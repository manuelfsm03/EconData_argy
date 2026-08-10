import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import {
  deriveForumIdentity,
  ForumConfigurationError,
  getTrustedClientIp,
  requireForumRateLimitSecret,
} from "@/server/forum/forum-policy"

const VALID_EMOJIS = ["👍", "🔥", "🤔"] as const
type Emoji = (typeof VALID_EMOJIS)[number]

function isValidEmoji(value: string): value is Emoji {
  return (VALID_EMOJIS as readonly string[]).includes(value)
}

export async function POST(request: NextRequest) {
  let body: { postId?: unknown; emoji?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const postId = typeof body.postId === "string" ? body.postId : ""
  const emoji = typeof body.emoji === "string" ? body.emoji : ""
  if (!postId) return NextResponse.json({ error: "postId requerido" }, { status: 400 })
  if (!isValidEmoji(emoji)) return NextResponse.json({ error: "emoji inválido" }, { status: 400 })

  const trustedIp = getTrustedClientIp(request.headers)
  if (!trustedIp) {
    return NextResponse.json({ error: "No se pudo validar la identidad de red" }, { status: 503 })
  }

  let identityToken: string
  try {
    identityToken = deriveForumIdentity(trustedIp, requireForumRateLimitSecret())
  } catch (error) {
    if (error instanceof ForumConfigurationError) {
      return NextResponse.json({ error: "Foro temporalmente no disponible" }, { status: 503 })
    }
    throw error
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const post = await tx.forumPost.findUnique({ where: { id: postId }, select: { id: true } })
      if (!post) return null

      const existing = await tx.forumReaction.findUnique({
        where: { postId_identityToken: { postId, identityToken } },
      })

      let miReaccion: string | null
      if (existing?.emoji === emoji) {
        await tx.forumReaction.delete({ where: { id: existing.id } })
        miReaccion = null
      } else if (existing) {
        await tx.forumReaction.update({ where: { id: existing.id }, data: { emoji } })
        miReaccion = emoji
      } else {
        await tx.forumReaction.create({ data: { postId, emoji, identityToken } })
        miReaccion = emoji
      }

      const grouped = await tx.forumReaction.groupBy({
        by: ["emoji"],
        where: { postId },
        _count: { id: true },
      })
      return {
        miReaccion,
        reacciones: Object.fromEntries(grouped.map(row => [row.emoji, row._count.id])),
      }
    })

    if (!result) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[/api/foro/react] POST", error)
    return NextResponse.json({ error: "Error al procesar la reacción" }, { status: 500 })
  }
}
