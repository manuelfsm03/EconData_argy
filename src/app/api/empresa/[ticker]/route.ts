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
      // quoteSummary a veces devuelve 200 pero con error interno.
      // Casteo seguro para leer .error sin romper el tipado (j es unknown).
      const err = (j as { quoteSummary?: { error?: unknown } })?.quoteSummary?.error
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

  // ── Metadatos de moneda / período / fuente (feedback del revisor) ──────────
  // Objetivo: que CADA métrica sea interpretable y auditable → moneda + período +
  // fuente efectiva SIEMPRE presentes. Distinguimos 3 monedas:
  //
  //  1) Precio/gráfico: moneda de cotización del priceSymbol. Para ".BA" es ARS.
  //  2) Fundamentals (EBITDA, EBIT, revenue, márgenes, cashflows, deuda): moneda en
  //     que la EMPRESA reporta sus estados = fund.currency (financialCurrency).
  //     OJO: para varios ADRs argentinos (ej. GGAL) los estados están en ARS aunque
  //     el ADR cotice en USD. Por eso NO asumimos "USD" a ciegas: usamos fund.currency
  //     y sólo caemos al heurístico (adrUsed ? USD) si la fuente no informó la moneda.
  //  3) Market cap / enterprise value: son valores de MERCADO, cotizados en la moneda
  //     del símbolo de fundamentals (ADR → USD; .BA → ARS). Puede diferir de (2).
  const monedaPrecio = (typeof meta.currency === "string" && meta.currency)
    || (market === "usa" ? "USD" : "ARS")

  // Moneda de cotización del fundamentalsSymbol (ADR=USD; si no hay ADR, = precio)
  const monedaMarketCap = adrUsed ? "USD" : monedaPrecio

  // Moneda REAL de los estados financieros (preferimos lo que informó la fuente)
  const monedaFundamentals = fund.currency ?? (adrUsed ? "USD" : monedaPrecio)

  // Fuente efectiva del market cap: qué se usó REALMENTE (no las posibles).
  // Sale de fund.marketCap o, si no, del v7/quote del fundamentalsSymbol.
  const fuenteMarketCap = fund.marketCap != null
    ? `${fund.source}:${fundamentalsSymbol}`
    : (quoteResult?.marketCap != null ? `yahoo:v7/quote:${fundamentalsSymbol}` : "n/d")

  // ── Guardrail ARS/USD ─────────────────────────────────────────────────────
  // EV/EBITDA y EV/Revenue combinan un numerador de MERCADO (enterprise value, en
  // monedaMarketCap) con un denominador de ESTADOS (EBITDA/revenue, en
  // monedaFundamentals). Si esas monedas difieren, el ratio mezcla pesos con
  // dólares → es INVÁLIDO y NO se devuelve (queda null) + se marca el flag.
  // Caso real: GGAL → EV en USD (ADR) y EBITDA en ARS (estados) ⇒ ratio sin sentido.
  const ratiosMonedaMismatch = monedaMarketCap !== monedaFundamentals

  // Período de los ESTADOS FINANCIEROS según lo que informó la fuente.
  // TTM = últimos 12 meses móviles; FY = último ejercicio fiscal cerrado.
  // Si no se puede afirmar con certeza → "TTM?" (no afirmamos de más).
  const periodoEstados = (() => {
    const p = fund.periodo
    if (!p) return "TTM?"
    if (p === "TTM") return "TTM"
    if (p === "annual") return "FY (último ejercicio)"
    const m = /^(\d{4})-\d{2}-\d{2}$/.exec(p)   // fecha de cierre de ejercicio
    if (m) return `FY${m[1]}`
    return "TTM?"
  })()

  // Fuente efectiva (símbolo REAL usado para cada pata)
  const fuenteFundamentals = `${fund.source}:${fundamentalsSymbol}${adrUsed ? " (ADR)" : ""}`
  const fuentePrecio = `yahoo:chart:${priceSymbol}`
  const fuenteEfectiva = `fundamentals=${fuenteFundamentals} · precio=${fuentePrecio}`

  // Fuente por métrica de valuación (fund vs fallback v7/quote), para auditar
  const srcValuacion = (usoFund: boolean) =>
    usoFund ? fuenteFundamentals : `yahoo:v7/quote:${fundamentalsSymbol}`

  // Ajuste fino de período: en la ruta yahoo_crumb, ebit y grossProfit NO salen de
  // financialData (TTM) sino de incomeStatementHistory (último ejercicio ANUAL).
  // Para no afirmar "TTM" de más, los marcamos como FY cuando la fuente es YF crumb.
  const periodoEbitGross = fund.source === "yahoo_crumb" ? "FY (último ejercicio)" : periodoEstados

  // Mapa de metadatos por métrica: { moneda, periodo, fuente }.
  //  - moneda=null → la métrica es adimensional (ratio, %, growth, beta).
  //  - Se AGREGA a `data` sin tocar los campos existentes (no rompe el front).
  const metricasMeta: Record<string, { moneda: string | null; periodo: string; fuente: string }> = {
    // Valuación (valores/ratios de mercado)
    marketCap:       { moneda: monedaMarketCap, periodo: "actual",  fuente: fuenteMarketCap },
    enterpriseValue: { moneda: monedaMarketCap, periodo: "actual",  fuente: fuenteFundamentals },
    peRatioTtm:      { moneda: null,            periodo: "TTM",     fuente: srcValuacion(fund.trailingPE   != null) },
    peForward:       { moneda: null,            periodo: "forward", fuente: srcValuacion(fund.forwardPE    != null) },
    evToEbitda:      { moneda: null,            periodo: "TTM",     fuente: fuenteFundamentals },
    evToRevenue:     { moneda: null,            periodo: "TTM",     fuente: fuenteFundamentals },
    priceToBook:     { moneda: null,            periodo: "actual",  fuente: srcValuacion(fund.priceToBook  != null) },
    eps:             { moneda: monedaMarketCap, periodo: "TTM",     fuente: srcValuacion(fund.eps          != null) },
    beta:            { moneda: null,            periodo: "mercado", fuente: srcValuacion(fund.beta         != null) },
    dividendYield:   { moneda: null,            periodo: "TTM",     fuente: srcValuacion(fund.dividendYield != null) },
    // Estados financieros (P&L / cashflow / balance) → moneda de los estados
    totalRevenue:      { moneda: monedaFundamentals, periodo: periodoEstados, fuente: fuenteFundamentals },
    grossProfit:       { moneda: monedaFundamentals, periodo: periodoEbitGross, fuente: fuenteFundamentals },
    ebitda:            { moneda: monedaFundamentals, periodo: periodoEstados,   fuente: fuenteFundamentals },
    ebit:              { moneda: monedaFundamentals, periodo: periodoEbitGross, fuente: fuenteFundamentals },
    netIncome:         { moneda: monedaFundamentals, periodo: periodoEstados, fuente: fuenteFundamentals },
    operatingCashflow: { moneda: monedaFundamentals, periodo: periodoEstados, fuente: fuenteFundamentals },
    freeCashflow:      { moneda: monedaFundamentals, periodo: periodoEstados, fuente: fuenteFundamentals },
    totalDebt:         { moneda: monedaFundamentals, periodo: periodoEstados, fuente: fuenteFundamentals },
    // Márgenes y retornos (adimensionales, base TTM/estados)
    grossMargin:     { moneda: null, periodo: periodoEstados, fuente: fuenteFundamentals },
    ebitdaMargin:    { moneda: null, periodo: periodoEstados, fuente: fuenteFundamentals },
    operatingMargin: { moneda: null, periodo: periodoEstados, fuente: fuenteFundamentals },
    profitMargin:    { moneda: null, periodo: periodoEstados, fuente: fuenteFundamentals },
    revenueGrowth:   { moneda: null, periodo: "YoY",          fuente: fuenteFundamentals },
    earningsGrowth:  { moneda: null, periodo: "YoY",          fuente: fuenteFundamentals },
    returnOnEquity:  { moneda: null, periodo: "TTM",          fuente: fuenteFundamentals },
    returnOnAssets:  { moneda: null, periodo: "TTM",          fuente: fuenteFundamentals },
  }

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
    // Guardrail: si el market cap y los estados están en monedas distintas, el
    // EV/EBITDA y EV/Revenue mezclan monedas → no comparables → no los exponemos.
    evToEbitda:      ratiosMonedaMismatch ? null : fund.evToEbitda,
    evToRevenue:     ratiosMonedaMismatch ? null : fund.evToRevenue,
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
    // ── Metadatos de moneda / período / fuente (auditoría — feedback revisor) ──
    monedas: {
      precio: monedaPrecio,             // moneda del gráfico/precio (para .BA = ARS)
      fundamentals: monedaFundamentals, // moneda de los estados financieros
      marketCap: monedaMarketCap,       // moneda del market cap / EV (mercado)
    },
    metricasMeta,                       // { campo: { moneda, periodo, fuente } }
    fuente_efectiva: fuenteEfectiva,    // qué fuente/símbolo se usó realmente
    fecha_actualizacion: new Date().toISOString(),
    ratios_moneda_mismatch: ratiosMonedaMismatch, // true → EV/EBITDA y EV/Rev van null
    // Historia de precios
    history,
  }

  // Cache del endpoint (blob precio + fundamentals).
  // TTL: 1h en rangos normales; 6h para range=max (antes 24h). Lo bajamos para que
  // los fundamentals embebidos no queden más viejos que ~6h (pedido del revisor).
  // El cache profundo de fundamentals ya usa TTL corto (ver earnings-calendar.ts).
  // TODO(invalidación por earnings): cuando exista detección de nuevos resultados
  //   (10-K/10-Q/6-K vía feed de earnings o "recent filings" de SEC EDGAR),
  //   invalidar esta key + la de getFundamentals en vez de esperar el TTL.
  //   Punto de enganche: earnings-calendar.ts → enVentanaEarnings()/fundamentalsTTL().
  setCached(cacheKey, data, range === "max" ? 6 * 3600 : 3600)
  return NextResponse.json({ data, updated_at: new Date().toISOString() })
}
