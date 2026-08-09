/**
 * /api/foro/[assetType]/[ticker] — Foro por activo
 *
 * Hilo único cronológico por (assetType, assetTicker), sin autenticación.
 * assetType: "accion" | "bono" | "cap"
 *
 * GET  ?page=1&pageSize=20  → posts en orden ascendente (más viejo primero, como foro.rava.com)
 * POST { authorName, content, parentId? } → crea un post nuevo
 */

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const VALID_ASSET_TYPES = ["accion", "bono", "cap"] as const
type AssetType = (typeof VALID_ASSET_TYPES)[number]

function isValidAssetType(v: string): v is AssetType {
  return (VALID_ASSET_TYPES as readonly string[]).includes(v)
}

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

const RATE_LIMIT_SECONDS = 20
const MAX_AUTHOR_LEN = 40
const MIN_AUTHOR_LEN = 2
const MAX_CONTENT_LEN = 2000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetType: string; ticker: string }> }
) {
  const { assetType, ticker } = await params

  if (!isValidAssetType(assetType)) {
    return NextResponse.json({ error: "assetType inválido" }, { status: 400 })
  }

  const assetTicker = ticker.toUpperCase()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20))
  const q = (searchParams.get("q") ?? "").trim()
  const sort = searchParams.get("sort") === "votados" ? "votados" : "cron"

  const ip = getClientIp(request)

  // Filtro base + búsqueda opcional por contenido o autor (LIKE, case-insensitive en SQLite ASCII)
  const where: Prisma.ForumPostWhereInput = { assetType, assetTicker }
  if (q) {
    where.OR = [
      { content: { contains: q } },
      { authorName: { contains: q } },
    ]
  }

  // Orden: cronológico (más viejo primero, como foro.rava.com) o por más reaccionados
  const orderBy: Prisma.ForumPostOrderByWithRelationInput[] =
    sort === "votados"
      ? [{ reactions: { _count: "desc" } }, { createdAt: "asc" }]
      : [{ createdAt: "asc" }]

  try {
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          authorName: true,
          content: true,
          parentId: true,
          createdAt: true,
          reactions: { select: { emoji: true, authorIp: true } },
        },
      }),
      prisma.forumPost.count({ where }),
    ])

    const data = posts.map(({ reactions, ...post }) => {
      const reacciones: Record<string, number> = {}
      let miReaccion: string | null = null
      for (const r of reactions) {
        reacciones[r.emoji] = (reacciones[r.emoji] ?? 0) + 1
        if (r.authorIp === ip) miReaccion = r.emoji
      }
      return { ...post, reacciones, miReaccion }
    })

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[/api/foro] GET", error)
    return NextResponse.json({ error: "Error al obtener posts" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetType: string; ticker: string }> }
) {
  const { assetType, ticker } = await params

  if (!isValidAssetType(assetType)) {
    return NextResponse.json({ error: "assetType inválido" }, { status: 400 })
  }

  const assetTicker = ticker.toUpperCase()

  let body: { authorName?: unknown; content?: unknown; parentId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const parentId = typeof body.parentId === "string" && body.parentId.length > 0 ? body.parentId : null

  if (authorName.length < MIN_AUTHOR_LEN || authorName.length > MAX_AUTHOR_LEN) {
    return NextResponse.json({ error: `El nombre debe tener entre ${MIN_AUTHOR_LEN} y ${MAX_AUTHOR_LEN} caracteres` }, { status: 400 })
  }
  if (content.length < 1 || content.length > MAX_CONTENT_LEN) {
    return NextResponse.json({ error: `El mensaje debe tener entre 1 y ${MAX_CONTENT_LEN} caracteres` }, { status: 400 })
  }

  const ip = getClientIp(request)

  try {
    const lastFromIp = await prisma.forumPost.findFirst({
      where: { authorIp: ip },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (lastFromIp && Date.now() - lastFromIp.createdAt.getTime() < RATE_LIMIT_SECONDS * 1000) {
      return NextResponse.json({ error: "Estás posteando muy rápido, esperá unos segundos" }, { status: 429 })
    }

    if (parentId) {
      const parent = await prisma.forumPost.findFirst({ where: { id: parentId, assetType, assetTicker }, select: { id: true } })
      if (!parent) {
        return NextResponse.json({ error: "El post citado no existe" }, { status: 400 })
      }
    }

    const post = await prisma.forumPost.create({
      data: { assetType, assetTicker, authorName, content, parentId, authorIp: ip },
      select: { id: true, authorName: true, content: true, parentId: true, createdAt: true },
    })

    return NextResponse.json({ data: post }, { status: 201 })
  } catch (error) {
    console.error("[/api/foro] POST", error)
    return NextResponse.json({ error: "Error al crear el post" }, { status: 500 })
  }
}
