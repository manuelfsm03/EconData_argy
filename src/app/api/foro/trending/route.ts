/**
 * GET /api/foro/trending
 *
 * Devuelve los activos con más posts en las últimas N horas.
 * ?hours=24  (default 24)
 * ?limit=5   (default 5, max 20)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hours = Math.min(168, Math.max(1, Number(searchParams.get("hours")) || 24))
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 5))

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
      data: rows.map(r => ({
        assetType: r.assetType,
        ticker: r.assetTicker,
        posts: r._count.id,
      })),
      hours,
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[/api/foro/trending] GET", error)
    return NextResponse.json({ error: "Error al obtener trending" }, { status: 500 })
  }
}
