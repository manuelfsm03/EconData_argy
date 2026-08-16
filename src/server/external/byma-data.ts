import { fetchRegistered } from "@/server/http/fetch-source"

const BYMA_HISTORY_URL = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/chart/historical-series/history"
const BYMA_LEBACS_URL = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/lebacs"
const DEFAULT_SETTLEMENT = "24HS"
const DELAYED_MINUTES = 20
const FRESH_CACHE_MS = 5 * 60 * 1000
const STALE_IF_ERROR_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CONCURRENCY = 3

type NumericValue = number | string | null | undefined

export interface BymaHistoryPayload {
  s?: string
  t?: NumericValue[]
  o?: NumericValue[]
  h?: NumericValue[]
  l?: NumericValue[]
  c?: NumericValue[]
  v?: NumericValue[]
}

export interface BymaQuote {
  ticker: string
  symbol: string
  settlement: "24HS"
  lastPrice: number
  previousClose: number | null
  openPrice: number | null
  highPrice: number | null
  lowPrice: number | null
  volume: number | null
  change1D: number | null
  asOf: string
  delayedMinutes: 20
  source: "byma_data_open"
}

type CacheEntry = {
  quote: BymaQuote
  freshUntil: number
  staleUntil: number
}

const quoteCache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<BymaQuote | null>>()

export interface BymaCapInstrument {
  ticker: string
  tipo: "LECAP" | "BONCAP"
  vencimiento: string
}

type BymaLebacRow = {
  symbol?: unknown
  maturityDate?: unknown
  denominationCcy?: unknown
  settlementType?: unknown
}

type BymaLebacsPayload = {
  data?: unknown
}

let capCatalogCache: { data: BymaCapInstrument[]; freshUntil: number; staleUntil: number } | null = null

function positiveNumber(value: NumericValue): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function nonNegativeNumber(value: NumericValue): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function valueAt(values: NumericValue[] | undefined, index: number, positive = true): number | null {
  return positive ? positiveNumber(values?.[index]) : nonNegativeNumber(values?.[index])
}

export function parseBymaHistory(payload: unknown, ticker: string, symbol: string): BymaQuote | null {
  if (!payload || typeof payload !== "object") return null
  const series = payload as BymaHistoryPayload
  if (series.s !== "ok" || !Array.isArray(series.t) || !Array.isArray(series.c)) return null

  const validIndexes = series.c
    .map((close, index) => positiveNumber(close) != null && positiveNumber(series.t?.[index]) != null ? index : -1)
    .filter((index) => index >= 0)
  if (validIndexes.length === 0) return null

  const lastIndex = validIndexes.at(-1)!
  const previousIndex = validIndexes.length > 1 ? validIndexes.at(-2)! : null
  const lastPrice = positiveNumber(series.c[lastIndex])!
  const previousClose = previousIndex == null ? null : positiveNumber(series.c[previousIndex])
  const timestamp = positiveNumber(series.t[lastIndex])
  if (timestamp == null) return null

  return {
    ticker: ticker.toUpperCase(),
    symbol,
    settlement: DEFAULT_SETTLEMENT,
    lastPrice,
    previousClose,
    openPrice: valueAt(series.o, lastIndex),
    highPrice: valueAt(series.h, lastIndex),
    lowPrice: valueAt(series.l, lastIndex),
    volume: valueAt(series.v, lastIndex, false),
    change1D: previousClose == null ? null : ((lastPrice - previousClose) / previousClose) * 100,
    asOf: new Date(timestamp * 1000).toISOString(),
    delayedMinutes: DELAYED_MINUTES,
    source: "byma_data_open",
  }
}

export function buildBymaHistoryUrl(symbol: string, now = new Date()): string {
  const url = new URL(BYMA_HISTORY_URL)
  const from = Math.floor((now.getTime() - 14 * 24 * 60 * 60 * 1000) / 1000)
  const to = Math.floor((now.getTime() + 24 * 60 * 60 * 1000) / 1000)
  url.searchParams.set("symbol", symbol)
  url.searchParams.set("resolution", "D")
  url.searchParams.set("from", String(from))
  url.searchParams.set("to", String(to))
  return url.toString()
}

export function parseBymaCapInstruments(payload: unknown, now = new Date()): BymaCapInstrument[] {
  if (!payload || typeof payload !== "object") return []
  const rows = (payload as BymaLebacsPayload).data
  if (!Array.isArray(rows)) return []

  const today = now.toISOString().slice(0, 10)
  const result = new Map<string, BymaCapInstrument>()
  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== "object") continue
    const row = rawRow as BymaLebacRow
    const ticker = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : ""
    const vencimiento = typeof row.maturityDate === "string" ? row.maturityDate.slice(0, 10) : ""
    const settlement = String(row.settlementType ?? "")
    if (row.denominationCcy !== "ARS" || settlement !== "2" || vencimiento < today) continue

    const tipo = /^S\d{2}[A-Z]\d$/.test(ticker)
      ? "LECAP"
      : /^T\d{2}[A-Z]\d$/.test(ticker)
        ? "BONCAP"
        : null
    if (tipo) result.set(ticker, { ticker, tipo, vencimiento })
  }

  return [...result.values()].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.ticker.localeCompare(b.ticker))
}

export async function fetchBymaCapInstruments(): Promise<BymaCapInstrument[]> {
  const now = Date.now()
  if (capCatalogCache && capCatalogCache.freshUntil > now) return capCatalogCache.data

  try {
    const response = await fetchRegistered(BYMA_LEBACS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "LaPizarra/1.0 (+https://lapizarra.ar)",
      },
      body: JSON.stringify({
        page_number: 1,
        page_size: 5000,
        T0: true,
        T1: true,
        T2: true,
        excludeZeroPxAndQty: false,
      }),
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 21_600 },
    })
    if (response.ok) {
      const data = parseBymaCapInstruments(await response.json())
      if (data.length > 0) {
        capCatalogCache = {
          data,
          freshUntil: Date.now() + 6 * 60 * 60 * 1000,
          staleUntil: Date.now() + STALE_IF_ERROR_MS,
        }
        return data
      }
    }
  } catch {
    // Conservar el último catálogo válido ante fallos transitorios de BYMA.
  }

  return capCatalogCache && capCatalogCache.staleUntil > Date.now() ? capCatalogCache.data : []
}

async function fetchQuoteOnce(ticker: string, symbol: string): Promise<BymaQuote | null> {
  const response = await fetchRegistered(buildBymaHistoryUrl(symbol), {
    headers: {
      Accept: "application/json",
      "User-Agent": "LaPizarra/1.0 (+https://lapizarra.ar)",
    },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 300 },
  })
  if (!response.ok) return null
  return parseBymaHistory(await response.json(), ticker, symbol)
}

async function fetchQuote(ticker: string, symbol: string): Promise<BymaQuote | null> {
  const cacheKey = symbol.toUpperCase()
  const now = Date.now()
  const cached = quoteCache.get(cacheKey)
  if (cached && cached.freshUntil > now) return cached.quote

  const pending = inFlight.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const quote = await fetchQuoteOnce(ticker, symbol)
        if (quote) {
          quoteCache.set(cacheKey, {
            quote,
            freshUntil: Date.now() + FRESH_CACHE_MS,
            staleUntil: Date.now() + STALE_IF_ERROR_MS,
          })
          return quote
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
      }
    } catch {
      // El último cierre válido es preferible a publicar cero/null por un fallo transitorio.
    }
    const stale = quoteCache.get(cacheKey)
    return stale && stale.staleUntil > Date.now() ? stale.quote : null
  })().finally(() => inFlight.delete(cacheKey))

  inFlight.set(cacheKey, request)
  return request
}

async function mapWithConcurrency<T, R>(items: T[], mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

export async function fetchBymaQuotes(
  tickers: string[],
  options: { currencySuffix?: "" | "D" } = {},
): Promise<Map<string, BymaQuote>> {
  const normalized = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))]
  const suffix = options.currencySuffix ?? ""
  const quotes = await mapWithConcurrency(normalized, async (ticker) => {
    const symbol = `${ticker}${suffix} ${DEFAULT_SETTLEMENT}`
    return fetchQuote(ticker, symbol)
  })

  const result = new Map<string, BymaQuote>()
  quotes.forEach((quote, index) => {
    if (quote) result.set(normalized[index], quote)
  })
  return result
}

export const BYMA_DATA_METADATA = {
  source: "BYMA Data abierto",
  sourceId: "byma_data_open",
  delayedMinutes: DELAYED_MINUTES,
  access: "open_no_registration",
} as const

type MarketRow = { fuente?: string; asOf?: string | null }

export function marketMetaForRows(value: unknown) {
  const rows = (Array.isArray(value) ? value : [value]) as MarketRow[]
  const sources = [...new Set(rows.map((row) => row?.fuente).filter((source): source is string => Boolean(source)))]
  const bymaRows = rows.filter((row) => row?.fuente === BYMA_DATA_METADATA.sourceId)
  const priceAsOf = bymaRows
    .map((row) => row?.asOf)
    .filter((asOf): asOf is string => Boolean(asOf))
    .sort()
    .at(-1) ?? null
  const metadata = {
    source: sources.join(" + ") || "unavailable",
    price_as_of: priceAsOf,
  }
  return bymaRows.length > 0
    ? {
        ...metadata,
        source_name: BYMA_DATA_METADATA.source,
        delayed_minutes: BYMA_DATA_METADATA.delayedMinutes,
      }
    : metadata
}
