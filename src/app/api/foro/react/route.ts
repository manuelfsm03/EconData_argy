/**
 * POST /api/foro/react
 *
 * Toggle de reacción emoji sobre un post. Si la IP ya tiene ese emoji en ese post, lo elimina.
 * Body: { postId: string, emoji: "👍" | "🔥" | "🤔" }
 * Respuesta: { reacciones: Record<string, number>, miReaccion: string | null }
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_EMOJIS = ["👍", "🔥", "🤔"] as const
type Emoji = (typeof VALID_EMOJIS)[number]

function isValidEmoji(v: string): v is Emoji {
  return (VALID_EMOJIS as readonly string[]).includes(v)
}

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
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

  const ip = getClientIp(request)

  try {
    // Verificar que el post existe
    const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { id: true } })
    if (!post) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 })

    // Toggle: si ya existe esta reacción de esta IP, la elimina; si no, la crea
    const existing = await prisma.forumReaction.findUnique({
      where: { postId_authorIp_emoji: { postId, authorIp: ip, emoji } },
    })

    if (existing) {
      await prisma.forumReaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.forumReaction.create({ data: { postId, emoji, authorIp: ip } })
    }

    // Devolver conteos actualizados y reacción activa de esta IP
    const [allReactions, myReaction] = await Promise.all([
      prisma.forumReaction.findMany({ where: { postId }, select: { emoji: true } }),
      prisma.forumReaction.findFirst({ where: { postId, authorIp: ip }, select: { emoji: true } }),
    ])

    const reacciones: Record<string, number> = {}
    for (const r of allReactions) {
      reacciones[r.emoji] = (reacciones[r.emoji] ?? 0) + 1
    }

    return NextResponse.json({ reacciones, miReaccion: myReaction?.emoji ?? null })
  } catch (error) {
    console.error("[/api/foro/react] POST", error)
    return NextResponse.json({ error: "Error al procesar la reacción" }, { status: 500 })
  }
}
