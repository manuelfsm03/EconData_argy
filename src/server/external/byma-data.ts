import { fetchRegistered } from "@/server/http/fetch-source"
import { gateMarketPrice } from "@/server/domain/market-freshness"
import { aISO, esDiaHabil, fechaUTC } from "@/lib/market-calendar"

const BYMA_HISTORY_URL = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/chart/historical-series/history"
const BYMA_LEBACS_URL = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/lebacs"
// Panel de títulos públicos. Los BONCAP cotizan acá y no en /lebacs.
const BYMA_PUBLIC_BONDS_URL = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/public-bonds"
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
  sourceMode: "live" | "cache_fresh" | "cache_stale"
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
    sourceMode: "live",
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

// ── Precios de LECAP / BONCAP desde los paneles ──────────────────────────────
//
// Los paneles /lebacs y /public-bonds ya traen el último operado de cada
// especie. Antes se pedía acá sólo el catálogo y el precio se buscaba después
// en /historical-series, que para letras devuelve "no_data": por eso dos
// LECAPs aparecían sin precio aunque BYMA las cotizaba.

export interface BymaCapQuote {
  ticker: string
  tipo: "LECAP" | "BONCAP"
  vencimiento: string
  /** Último operado en 24 hs. Si hoy todavía no operó, el cierre anterior. */
  precio: number | null
  cierreAnterior: number | null
  change1D: number | null
  /** Momento del precio, ISO en UTC. */
  asOf: string | null
}

type BymaPanelRow = BymaLebacRow & {
  trade?: unknown
  settlementPrice?: unknown
  previousClosingPrice?: unknown
  tradeHour?: unknown
}

const CAP_TICKER_LECAP = /^S\d{2}[A-Z]\d$/
const CAP_TICKER_BONCAP = /^T\d{2}[A-Z]\d$/
const MS_POR_DIA = 86_400_000

/** Fecha de hoy en Buenos Aires (UTC−3 todo el año). */
function hoyBuenosAires(now: Date): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** La rueda más reciente que no es posterior a la fecha dada. */
function ultimaRueda(iso: string): string {
  let fecha = fechaUTC(iso)
  for (let i = 0; i < 10 && !esDiaHabil(fecha); i++) fecha = new Date(fecha.getTime() - MS_POR_DIA)
  return aISO(fecha)
}

function momentoBuenosAires(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}-03:00`).toISOString()
}

export function parseBymaCapQuotes(payload: unknown, now = new Date()): BymaCapQuote[] {
  if (!payload || typeof payload !== "object") return []
  const rows = (payload as BymaLebacsPayload).data
  if (!Array.isArray(rows)) return []

  const hoy = hoyBuenosAires(now)
  const rueda = ultimaRueda(hoy)
  const ruedaPrevia = ultimaRueda(aISO(new Date(fechaUTC(rueda).getTime() - MS_POR_DIA)))
  const result = new Map<string, BymaCapQuote>()

  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== "object") continue
    const row = rawRow as BymaPanelRow
    const ticker = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : ""
    const tipo = CAP_TICKER_LECAP.test(ticker) ? "LECAP" : CAP_TICKER_BONCAP.test(ticker) ? "BONCAP" : null
    const vencimiento = typeof row.maturityDate === "string" ? row.maturityDate.slice(0, 10) : ""
    // Sólo la liquidación en 24 hs (settlementType "2"): es la que liquida T+1
    // y contra la que se cuentan los días al vencimiento.
    if (!tipo || row.denominationCcy !== "ARS" || String(row.settlementType ?? "") !== "2" || vencimiento <= hoy) continue

    const operado = positiveNumber(row.trade as NumericValue) ?? positiveNumber(row.settlementPrice as NumericValue)
    const cierreAnterior = positiveNumber(row.previousClosingPrice as NumericValue)
    const hora = typeof row.tradeHour === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(row.tradeHour) ? row.tradeHour : "17:00:00"

    result.set(ticker, {
      ticker,
      tipo,
      vencimiento,
      precio: operado ?? cierreAnterior,
      cierreAnterior,
      change1D: operado != null && cierreAnterior != null ? (operado / cierreAnterior - 1) * 100 : null,
      asOf: operado != null
        ? momentoBuenosAires(rueda, hora)
        : cierreAnterior != null ? momentoBuenosAires(ruedaPrevia, "17:00:00") : null,
    })
  }

  return [...result.values()].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.ticker.localeCompare(b.ticker))
}

let capQuotesCache: { data: BymaCapQuote[]; freshUntil: number; staleUntil: number } | null = null

async function postBymaPanel(url: string): Promise<unknown> {
  const response = await fetchRegistered(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "LaPizarra/1.0 (+https://lapizarra.ar)",
    },
    body: JSON.stringify({ page_number: 1, page_size: 5000, T0: true, T1: true, T2: true, excludeZeroPxAndQty: false }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`BYMA_PANEL_HTTP_${response.status}`)
  return response.json()
}

/**
 * LECAP y BONCAP con precio, de los dos paneles de BYMA. Si un panel falla
 * se usa el otro; si fallan los dos, el último resultado válido rotulado como
 * cache_stale.
 */
export async function fetchBymaCapQuotes(now = new Date()): Promise<{
  quotes: BymaCapQuote[]
  sourceMode: "live" | "cache_fresh" | "cache_stale" | "unavailable"
}> {
  if (capQuotesCache && capQuotesCache.freshUntil > Date.now()) {
    return { quotes: capQuotesCache.data, sourceMode: "cache_fresh" }
  }

  const paneles = await Promise.allSettled([postBymaPanel(BYMA_LEBACS_URL), postBymaPanel(BYMA_PUBLIC_BONDS_URL)])
  const merged = new Map<string, BymaCapQuote>()
  for (const panel of paneles) {
    if (panel.status !== "fulfilled") continue
    for (const quote of parseBymaCapQuotes(panel.value, now)) {
      const previa = merged.get(quote.ticker)
      if (!previa || (previa.precio == null && quote.precio != null)) merged.set(quote.ticker, quote)
    }
  }

  if (merged.size > 0) {
    const data = [...merged.values()].sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
    capQuotesCache = { data, freshUntil: Date.now() + 60_000, staleUntil: Date.now() + STALE_IF_ERROR_MS }
    return { quotes: data, sourceMode: "live" }
  }

  return capQuotesCache && capQuotesCache.staleUntil > Date.now()
    ? { quotes: capQuotesCache.data, sourceMode: "cache_stale" }
    : { quotes: [], sourceMode: "unavailable" }
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
  if (cached && cached.freshUntil > now) return { ...cached.quote, sourceMode: "cache_fresh" as const }

  const pending = inFlight.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const quote = await fetchQuoteOnce(ticker, symbol)
        if (quote) {
          quoteCache.set(cacheKey, {
            quote: { ...quote, sourceMode: "live" as const },
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
    return stale && stale.staleUntil > Date.now() ? { ...stale.quote, sourceMode: "cache_stale" as const } : null
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
  options: { currencySuffix?: "" | "D" | "C" } = {},
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

type MarketRow = { fuente?: string; asOf?: string | null; priceStatus?: string }

export function marketMetaForRows(value: unknown, now = new Date()) {
  const rows = (Array.isArray(value) ? value : [value]) as MarketRow[]
  const sources = [...new Set(rows.map((row) => row?.fuente).filter((source): source is string => Boolean(source)))]
  const bymaRows = rows.filter((row) => row?.fuente === BYMA_DATA_METADATA.sourceId && gateMarketPrice(BYMA_DATA_METADATA.sourceId, row?.asOf, now).accepted)
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
