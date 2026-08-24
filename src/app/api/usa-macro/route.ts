import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

/**
 * /api/usa-macro — Indicadores macroeconómicos de EE.UU.
 *
 * Fuente: FRED (St. Louis Fed) CSV público — sin API key, sin registro.
 * URL patrón: https://fred.stlouisfed.org/graph/fredgraph.csv?id=SERIE
 *
 * Series incluidas:
 *   UNRATE   — Tasa de desempleo (%)
 *   CPIAUCSL — CPI (índice, base 1982-84=100) — para calcular inflación YoY
 *   M2SL     — Oferta monetaria M2 (miles de millones USD)
 *   DGS10    — Rendimiento del Treasury a 10 años (%)
 *   DGS2     — Rendimiento del Treasury a 2 años (%)
 *   UMCSENT  — Índice de Confianza del Consumidor U. Michigan
 *   ICSA     — Pedidos iniciales de seguro de desempleo (semanal)
 *   PAYEMS   — Nóminas no agrícolas (miles de personas)
 *
 * Datos actualizados: algunos diarios (DGS10), otros mensuales (UNRATE, CPI, M2).
 * TTL cache: 6 horas.
 */

export const runtime = "nodejs"

const CACHE_KEY = "usa-macro:fred"
const TTL_SEG = 6 * 3600

const FRED_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv?id="

interface FredSerie {
  id: string
  label: string
  unidad: string
  frecuencia: "diaria" | "semanal" | "mensual"
  nota?: string
}

const SERIES: FredSerie[] = [
  { id: "UNRATE",   label: "Desempleo",              unidad: "%",      frecuencia: "mensual" },
  { id: "CPIAUCSL", label: "CPI (all items)",        unidad: "índice", frecuencia: "mensual", nota: "base 1982-84=100" },
  { id: "M2SL",     label: "M2",                     unidad: "B USD",  frecuencia: "mensual" },
  { id: "DGS10",    label: "Treasury 10Y",           unidad: "%",      frecuencia: "diaria"  },
  { id: "DGS2",     label: "Treasury 2Y",            unidad: "%",      frecuencia: "diaria"  },
  { id: "T10Y2Y",   label: "Spread 10Y-2Y",          unidad: "%",      frecuencia: "diaria",  nota: "positivo = curva normal" },
  { id: "UMCSENT",  label: "Confianza consumidor",   unidad: "índice", frecuencia: "mensual", nota: "U. Michigan" },
  { id: "ICSA",     label: "Pedidos desempleo init.", unidad: "miles",  frecuencia: "semanal" },
  { id: "PAYEMS",   label: "Nóminas no agrícolas",   unidad: "miles",  frecuencia: "mensual" },
]

interface DatoSerie {
  id: string
  label: string
  unidad: string
  frecuencia: string
  valor: number | null
  fecha: string | null
  variacion_anterior: number | null
  nota?: string
}

async function fetchFredCsv(serie: FredSerie): Promise<DatoSerie> {
  const base: DatoSerie = {
    id: serie.id,
    label: serie.label,
    unidad: serie.unidad,
    frecuencia: serie.frecuencia,
    valor: null,
    fecha: null,
    variacion_anterior: null,
    nota: serie.nota,
  }

  try {
    const res = await fetch(`${FRED_BASE}${serie.id}`, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return base

    const text = await res.text()
    const lines = text.trim().split("\n").filter((l) => l.trim() && !l.startsWith("DATE"))
    if (lines.length < 2) return base

    // El CSV tiene dos columnas: DATE,VALUE
    // Tomamos los últimos 2 puntos para calcular variación
    const last = lines[lines.length - 1].split(",")
    const prev = lines[lines.length - 2].split(",")

    const valor = parseFloat(last[1] ?? "")
    const valorPrev = parseFloat(prev[1] ?? "")
    const fecha = last[0]?.trim() ?? null

    if (!Number.isFinite(valor)) return base

    return {
      ...base,
      valor: parseFloat(valor.toFixed(4)),
      fecha,
      variacion_anterior: Number.isFinite(valorPrev)
        ? parseFloat((valor - valorPrev).toFixed(4))
        : null,
    }
  } catch {
    return base
  }
}

export async function GET() {
  const cached = leerFresco<DatoSerie[]>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })
  }

  const resultados = await Promise.all(SERIES.map(fetchFredCsv))

  // Calcular inflación YoY desde CPI si está disponible
  const cpiRow = resultados.find((r) => r.id === "CPIAUCSL")
  let inflacion_yoy: number | null = null
  if (cpiRow?.valor != null) {
    try {
      const res = await fetch(`${FRED_BASE}CPIAUCSL`, {
        headers: { Accept: "text/csv" },
        signal: AbortSignal.timeout(12_000),
      })
      if (res.ok) {
        const text = await res.text()
        const lines = text.trim().split("\n").filter((l) => l.trim() && !l.startsWith("DATE"))
        if (lines.length >= 13) {
          const last = parseFloat(lines[lines.length - 1].split(",")[1] ?? "")
          const yearAgo = parseFloat(lines[lines.length - 13].split(",")[1] ?? "")
          if (Number.isFinite(last) && Number.isFinite(yearAgo) && yearAgo > 0) {
            inflacion_yoy = parseFloat(((last / yearAgo - 1) * 100).toFixed(2))
          }
        }
      }
    } catch { /* ignorar */ }
  }

  const data = resultados.map((r) =>
    r.id === "CPIAUCSL" ? { ...r, inflacion_yoy } : r,
  )

  const vivosOk = data.filter((r) => r.valor != null).length
  if (vivosOk >= 3) guardarExito(CACHE_KEY, data, TTL_SEG)

  return NextResponse.json({
    data,
    cached: false,
    updated_at: new Date().toISOString(),
    fuente: "FRED — St. Louis Fed (CSV público sin key)",
  })
}
