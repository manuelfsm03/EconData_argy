/**
 * Cascada de 3 fuentes para fundamentals de empresas.
 *
 * Orden: FMP (250 req/día gratis) → Alpha Vantage (25 req/día gratis) → YF crumb
 *
 * El resultado se cachea en memoria con TTL inteligente basado en el calendario
 * de earnings (7 días cerca del evento, 90 días en período tranquilo).
 */

import { fundamentalsTTL } from "@/lib/earnings-calendar"

// ────────────────────────────────────────────────────────────────────────────
// Interfaz pública
// ────────────────────────────────────────────────────────────────────────────

export interface FundamentalsData {
  source: "sec_edgar" | "fmp" | "alphavantage" | "yahoo_crumb" | "none"
  // P&L
  totalRevenue: number | null
  grossProfit: number | null
  ebitda: number | null
  ebit: number | null
  netIncome: number | null
  operatingExpenses: number | null
  // Cash flow
  operatingCashflow: number | null
  capitalExpenditures: number | null   // siempre positivo (valor absoluto)
  freeCashflow: number | null
  // Balance
  totalDebt: number | null
  // Márgenes
  ebitdaMargin: number | null
  grossMargin: number | null
  operatingMargin: number | null
  profitMargin: number | null
  // Valuación
  marketCap: number | null
  enterpriseValue: number | null
  trailingPE: number | null
  forwardPE: number | null
  priceToBook: number | null
  beta: number | null
  evToEbitda: number | null
  evToRevenue: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
  dividendYield: number | null
  eps: number | null
  // Contexto
  periodo: string | null    // "TTM" o "YYYY-MM-DD" del último reporte
  currency: string | null
}

// Resultado vacío (cuando las 3 fuentes fallan)
const EMPTY_FUNDAMENTALS: FundamentalsData = {
  source: "none",
  totalRevenue: null, grossProfit: null, ebitda: null, ebit: null,
  netIncome: null, operatingExpenses: null, operatingCashflow: null,
  capitalExpenditures: null, freeCashflow: null, totalDebt: null,
  ebitdaMargin: null, grossMargin: null, operatingMargin: null, profitMargin: null,
  marketCap: null, enterpriseValue: null, trailingPE: null, forwardPE: null,
  priceToBook: null, beta: null, evToEbitda: null, evToRevenue: null,
  revenueGrowth: null, earningsGrowth: null, returnOnEquity: null,
  returnOnAssets: null, dividendYield: null, eps: null,
  periodo: null, currency: null,
}

// ────────────────────────────────────────────────────────────────────────────
// Fuente 0 — SEC EDGAR (sin key, gobierno, datos anuales)
// Docs: https://efts.sec.gov/LATEST/search-index
// company_tickers.json → CIK; companyfacts → XBRL us-gaap
// ────────────────────────────────────────────────────────────────────────────

const SEC_UA = "La-Pizarra/1.0 contact@lapizarra.ar"

// CIK map cacheado en memoria (se descarga una sola vez por proceso)
let _cikMap: Record<string, number> | null = null

async function getCIKMap(): Promise<Record<string, number>> {
  if (_cikMap) return _cikMap
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_UA },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error("SEC CIK map unavailable")
  const raw = await res.json() as Record<string, { cik_str: number; ticker: string }>
  const map: Record<string, number> = {}
  for (const e of Object.values(raw)) map[e.ticker.toUpperCase()] = e.cik_str
  _cikMap = map
  return map
}

async function fetchSECEdgar(ticker: string): Promise<FundamentalsData | null> {
  try {
    const cikMap = await getCIKMap()
    const cik = cikMap[ticker.toUpperCase()]
    if (!cik) return null

    const cikPadded = String(cik).padStart(10, "0")
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cikPadded}.json`,
      { headers: { "User-Agent": SEC_UA }, signal: AbortSignal.timeout(20000) },
    )
    if (!res.ok) return null

    type USDEntry = { end: string; val: number; form: string }
    type Concept  = { units?: { USD?: USDEntry[] } }
    const facts = await res.json() as { facts?: { "us-gaap"?: Record<string, Concept>; "ifrs-full"?: Record<string, Concept> } }
    const gaap  = facts?.facts?.["us-gaap"]

    function makeLatestFn(ns: Record<string, Concept> | undefined, forms: string[]) {
      return function latestAnnual(...concepts: string[]): number | null {
        for (const concept of concepts) {
          const data = ns?.[concept]?.units?.USD
          if (!data) continue
          const annuals = data.filter(d => forms.includes(d.form))
          if (annuals.length === 0) continue
          annuals.sort((a, b) => b.end.localeCompare(a.end))
          return annuals[0].val
        }
        return null
      }
    }

    // ── US-GAAP path ──────────────────────────────────────────────────────────
    const latestAnnual = makeLatestFn(gaap, ["10-K", "20-F"])
    const revenue = latestAnnual(
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
    )
    const grossProfit = latestAnnual("GrossProfit")
    const ebit        = latestAnnual("OperatingIncomeLoss")
    const netIncome   = latestAnnual("NetIncomeLoss")
    const da          = latestAnnual("DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet")
    const ebitda      = ebit != null && da != null ? ebit + da : null
    const capex       = latestAnnual("PaymentsToAcquirePropertyPlantAndEquipment")
    const ocf         = latestAnnual("NetCashProvidedByUsedInOperatingActivities")
    const fcf         = ocf != null && capex != null ? ocf - capex : null
    const debt        = latestAnnual("LongTermDebt", "LongTermDebtAndCapitalLeaseObligation")
    const opex        = latestAnnual("OperatingExpenses")

    if (revenue != null || ebit != null || netIncome != null) {
      return {
        source: "sec_edgar",
        totalRevenue: revenue, grossProfit, ebitda, ebit, netIncome,
        operatingExpenses: opex, operatingCashflow: ocf,
        capitalExpenditures: capex != null ? Math.abs(capex) : null,
        freeCashflow: fcf, totalDebt: debt,
        ebitdaMargin: revenue && ebitda ? ebitda / revenue : null,
        grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
        operatingMargin: revenue && ebit ? ebit / revenue : null,
        profitMargin: revenue && netIncome ? netIncome / revenue : null,
        marketCap: null, enterpriseValue: null, trailingPE: null, forwardPE: null,
        priceToBook: null, beta: null, evToEbitda: null, evToRevenue: null,
        revenueGrowth: null, earningsGrowth: null,
        returnOnEquity: null, returnOnAssets: null,
        dividendYield: null, eps: null,
        periodo: "annual", currency: "USD",
      }
    }

    // ── IFRS-full fallback (20-F foreign private issuers, e.g. YPF) ───────────
    const ifrs = facts?.facts?.["ifrs-full"]
    if (!ifrs) return null
    const latestIFRS = makeLatestFn(ifrs, ["20-F"])

    const iRev   = latestIFRS("Revenue")
    const iGP    = latestIFRS("GrossProfit")
    const iEbit  = latestIFRS("ProfitLossFromOperatingActivities", "OperatingProfit")
    const iNet   = latestIFRS("ProfitLoss", "ProfitLossAttributableToOwnersOfParent")
    const iDep   = latestIFRS("AdjustmentsForDepreciationExpense")
    const iAmort = latestIFRS("AdjustmentsForAmortisationExpense")
    const iDA    = (iDep ?? 0) + (iAmort ?? 0) || null
    const iEbitda = iEbit != null && iDA != null ? iEbit + iDA : null
    const iOcf   = latestIFRS("CashFlowsFromUsedInOperatingActivities")
    const iCapex = latestIFRS(
      "PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets",
      "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
      "PurchaseOfPropertyPlantAndEquipment",
    )
    const iFcf   = iOcf != null && iCapex != null ? iOcf - iCapex : null
    const iDebt  = latestIFRS("Borrowings")

    if (iRev == null && iEbit == null && iNet == null) return null

    return {
      source: "sec_edgar",
      totalRevenue: iRev, grossProfit: iGP, ebitda: iEbitda, ebit: iEbit, netIncome: iNet,
      operatingExpenses: null, operatingCashflow: iOcf,
      capitalExpenditures: iCapex != null ? Math.abs(iCapex) : null,
      freeCashflow: iFcf, totalDebt: iDebt,
      ebitdaMargin: iRev && iEbitda ? iEbitda / iRev : null,
      grossMargin: iRev && iGP ? iGP / iRev : null,
      operatingMargin: iRev && iEbit ? iEbit / iRev : null,
      profitMargin: iRev && iNet ? iNet / iRev : null,
      marketCap: null, enterpriseValue: null, trailingPE: null, forwardPE: null,
      priceToBook: null, beta: null, evToEbitda: null, evToRevenue: null,
      revenueGrowth: null, earningsGrowth: null,
      returnOnEquity: null, returnOnAssets: null,
      dividendYield: null, eps: null,
      periodo: "annual", currency: "USD",
    }
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fuente 1 — Financial Modeling Prep (FMP)
// API key: FMP_API_KEY  |  Free tier: 250 req/día, 5 req/min
// Registro: https://financialmodelingprep.com/developer/docs
// ────────────────────────────────────────────────────────────────────────────

async function fetchFMP(ticker: string): Promise<FundamentalsData | null> {
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) return null

  try {
    const [incomeRes, cashRes, profileRes] = await Promise.all([
      fetch(
        `https://financialmodelingprep.com/api/v3/income-statement/${ticker}?limit=1&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(10000) },
      ),
      fetch(
        `https://financialmodelingprep.com/api/v3/cash-flow-statement/${ticker}?limit=1&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(10000) },
      ),
      fetch(
        `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${apiKey}`,
        { signal: AbortSignal.timeout(10000) },
      ),
    ])

    if (!incomeRes.ok) return null
    const incomeArr = await incomeRes.json() as Record<string, unknown>[]
    const income = incomeArr?.[0]
    if (!income) return null

    const cashArr = cashRes.ok ? (await cashRes.json() as Record<string, unknown>[]) : []
    const cash = cashArr?.[0] ?? {}
    const profileArr = profileRes.ok ? (await profileRes.json() as Record<string, unknown>[]) : []
    const profile = profileArr?.[0] ?? {}

    // Extrae number o null
    const n = (v: unknown): number | null => typeof v === "number" ? v : null

    const revenue    = n(income.revenue)
    const ebitda     = n(income.ebitda)
    const ebit       = n(income.operatingIncome)
    const grossProfit = n(income.grossProfit)
    const netIncome  = n(income.netIncome)
    const opex       = n(income.operatingExpenses)
    const ocf        = n(cash.operatingCashFlow)
    const capex      = n(cash.capitalExpenditure)  // positivo en FMP
    const fcf        = n(cash.freeCashFlow)
    const mktCap     = n(profile.mktCap)
    const beta       = n(profile.beta)
    const pe         = n(profile.pe)
    const pb         = n(profile.priceToBookRatio)
    const div        = n(profile.lastDiv)
    const eps        = n(profile.eps)

    return {
      source: "fmp",
      totalRevenue: revenue,
      grossProfit,
      ebitda,
      ebit,
      netIncome,
      operatingExpenses: opex,
      operatingCashflow: ocf,
      capitalExpenditures: capex != null ? Math.abs(capex) : null,
      freeCashflow: fcf,
      totalDebt: null,   // no disponible en income statement de FMP
      ebitdaMargin: revenue && ebitda ? ebitda / revenue : null,
      grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
      operatingMargin: revenue && ebit ? ebit / revenue : null,
      profitMargin: revenue && netIncome ? netIncome / revenue : null,
      marketCap: mktCap,
      enterpriseValue: null,
      trailingPE: pe,
      forwardPE: null,
      priceToBook: pb,
      beta,
      evToEbitda: null,
      evToRevenue: null,
      revenueGrowth: null,
      earningsGrowth: null,
      returnOnEquity: null,
      returnOnAssets: null,
      dividendYield: div != null && mktCap ? div / (mktCap / 1e9) : null,
      eps,
      periodo: typeof income.date === "string" ? income.date : null,
      currency: typeof income.reportedCurrency === "string" ? income.reportedCurrency : "USD",
    }
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Utilidad: tipo de cambio vía open.er-api.com (gratis, sin key)
// Cache 24h para no sobrecargar el servicio.
// ────────────────────────────────────────────────────────────────────────────

const _fxCache: Record<string, { rate: number; expiry: number }> = {}

async function getFXRate(from: string): Promise<number> {
  const key = from.toUpperCase()
  const cached = _fxCache[key]
  if (cached && cached.expiry > Date.now()) return cached.rate

  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${key}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return 1
    const json = await res.json() as { rates?: Record<string, number> }
    const rate = json.rates?.["USD"]
    if (rate && rate > 0) {
      _fxCache[key] = { rate, expiry: Date.now() + 24 * 3600 * 1000 }
      return rate
    }
  } catch { /* sin conversión → devolvemos 1 */ }
  return 1
}

// ────────────────────────────────────────────────────────────────────────────
// Fuente 2 — Alpha Vantage
// API key: ALPHA_VANTAGE_KEY  |  Free tier: 25 req/día
// Registro: https://www.alphavantage.co/support/#api-key
// ────────────────────────────────────────────────────────────────────────────

async function fetchAlphaVantage(ticker: string): Promise<FundamentalsData | null> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY
  if (!apiKey) return null

  try {
    const [incomeRes, cashRes, overviewRes] = await Promise.all([
      fetch(
        `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(12000) },
      ),
      fetch(
        `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${ticker}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(12000) },
      ),
      fetch(
        `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(12000) },
      ),
    ])

    // AV devuelve rate-limit como HTTP 200 con body {"Information": "..."}
    // En esos casos, los datos son inútiles — tratar como sin response
    const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
      if (!res.ok) return {}
      const j = await res.json() as Record<string, unknown>
      if (j.Note || j.Information) return {}  // rate limit message
      return j
    }

    const income   = await safeJson(incomeRes)
    const cashData = await safeJson(cashRes)
    const overview = await safeJson(overviewRes)

    // AV devuelve último año en annualReports[0]
    const annualIncome = (income.annualReports   as Record<string, string>[])?.[0] ?? {}
    const annualCash   = (cashData.annualReports as Record<string, string>[])?.[0] ?? {}

    // Si no hay datos de income statement (rate limit o ticker no cubierto), fallar rápido
    if (!annualIncome.totalRevenue) return null

    // Detectar si los valores del income statement están en moneda local (no USD)
    // Caso 1: AV dice explícitamente reportedCurrency ≠ "USD" (ej. GGAL → ARS)
    // Caso 2: AV dice "USD" pero los valores son absurdamente grandes vs market cap
    //         (BMA: revenue 5.8T vs mcap $4.8B → ratio 1200x → claramente en ARS)
    const reportedCurrency = (annualIncome.reportedCurrency as string) ?? "USD"
    const rawRevenue = parseFloat(annualIncome.totalRevenue ?? "")
    const mcap = parseFloat((overview.MarketCapitalization ?? "") as string)
    // isLocalCurrency: tres condiciones alternativas
    // 1. AV dice explícitamente que es ARS (o BRL, etc.)
    // 2. Ratio revenue/mcap > 200 (e.g. 5.8T ARS / $4.8B market cap = 1200x)
    // 3. Revenue > $500B "USD" pero mcap no disponible (fallback absoluto:
    //    ningún company de nuestro screener tiene $500B de revenue en USD)
    const isLocalCurrency =
      reportedCurrency !== "USD" ||
      (!isNaN(rawRevenue) && !isNaN(mcap) && mcap > 0 && rawRevenue / mcap > 200) ||
      rawRevenue > 5e11

    let fxRate = 1  // multiplicador para convertir a USD (local → USD)

    if (isLocalCurrency) {
      // Intentar inferir la moneda real desde la empresa registrada
      // Si reportedCurrency dice "USD" pero es falso, usamos la moneda del país del overview
      const currencyForFX = reportedCurrency !== "USD" ? reportedCurrency : "ARS"
      fxRate = await getFXRate(currencyForFX)
    }

    // Parsea string numérico, devuelve null si "None" o NaN
    const p = (k: string, src: Record<string, string>): number | null => {
      const v = parseFloat(src[k] ?? "")
      if (isNaN(v)) return null
      return fxRate !== 1 ? v * fxRate : v
    }
    // Parsea campo del overview (siempre en USD, no necesita conversión)
    const ov = (k: string): number | null => {
      const v = parseFloat((overview[k] ?? "") as string)
      return isNaN(v) ? null : v
    }

    const revenue    = p("totalRevenue",        annualIncome)
    const grossProfit = p("grossProfit",         annualIncome)
    const ebit       = p("ebit",                annualIncome)
    const ebitda     = p("ebitda",              annualIncome)
    const netIncome  = p("netIncome",           annualIncome)
    const opex       = p("totalOperatingExpense", annualIncome)
    const ocf        = p("operatingCashflow",   annualCash)
    const capex      = p("capitalExpenditures", annualCash)
    const fcf        = ocf != null && capex != null ? ocf - Math.abs(capex) : null

    const evToEbitda = ov("EVToEBITDA")

    return {
      source: "alphavantage",
      totalRevenue: revenue,
      grossProfit,
      ebitda,
      ebit,
      netIncome,
      operatingExpenses: opex,
      operatingCashflow: ocf,
      capitalExpenditures: capex != null ? Math.abs(capex) : null,
      freeCashflow: fcf,
      totalDebt: ov("TotalDebt"),
      ebitdaMargin: revenue && ebitda ? ebitda / revenue : null,
      grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
      operatingMargin: revenue && ebit ? ebit / revenue : null,
      profitMargin: revenue && netIncome ? netIncome / revenue : null,
      marketCap: ov("MarketCapitalization"),
      enterpriseValue: evToEbitda != null && ebitda != null ? evToEbitda * ebitda : null,
      trailingPE: ov("TrailingPE"),
      forwardPE: ov("ForwardPE"),
      priceToBook: ov("PriceToBookRatio"),
      beta: ov("Beta"),
      evToEbitda,
      evToRevenue: ov("EVToRevenue"),
      revenueGrowth: null,
      earningsGrowth: null,
      returnOnEquity: ov("ReturnOnEquityTTM"),
      returnOnAssets: ov("ReturnOnAssetsTTM"),
      dividendYield: ov("DividendYield"),
      eps: ov("EPS"),
      periodo: typeof annualIncome.fiscalDateEnding === "string" ? annualIncome.fiscalDateEnding : null,
      // Si convertimos, reportar USD; si no pudimos convertir, reportar la moneda original
      currency: fxRate !== 1 ? "USD" : (reportedCurrency !== "USD" ? reportedCurrency : (typeof overview.Currency === "string" ? overview.Currency as string : "USD")),
    }
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fuente 3 — Yahoo Finance con crumb refresh
// Sin API key, pero frágil (YF puede bloquear).
// El crumb se cachea en memoria con TTL 6h.
// ────────────────────────────────────────────────────────────────────────────

let _yfCrumb: string | null = null
let _yfCookie: string | null = null
let _yfCrumbExpiry = 0

async function refreshYFCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (_yfCrumb && _yfCookie && _yfCrumbExpiry > Date.now()) {
    return { crumb: _yfCrumb, cookie: _yfCookie }
  }
  try {
    // Step 1: GET finance.yahoo.com para obtener cookies de sesión
    const homeRes = await fetch("https://finance.yahoo.com", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    })
    const setCookie = homeRes.headers.get("set-cookie") ?? ""
    const cookie = setCookie
      .split(",")
      .map(c => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ")

    // Step 2: Obtener el crumb con las cookies de sesión
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!crumbRes.ok) return null
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes("<")) return null  // HTML = blocked

    _yfCrumb = crumb
    _yfCookie = cookie
    _yfCrumbExpiry = Date.now() + 6 * 3600 * 1000  // caduca en 6h
    return { crumb, cookie }
  } catch {
    return null
  }
}

async function fetchYFCrumb(ticker: string): Promise<FundamentalsData | null> {
  const auth = await refreshYFCrumb()
  if (!auth) return null

  try {
    const modules = [
      "financialData",
      "defaultKeyStatistics",
      "summaryDetail",
      "incomeStatementHistory",
      "cashflowStatementHistory",
    ].join(",")

    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: auth.cookie,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null

    const j = await res.json() as Record<string, unknown>
    if ((j.quoteSummary as Record<string, unknown>)?.error) return null

    const qs = ((j.quoteSummary as Record<string, unknown>)?.result as Record<string, unknown>[])?.[0]
    if (!qs) return null

    const fd = (qs.financialData       ?? {}) as Record<string, unknown>
    const ks = (qs.defaultKeyStatistics ?? {}) as Record<string, unknown>
    const sd = (qs.summaryDetail        ?? {}) as Record<string, unknown>
    const is = ((qs.incomeStatementHistory as Record<string, unknown>)
      ?.incomeStatementHistory as Record<string, unknown>[])?.[0] ?? {}
    const cf = ((qs.cashflowStatementHistory as Record<string, unknown>)
      ?.cashflowStatements as Record<string, unknown>[])?.[0] ?? {}

    // Yahoo Finance devuelve { raw: number, fmt: string } — extrae raw
    function rawYF(v: unknown): number | null {
      if (v == null || typeof v !== "object") return null
      const o = v as Record<string, unknown>
      return typeof o.raw === "number" ? o.raw : null
    }

    const revenue     = rawYF(fd.totalRevenue)    ?? rawYF(is.totalRevenue)
    const ebitda      = rawYF(fd.ebitda)
    const ebit        = rawYF(is.ebit)
    const grossProfit = rawYF(is.grossProfit)
    const netIncome   = rawYF(fd.netIncomeToCommon) ?? rawYF(is.netIncome)
    const ocf         = rawYF(fd.operatingCashflow) ?? rawYF(cf.totalCashFromOperatingActivities)
    const capex       = rawYF(cf.capitalExpenditures)
    const fcf         = rawYF(fd.freeCashflow)
    const debt        = rawYF(fd.totalDebt)

    // Si YF no tiene datos financieros (empresa fuera de cobertura YF), continuar cascada
    if (revenue == null && ebitda == null && ebit == null && netIncome == null) return null

    return {
      source: "yahoo_crumb",
      totalRevenue: revenue,
      grossProfit,
      ebitda,
      ebit,
      netIncome,
      operatingExpenses: null,   // no disponible directamente en YF quoteSummary
      operatingCashflow: ocf,
      capitalExpenditures: capex != null ? Math.abs(capex) : null,
      freeCashflow: fcf,
      totalDebt: debt,
      ebitdaMargin: rawYF(fd.ebitdaMargins),
      grossMargin: rawYF(fd.grossMargins),
      operatingMargin: rawYF(fd.operatingMargins),
      profitMargin: rawYF(fd.profitMargins),
      marketCap: rawYF(sd.marketCap),
      enterpriseValue: rawYF(ks.enterpriseValue),
      trailingPE: rawYF(sd.trailingPE),
      forwardPE: rawYF(ks.forwardPE),
      priceToBook: rawYF(ks.priceToBook),
      beta: rawYF(sd.beta),
      evToEbitda: rawYF(ks.enterpriseToEbitda),
      evToRevenue: rawYF(ks.enterpriseToRevenue),
      revenueGrowth: rawYF(fd.revenueGrowth),
      earningsGrowth: rawYF(fd.earningsGrowth),
      returnOnEquity: rawYF(fd.returnOnEquity),
      returnOnAssets: rawYF(fd.returnOnAssets),
      dividendYield: rawYF(sd.dividendYield),
      eps: rawYF(ks.trailingEps),
      periodo: "TTM",
      currency: (fd.financialCurrency as string) ?? "USD",
    }
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cache en memoria + función pública
// ────────────────────────────────────────────────────────────────────────────

const _fundCache: Record<string, { data: FundamentalsData; expiry: number }> = {}

/**
 * Devuelve los fundamentals del ticker usando la cascada FMP → AV → YF crumb.
 * Cachea el resultado según el TTL del calendario de earnings.
 */
export async function getFundamentals(ticker: string): Promise<FundamentalsData> {
  const key = ticker.toUpperCase()

  const cached = _fundCache[key]
  if (cached && cached.expiry > Date.now()) return cached.data

  // Cascada: EDGAR (gratis, anual) → YF crumb (TTM, frágil) → AV (25 req/día) → FMP (250 req/día)
  const result =
    (await fetchSECEdgar(key)) ??
    (await fetchYFCrumb(key)) ??
    (await fetchAlphaVantage(key)) ??
    (await fetchFMP(key))

  const final = result ?? { ...EMPTY_FUNDAMENTALS }

  // TTL inteligente: corto si estamos cerca de earnings, largo si no
  const ttl = result ? fundamentalsTTL(key) : 300  // si falla: reintentar en 5 min
  _fundCache[key] = { data: final, expiry: Date.now() + ttl * 1000 }

  return final
}
