import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

/**
 * /api/derived — Variables calculadas a partir de fuentes propias.
 *
 * Calcula en tiempo real, sin API key externa:
 *   tasas_reales    — tasa política − inflación IMF por banco central
 *   spreads_carry   — diferencial vs Fed (ranking carry trade)
 *   ratios_commodities — Gold/Silver, Cobre/Oro, WTI-Brent, ITBI ARG
 *   risk_score      — índice propio 0-100 (VIX + S&P + DXY + Fear&Greed)
 *   ntv_btc         — Network Value to Transactions (Blockchain.com)
 *
 * Llama internamente a /api/bancos-centrales y /api/imf-macro (ya cacheados),
 * más Yahoo Finance, Blockchain.com y Alternative.me directamente.
 *
 * TTL cache: 20 min.
 */

export const runtime = "nodejs"

const CACHE_KEY = "derived:v1"
const TTL_SEG = 20 * 60

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface TasaReal {
  pais: string
  moneda: string
  tasa_nominal: number | null
  inflacion: number | null
  inflacion_anio: number | null
  tasa_real: number | null
  esVivo: boolean
}

export interface SpreadCarry {
  par: string
  pais_a: string
  pais_b: string
  tasa_a: number | null
  tasa_b: number | null
  spread: number | null
}

export interface RatiosCommodities {
  gold_silver: number | null
  cobre_oro: number | null      // ×1000 para escala legible
  wti_brent: number | null      // spread en USD/bbl
  itbi_arg: number | null       // índice términos intercambio ARG en USc/bu ponderado
}

export interface RiskScore {
  score: number | null          // 0–100 ; 100 = euforia / risk-on
  clasificacion: string | null
  componentes: {
    vix: number | null
    sp500_cambio_pct: number | null
    dxy_cambio_pct: number | null
    fear_greed: number | null
    scores: {
      vix: number | null
      sp500: number | null
      dxy: number | null
      fear_greed: number | null
    }
  }
}

export interface NtvBtc {
  ntv: number | null
  market_cap_usd: number | null
  n_tx_24h: number | null
  interpretacion: string | null
}

export interface DerivedData {
  tasas_reales: TasaReal[]
  spreads_carry: SpreadCarry[]
  ratios_commodities: RatiosCommodities
  risk_score: RiskScore
  ntv_btc: NtvBtc
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function riskLabel(score: number): string {
  if (score <= 20) return "Pánico extremo"
  if (score <= 40) return "Risk-Off"
  if (score <= 60) return "Neutro"
  if (score <= 80) return "Risk-On"
  return "Euforia"
}

// v7/quote requiere auth desde 2025; usamos v8/chart por ticker (sin auth)
async function fetchYF(tickers: string[]): Promise<Map<string, { price: number | null; changePct: number | null }>> {
  async function fetchChart(t: string): Promise<{ price: number; changePct: number } | null> {
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const res = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(t)}?interval=1d&range=5d`, { headers: YF_HEADERS, signal: AbortSignal.timeout(8_000) })
        if (!res.ok) continue
        const json = await res.json() as { chart?: { result?: unknown[] } }
        const result = json?.chart?.result?.[0] as { timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } } | undefined
        if (!result) continue
        const closes = result.indicators?.quote?.[0]?.close ?? []
        const valid: number[] = closes.filter((c): c is number => c != null)
        if (!valid.length) continue
        const last = valid[valid.length - 1]
        const prev = valid.length > 1 ? valid[valid.length - 2] : null
        const changePct = prev && prev > 0 ? ((last - prev) / prev) * 100 : 0
        return { price: last, changePct }
      } catch { /* next host */ }
    }
    return null
  }
  const entries = await Promise.all(tickers.map(async (t) => [t, await fetchChart(t)] as const))
  const map = new Map<string, { price: number | null; changePct: number | null }>()
  for (const [t, d] of entries) { map.set(t, { price: d?.price ?? null, changePct: d?.changePct ?? null }) }
  return map
}

// ── Mapping banco-key → ISO3 para cruzar con IMF ──────────────────────────────

const BANCO_META: Record<string, { iso3: string; pais: string; moneda: string }> = {
  fed:            { iso3: "USA", pais: "Estados Unidos", moneda: "USD" },
  bce:            { iso3: "DEU", pais: "Eurozona",       moneda: "EUR" },
  bcb:            { iso3: "BRA", pais: "Brasil",         moneda: "BRL" },
  boe:            { iso3: "GBR", pais: "Reino Unido",    moneda: "GBP" },
  boc:            { iso3: "CAN", pais: "Canadá",         moneda: "CAD" },
  banxico:        { iso3: "MEX", pais: "México",         moneda: "MXN" },
  bcentral_chile: { iso3: "CHL", pais: "Chile",          moneda: "CLP" },
  boj:            { iso3: "JPN", pais: "Japón",          moneda: "JPY" },
  rba:            { iso3: "AUS", pais: "Australia",      moneda: "AUD" },
  bcra:           { iso3: "ARG", pais: "Argentina",      moneda: "ARS" },
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const cached = leerFresco<DerivedData>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })
  }

  const origin = new URL(req.url).origin

  // Fetch todas las fuentes en paralelo
  const [bancosRes, imfRes, blockchainRes, fearGreedRes, yfSettled] = await Promise.allSettled([
    fetch(`${origin}/api/bancos-centrales`, { signal: AbortSignal.timeout(25_000) }),
    fetch(`${origin}/api/imf-macro`, { signal: AbortSignal.timeout(25_000) }),
    fetch("https://api.blockchain.info/stats", { signal: AbortSignal.timeout(10_000) }),
    fetch("https://api.alternative.me/fng/?limit=1&format=json", { signal: AbortSignal.timeout(8_000) }),
    fetchYF(["GC=F", "SI=F", "HG=F", "CL=F", "BZ=F", "ZS=F", "ZC=F", "ZW=F", "^VIX", "DX-Y.NYB", "^GSPC"]),
  ])

  // ── Parsear bancos centrales ──────────────────────────────────────────────
  interface BancoRaw { pais: string; moneda: string; tasa: number | null; esVivo: boolean }
  const bancos: Record<string, BancoRaw> =
    bancosRes.status === "fulfilled" && bancosRes.value.ok
      ? ((await bancosRes.value.json()) as { data: Record<string, BancoRaw> }).data ?? {}
      : {}

  // ── Parsear IMF macro ─────────────────────────────────────────────────────
  interface ImfPaisRaw { code: string; inflacion: number | null; inflacion_anio: number | null }
  const imfList: ImfPaisRaw[] =
    imfRes.status === "fulfilled" && imfRes.value.ok
      ? ((await imfRes.value.json()) as { data: ImfPaisRaw[] }).data ?? []
      : []
  const inflMap = new Map(imfList.map((p) => [p.code, { inflacion: p.inflacion, anio: p.inflacion_anio }]))

  // ── Parsear Blockchain.com ────────────────────────────────────────────────
  interface BlockchainRaw { market_price_usd: number; n_tx: number; totalbc: number }
  const blockchain: BlockchainRaw | null =
    blockchainRes.status === "fulfilled" && (blockchainRes.value as Response).ok
      ? await (blockchainRes.value as Response).json()
      : null

  // ── Parsear Fear & Greed ──────────────────────────────────────────────────
  interface FGRaw { data: Array<{ value: string }> }
  const fgRaw: FGRaw | null =
    fearGreedRes.status === "fulfilled" && (fearGreedRes.value as Response).ok
      ? await (fearGreedRes.value as Response).json()
      : null
  const fearGreed: number | null =
    fgRaw?.data?.[0]?.value != null ? parseInt(fgRaw.data[0].value, 10) : null

  // ── Yahoo Finance quotes ──────────────────────────────────────────────────
  const yf = yfSettled.status === "fulfilled" ? yfSettled.value : new Map<string, { price: number | null; changePct: number | null }>()

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TASAS REALES
  // ═══════════════════════════════════════════════════════════════════════════
  const tasas_reales: TasaReal[] = Object.entries(BANCO_META)
    .map(([key, meta]) => {
      const banco = bancos[key]
      const infl  = inflMap.get(meta.iso3)
      const tasa_nominal = banco?.tasa ?? null
      const inflacion    = infl?.inflacion ?? null
      const tasa_real    = tasa_nominal != null && inflacion != null
        ? parseFloat((tasa_nominal - inflacion).toFixed(2))
        : null
      return {
        pais:          banco?.pais ?? meta.pais,
        moneda:        meta.moneda,
        tasa_nominal,
        inflacion,
        inflacion_anio: infl?.anio ?? null,
        tasa_real,
        esVivo:        banco?.esVivo ?? false,
      }
    })
    .sort((a, b) => {
      if (a.tasa_real == null && b.tasa_real == null) return 0
      if (a.tasa_real == null) return 1
      if (b.tasa_real == null) return -1
      return b.tasa_real - a.tasa_real
    })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SPREADS CARRY (vs Fed)
  // ═══════════════════════════════════════════════════════════════════════════
  const fedRate = bancos["fed"]?.tasa ?? null
  const CARRY_PAIRS: Array<[string, string, string]> = [
    ["bcb",            "Brasil",        "BRL/USD"],
    ["boe",            "Reino Unido",   "GBP/USD"],
    ["boc",            "Canadá",        "CAD/USD"],
    ["banxico",        "México",        "MXN/USD"],
    ["bcentral_chile", "Chile",         "CLP/USD"],
    ["rba",            "Australia",     "AUD/USD"],
    ["bce",            "Eurozona",      "EUR/USD"],
    ["boj",            "Japón",         "JPY/USD"],
    ["bcra",           "Argentina",     "ARS/USD"],
  ]

  const spreads_carry: SpreadCarry[] = CARRY_PAIRS
    .map(([key, pais_a, par]) => {
      const tasa_a = bancos[key]?.tasa ?? null
      return {
        par,
        pais_a,
        pais_b: "Estados Unidos",
        tasa_a,
        tasa_b: fedRate,
        spread: tasa_a != null && fedRate != null
          ? parseFloat((tasa_a - fedRate).toFixed(2))
          : null,
      }
    })
    .sort((a, b) => {
      if (a.spread == null && b.spread == null) return 0
      if (a.spread == null) return 1
      if (b.spread == null) return -1
      return b.spread - a.spread
    })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. RATIOS COMMODITIES
  // ═══════════════════════════════════════════════════════════════════════════
  const gold   = yf.get("GC=F")?.price ?? null
  const silver = yf.get("SI=F")?.price ?? null
  const copper = yf.get("HG=F")?.price ?? null
  const wti    = yf.get("CL=F")?.price ?? null
  const brent  = yf.get("BZ=F")?.price ?? null
  const soja   = yf.get("ZS=F")?.price ?? null   // USc/bu
  const maiz   = yf.get("ZC=F")?.price ?? null
  const trigo  = yf.get("ZW=F")?.price ?? null

  // ITBI ARG: canasta export ponderada (soja 55%, maíz 25%, trigo 20%)
  const itbi_arg =
    soja != null && maiz != null && trigo != null
      ? parseFloat((0.55 * soja + 0.25 * maiz + 0.20 * trigo).toFixed(1))
      : soja != null
      ? soja
      : null

  const ratios_commodities: RatiosCommodities = {
    gold_silver: gold != null && silver != null && silver > 0
      ? parseFloat((gold / silver).toFixed(1))
      : null,
    cobre_oro: copper != null && gold != null && gold > 0
      ? parseFloat((copper / gold * 1000).toFixed(3))
      : null,
    wti_brent: wti != null && brent != null
      ? parseFloat((wti - brent).toFixed(2))
      : null,
    itbi_arg,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. RISK SCORE (0–100)
  // ═══════════════════════════════════════════════════════════════════════════
  const vix         = yf.get("^VIX")?.price ?? null
  const sp500Chg    = yf.get("^GSPC")?.changePct ?? null
  const dxyChg      = yf.get("DX-Y.NYB")?.changePct ?? null

  // VIX: 10→score 100 (calm), 50→score 0 (extreme fear)
  const scoreVix = vix != null ? clamp(Math.round(100 - (vix - 10) * 2.5), 0, 100) : null
  // S&P 500: +2%→60, -2%→40; lineal 5pts/1%
  const scoreSp  = sp500Chg != null ? clamp(Math.round(50 + sp500Chg * 5), 0, 100) : null
  // DXY: sube→USD safe haven→risk off; -1%→55, +1%→45
  const scoreDxy = dxyChg != null ? clamp(Math.round(50 - dxyChg * 5), 0, 100) : null
  // Fear & Greed: directo 0-100
  const scoreFg  = fearGreed

  const validScores = [scoreVix, scoreSp, scoreDxy, scoreFg].filter((s): s is number => s != null)
  const riskScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null

  const risk_score: RiskScore = {
    score: riskScore,
    clasificacion: riskScore != null ? riskLabel(riskScore) : null,
    componentes: {
      vix,
      sp500_cambio_pct: sp500Chg,
      dxy_cambio_pct: dxyChg,
      fear_greed: fearGreed,
      scores: { vix: scoreVix, sp500: scoreSp, dxy: scoreDxy, fear_greed: scoreFg },
    },
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. NTV BTC (Network Value to Transactions)
  // NTV = Market Cap / TX diarias — por encima de 65k USD/tx = sobrevaluado
  // ═══════════════════════════════════════════════════════════════════════════
  let ntv_btc: NtvBtc = { ntv: null, market_cap_usd: null, n_tx_24h: null, interpretacion: null }
  if (blockchain) {
    const mktCap = blockchain.market_price_usd * (blockchain.totalbc / 1e8)
    const ntv = blockchain.n_tx > 0 ? Math.round(mktCap / blockchain.n_tx) : null
    ntv_btc = {
      ntv,
      market_cap_usd: Math.round(mktCap),
      n_tx_24h: blockchain.n_tx,
      interpretacion:
        ntv == null ? null
        : ntv > 65000 ? "Sobrevaluado"
        : ntv < 27000 ? "Subvaluado"
        : "Rango justo",
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Ensamblar y cachear
  // ═══════════════════════════════════════════════════════════════════════════
  const data: DerivedData = { tasas_reales, spreads_carry, ratios_commodities, risk_score, ntv_btc }

  if (tasas_reales.some((t) => t.tasa_nominal != null) || risk_score.score != null) {
    guardarExito(CACHE_KEY, data, TTL_SEG)
  }

  return NextResponse.json({
    data,
    cached: false,
    updated_at: new Date().toISOString(),
    fuente: "Cálculos propios — NY Fed · OECD · IMF · Yahoo Finance · Blockchain.com · Alternative.me",
  })
}
