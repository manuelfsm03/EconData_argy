import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

const VALID_ASSET_TYPES = ["accion", "bono", "cap", "variable"] as const

export async function GET(request: NextRequest) {
  const requestedType = new URL(request.url).searchParams.get("assetType")
  const assetType = requestedType && (VALID_ASSET_TYPES as readonly string[]).includes(requestedType)
    ? requestedType
    : null

  try {
    const rows = await prisma.forumPost.groupBy({
      by: ["assetType", "assetTicker"],
      where: assetType ? { assetType } : undefined,
      _count: { id: true },
    })
    const counts = Object.fromEntries(
      rows.map(row => [`${row.assetType}:${row.assetTicker}`, row._count.id]),
    )
    return NextResponse.json({ counts, updated_at: new Date().toISOString() })
  } catch (error) {
    console.error("[/api/foro/counts] GET", error)
    return NextResponse.json({ error: "Error al obtener conteos" }, { status: 500 })
  }
}
