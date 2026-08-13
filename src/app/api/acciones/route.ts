import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/acciones — Screener de acciones argentinas (Merval)
 *
 * Fuente: api-merval (Railway)
 * Tickers: STOCK_CATEGORIES from panel-data
 *
 * Query params:
 *   ?category=all|Bancos...    (default: all)
 *   ?tickers=GGAL,BMA,...      (comma-separated override)
 */

import { NextRequest, NextResponse } from "next/server"
import { STOCK_CATEGORIES, MERVAL_TOP, type StockQuote } from "@/server/domain/stock-categories"

// api-merval/byma deshabilitado por criterio legal; acciones usa fuentes públicas permitidas
// ── In-memory cache ────────────────────────────────────────────────────────────
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

function parseLocaleNumber(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.trim().match(/-?[\d.]+(?:,\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function extractRavaMetric(html: string, label: string): number | null {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`<span>\\s*${safeLabel}:?\\s*<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
    new RegExp(`${safeLabel}:<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
    new RegExp(`>${safeLabel}<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
  ]

  for (const pattern of patterns) {
    const value = parseLocaleNumber(html.match(pattern)?.[1])
    if (value != null) return value
  }

  return null
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
    const lastPrice = extractRavaMetric(html, "Precio")
    if (lastPrice == null) return null

    const closePrice = extractRavaMetric(html, "Anterior")
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
    }
  } catch {
    return null
  }
}

async function enrichWithRavaFallback(symbols: string[], base: Map<string, StockQuote>): Promise<Map<string, StockQuote>> {
  const missing = symbols.filter((symbol) => (base.get(symbol)?.lastPrice ?? null) == null)
  if (missing.length === 0) return base

  const fallbackQuotes = await Promise.all(missing.map(scrapeRavaQuote))
  fallbackQuotes.forEach((quote) => {
    if (quote?.ticker) base.set(quote.ticker, quote)
  })
  return base
}

// ── Fuentes públicas permitidas (sin api-merval/byma) ─────────────────────────
async function fetchBatch(_: string[]): Promise<Map<string, StockQuote>> {
  return new Map<string, StockQuote>()
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
    if (cached) return NextResponse.json({ data: cached, cached: true })

    let qmap = await fetchBatch(MERVAL_TOP)
    qmap = await enrichWithRavaFallback(MERVAL_TOP, qmap)
    const data: StockQuote[] = MERVAL_TOP.map((t) => {
      const q = qmap.get(t) ?? { ticker: t, category: "", lastPrice: null, closePrice: null, openPrice: null, change1D: null, volume: null, bid: null, ask: null }
      q.category = findCategory(t)
      return q
    }).filter((q) => q.lastPrice != null)

    setCached(cacheKey, data, 60)
    return NextResponse.json({ data, updated_at: new Date().toISOString() })
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
    return NextResponse.json({ data, updated_at: new Date().toISOString() })
  }

  // Full screener (all or filtered by category)
  const cacheKey = `acciones_${categoryParam}`
  const cached = getCached<{ byCategory: Record<string, StockQuote[]> }>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })

  // Collect tickers
  let targetCategories = Object.entries(STOCK_CATEGORIES)
  if (categoryParam !== "all") {
    targetCategories = targetCategories.filter(([cat]) => cat === categoryParam)
  }

  const allTickers = [...new Set(targetCategories.flatMap(([, t]) => t))]

  // Fetch in batches of 20 (API limit)
  const batchSize = 20
  const batches: string[][] = []
  for (let i = 0; i < allTickers.length; i += batchSize) {
    batches.push(allTickers.slice(i, i + batchSize))
  }

  let qmaps = await Promise.all(batches.map(fetchBatch))
  qmaps = await Promise.all(qmaps.map((qm, idx) => enrichWithRavaFallback(batches[idx], qm)))
  const merged = new Map<string, StockQuote>()
  for (const qm of qmaps) {
    for (const [k, v] of qm) merged.set(k, v)
  }

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
  setCached(cacheKey, result, 90) // 90 segundos
  return NextResponse.json({ data: result, updated_at: new Date().toISOString(), source: "api-merval" })
}

function findCategory(ticker: string): string {
  for (const [cat, tickers] of Object.entries(STOCK_CATEGORIES)) {
    if (tickers.includes(ticker)) return cat
  }
  return "Otros"
}
