import { NextRequest, NextResponse } from "next/server"
import { getFundamentals } from "@/server/external/fundamentals"

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

async function fetchYF(url: string): Promise<unknown> {
  // Intenta query1, fallback a query2 si falla (YF a veces bloquea uno u otro)
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const finalUrl = url.replace(/query\d\.finance\.yahoo\.com/, host)
    try {
      const res = await fetch(finalUrl, {
        headers: YF_HEADERS,
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const j = await res.json()
      // quoteSummary a veces devuelve 200 pero con error interno
      const err = (j as Record<string, unknown>)?.quoteSummary?.error
      if (err) continue
      return j
    } catch {
      // siguiente host
    }
  }
  return null
}

// Yahoo Finance devuelve números envueltos en { raw, fmt } — extraemos raw
function raw(v: unknown): number | null {
  if (v == null || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  return typeof o.raw === "number" ? o.raw : null
}

const RANGE_PARAMS: Record<string, { interval: string; range: string }> = {
  "1m":  { interval: "1d",  range: "1mo"  },
  "3m":  { interval: "1d",  range: "3mo"  },
  "6m":  { interval: "1d",  range: "6mo"  },
  "1y":  { interval: "1wk", range: "1y"   },
  "max": { interval: "1mo", range: "10y"  },
}

/**
 * Mapa de tickers BYMA → ADR en NYSE/NASDAQ.
 * Los ADRs tienen cotización en USD y Yahoo Finance sí devuelve fundamentals
 * completos (EBITDA, EBIT, revenue, margins, etc.).
 * Estrategia: precio/gráfico desde ticker.BA (ARS), fundamentals desde el ADR.
 */
const ADR_MAP: Record<string, string> = {
  GGAL:  "GGAL",   // Grupo Financiero Galicia → NASDAQ
  YPFD:  "YPF",    // YPF S.A. → NYSE
  BMA:   "BMA",    // Banco Macro → NYSE
  BBAR:  "BBAR",   // BBVA Argentina → NYSE
  CEPU:  "CEPU",   // Central Puerto → NYSE
  PAMP:  "PAM",    // Pampa Energía → NYSE
  LOMA:  "LOMA",   // Loma Negra → NYSE
  TXAR:  "TX",     // Ternium (padre de TXAR) → NYSE
  TECO2: "TEO",    // Telecom Argentina → NYSE
  VALO:  "SUPV",   // Grupo Supervielle → NYSE
  EDN:   "EDN",    // Edenor → NYSE
  MIRG:  "MIRG",   // Mirgor → sin ADR (no map)
  MELI:  "MELI",   // MercadoLibre → NASDAQ (no cotiza en BYMA pero por si acaso)
  GLOB:  "GLOB",   // Globant → NYSE
  DESP:  "DESP",   // Despegar → NASDAQ
}

// Descriptions de respaldo para las principales compañías argentinas
// cuando Yahoo Finance no devuelve longBusinessSummary
const FALLBACK_DESC: Record<string, string> = {
  GGAL:  "Grupo Financiero Galicia es uno de los principales grupos financieros privados de la Argentina, con actividades en banca retail y corporativa, seguros, fintech y servicios financieros.",
  YPFD:  "YPF S.A. es la principal empresa de energía de Argentina, con actividades de exploración, producción, refinación, distribución y comercialización de petróleo, gas y derivados.",
  BMA:   "Banco Macro es uno de los bancos privados más grandes de Argentina, con fuerte presencia en el interior del país y foco en banca minorista y PyMEs.",
  BBAR:  "BBVA Argentina (ex Banco Francés) es uno de los bancos líderes del sistema financiero argentino, con operaciones de banca retail, corporativa y digital.",
  CEPU:  "Central Puerto es la mayor generadora de energía eléctrica de Argentina por capacidad instalada, operando plantas térmicas e hidroeléctricas.",
  PAMP:  "Pampa Energía es un holding de energía con participación en generación, transmisión y distribución eléctrica, y producción de gas y petróleo.",
  LOMA:  "Loma Negra es la principal empresa cementera de Argentina, con plantas en Olavarría, Zapala y otras ciudades, parte del grupo brasileño InterCement.",
  TXAR:  "Ternium Argentina (ex SIDERAR) es el principal productor de acero plano de Argentina, integrante del grupo Ternium, con planta siderúrgica en Ensenada, Buenos Aires.",
  TECO2: "Telecom Argentina es el principal grupo de telecomunicaciones del país, ofreciendo telefonía fija, móvil (Personal), internet y TV por cable (Cablevisión).",
  VALO:  "Grupo Supervielle es un grupo financiero argentino con operaciones en banca, finanzas al consumo, seguros y gestión de patrimonio.",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params
  const { searchParams } = new URL(request.url)
  const range  = searchParams.get("range")  ?? "1y"
  const market = searchParams.get("market") ?? "arg"  // "arg" → agrega .BA; "usa" → ticker as-is

  const tickerUpper = ticker.toUpperCase()

  // Símbolo para el gráfico de precios (ARS si ARG, plain si USA)
  const priceSymbol = market === "usa" ? tickerUpper : `${tickerUpper}.BA`

  // Símbolo para fundamentals: si la acción tiene ADR en NYSE/NASDAQ, lo usamos
  // para obtener EBITDA, EBIT, revenue, etc. (los .BA no tienen estos datos).
  const fundamentalsSymbol = market === "usa"
    ? tickerUpper
    : (ADR_MAP[tickerUpper] ?? `${tickerUpper}.BA`)

  const adrUsed = market === "arg" && fundamentalsSymbol !== `${tickerUpper}.BA`

  const cacheKey = `empresa_${tickerUpper}_${market}_${range}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true })

  const { interval, range: yfRange } = RANGE_PARAMS[range] ?? RANGE_PARAMS["1y"]

  // Fetch en paralelo:
  //  - gráfico histórico (precio local, BYMA)
  //  - assetProfile de YF (descripción, sector, industria — no requiere crumb)
  //  - v7/quote sin crumb (52w high/low, etc.)
  //  - getFundamentals: cascada FMP → Alpha Vantage → YF crumb
  const [chartJson, summaryJson, quoteJson, fund] = await Promise.all([
    fetchYF(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(priceSymbol)}` +
      `?interval=${interval}&range=${yfRange}&includePrePost=false`,
    ),
    // Solo pedimos assetProfile — los financials vienen del cascade
    fetchYF(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(fundamentalsSymbol)}` +
      `?modules=assetProfile`,
    ),
    // v7/quote no requiere crumb+cookie — útil para 52w high/low
    fetchYF(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(fundamentalsSymbol)}` +
      `&fields=marketCap,trailingPE,forwardPE,epsTrailingTwelveMonths,beta,priceToBook,dividendYield,trailingAnnualDividendYield,fiftyTwoWeekHigh,fiftyTwoWeekLow`,
    ),
    getFundamentals(fundamentalsSymbol),
  ])

  // ── Historia de precios ──────────────────────────────────────────────────
  const chartResult = (chartJson as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as {
    timestamp?: number[]
    meta?: Record<string, unknown>
    indicators?: { quote?: Array<{ close?: (number | null)[]; volume?: (number | null)[] }> }
  } | undefined

  const timestamps: number[] = chartResult?.timestamp ?? []
  const q0 = chartResult?.indicators?.quote?.[0] ?? {}
  const closes: (number | null)[] = q0.close ?? []
  const volumes: (number | null)[] = q0.volume ?? []

  const history = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split("T")[0],
      close: closes[i] != null ? parseFloat(closes[i]!.toFixed(2)) : null,
      volume: volumes[i] ?? null,
    }))
    .filter((e) => e.close != null)

  const meta = (chartResult?.meta ?? {}) as Record<string, unknown>

  // ── Fallback v7/quote (valores directos, sin wrapper raw/fmt) ───────────
  type QuoteV7 = {
    marketCap?: number
    trailingPE?: number
    forwardPE?: number
    epsTrailingTwelveMonths?: number
    beta?: number
    priceToBook?: number
    dividendYield?: number
    trailingAnnualDividendYield?: number
    fiftyTwoWeekHigh?: number
    fiftyTwoWeekLow?: number
  }
  const quoteResult = (quoteJson as { quoteResponse?: { result?: QuoteV7[] } })
    ?.quoteResponse?.result?.[0]

  // ── Perfil de la empresa desde assetProfile de YF ───────────────────────
  const summaryResult = (summaryJson as {
    quoteSummary?: { result?: unknown[] }
  })?.quoteSummary?.result?.[0] as Record<string, Record<string, unknown>> | undefined

  const ap = summaryResult?.assetProfile ?? {}

  const description =
    (typeof ap.longBusinessSummary === "string" && ap.longBusinessSummary)
    || FALLBACK_DESC[tickerUpper]
    || null

  const data = {
    ticker: tickerUpper,
    priceSymbol,
    fundamentalsSymbol,
    adrUsed,  // true cuando usamos ADR para fundamentals de una ARG
    fundamentalsSource: fund.source,  // "fmp" | "alphavantage" | "yahoo_crumb" | "none"
    // Identidad
    shortName: typeof meta.shortName === "string" ? meta.shortName : tickerUpper,
    longName:  typeof meta.longName  === "string" ? meta.longName  : null,
    sector:    typeof ap.sector   === "string" ? ap.sector   : null,
    industry:  typeof ap.industry === "string" ? ap.industry : null,
    employees: typeof ap.fullTimeEmployees === "number" ? ap.fullTimeEmployees : null,
    website:   typeof ap.website  === "string" ? ap.website  : null,
    description,
    country: typeof ap.country === "string" ? ap.country : "Argentina",
    city:    typeof ap.city    === "string" ? ap.city    : null,
    // Precio actual (siempre en moneda local del gráfico)
    lastPrice:     typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
    previousClose: typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose
                 : typeof meta.previousClose       === "number" ? meta.previousClose : null,
    high52w: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : (quoteResult?.fiftyTwoWeekHigh ?? null),
    low52w:  typeof meta.fiftyTwoWeekLow  === "number" ? meta.fiftyTwoWeekLow  : (quoteResult?.fiftyTwoWeekLow  ?? null),
    currency: typeof meta.currency === "string" ? meta.currency : "ARS",
    // Key metrics — desde el cascade (FMP/AV/YF), con fallback a v7/quote para lo que no cubra
    marketCap:       fund.marketCap       ?? quoteResult?.marketCap       ?? null,
    enterpriseValue: fund.enterpriseValue,
    peRatioTtm:      fund.trailingPE      ?? quoteResult?.trailingPE      ?? null,
    peForward:       fund.forwardPE       ?? quoteResult?.forwardPE       ?? null,
    eps:             fund.eps             ?? quoteResult?.epsTrailingTwelveMonths ?? null,
    beta:            fund.beta            ?? quoteResult?.beta             ?? null,
    priceToBook:     fund.priceToBook     ?? quoteResult?.priceToBook     ?? null,
    evToEbitda:      fund.evToEbitda,
    evToRevenue:     fund.evToRevenue,
    dividendYield:   fund.dividendYield   ?? quoteResult?.dividendYield   ?? quoteResult?.trailingAnnualDividendYield ?? null,
    // Financials (de la cascada)
    ebitda:          fund.ebitda,
    ebit:            fund.ebit,
    totalRevenue:    fund.totalRevenue,
    grossProfit:     fund.grossProfit,
    netIncome:       fund.netIncome,
    operatingCashflow:    fund.operatingCashflow,
    capitalExpenditures:  fund.capitalExpenditures,
    freeCashflow:         fund.freeCashflow,
    totalDebt:            fund.totalDebt,
    operatingExpenses:    fund.operatingExpenses,
    // Márgenes y retornos
    ebitdaMargin:    fund.ebitdaMargin,
    profitMargin:    fund.profitMargin,
    grossMargin:     fund.grossMargin,
    operatingMargin: fund.operatingMargin,
    revenueGrowth:   fund.revenueGrowth,
    earningsGrowth:  fund.earningsGrowth,
    returnOnEquity:  fund.returnOnEquity,
    returnOnAssets:  fund.returnOnAssets,
    // Contexto del reporte
    fundamentalsPeriodo: fund.periodo,
    fundamentalsCurrency: fund.currency,
    // Historia de precios
    history,
  }

  setCached(cacheKey, data, range === "max" ? 86400 : 3600)
  return NextResponse.json({ data, updated_at: new Date().toISOString() })
}
