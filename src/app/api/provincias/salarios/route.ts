/**
 * /api/provincias/salarios — Salario promedio sector privado por provincia
 *
 * Sirve public/data/salarios-provincias.json generado por
 * scripts/update-salarios-provincias.mjs (GitHub Actions, 1ro de cada mes).
 * Cero llamadas externas en runtime.
 *
 * Fuente: OEDE — Ministerio de Trabajo / SIPA-AFIP
 * Cobertura: 24 jurisdicciones, mensual 2007-presente, pesos corrientes
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
    const raw = readFileSync(join(process.cwd(), "public", "data", "salarios-provincias.json"), "utf8")
    const data = JSON.parse(raw)

    if (data.total_provincias === 0) {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Correr scripts/update-salarios-provincias.mjs", retryable: false } },
        { status: 503 },
      )
    }

    const meta = { fuente: data.fuente, unidad: data.unidad, cobertura: data.cobertura, generado_en: data.generado_en }

    if (provincia) {
      const prov = data.provincias.find((p: { id: string }) => p.id === provincia)
      if (!prov) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
      return NextResponse.json({ data: prov, meta })
    }

    if (periodo) {
      const snapshot = data.provincias.map((p: {
        id: string; nombre: string; series: { periodo: string; salario: number }[]
      }) => ({
        id: p.id,
        nombre: p.nombre,
        salario: p.series?.find(d => d.periodo === periodo)?.salario ?? null,
      }))
      return NextResponse.json({ data: snapshot, meta: { ...meta, periodo } })
    }

    // Default: último valor por provincia
    const snapshot = data.provincias.map((p: {
      id: string; nombre: string; ultimo_periodo: string; ultimo_valor: number; variacion_interanual: number | null
    }) => ({
      id: p.id,
      nombre: p.nombre,
      ultimo_periodo: p.ultimo_periodo,
      salario: p.ultimo_valor,
      variacion_interanual: p.variacion_interanual,
    }))

    return NextResponse.json({ data: snapshot, meta })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer datos de salarios provinciales", retryable: true } },
      { status: 500 },
    )
  }
}
