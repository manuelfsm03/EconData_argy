/**
 * GET /api/foro/counts
 *
 * Conteo de posts por activo, para mostrar un badge 💬N en las tablas
 * sin abrir el panel de cada uno. Una sola llamada, payload chico.
 *
 * ?assetType=accion  (opcional) → filtra a un solo tipo
 *
 * Respuesta: { counts: { "accion:GGAL": 3, "bono:AL29": 5 }, updated_at }
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const VALID_ASSET_TYPES = ["accion", "bono", "cap"]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const assetType = searchParams.get("assetType")
  const where = assetType && VALID_ASSET_TYPES.includes(assetType) ? { assetType } : undefined

  try {
    const rows = await prisma.forumPost.groupBy({
      by: ["assetType", "assetTicker"],
      where,
      _count: { id: true },
    })

    const counts: Record<string, number> = {}
    for (const r of rows) {
      counts[`${r.assetType}:${r.assetTicker}`] = r._count.id
    }

    return NextResponse.json({ counts, updated_at: new Date().toISOString() })
  } catch (error) {
    console.error("[/api/foro/counts] GET", error)
    return NextResponse.json({ error: "Error al obtener conteos" }, { status: 500 })
  }
}
