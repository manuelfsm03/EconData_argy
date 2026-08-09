import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { normalizeForumSearch, normalizeForumVariable } from "@/server/forum/forum-policy"

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = normalizeForumSearch(searchParams.get("q"))
  const requestedTag = searchParams.get("tag")
  const tag = requestedTag ? normalizeForumVariable(requestedTag) : null
  const page = boundedInteger(searchParams.get("page"), 1, 1, 1_000_000)
  const pageSize = boundedInteger(searchParams.get("pageSize"), 30, 1, 50)

  if (requestedTag && !tag) {
    return NextResponse.json({ error: "tag inválido" }, { status: 400 })
  }

  const where = {
    ...(tag ? { assetTicker: tag } : {}),
    ...(query ? {
      OR: [
        { content: { contains: query, mode: "insensitive" as const } },
        { authorName: { contains: query, mode: "insensitive" as const } },
        { assetTicker: { contains: query.toUpperCase(), mode: "insensitive" as const } },
      ],
    } : {}),
  }

  try {
    const [posts, total, conversations] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          assetType: true,
          assetTicker: true,
          authorName: true,
          content: true,
          parentId: true,
          createdAt: true,
        },
      }),
      prisma.forumPost.count({ where }),
      prisma.forumPost.groupBy({
        by: ["assetType", "assetTicker"],
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
        take: 60,
      }),
    ])

    return NextResponse.json({
      data: posts,
      conversations: conversations.map((conversation) => ({
        assetType: conversation.assetType,
        tag: conversation.assetTicker,
        messages: conversation._count._all,
        lastActivity: conversation._max.createdAt,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[/api/foro] GET global", error)
    return NextResponse.json({ error: "Error al obtener conversaciones" }, { status: 500 })
  }
}
