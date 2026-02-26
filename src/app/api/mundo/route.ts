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
  // Commodities
  soja: "ZS=F",
  maiz: "ZC=F",
  trigo: "ZW=F",
  petroleo: "CL=F",
  oro: "GC=F",
  // FX
  eurusd: "EURUSD=X",
  usdbrl: "USDBRL=X",
  usdcny: "USDCNY=X",
  // Renta fija USA
  us10y: "^TNX",
  // Commodities extra
  brent: "BZ=F",
  dxy: "DX-Y.NYB",
  // Crypto
  bitcoin: "BTC-USD",
  ethereum: "ETH-USD",
}

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

  try {
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
