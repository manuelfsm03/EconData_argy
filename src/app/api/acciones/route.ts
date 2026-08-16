import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/acciones — Screener de acciones argentinas (Merval)
 *
 * Fuente primaria: BYMA Data abierto (20 minutos de demora)
 * Tickers: STOCK_CATEGORIES from panel-data
 *
 * Query params:
 *   ?category=all|Bancos...    (default: all)
 *   ?tickers=GGAL,BMA,...      (comma-separated override)
 */

import { NextRequest, NextResponse } from "next/server"
import { STOCK_CATEGORIES, MERVAL_TOP, type StockQuote } from "@/server/domain/stock-categories"
import { fetchBymaQuotes, marketMetaForRows } from "@/server/external/byma-data"
import { parseRavaStockQuote } from "@/server/external/rava-stock"

// ── In-memory cache ────────────────────────────────────────────────────────────
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

async function scrapeRavaQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const res = await fetchRegistered(`https://www.rava.com/perfil/${symbol.toLowerCase()}`, {
      headers: { "User-Agent": "Mozilla/5.0 PanelDeControl/2.0", Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const html = await res.text()
    const parsed = parseRavaStockQuote(html)
    if (!parsed) return null
    const { lastPrice, previousClose: closePrice } = parsed
    const change1D = closePrice != null && closePrice > 0
      ? ((lastPrice - closePrice) / closePrice) * 100
      : null

    return {
      ticker: symbol,
      category: "",
      lastPrice,
      closePrice,
      openPrice: null,
      change1D,
      volume: null,
      bid: null,
      ask: null,
      source: "rava",
    }
  } catch {
    return null
  }
}

async function enrichWithRavaFallback(symbols: string[], base: Map<string, StockQuote>): Promise<Map<string, StockQuote>> {
  const missing = symbols.filter((symbol) => (base.get(symbol)?.lastPrice ?? null) == null)
  if (missing.length === 0) return base

  for (let index = 0; index < missing.length; index += 6) {
    const fallbackQuotes = await Promise.all(missing.slice(index, index + 6).map(scrapeRavaQuote))
    fallbackQuotes.forEach((quote) => {
      if (quote?.ticker) base.set(quote.ticker, quote)
    })
  }
  return base
}

async function fetchBatch(symbols: string[]): Promise<Map<string, StockQuote>> {
  const bymaQuotes = await fetchBymaQuotes(symbols)
  const quotes = new Map<string, StockQuote>()
  for (const [ticker, quote] of bymaQuotes) {
    quotes.set(ticker, {
      ticker,
      category: "",
      lastPrice: quote.lastPrice,
      closePrice: quote.previousClose,
      openPrice: quote.openPrice,
      change1D: quote.change1D,
      volume: quote.volume,
      bid: null,
      ask: null,
      asOf: quote.asOf,
      source: quote.source,
      delayedMinutes: quote.delayedMinutes,
    })
  }
  return quotes
}

function responseMeta(quotes: StockQuote[]) {
  return marketMetaForRows(quotes.map((quote) => ({
    fuente: quote.source,
    asOf: quote.asOf,
  })))
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoryParam = searchParams.get("category") ?? "all"
  const tickersParam = searchParams.get("tickers")
  const tapeMode = searchParams.get("tape") === "1"

  // Tape mode: top merval only
  if (tapeMode) {
    const cacheKey = "acciones_tape"
    const cached = getCached<StockQuote[]>(cacheKey)
    if (cached) return NextResponse.json({ data: cached, cached: true, ...responseMeta(cached) })

    let qmap = await fetchBatch(MERVAL_TOP)
    qmap = await enrichWithRavaFallback(MERVAL_TOP, qmap)
    const data: StockQuote[] = MERVAL_TOP.map((t) => {
      const q = qmap.get(t) ?? { ticker: t, category: "", lastPrice: null, closePrice: null, openPrice: null, change1D: null, volume: null, bid: null, ask: null }
      q.category = findCategory(t)
      return q
    }).filter((q) => q.lastPrice != null)

    setCached(cacheKey, data, 300)
    return NextResponse.json({ data, updated_at: new Date().toISOString(), ...responseMeta(data) })
  }

  // Override tickers
  if (tickersParam) {
    const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase())
    let qmap = await fetchBatch(tickers)
    qmap = await enrichWithRavaFallback(tickers, qmap)
    const data = tickers.map((t) => {
      const q = qmap.get(t) ?? { ticker: t, category: "", lastPrice: null, closePrice: null, openPrice: null, change1D: null, volume: null, bid: null, ask: null }
      q.category = findCategory(t)
      return q
    })
    return NextResponse.json({ data, updated_at: new Date().toISOString(), ...responseMeta(data) })
  }

  // Full screener (all or filtered by category)
  const cacheKey = `acciones_${categoryParam}`
  const cached = getCached<{ byCategory: Record<string, StockQuote[]> }>(cacheKey)
  if (cached) {
    const quotes = Object.values(cached.byCategory).flat()
    return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString(), ...responseMeta(quotes) })
  }

  // Collect tickers
  let targetCategories = Object.entries(STOCK_CATEGORIES)
  if (categoryParam !== "all") {
    targetCategories = targetCategories.filter(([cat]) => cat === categoryParam)
  }

  const allTickers = [...new Set(targetCategories.flatMap(([, t]) => t))]

  let merged = await fetchBatch(allTickers)
  merged = await enrichWithRavaFallback(allTickers, merged)

  // Build by-category response
  const byCategory: Record<string, StockQuote[]> = {}
  for (const [cat, tickers] of targetCategories) {
    byCategory[cat] = tickers.map((t) => {
      const q = merged.get(t) ?? {
        ticker: t, category: cat, lastPrice: null, closePrice: null,
        openPrice: null, change1D: null, volume: null, bid: null, ask: null,
      }
      q.category = cat
      return q
    })
  }

  const result = { byCategory, categories: Object.keys(byCategory) }
  setCached(cacheKey, result, 300)
  return NextResponse.json({
    data: result,
    updated_at: new Date().toISOString(),
    ...responseMeta(Object.values(byCategory).flat()),
  })
}

function findCategory(ticker: string): string {
  for (const [cat, tickers] of Object.entries(STOCK_CATEGORIES)) {
    if (tickers.includes(ticker)) return cat
  }
  return "Otros"
}
