/**
 * /api/provincias/establecimientos — Establecimientos productivos por provincia
 *
 * Sirve public/data/establecimientos-provincias.json generado por
 * scripts/update-establecimientos-provincias.mjs (GitHub Actions, 1ro de cada mes).
 * Cero llamadas externas en runtime.
 *
 * Fuente: CEP XXI / Secretaría de Industria — distribución geográfica de establecimientos
 * Cobertura: 24 jurisdicciones, 2021-2022, establecimientos únicos por CUIT
 */

import { NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-static"
export const revalidate = 86_400

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const provincia = searchParams.get("provincia")
  const anio = searchParams.get("anio") ? Number(searchParams.get("anio")) : null

  try {
    const raw = readFileSync(join(process.cwd(), "public", "data", "establecimientos-provincias.json"), "utf8")
    const data = JSON.parse(raw)

    if (data.total_provincias === 0) {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Correr scripts/update-establecimientos-provincias.mjs", retryable: false } },
        { status: 503 },
      )
    }

    const meta = { fuente: data.fuente, unidad: data.unidad, cobertura: data.cobertura, generado_en: data.generado_en }

    if (provincia) {
      const prov = data.provincias.find((p: { id: string }) => p.id === provincia)
      if (!prov) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
      return NextResponse.json({ data: prov, meta })
    }

    if (anio) {
      const snapshot = data.provincias.map((p: {
        id: string; nombre: string; series: { anio: number; establecimientos: number; sucursales: number }[]
      }) => {
        const entry = p.series?.find(s => s.anio === anio)
        return { id: p.id, nombre: p.nombre, establecimientos: entry?.establecimientos ?? null, sucursales: entry?.sucursales ?? null }
      })
      return NextResponse.json({ data: snapshot, meta: { ...meta, anio } })
    }

    // Default: último valor por provincia
    const snapshot = data.provincias.map((p: {
      id: string; nombre: string; ultimo_anio: number; ultimo_valor: number; series: { anio: number; establecimientos: number }[]
    }) => ({
      id: p.id,
      nombre: p.nombre,
      ultimo_periodo: String(p.ultimo_anio),
      ultimo_valor: p.ultimo_valor,
    }))

    return NextResponse.json({ data: snapshot, meta })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer datos de establecimientos provinciales", retryable: true } },
      { status: 500 },
    )
  }
}
