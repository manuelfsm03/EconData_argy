import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/senoraje — Señoreaje e inflación (modelo Cagan + Curva de Laffer)
 *
 * Metodología:
 *  1. Base Monetaria (BCRA API var 15, diaria) → último valor de cada mes
 *  2. IPC mensual (datos.gob.ar, decimal) → π_t
 *  3. Índice de precios acumulado: P_t = ∏(1 + π_i)
 *  4. Saldos reales: (M/P)_t = BM_t / P_t
 *  5. Señoreaje mensual: S_t = π_t × (M/P)_t
 *  6. Agregación anual + OLS Cagan: ln(M/P) = ln(k) - α·π
 *  7. Curva de Laffer teórica: S(π) = π × k × exp(-α × π), π* = 1/α
 *  8. Estimación 2026: parcial + proyección anual
 */

import { NextResponse } from "next/server"
import { bcraOfficialApi } from "@/server/sources/bcra-official-api"

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache: { data: unknown; expiry: number } | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function ymKey(fecha: string): string {
  return fecha.slice(0, 7) // "YYYY-MM"
}

/** OLS lineal simple: y = a + b·x → {a, b, r2} */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length
  if (n < 2) return { a: 0, b: 0, r2: 0 }
  const xBar = xs.reduce((s, v) => s + v, 0) / n
  const yBar = ys.reduce((s, v) => s + v, 0) / n
  const covXY = xs.reduce((s, v, i) => s + (v - xBar) * (ys[i] - yBar), 0)
  const varX  = xs.reduce((s, v) => s + (v - xBar) ** 2, 0)
  if (varX === 0) return { a: yBar, b: 0, r2: 0 }
  const b = covXY / varX
  const a = yBar - b * xBar
  const ssTot = ys.reduce((s, v) => s + (v - yBar) ** 2, 0)
  const ssRes = ys.reduce((s, v, i) => s + (v - (a + b * xs[i])) ** 2, 0)
  const r2 = ssTot === 0 ? 0 : Math.round((1 - ssRes / ssTot) * 1000) / 1000
  return { a, b, r2 }
}

// ── Fetch Base Monetaria (var 15) ─────────────────────────────────────────────

async function fetchBaseMon(): Promise<Record<string, number>> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    // Fetch ~5 years of daily data to get good annual coverage
    const from = `${new Date().getUTCFullYear() - 5}-01-01`
    const rows = await bcraOfficialApi.getSeriesData(15, from, today, 2000)
    // Keep last value of each month
    const byMonth: Record<string, number> = {}
    for (const { fecha, valor } of rows) {
      const ym = ymKey(fecha)
      byMonth[ym] = valor // overwrite → last day of month wins
    }
    return byMonth
  } catch {
    return {}
  }
}

// ── Fetch PBI nominal ARS (World Bank NY.GDP.MKTP.CN, annual) ────────────────

async function fetchPBIanual(): Promise<Record<number, number>> {
  try {
    const url = "https://api.worldbank.org/v2/country/AR/indicator/NY.GDP.MKTP.CN?format=json&per_page=15&mrv=15"
    const res = await fetchRegistered(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return {}
    const [, rows] = await res.json() as [unknown, Array<{ date: string; value: number | null }>]
    const result: Record<number, number> = {}
    for (const { date, value } of rows ?? []) {
      if (value != null) result[parseInt(date)] = value / 1e6  // ARS → millions ARS
    }
    return result
  } catch {
    return {}
  }
}

// ── Fetch IPC mensual ─────────────────────────────────────────────────────────

async function fetchIPC(): Promise<Record<string, number>> {
  try {
    const url =
      "https://apis.datos.gob.ar/series/api/series/" +
      "?ids=145.3_INGNACUAL_DICI_M_38&limit=120&sort=asc&format=json"
    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 43200 },
    })
    if (!res.ok) return {}
    const json = await res.json()
    const rows: [string, number | null][] = json.data ?? []
    const result: Record<string, number> = {}
    for (const [fecha, valor] of rows) {
      if (valor != null) result[ymKey(fecha)] = valor // decimal, e.g. 0.035
    }
    return result
  } catch {
    return {}
  }
}

// ── Main computation ──────────────────────────────────────────────────────────

function compute(bmPorMes: Record<string, number>, ipcPorMes: Record<string, number>, pbiAnual: Record<number, number>) {
  // Intersect months with both BM and IPC data
  const months = Object.keys(ipcPorMes)
    .filter(ym => bmPorMes[ym] != null)
    .sort()

  if (months.length === 0) return null

  // Build cumulative price index (base = first month = 1)
  const P: Record<string, number> = {}
  let pAcc = 1
  for (const ym of months) {
    pAcc *= (1 + ipcPorMes[ym])
    P[ym] = pAcc
  }

  // Real balances and monthly seigniorage
  type MonthPoint = {
    ym: string
    anio: number
    bm: number
    pi: number
    p: number
    mp: number
    s: number
    s_nom: number
  }
  const pts: MonthPoint[] = months.map(ym => {
    const bm = bmPorMes[ym]
    const pi = ipcPorMes[ym]
    const p  = P[ym]
    const mp = bm / p
    const s  = pi * mp
    const s_nom = pi * bm  // nominal seigniorage in current ARS millions
    return { ym, anio: parseInt(ym.slice(0, 4)), bm, pi, p, mp, s, s_nom }
  })

  // Annual aggregation
  const byYear: Record<number, MonthPoint[]> = {}
  for (const pt of pts) {
    if (!byYear[pt.anio]) byYear[pt.anio] = []
    byYear[pt.anio].push(pt)
  }

  const hoyAnio = new Date().getUTCFullYear()

  // Serie anual histórica (años completos: 12 meses, excluir año en curso)
  const serieAnual = Object.entries(byYear)
    .filter(([anio, meses]) => parseInt(anio) < hoyAnio && meses.length === 12)
    .map(([anio, meses]) => {
      const a              = parseInt(anio)
      const inflacionAnual = meses.reduce((acc, m) => (1 + acc) * (1 + m.pi) - 1, 0) * 100
      const mpPromedio     = meses.reduce((s, m) => s + m.mp, 0) / meses.length
      const senoraje       = meses.reduce((s, m) => s + m.s, 0)
      const senNominal     = meses.reduce((s, m) => s + m.s_nom, 0)
      // % of GDP: use exact year if available, otherwise nearest prior year
      const pbi = pbiAnual[a] ?? pbiAnual[a - 1] ?? null
      const senPctPbi = pbi && pbi > 0 ? Math.round((senNominal / pbi) * 1000) / 10 : null
      return {
        anio: a,
        inflacion_anual: Math.round(inflacionAnual * 10) / 10,
        mp_promedio:     Math.round(mpPromedio),
        senoraje:        Math.round(senoraje),
        senoraje_nominal: Math.round(senNominal),
        pbi_nominal:     pbi ? Math.round(pbi) : null,
        senoraje_pct_pbi: senPctPbi,
      }
    })
    .sort((a, b) => a.anio - b.anio)

  // 2026 estimate (año en curso)
  const pts2026 = (byYear[hoyAnio] ?? [])
  const estimacion_2026 = (() => {
    if (pts2026.length === 0) return null
    const senParcial   = pts2026.reduce((s, m) => s + m.s, 0)
    const infParcial   = pts2026.reduce((acc, m) => (1 + acc) * (1 + m.pi) - 1, 0) * 100
    const senEstAnual  = (senParcial / pts2026.length) * 12
    return {
      meses_disponibles:      pts2026.length,
      senoraje_parcial:       Math.round(senParcial),
      senoraje_estimado_anual: Math.round(senEstAnual),
      inflacion_parcial:      Math.round(infParcial * 10) / 10,
    }
  })()

  // OLS Cagan: ln(mp_promedio) = ln(k) - α·π_decimal
  const xs = serieAnual.map(r => r.inflacion_anual / 100)  // π decimal
  const ys = serieAnual.map(r => Math.log(r.mp_promedio))
  const { a: lnK, b, r2 } = ols(xs, ys)
  const alpha = -b  // b is negative in Cagan → α > 0
  const k     = Math.exp(lnK)
  const piStar = alpha > 0 ? 1 / alpha : 1  // optimal π = 1/α

  // Laffer curve: 300 points from 0 to 500% (π = 0 to 5)
  const laffCurve = Array.from({ length: 300 }, (_, i) => {
    const pi = (i / 299) * 5
    return {
      pi:      Math.round(pi * 1000) / 10,   // in %, 0–500
      senoraje: Math.round(pi * k * Math.exp(-alpha * pi)),
    }
  })

  const sMax = Math.round(piStar * k * Math.exp(-1))

  return {
    serie_anual: serieAnual,
    estimacion_2026,
    params: {
      alpha:        Math.round(alpha * 1000) / 1000,
      k:            Math.round(k),
      r2,
      pi_star:      Math.round(piStar * 1000) / 1000,
      pi_star_pct:  Math.round(piStar * 100 * 10) / 10,
      s_max:        sMax,
    },
    laffer_curve: laffCurve,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  if (_cache && _cache.expiry > Date.now()) {
    return NextResponse.json({ ..._cache.data as object, cached: true })
  }

  const [bmPorMes, ipcPorMes, pbiAnual] = await Promise.all([fetchBaseMon(), fetchIPC(), fetchPBIanual()])

  const result = compute(bmPorMes, ipcPorMes, pbiAnual)
  if (!result) {
    return NextResponse.json({ error: "Sin datos suficientes" }, { status: 503 })
  }

  const payload = {
    ...result,
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 (Base Monetaria var 15) · datos.gob.ar IPC mensual",
  }

  _cache = { data: payload, expiry: Date.now() + 12 * 3600 * 1000 }
  return NextResponse.json(payload)
}
