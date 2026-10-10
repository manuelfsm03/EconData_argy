/**
 * /api/provincias/empleo — Puestos de trabajo registrados por provincia
 *
 * Sirve el asset pre-calculado public/data/empleo-provincias.json que genera
 * scripts/update-empleo-provincias.mjs (GitHub Actions, 1ro de cada mes).
 * Cero llamadas externas en runtime — el dato vive en el repo como JSON estático.
 *
 * Fuente original: OEDE / Ministerio de Trabajo — SIPA (AFIP)
 * Frecuencia: mensual, rezago ~2 meses
 */

import { NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-static"
export const revalidate = 86_400 // 24h: el dato cambia mensualmente

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const provincia = searchParams.get("provincia") // filtro opcional por id

  try {
    const raw = readFileSync(join(process.cwd(), "public", "data", "empleo-provincias.json"), "utf8")
    const data = JSON.parse(raw)

    if (data.total_provincias === 0) {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Asset no generado aún — correr scripts/update-empleo-provincias.mjs", retryable: false } },
        { status: 503 },
      )
    }

    if (provincia) {
      const prov = data.provincias.find((p: { id: string }) => p.id === provincia)
      if (!prov) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Provincia ${provincia} no encontrada` } },
          { status: 404 },
        )
      }
      return NextResponse.json({ data: prov, meta: { fuente: data.fuente, cobertura: data.cobertura } })
    }

    // Sin filtro: devolver snapshot (sin series largas para no inflar la respuesta)
    const snapshot = data.provincias.map((p: {
      id: string; nombre: string; ultimo_periodo: string; ultimo_valor: number; variacion_interanual: number | null
    }) => ({
      id: p.id,
      nombre: p.nombre,
      ultimo_periodo: p.ultimo_periodo,
      ultimo_valor: p.ultimo_valor,
      variacion_interanual: p.variacion_interanual,
    }))

    return NextResponse.json({
      data: snapshot,
      meta: {
        fuente: data.fuente,
        cobertura: data.cobertura,
        generado_en: data.generado_en,
        total: data.total_provincias,
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer datos de empleo provincial", retryable: true } },
      { status: 500 },
    )
  }
}
