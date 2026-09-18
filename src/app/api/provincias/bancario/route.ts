/**
 * /api/provincias/bancario — Participación bancaria por provincia (BCRA locser)
 *
 * Sirve public/data/bancario-provincias.json generado por
 * scripts/update-bancario-provincias.mjs (GitHub Actions, 1ro de cada mes).
 * Cero llamadas externas en runtime.
 *
 * Fuente: BCRA — Gerencia de Estadísticas Monetarias
 * Cobertura: 24 jurisdicciones, trimestral 1990-presente, % del total nacional
 * Métricas: prestamos_privados_ars, depositos_privados_ars
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
  const periodo = searchParams.get("periodo")

  try {
    const raw = readFileSync(join(process.cwd(), "public", "data", "bancario-provincias.json"), "utf8")
    const data = JSON.parse(raw)

    if (data.total_provincias === 0) {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Correr scripts/update-bancario-provincias.mjs", retryable: false } },
        { status: 503 },
      )
    }

    const meta = {
      fuente: data.fuente,
      unidad: data.unidad,
      metricas: data.metricas,
      cobertura: data.cobertura,
      generado_en: data.generado_en,
    }

    if (provincia) {
      const prov = data.provincias.find((p: { id: string }) => p.id === provincia)
      if (!prov) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
      return NextResponse.json({ data: prov, meta })
    }

    if (periodo) {
      // Snapshot de un trimestre: todas las provincias con sus valores para ese periodo
      const snapshot = data.provincias.map((p: {
        id: string; nombre: string;
        prestamos_privados_ars: { series: { periodo: string; valor: number }[] };
        depositos_privados_ars: { series: { periodo: string; valor: number }[] };
      }) => {
        const get = (metrica: "prestamos_privados_ars" | "depositos_privados_ars") =>
          p[metrica]?.series?.find((d) => d.periodo === periodo)?.valor ?? null
        return {
          id: p.id, nombre: p.nombre,
          prestamos_privados_ars: get("prestamos_privados_ars"),
          depositos_privados_ars: get("depositos_privados_ars"),
        }
      })
      return NextResponse.json({ data: snapshot, meta: { ...meta, periodo } })
    }

    // Default: último valor por provincia
    const snapshot = data.provincias.map((p: {
      id: string; nombre: string;
      prestamos_privados_ars: { ultimo_periodo: string; ultimo_valor: number };
      depositos_privados_ars: { ultimo_periodo: string; ultimo_valor: number };
    }) => ({
      id: p.id,
      nombre: p.nombre,
      ultimo_periodo: p.depositos_privados_ars?.ultimo_periodo,
      prestamos_privados_ars: p.prestamos_privados_ars?.ultimo_valor,
      depositos_privados_ars: p.depositos_privados_ars?.ultimo_valor,
    }))

    return NextResponse.json({ data: snapshot, meta })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer datos bancarios provinciales", retryable: true } },
      { status: 500 },
    )
  }
}
