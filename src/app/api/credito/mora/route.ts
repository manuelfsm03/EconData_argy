/**
 * /api/credito/mora — Irregularidad del crédito al sector privado (BCRA)
 *
 * Sirve public/data/mora-bcra.json generado por scripts/update-mora-bcra.ts
 * (GitHub Actions, mensual). Cero llamadas externas en runtime.
 * Series: total_privado, familias, empresas (% de cartera irregular, mensual).
 *
 * Query: ?serie=familias|empresas|total_privado  ?desde=YYYY-MM
 * Si el JSON todavía no existe (primera corrida pendiente) responde 503;
 * si la última actualización falló, devuelve el dato previo con meta.estado.
 */

import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SERIES = ["total_privado", "familias", "empresas"] as const

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const serie = searchParams.get("serie")
  const desde = searchParams.get("desde")

  if (serie && !(SERIES as readonly string[]).includes(serie)) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "serie inválida", retryable: false } }, { status: 400 })
  }
  if (desde && !/^\d{4}-\d{2}$/.test(desde)) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "desde debe ser YYYY-MM", retryable: false } }, { status: 400 })
  }

  const file = join(process.cwd(), "public", "data", "mora-bcra.json")
  if (!existsSync(file)) {
    return NextResponse.json(
      { error: { code: "DATA_NOT_READY", message: "Pendiente primera corrida del workflow Actualizar mora BCRA", retryable: false } },
      { status: 503 },
    )
  }

  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as {
      estado: string; fuente: string; url_fuente: string; unidad: string; frecuencia: string
      cobertura: unknown; generado_en: string; ultimo_error?: unknown
      series: Record<string, { periodo: string; valor: number }[]>
    }
    const nombres = serie ? [serie] : SERIES
    const series: Record<string, { periodo: string; valor: number }[]> = {}
    for (const n of nombres) {
      const s = data.series[n]
      if (s) series[n] = desde ? s.filter((p) => p.periodo >= desde) : s
    }
    return NextResponse.json({
      data: series,
      meta: {
        estado: data.estado,
        fuente: data.fuente,
        url_fuente: data.url_fuente,
        unidad: data.unidad,
        frecuencia: data.frecuencia,
        cobertura: data.cobertura,
        generado_en: data.generado_en,
        ...(data.ultimo_error ? { ultimo_error: data.ultimo_error } : {}),
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer mora-bcra.json", retryable: true } },
      { status: 500 },
    )
  }
}
