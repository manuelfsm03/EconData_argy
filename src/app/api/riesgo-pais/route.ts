import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/riesgo-pais — Riesgo País EMBI+ Argentina
 *
 * Fuentes:
 *   - argentinadatos.com /v1/finanzas/indices/riesgo-pais  (histórico oficial EMBI+)
 *   - Yahoo Finance ^TNX (US 10Y treasury yield) — con fallback a FRED (serie DGS10)
 *     si Yahoo falla y hay FRED_API_KEY seteada. Si ambas fallan, cae a 4.5% default.
 *   - TIR de los Globales (GD30/GD35/GD41/GD29): motor verificado de bond-schedule.ts
 *     + precio en vivo BYMA Data -- MISMO cálculo que /api/bonos, no una consulta
 *     aparte a la DB (esa consulta directa a Prisma quedaba en blanco si la DB
 *     local no tenía el bono seedeado; con esto no depende de la DB en absoluto).
 *   - Outstanding de bonos: @/lib/bond-outstanding (única fuente de verdad,
 *     compartida con la UI de bonos).
 *   - Comparativos regionales: valores de referencia manual (FRED no tiene
 *     EMBI+ regionales gratis — el índice es propietario de JPMorgan).
 */

import { NextRequest, NextResponse } from "next/server"
import { ESQUEMAS, construirCashflows } from "@/lib/bond-schedule"
import { metricasDeMercado, metricasDevengadas } from "@/lib/bond-math"
import { fechaUTC, siguienteDiaHabil } from "@/lib/market-calendar"
import { fetchBymaQuotes } from "@/server/external/byma-data"
import { fetchFREDLatest } from "@/server/external/fred"
import { BOND_OUTSTANDING } from "@/lib/bond-outstanding"

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

async function getYFPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetchRegistered(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 900 } })
    if (!res.ok) return null
    const j = await res.json()
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
}

interface GlobalTir { ticker: string; tir: number | null; precio: number | null; durationMod: number | null }

/**
 * TIR en vivo de los bonos Globales (Ley NY) de Argentina -- GD30, GD35,
 * GD41, GD29 -- vía precio BYMA + motor de cashflows verificado. "Los
 * Globales" en plural porque el riesgo país de un solo bono (GD30) es un
 * solo punto; ver la TIR en varios plazos da una lectura más completa de
 * qué tan cara/barata está la curva soberana en dólares.
 */
async function fetchGlobalesTir(): Promise<GlobalTir[]> {
  const globales = ESQUEMAS.filter((e) => e.ley === "NY")
  const bymaQuotes = await fetchBymaQuotes(globales.map((e) => e.ticker), { currencySuffix: "D" })
  const hoy = new Date()
  const liquidacion = siguienteDiaHabil(fechaUTC(hoy.toISOString().slice(0, 10)))

  return globales.map((esquema) => {
    const precio = bymaQuotes.get(esquema.ticker)?.lastPrice ?? null
    if (precio == null) return { ticker: esquema.ticker, tir: null, precio: null, durationMod: null }
    const cashflows = construirCashflows(esquema)
    const devengadas = metricasDevengadas(cashflows, liquidacion)
    if (!devengadas) return { ticker: esquema.ticker, tir: null, precio, durationMod: null }
    const precioDirty = precio + devengadas.interesesCorridos
    const mercado = metricasDeMercado(precioDirty, cashflows, liquidacion)
    return { ticker: esquema.ticker, tir: mercado?.tir ?? null, precio, durationMod: mercado?.durationMod ?? null }
  })
}

// Riesgo país desde argentinadatos.com (datos EMBI+ oficiales desde 1999)
async function fetchArgDatosHistorico(): Promise<Array<{ fecha: string; valor: number }>> {
  try {
    const res = await fetchRegistered("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais", {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    return (await res.json()) as Array<{ fecha: string; valor: number }>
  } catch { return [] }
}

// ── In-memory cache ────────────────────────────────────────────────────────────
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

export async function GET(_request: NextRequest) {
  const cacheKey = "riesgo_pais_v2"
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })

  // Fetch en paralelo
  const [argDatosHist, us10yYahoo, globalesTir] = await Promise.all([
    fetchArgDatosHistorico(),
    getYFPrice("^TNX"),
    fetchGlobalesTir().catch(() => [] as GlobalTir[]),
  ])
  const gd30 = globalesTir.find((g) => g.ticker === "GD30") ?? null

  // US10Y: Yahoo primero, FRED (serie DGS10) como fallback, default 4.5%
  // solo si ambas fallan. FRED devuelve null si no hay FRED_API_KEY (degrada
  // grácilmente). Se loguea la fuente elegida para depurar caídas.
  let us10y: number | null = us10yYahoo
  let us10yFuente: "yahoo" | "fred" | "default_45" = "yahoo"
  if (us10y == null) {
    const fredVal = await fetchFREDLatest("DGS10")
    if (fredVal != null) {
      us10y = fredVal
      us10yFuente = "fred"
    } else {
      us10yFuente = "default_45"
    }
  }
  console.log(`[riesgo-pais] US10Y fuente=${us10yFuente} valor=${us10y ?? "null"}`)

  // Valor actual = último de la serie
  const histSorted = [...argDatosHist].sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  const latestEntry = histSorted[histSorted.length - 1]
  const riesgoPaisBps = latestEntry?.valor ?? null

  // Últimas 2 semanas para variaciones
  const now = new Date()
  const d1w = new Date(now); d1w.setDate(now.getDate() - 7)
  const d1m = new Date(now); d1m.setMonth(now.getMonth() - 1)

  const last1w = histSorted.filter((e) => new Date(e.fecha) >= d1w).at(0)?.valor ?? null
  const last1m = histSorted.filter((e) => new Date(e.fecha) >= d1m).at(0)?.valor ?? null

  const var1w = riesgoPaisBps != null && last1w != null ? riesgoPaisBps - last1w : null
  const var1m = riesgoPaisBps != null && last1m != null ? riesgoPaisBps - last1m : null

  // TIR GD30 en vivo (motor verificado + precio BYMA, ver fetchGlobalesTir)
  const arTir = gd30?.tir ?? null
  const us10yPct = us10y ?? 4.5

  // Spread calculado
  const spreadAr = arTir != null ? arTir - us10yPct : null

  // Comparativos regionales — valores de referencia MANUAL (sin API en vivo).
  //
  // TODO: FRED NO publica las series EMBI+ regionales de JPMorgan de forma
  // gratuita (el índice EMBI+ es propietario de JPMorgan/CEMBI). Opciones para
  // conectarlo en vivo cuando haya presupuesto/tiempo:
  //   - Bloomberg / Refinitiv / JPMorgan Markets (todas pagas).
  //   - World Bank GEM Commodities / IMF SDMX no traen EMBI regional.
  //   - Proxy imperfecto: CDS soberano a 5Y desde S&P/Markit (también pago).
  // Por ahora los mantenemos hardcodeados con la fecha de referencia; el flag
  // `esVivo:false` y `refFecha` se muestran en la UI para que quede claro que
  // NO son datos en vivo. Actualizar manualmente cuando haga falta.
  const REGIONALES_REF_FECHA = "2025-08"
  const REGIONALES_REFERENCIA: Record<string, { bps: number; moneda: string }> = {
    brasil:    { bps: 185, moneda: "BRL" },
    chile:     { bps: 80,  moneda: "CLP" },
    colombia:  { bps: 245, moneda: "COP" },
    peru:      { bps: 140, moneda: "PEN" },
    mexico:    { bps: 175, moneda: "MXN" },
  }
  const regionales: Record<string, { bps: number | null; moneda: string; nota?: string; ticker?: string; fuente?: string; esVivo: boolean; refFecha?: string }> = {
    argentina: { bps: riesgoPaisBps, moneda: "ARS", ticker: "GD30", fuente: "EMBI+ argentinadatos.com", esVivo: true },
  }
  for (const [pais, ref] of Object.entries(REGIONALES_REFERENCIA)) {
    regionales[pais] = { bps: ref.bps, moneda: ref.moneda, nota: `referencia ${REGIONALES_REF_FECHA}`, esVivo: false, refFecha: REGIONALES_REF_FECHA }
  }

  // Histórico: últimos 2 años para gráfico
  const cutoff2y = new Date(); cutoff2y.setFullYear(now.getFullYear() - 2)
  const historico2y = histSorted
    .filter((e) => new Date(e.fecha) >= cutoff2y)
    .map((e) => ({ date: e.fecha, valor: e.valor }))

  // SMA 30D y 90D sobre el histórico
  const historicoConSMA = calcularSMA(historico2y)

  // Ponderación por bono (estimación — contribución al EMBI AR proporcional
  // al outstanding). Los montos vienen de @/lib/bond-outstanding para que
  // este endpoint y la UI de bonos usen SIEMPRE el mismo número (evitar
  // drift si hay buybacks/canjes/reaperturas).
  const PONDERACION_TICKERS = ["GD35", "GD30", "GD41", "AL30", "AL35", "GD46", "AE38"] as const
  const outstandingTotal = PONDERACION_TICKERS.reduce((s, t) => s + (BOND_OUTSTANDING[t] ?? 0), 0)
  const ponderacionBonos = PONDERACION_TICKERS.map((ticker) => {
    const outstanding = BOND_OUTSTANDING[ticker] ?? 0
    const pct = outstandingTotal > 0 ? Math.round((outstanding / outstandingTotal) * 100) : 0
    return { ticker, outstanding, pct }
  })

  const alertas = []
  if (riesgoPaisBps != null) {
    if (riesgoPaisBps > 2000) alertas.push({ nivel: "crítico", mensaje: "Riesgo País > 2000 bps — acceso a crédito internacional prácticamente cerrado" })
    else if (riesgoPaisBps > 1000) alertas.push({ nivel: "alto", mensaje: "Riesgo País > 1000 bps — costo de financiamiento elevado" })
    else if (riesgoPaisBps > 500) alertas.push({ nivel: "moderado", mensaje: "Riesgo País entre 500-1000 bps — mercados con cautela" })
    else alertas.push({ nivel: "bajo", mensaje: "Riesgo País < 500 bps — condiciones de acceso a crédito normalizándose" })
  }

  const result = {
    actual: {
      riesgoPaisBps,
      var1w,
      var1m,
      spreadAr,
      us10y: us10yPct,
      arTir,
      gd30Precio: gd30?.precio ?? null,
      metodologia: "EMBI+ oficial (argentinadatos.com) + spread GD30 vs US 10Y (TIR en vivo, motor verificado)",
    },
    regionales,
    globalesTir,
    historico: historico2y,
    historicoConSMA,
    ponderacionBonos,
    alertas,
  }

  setCached(cacheKey, result, 3600) // 1h
  return NextResponse.json({ data: result, updated_at: new Date().toISOString(), source: "argentinadatos.com + yahoo_finance" })
}

function calcularSMA(data: Array<{ date: string; valor: number }>, windows = [30, 90]) {
  return data.map((punto, i) => {
    const result: Record<string, unknown> = { date: punto.date, valor: punto.valor }
    for (const window of windows) {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1)
      const avg = slice.reduce((sum, p) => sum + p.valor, 0) / slice.length
      result[`sma${window}`] = Math.round(avg)
    }
    return result
  })
}
