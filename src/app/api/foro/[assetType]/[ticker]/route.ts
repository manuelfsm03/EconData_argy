/**
 * /api/foro/[assetType]/[ticker] — Foro por activo
 *
 * Hilo único cronológico por (assetType, assetTicker), sin autenticación.
 * assetType: "accion" | "bono" | "cap" | "variable"
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import {
  deriveForumIdentity,
  FORUM_PAGE_SIZE,
  ForumConfigurationError,
  getTrustedClientIp,
  normalizeForumTicker,
  normalizeForumVariable,
  requireForumRateLimitSecret,
} from "@/server/forum/forum-policy"
import {
  createForumPostAtomic,
  ForumParentScopeError,
  ForumRateLimitError,
} from "@/server/forum/forum-service"

const VALID_ASSET_TYPES = ["accion", "bono", "cap", "variable"] as const
type AssetType = (typeof VALID_ASSET_TYPES)[number]

function isValidAssetType(value: string): value is AssetType {
  return (VALID_ASSET_TYPES as readonly string[]).includes(value)
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)))
}

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
  const assetTicker = assetType === "variable" ? normalizeForumVariable(ticker) : normalizeForumTicker(ticker)
  if (!assetTicker) {
    return NextResponse.json({ error: "ticker inválido" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const page = boundedInteger(searchParams.get("page"), 1, 1, 1_000_000)
  const pageSize = boundedInteger(searchParams.get("pageSize"), FORUM_PAGE_SIZE, 1, 50)

  try {
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { assetType, assetTicker },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, authorName: true, content: true, parentId: true, createdAt: true },
      }),
      prisma.forumPost.count({ where: { assetType, assetTicker } }),
    ])

    return NextResponse.json({
      data: posts,
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
  const assetTicker = assetType === "variable" ? normalizeForumVariable(ticker) : normalizeForumTicker(ticker)
  if (!assetTicker) {
    return NextResponse.json({ error: "ticker inválido" }, { status: 400 })
  }

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

  const trustedIp = getTrustedClientIp(request.headers)
  if (!trustedIp) {
    return NextResponse.json({ error: "No se pudo validar la identidad de red" }, { status: 503 })
  }

  let identityToken: string
  try {
    identityToken = deriveForumIdentity(trustedIp, requireForumRateLimitSecret())
  } catch (error) {
    if (error instanceof ForumConfigurationError) {
      console.error("[/api/foro] POST configuración de rate limit ausente")
      return NextResponse.json({ error: "Foro temporalmente no disponible" }, { status: 503 })
    }
    throw error
  }

  try {
    const created = await createForumPostAtomic(prisma, {
      assetType,
      assetTicker,
      authorName,
      content,
      parentId,
      identityToken,
    })

    return NextResponse.json({
      data: created.post,
      total: created.total,
      totalPages: created.totalPages,
      page: created.totalPages,
      pageSize: FORUM_PAGE_SIZE,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ForumRateLimitError) {
      return NextResponse.json({ error: "Estás posteando muy rápido, esperá unos segundos" }, { status: 429 })
    }
    if (error instanceof ForumParentScopeError) {
      return NextResponse.json({ error: "El post citado no pertenece a este activo" }, { status: 400 })
    }
    console.error("[/api/foro] POST", error)
    return NextResponse.json({ error: "Error al crear el post" }, { status: 500 })
  }
}
