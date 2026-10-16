/**
 * Familia dollar-linked sobre BYMA Open Data. Reusa fetchRegistered + parseBymaHistory
 * + buildBymaHistoryUrl de byma-data.ts (no duplica). No toca LECAP/BONCAP.
 *
 * Config por env (todo opcional):
 *  - BYMA_DL_UNIVERSE_URL: endpoint de BYMA que lista bonos/letras públicos.
 *  - BYMA_DL_UNIVERSE_METHOD: GET (default) o POST.
 *  - BYMA_DL_UNIVERSE_BODY: JSON del body si es POST.
 *  - BYMA_DL_TICKER_REGEX: patrón de ticker dollar-linked (ver domain/dollar-linked.ts).
 * Sin BYMA_DL_UNIVERSE_URL se usa sólo el catálogo estático (hoy vacío) => familia sin datos.
 */
import { fetchRegistered } from "@/server/http/fetch-source"
import { buildBymaHistoryUrl, parseBymaHistory, type BymaQuote } from "@/server/external/byma-data"
import {
  aggregateFamilyVolume, dollarLinkedFromCatalog, parseBymaVolumeSeries, parseDollarLinkedUniverse,
  type AggregatedVolumePoint, type DollarLinkedInstrument, type VolumePoint,
} from "@/server/domain/dollar-linked"
import { gateMarketPrice } from "@/server/domain/market-freshness"

const HISTORY_DAYS = 90
const CACHE_MS = 5 * 60 * 1000
const MAX_CONCURRENCY = 3
const HEADERS = { Accept: "application/json", "User-Agent": "LaPizarra/1.0 (+https://lapizarra.ar)" }

export interface DollarLinkedRow {
  ticker: string
  vencimiento: string | null
  precio: number | null
  change1D: number | null
  volumen: number | null
  asOf: string | null
  fuente: "byma_data_open"
}

export interface DollarLinkedFamily {
  instrumentos: DollarLinkedRow[]
  volumenAgregado: AggregatedVolumePoint[]
  volumenUnidad: string
  universo: "byma_open_data" | "catalogo_estatico" | "sin_universo"
}

let cache: { data: DollarLinkedFamily; until: number } | null = null

async function fetchUniverse(): Promise<{ list: DollarLinkedInstrument[]; origin: DollarLinkedFamily["universo"] }> {
  const url = process.env.BYMA_DL_UNIVERSE_URL
  if (url) {
    try {
      const post = (process.env.BYMA_DL_UNIVERSE_METHOD ?? "GET").toUpperCase() === "POST"
      const res = await fetchRegistered(url, {
        method: post ? "POST" : "GET",
        headers: post ? { ...HEADERS, "Content-Type": "application/json" } : HEADERS,
        body: post ? (process.env.BYMA_DL_UNIVERSE_BODY ?? "{}") : undefined,
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 21_600 },
      })
      if (res.ok) {
        const list = parseDollarLinkedUniverse(await res.json())
        if (list.length > 0) return { list, origin: "byma_open_data" }
      }
    } catch { /* cae al catálogo estático */ }
  }
  const fallback = dollarLinkedFromCatalog()
  return { list: fallback, origin: fallback.length > 0 ? "catalogo_estatico" : "sin_universo" }
}

async function fetchHistory(ticker: string): Promise<{ quote: BymaQuote | null; series: VolumePoint[] }> {
  try {
    const symbol = `${ticker} 24HS` // T+1
    const url = new URL(buildBymaHistoryUrl(symbol))
    url.searchParams.set("from", String(Math.floor(Date.now() / 1000) - HISTORY_DAYS * 86_400))
    const res = await fetchRegistered(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(10_000), next: { revalidate: 300 } })
    if (!res.ok) return { quote: null, series: [] }
    const payload = await res.json()
    return { quote: parseBymaHistory(payload, ticker, symbol), series: parseBymaVolumeSeries(payload) }
  } catch {
    return { quote: null, series: [] }
  }
}

export async function fetchDollarLinkedFamily(): Promise<DollarLinkedFamily> {
  if (cache && cache.until > Date.now()) return cache.data
  const { list, origin } = await fetchUniverse()

  const results = new Array<Awaited<ReturnType<typeof fetchHistory>>>(list.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, list.length) }, async () => {
    while (cursor < list.length) {
      const i = cursor++
      results[i] = await fetchHistory(list[i].ticker)
    }
  }))

  const seriesByTicker = new Map<string, VolumePoint[]>()
  const instrumentos: DollarLinkedRow[] = []
  list.forEach((inst, i) => {
    const { quote, series } = results[i]
    if (series.length > 0) seriesByTicker.set(inst.ticker, series)
    // Precio sólo si pasa el gate de frescura; nunca un precio viejo presentado como actual.
    const fresh = quote != null && gateMarketPrice("byma_data_open", quote.asOf).accepted
    instrumentos.push({
      ticker: inst.ticker,
      vencimiento: inst.vencimiento,
      precio: fresh ? quote.lastPrice : null,
      change1D: fresh ? quote.change1D : null,
      volumen: fresh ? quote.volume : null,
      asOf: fresh ? quote.asOf : null,
      fuente: "byma_data_open",
    })
  })

  const data: DollarLinkedFamily = {
    instrumentos: instrumentos.filter((r) => r.precio != null || seriesByTicker.has(r.ticker)),
    volumenAgregado: aggregateFamilyVolume(seriesByTicker),
    volumenUnidad: "suma del campo v de BYMA por rueda (se asume nominales VN; no verificado)",
    universo: origin,
  }
  if (data.instrumentos.length > 0) cache = { data, until: Date.now() + CACHE_MS }
  return data
}
