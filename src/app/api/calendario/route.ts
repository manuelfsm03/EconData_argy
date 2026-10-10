/**
 * GET /api/calendario — devuelve el catálogo del Calendario Financiero.
 *
 * Query params (todos opcionales):
 *   - desde=YYYY-MM-DD      fecha mínima (inclusive)
 *   - hasta=YYYY-MM-DD      fecha máxima (inclusive)
 *   - categoria=<slug>      filtra por categoría (repetible → CSV o multi)
 *   - solo_alta=1           solo importancia = "alta"
 *   - futuras=1             solo eventos con fecha >= hoy AR
 *
 * Cache: el catálogo es estático (JSON en disco); usamos revalidate 1 día
 * y cache en memoria del loader para evitar leer el archivo por request.
 * (No force-static porque los searchParams lo vuelven dinámico.)
 */

import { NextRequest, NextResponse } from "next/server"
import { cargarCatalogo } from "@/server/calendario-loader"
import {
  filtrarEventos,
  hoyISO,
  ordenarPorFecha,
  type CategoriaEvento,
} from "@/lib/calendario-financiero"

export const revalidate = 86400  // 1 día

const CATEGORIAS_VALIDAS: CategoriaEvento[] = [
  "licitacion", "publicacion_datos", "vencimiento_tesoro", "earnings", "feriado", "otro",
]

function parseCategorias(raw: string | null): CategoriaEvento[] | undefined {
  if (!raw) return undefined
  const partes = raw.split(",").map((s) => s.trim()).filter(Boolean)
  const cats = partes.filter((p): p is CategoriaEvento =>
    (CATEGORIAS_VALIDAS as string[]).includes(p),
  )
  return cats.length > 0 ? cats : undefined
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const desdeParam = searchParams.get("desde")
  const hastaParam = searchParams.get("hasta")
  const categoriaParam = parseCategorias(searchParams.get("categoria"))
  const soloAlta = searchParams.get("solo_alta") === "1"
  const soloFuturas = searchParams.get("futuras") === "1"

  const catalogo = await cargarCatalogo()
  const hoy = hoyISO()

  const desde = desdeParam ?? (soloFuturas ? hoy : undefined)
  const eventos = ordenarPorFecha(
    filtrarEventos(catalogo.eventos, {
      desde,
      hasta: hastaParam ?? undefined,
      categoria: categoriaParam,
      soloAlta,
    }),
  )

  return NextResponse.json({
    data: eventos,
    count: eventos.length,
    total_en_catalogo: catalogo.eventos.length,
    actualizado: catalogo.actualizado,
    cobertura: catalogo.cobertura,
    nota: catalogo.nota,
    hoy_ar: hoy,
    filtros: {
      desde: desde ?? null,
      hasta: hastaParam ?? null,
      categoria: categoriaParam ?? null,
      solo_alta: soloAlta,
      futuras: soloFuturas,
    },
  })
}
