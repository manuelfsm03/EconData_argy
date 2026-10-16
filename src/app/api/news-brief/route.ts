/**
 * /api/news-brief
 *
 * Sirve el "morning brief" pre-generado por el agente (Claude Haiku 4.5).
 * Los JSON los produce scripts/generate-news-brief.mjs y viven en public/data/.
 *
 * Uso:
 *   GET /api/news-brief                            → último brief disponible
 *   GET /api/news-brief?fecha=2026-09-24&corte=morning → brief específico
 *
 * Errores:
 *   404 → pedido específico no encontrado
 *   503 → todavía no se generó ningún brief
 */

import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const DATA_DIR = join(process.cwd(), "public", "data")
const FILE_RE = /^news-brief-(\d{4}-\d{2}-\d{2})-(morning|noon)\.json$/

// Prioridad relativa para ordenar dentro del mismo día.
const CORTE_ORDEN: Record<string, number> = { morning: 0, noon: 1 }

interface BriefFile {
  fecha: string
  corte: "morning" | "noon"
  filename: string
}

async function listarBriefs(): Promise<BriefFile[]> {
  let archivos: string[] = []
  try {
    archivos = await readdir(DATA_DIR)
  } catch {
    return []
  }
  const briefs: BriefFile[] = []
  for (const nombre of archivos) {
    const m = nombre.match(FILE_RE)
    if (!m) continue
    briefs.push({ fecha: m[1], corte: m[2] as "morning" | "noon", filename: nombre })
  }
  // Orden desc por (fecha, corte)
  briefs.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
    return CORTE_ORDEN[b.corte] - CORTE_ORDEN[a.corte]
  })
  return briefs
}

async function leerBrief(filename: string): Promise<unknown> {
  const contenido = await readFile(join(DATA_DIR, filename), "utf8")
  return JSON.parse(contenido)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const fechaPedida = params.get("fecha")
  const cortePedido = params.get("corte")

  const briefs = await listarBriefs()

  if (briefs.length === 0) {
    return NextResponse.json(
      {
        error: "sin_briefs",
        mensaje:
          "El agente todavía no generó ningún brief. Se genera 2 veces por día (07:00 y 12:00 AR).",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  let elegido: BriefFile | undefined

  if (fechaPedida || cortePedido) {
    elegido = briefs.find(
      (b) =>
        (!fechaPedida || b.fecha === fechaPedida) &&
        (!cortePedido || b.corte === cortePedido),
    )
    if (!elegido) {
      return NextResponse.json(
        { error: "no_encontrado", fecha: fechaPedida, corte: cortePedido },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      )
    }
  } else {
    elegido = briefs[0]
  }

  try {
    const data = await leerBrief(elegido.filename)
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        "X-Brief-File": elegido.filename,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "read_error", detalle: (err as Error).message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
