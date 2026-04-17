/**
 * /api/mundo — Mercados globales vía Yahoo Finance chart API
 *
 * Fuentes de datos:
 *   - Yahoo Finance Chart API (público, sin autenticación)
 *     https://query1.finance.yahoo.com/v8/finance/chart/{ticker}
 *
 * Endpoints:
 *   GET /api/mundo                        — snapshot de todos los tickers
 *   GET /api/mundo?ticker=sp500           — snapshot de un ticker
 *   GET /api/mundo?ticker=sp500&hist=1y   — histórico de un ticker
 *
 * Portado desde EconData_argy/api/services/yfinance_service.py + routers/economia.py
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const TICKERS: Record<string, string> = {
  // Índices
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dow: "^DJI",
  merval: "^MERV",
  vix: "^VIX",
  // Commodities agrícolas
  soja: "ZS=F",
  maiz: "ZC=F",
  trigo: "ZW=F",
  arroz: "ZR=F",
  azucar: "SB=F",   // cotiza en cents/lb — dividir por 100 en UI para USD/lb
  cafe: "KC=F",
  algodon: "CT=F",
  // Energía
  petroleo: "CL=F",
  brent: "BZ=F",
  gas_natural: "NG=F",
  gasoil: "HO=F",
  // Metales — ALI=F (COMEX Aluminium) no tiene datos confiables en YF; usamos HG=F (Cobre) como referencia
  oro: "GC=F",
  plata: "SI=F",
  cobre: "HG=F",
  // Tierras raras & estratégicos
  remx: "REMX",          // VanEck Rare Earth/Strategic Metals ETF
  mp_materials: "MP",    // MP Materials — mayor productor EEUU
  lithium_etf: "LIT",   // Global X Lithium & Battery Tech ETF
  albemarle: "ALB",      // Albemarle — litio/tierras raras
  uranium: "URA",        // Global X Uranium ETF
  cobalt_nickel: "VALE", // Vale — níquel/cobalto
  // FX
  eurusd: "EURUSD=X",
  usdbrl: "USDBRL=X",
  usdcny: "USDCNY=X",
  // Renta fija USA
  us10y: "^TNX",
  // Índices extra
  dxy: "DX-Y.NYB",
  // Crypto
  bitcoin:  "BTC-USD",
  ethereum: "ETH-USD",
  solana:   "SOL-USD",
  cardano:  "ADA-USD",
  xrp:      "XRP-USD",
  bnb:      "BNB-USD",
  usdt:     "USDT-USD",
  usdc:     "USDC-USD",
}

// Tickers cuya variación diaria suele exceder el umbral por naturaleza (ETFs de volatilidad, cripto)
const HIGH_VOL_TICKERS = new Set(["vix", "bitcoin", "ethereum", "solana", "cardano", "xrp", "bnb"])
const MAX_1D_CHANGE_PCT = 25 // umbral para descartar variaciones sospechosas en commodities / índices

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

// In-memory cache
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface QuoteResult {
  precio: number
  variacion_pct: number
  ticker: string
}

async function getQuote(nombre: string, ticker: string): Promise<[string, QuoteResult | null]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: YF_HEADERS,
      next: { revalidate: 300 },
    })
    if (!res.ok) return [nombre, null]

    const json = await res.json()
    const chart = json?.chart
    if (chart?.error) return [nombre, null]

    const meta = chart?.result?.[0]?.meta
    const last = meta?.regularMarketPrice ?? meta?.chartPreviousClose
    const prev = meta?.chartPreviousClose ?? meta?.previousClose
    if (last == null || prev == null || prev === 0) return [nombre, null]

    const chg = ((last - prev) / prev) * 100

    // Descartar variaciones diarias sospechosas (ej. arroz ZR=F con -98%)
    if (!HIGH_VOL_TICKERS.has(nombre) && Math.abs(chg) > MAX_1D_CHANGE_PCT) {
      console.warn(`[mundo] Variación sospechosa ${ticker} (${nombre}): ${chg.toFixed(2)}% — descartando`)
      return [nombre, null]
    }

    return [
      nombre,
      {
        precio: parseFloat(last.toFixed(4)),
        variacion_pct: parseFloat(chg.toFixed(2)),
        ticker,
      },
    ]
  } catch {
    return [nombre, null]
  }
}

async function getSnapshot(): Promise<Record<string, QuoteResult | null>> {
  const cacheKey = "yf_snapshot"
  const cached = getCache<Record<string, QuoteResult | null>>(cacheKey)
  if (cached) return cached

  const pairs = await Promise.allSettled(
    Object.entries(TICKERS).map(([n, t]) => getQuote(n, t)),
  )

  const result: Record<string, QuoteResult | null> = {}
  for (const p of pairs) {
    if (p.status === "fulfilled") {
      const [nombre, data] = p.value
      result[nombre] = data
    }
  }

  setCache(cacheKey, result, 300)
  return result
}

async function getHistorico(nombre: string, period = "1y"): Promise<[string, number][]> {
  const ticker = TICKERS[nombre]
  if (!ticker) return []

  const cacheKey = `yf_hist_${nombre}_${period}`
  const cached = getCache<[string, number][]>(cacheKey)
  if (cached) return cached

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${period}`
    const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) return []

    const json = await res.json()
    const result_data = json?.chart?.result?.[0]
    const timestamps: number[] = result_data?.timestamp || []
    const closes: (number | null)[] = result_data?.indicators?.quote?.[0]?.close || []

    const data: [string, number][] = timestamps
      .map((ts, i) => {
        const c = closes[i]
        if (c == null) return null
        const dateStr = new Date(ts * 1000).toISOString().split("T")[0]
        return [dateStr, parseFloat(c.toFixed(4))] as [string, number]
      })
      .filter((x): x is [string, number] => x !== null)

    setCache(cacheKey, data, 3600)
    return data
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")
  const hist = searchParams.get("hist")
  const endpoint = searchParams.get("endpoint")

  try {
    // ── MACRO COMPARADA LATINOAMERICANA ─────────────────────────────────────
    if (endpoint === "macro_comparada") {
      const mockMacro = [
        { date: "2020-01-01", Argentina: 2.4, Brazil: -4.0, Chile: -6.0, Colombia: -7.3, Mexico: -8.2 },
        { date: "2021-01-01", Argentina: 10.4, Brazil: 4.6, Chile: 11.8, Colombia: 10.6, Mexico: 4.7 },
        { date: "2022-01-01", Argentina: -0.9, Brazil: 2.0, Chile: -0.2, Colombia: 7.5, Mexico: 3.7 },
        { date: "2023-01-01", Argentina: -2.1, Brazil: 2.9, Chile: 0.2, Colombia: 0.5, Mexico: 3.2 },
        { date: "2024-01-01", Argentina: 2.5, Brazil: 2.0, Chile: 2.5, Colombia: 2.0, Mexico: 1.5 },
      ]
      return NextResponse.json({ data: mockMacro, updated_at: new Date().toISOString(), source: "World Bank (mock)" })
    }

    // ── ELECTRICIDAD MUNDIAL (OWID) ─────────────────────────────────────────
    if (endpoint === "electricidad") {
      const cacheKey = "owid_electricidad"
      const cached = getCache<Record<string, unknown>[]>(cacheKey)
      if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), source: "Our World in Data — Ember / Energy Institute" })

      const OWID_ENTITIES = new Set(["Argentina", "Brazil", "China", "European Union (27)", "India", "United States"])
      const url = "https://ourworldindata.org/grapher/electricity-generation.csv?tab=chart"
      const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) return NextResponse.json({ error: "OWID no disponible", data: [] }, { status: 502 })

      const text = await res.text()
      const lines = text.trim().split("\n")
      const byYear: Record<string, Record<string, unknown>> = {}
      for (const line of lines.slice(1)) {
        const parts = line.split(",")
        const entity = parts[0]?.replace(/"/g, "").trim() ?? ""
        if (!OWID_ENTITIES.has(entity)) continue
        const year = parts[2]?.trim() ?? ""
        const twh = parseFloat(parts[3]?.trim() ?? "")
        if (!year || isNaN(twh)) continue
        if (!byYear[year]) byYear[year] = { date: `${year}-01-01` }
        byYear[year][entity] = parseFloat(twh.toFixed(2))
      }
      const data = Object.values(byYear).sort((a, b) =>
        (a.date as string).localeCompare(b.date as string)
      )

      setCache(cacheKey, data, 3600)
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "Our World in Data — Ember / Energy Institute Statistical Review" })
    }

    if (ticker && hist) {
      if (!(ticker in TICKERS)) {
        return NextResponse.json({ error: "ticker desconocido", valid: Object.keys(TICKERS) }, { status: 400 })
      }
      const data = await getHistorico(ticker, hist)
      return NextResponse.json({ data, ticker, period: hist, updated_at: new Date().toISOString(), source: "yahoo_finance" })
    }

    if (ticker) {
      const [, data] = await getQuote(ticker, TICKERS[ticker] ?? ticker)
      return NextResponse.json({ data, ticker, updated_at: new Date().toISOString(), source: "yahoo_finance" })
    }

    // Full snapshot
    const data = await getSnapshot()
    return NextResponse.json({
      data,
      tickers: Object.keys(TICKERS),
      updated_at: new Date().toISOString(),
      source: "yahoo_finance",
    })
  } catch (error) {
    console.error("[/api/mundo]", error)
    return NextResponse.json({ error: "Error al obtener datos de mercado", detail: String(error) }, { status: 500 })
  }
}
