/**
 * /api/provincias/fiscal — Ejecución presupuestaria por provincia
 *
 * Sirve public/data/fiscal-provincias.json generado por
 * scripts/update-fiscal-provincias.mjs (GitHub Actions, 1ro de cada mes).
 * Cero llamadas externas en runtime.
 *
 * Fuente: Secretaría de Hacienda — Dir. Nacional de Asuntos Provinciales
 * Cobertura: 24 jurisdicciones, acumulado anual 2005-2025, millones de $
 * Indicadores: ingresos, coparticipación, gastos, resultado primario y financiero
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
    const raw = readFileSync(join(process.cwd(), "public", "data", "fiscal-provincias.json"), "utf8")
    const data = JSON.parse(raw)

    if (data.total_provincias === 0) {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Correr scripts/update-fiscal-provincias.mjs", retryable: false } },
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
      // Snapshot de un año: todas las provincias con sus indicadores para ese año
      const snapshot = data.provincias.map((p: {
        id: string; nombre: string; series: Record<string, { anio: number; valor: number | null }[]>
      }) => {
        const get = (serie: string) => p.series[serie]?.find((d: { anio: number }) => d.anio === anio)?.valor ?? null
        return {
          id: p.id, nombre: p.nombre,
          ingresos_totales: get("ingresos_totales"),
          gastos_totales: get("gastos_totales"),
          resultado_financiero: get("resultado_financiero"),
          resultado_primario: get("resultado_primario"),
          coparticipacion: get("coparticipacion"),
        }
      })
      return NextResponse.json({ data: snapshot, meta: { ...meta, anio } })
    }

    // Default: snapshot del último año de cada provincia
    const snapshot = data.provincias.map((p: {
      id: string; nombre: string; ultimo_anio: number; ultimo_resultado_financiero: number | null; ultimo_ingresos_totales: number | null
    }) => ({
      id: p.id, nombre: p.nombre,
      ultimo_anio: p.ultimo_anio,
      resultado_financiero: p.ultimo_resultado_financiero,
      ingresos_totales: p.ultimo_ingresos_totales,
    }))

    return NextResponse.json({ data: snapshot, meta })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer datos fiscales provinciales", retryable: true } },
      { status: 500 },
    )
  }
}
