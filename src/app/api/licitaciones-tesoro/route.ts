/**
 * /api/licitaciones-tesoro — Resultados de las licitaciones del Tesoro
 *
 * Sirve public/data/licitaciones-tesoro.json generado por
 * scripts/update-licitaciones-tesoro.ts (GitHub Actions, semanal). Cero llamadas
 * externas en runtime. Si el JSON todavía no existe responde 503 (no hay datos
 * mockeados).
 *
 * Fuente: Secretaría de Finanzas — Ministerio de Economía.
 * Query: ?desde=YYYY-MM-DD & ?limite=N (más recientes primero).
 */

import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde")
  const limite = Number(searchParams.get("limite") ?? 0)

  const file = join(process.cwd(), "public", "data", "licitaciones-tesoro.json")
  if (!existsSync(file)) {
    return NextResponse.json(
      { error: { code: "DATA_NOT_READY", message: "Correr scripts/update-licitaciones-tesoro.ts (workflow update-licitaciones-tesoro)", retryable: false } },
      { status: 503 },
    )
  }

  try {
    const data = JSON.parse(readFileSync(file, "utf8"))
    let licitaciones: { fecha: string }[] = data.licitaciones ?? []
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) licitaciones = licitaciones.filter((l) => l.fecha >= desde)
    if (Number.isInteger(limite) && limite > 0) licitaciones = licitaciones.slice(0, limite)
    return NextResponse.json({
      data: licitaciones,
      meta: { fuente: data.fuente, unidad: data.unidad, cobertura: data.cobertura, generado_en: data.generado_en },
    })
  } catch {
    return NextResponse.json({ error: { code: "DATA_CORRUPT", retryable: false } }, { status: 500 })
  }
}
