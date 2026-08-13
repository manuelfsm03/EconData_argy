import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/acciones/[ticker] — Histórico + detalle de una acción
 *
 * Fuentes:
 *   - Yahoo Finance (tickers AR con sufijo .BA, ej: GGAL.BA)
 *   - api-merval para precio actual
 *
 * Query params:
 *   ?range=1m|3m|6m|1y|max  (default: 3m)
 *   ?info=1                  (include company info)
 */

import { NextRequest, NextResponse } from "next/server"

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

const MERVAL_BASE = "https://api-merval-production.up.railway.app"

interface OHLCEntry {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

interface StockDetail {
  ticker: string
  yfSymbol: string
  lastPrice: number | null
  closePrice: number | null
  change1D: number | null
  change1DPct: number | null
  high52w: number | null
  low52w: number | null
  volume: number | null
  avgVolume: number | null
  currency: string
  history: OHLCEntry[]
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

function rangeToYFParams(range: string): { interval: string; range: string } {
  switch (range) {
    case "1m": return { interval: "1d", range: "1mo" }
    case "3m": return { interval: "1d", range: "3mo" }
    case "6m": return { interval: "1d", range: "6mo" }
    case "1y": return { interval: "1wk", range: "1y" }
    case "max": return { interval: "1mo", range: "10y" }
    default: return { interval: "1d", range: "3mo" }
  }
}

async function fetchYFHistory(symbol: string, range: string): Promise<OHLCEntry[]> {
  const { interval, range: yfRange } = rangeToYFParams(range)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${yfRange}&includePrePost=false`

  try {
    const res = await fetchRegistered(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 1800 },
    })
    if (!res.ok) return []

    const j = await res.json()
    const result = j?.chart?.result?.[0]
    if (!result) return []

    const timestamps: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}
    const opens: (number | null)[] = q.open ?? []
    const highs: (number | null)[] = q.high ?? []
    const lows: (number | null)[] = q.low ?? []
    const closes: (number | null)[] = q.close ?? []
    const volumes: (number | null)[] = q.volume ?? []

    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split("T")[0],
        open: opens[i] ? parseFloat(opens[i]!.toFixed(2)) : null,
        high: highs[i] ? parseFloat(highs[i]!.toFixed(2)) : null,
        low: lows[i] ? parseFloat(lows[i]!.toFixed(2)) : null,
        close: closes[i] ? parseFloat(closes[i]!.toFixed(2)) : null,
        volume: volumes[i] ?? null,
      }))
      .filter((e) => e.close != null)
  } catch {
    return []
  }
}

async function fetchYFMeta(symbol: string): Promise<{
  regularMarketPrice: number | null
  previousClose: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  regularMarketVolume: number | null
  averageVolume: number | null
  currency: string
}> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  try {
    const res = await fetchRegistered(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error("not ok")
    const j = await res.json()
    const meta = j?.chart?.result?.[0]?.meta ?? {}
    return {
      regularMarketPrice: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      regularMarketVolume: meta.regularMarketVolume ?? null,
      averageVolume: meta.averageVolume ?? null,
      currency: meta.currency ?? "ARS",
    }
  } catch {
    return {
      regularMarketPrice: null,
      previousClose: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      regularMarketVolume: null,
      averageVolume: null,
      currency: "ARS",
    }
  }
}

async function fetchMervalCurrent(ticker: string): Promise<{ last: number | null; close: number | null; vol: number | null }> {
  try {
    const url = `${MERVAL_BASE}/v1/quotes/batch?symbols=${ticker}:24hs&depth=1`
    const res = await fetchRegistered(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 60 } })
    if (!res.ok) return { last: null, close: null, vol: null }
    const j = await res.json()
    const q = j.quotes?.[0]
    if (!q) return { last: null, close: null, vol: null }
    const md = q.marketData
    return {
      last: md?.LA?.price ? parseFloat(md.LA.price) : null,
      close: md?.CL?.price ? parseFloat(md.CL.price) : null,
      vol: md?.EV?.size ?? null,
    }
  } catch {
    return { last: null, close: null, vol: null }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  const range = searchParams.get("range") ?? "3m"

  const tickerUpper = ticker.toUpperCase()
  const cacheKey = `accion_${tickerUpper}_${range}`
  const cached = getCached<StockDetail>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true })

  // YF symbol: tickers argentinos van con .BA
  // Excepciones conocidas: MELI → MELI (NASDAQ), LOMA → LOMA.BA
  const US_TICKERS = ["MELI", "VIST", "GLOB", "BBAR", "GGAL", "TGS", "PAM", "YPF", "CEPU"]
  const isUS = US_TICKERS.includes(tickerUpper) && !tickerUpper.endsWith("D")
  const yfSymbol = isUS ? tickerUpper : `${tickerUpper}.BA`

  // Fetch in parallel
  const [history, meta, merval] = await Promise.all([
    fetchYFHistory(yfSymbol, range),
    fetchYFMeta(yfSymbol),
    fetchMervalCurrent(`${tickerUpper}D`),
  ])

  const lastPrice = merval.last ?? meta.regularMarketPrice
  const closePrice = merval.close ?? meta.previousClose
  const change1D = lastPrice != null && closePrice != null && closePrice > 0
    ? lastPrice - closePrice
    : null
  const change1DPct = change1D != null && closePrice != null && closePrice > 0
    ? (change1D / closePrice) * 100
    : null

  const detail: StockDetail = {
    ticker: tickerUpper,
    yfSymbol,
    lastPrice,
    closePrice,
    change1D,
    change1DPct,
    high52w: meta.fiftyTwoWeekHigh,
    low52w: meta.fiftyTwoWeekLow,
    volume: merval.vol ?? meta.regularMarketVolume,
    avgVolume: meta.averageVolume,
    currency: meta.currency,
    history,
  }

  setCached(cacheKey, detail, range === "max" ? 86400 : 1800)
  return NextResponse.json({ data: detail, updated_at: new Date().toISOString() })
}
