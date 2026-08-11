import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hours = boundedInteger(searchParams.get("hours"), 24, 1, 168)
  const limit = boundedInteger(searchParams.get("limit"), 5, 1, 20)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  try {
    const rows = await prisma.forumPost.groupBy({
      by: ["assetType", "assetTicker"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    })
    return NextResponse.json({
      data: rows.map(row => ({
        assetType: row.assetType,
        ticker: row.assetTicker,
        posts: row._count.id,
      })),
      hours,
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[/api/foro/trending] GET", error)
    return NextResponse.json({ error: "Error al obtener trending" }, { status: 500 })
  }
}
