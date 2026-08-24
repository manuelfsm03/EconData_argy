import { fetchRegistered } from "@/server/http/fetch-source"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"
/**
 * /api/mundo — Mercados globales
 *
 * Fuente PRIMARIA:
 *   - Yahoo Finance Chart API (público, sin autenticación)
 *     https://query1.finance.yahoo.com/v8/finance/chart/{ticker}
 *
 * REDUNDANCIA (si Yahoo falla, por ticker):
 *   - Frankfurter (api.frankfurter.app): FX (eurusd, usdbrl, usdcny). Gratis, sin
 *     key, ANDA bien. Sólo trae NIVEL (no variación día-a-día) → variacion_pct 0.
 *   - CoinGecko (registrado en el registry): cripto, con precio y variación 24h.
 *   - stooq.com (CSV): índices y commodities principales. OJO: stooq últimamente
 *     bloquea el acceso automático (404 en /q/l/ o verificación JS), así que es
 *     "best-effort": si contesta CSV lo usamos, si no, esos tickers quedan
 *     cubiertos por el stale-cache.
 *   - STALE-CACHE: los tickers que ninguna fuente en vivo cubra se completan con
 *     la última respuesta buena; si TODO falla, se sirve el último snapshot bueno
 *     con flag { stale: true, stale_since }.
 *
 * Nota: Frankfurter y stooq NO están en el registro de fuentes (fetchRegistered
 * sólo permite hosts registrados), así que a esas dos les pegamos con fetch
 * nativo (URLs públicas fijas, sin input de usuario → sin riesgo SSRF).
 * CoinGecko sí está registrado, por eso usa fetchRegistered.
 *
 * Endpoints:
 *   GET /api/mundo                        — snapshot de todos los tickers
 *   GET /api/mundo?ticker=sp500           — snapshot de un ticker
 *   GET /api/mundo?ticker=sp500&hist=1y   — histórico de un ticker
 *
 * Portado desde EconData_argy/api/services/yfinance_service.py + routers/economia.py
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const TICKERS: Record<string, string> = {
  // Índices
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dow: "^DJI",
  merval: "^MERV",
  vix: "^VIX",
  // Commodities agrícolas
  soja: "ZS=F",
  maiz: "ZC=F",
  trigo: "ZW=F",
  arroz: "ZR=F",
  azucar: "SB=F",   // cotiza en cents/lb — dividir por 100 en UI para USD/lb
  cafe: "KC=F",
  algodon: "CT=F",
  // Energía
  petroleo: "CL=F",
  brent: "BZ=F",
  gas_natural: "NG=F",
  gasoil: "HO=F",
  // Metales — ALI=F (COMEX Aluminium) no tiene datos confiables en YF; usamos HG=F (Cobre) como referencia
  oro: "GC=F",
  plata: "SI=F",
  cobre: "HG=F",
  // Tierras raras & estratégicos
  remx: "REMX",          // VanEck Rare Earth/Strategic Metals ETF
  mp_materials: "MP",    // MP Materials — mayor productor EEUU
  lithium_etf: "LIT",   // Global X Lithium & Battery Tech ETF
  albemarle: "ALB",      // Albemarle — litio/tierras raras
  uranium: "URA",        // Global X Uranium ETF
  cobalt_nickel: "VALE", // Vale — níquel/cobalto
  // FX
  eurusd: "EURUSD=X",
  usdbrl: "USDBRL=X",
  usdcny: "USDCNY=X",
  // Renta fija USA
  us10y: "^TNX",
  us5y: "^FVX",
  us2y: "^IRX", // 13-week T-bill como proxy del extremo corto
  // Índices extra
  dxy: "DX-Y.NYB",
  // Crypto
  bitcoin:  "BTC-USD",
  ethereum: "ETH-USD",
  solana:   "SOL-USD",
  cardano:  "ADA-USD",
  xrp:      "XRP-USD",
  bnb:      "BNB-USD",
  usdt:     "USDT-USD",
  usdc:     "USDC-USD",
}

// ── Mapas a fuentes secundarias ─────────────────────────────────────────────
// Yahoo-name → símbolo stooq (índices, commodities y FX que stooq cubre bien).
// Los que no estén acá quedan cubiertos por el stale-cache si Yahoo se cae.
const STOOQ_MAP: Record<string, string> = {
  sp500: "^spx",
  nasdaq: "^ndq",
  dow: "^dji",
  vix: "^vix",
  oro: "xauusd",
  plata: "xagusd",
  cobre: "hg.f",
  petroleo: "cl.f",
  brent: "cb.f",
  gas_natural: "ng.f",
  soja: "zs.f",
  maiz: "zc.f",
  trigo: "zw.f",
  cafe: "kc.f",
  azucar: "sb.f",
  algodon: "ct.f",
  eurusd: "eurusd",
  usdbrl: "usdbrl",
  usdcny: "usdcny",
  dxy: "dx.f",
}

// Yahoo-name → moneda de Frankfurter (base USD) + si hay que invertir la tasa.
// Frankfurter da "X por USD"; para eurusd (que es USD por EUR) invertimos.
const FRANKFURTER_MAP: Record<string, { cur: string; invertir: boolean }> = {
  eurusd: { cur: "EUR", invertir: true },  // Yahoo EURUSD=X = USD por EUR = 1/(EUR por USD)
  usdbrl: { cur: "BRL", invertir: false }, // Yahoo USDBRL=X = BRL por USD (directo)
  usdcny: { cur: "CNY", invertir: false }, // Yahoo USDCNY=X = CNY por USD (directo)
}

// Yahoo-name → id de CoinGecko (cripto).
const COINGECKO_MAP: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
  cardano: "cardano",
  xrp: "ripple",
  bnb: "binancecoin",
  usdt: "tether",
  usdc: "usd-coin",
}

// Tickers cuya variación diaria suele exceder el umbral por naturaleza (ETFs de volatilidad, cripto)
const HIGH_VOL_TICKERS = new Set(["vix", "bitcoin", "ethereum", "solana", "cardano", "xrp", "bnb"])
const MAX_1D_CHANGE_PCT = 25 // umbral para descartar variaciones sospechosas en commodities / índices

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

// Claves de cache (Map compartido en stale-cache.ts).
const SNAP_KEY = "mundo:snapshot"
const SNAP_TTL = 300     // 5 min de cache fresco para el snapshot
const HIST_TTL = 3600    // 1 h para históricos

// In-memory cache (histórico y electricidad siguen usando este cache simple).
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface QuoteResult {
  precio: number
  variacion_pct: number
  ticker: string
}

// ── PRIMARIA: Yahoo Finance (una cotización) ────────────────────────────────
async function getQuote(nombre: string, ticker: string): Promise<[string, QuoteResult | null]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetchRegistered(url, {
      headers: YF_HEADERS,
      next: { revalidate: 300 },
    })
    if (!res.ok) return [nombre, null]

    const json = await res.json()
    const chart = json?.chart
    if (chart?.error) return [nombre, null]

    const meta = chart?.result?.[0]?.meta
    const last = meta?.regularMarketPrice ?? meta?.chartPreviousClose
    const prev = meta?.chartPreviousClose ?? meta?.previousClose
    if (last == null || prev == null || prev === 0) return [nombre, null]

    const chg = ((last - prev) / prev) * 100

    // Descartar variaciones diarias sospechosas (ej. arroz ZR=F con -98%)
    if (!HIGH_VOL_TICKERS.has(nombre) && Math.abs(chg) > MAX_1D_CHANGE_PCT) {
      console.warn(`[mundo] Variación sospechosa ${ticker} (${nombre}): ${chg.toFixed(2)}% — descartando`)
      return [nombre, null]
    }

    return [
      nombre,
      {
        precio: parseFloat(last.toFixed(4)),
        variacion_pct: parseFloat(chg.toFixed(2)),
        ticker,
      },
    ]
  } catch {
    return [nombre, null]
  }
}

// ── SECUNDARIA: stooq.com (batch CSV) ───────────────────────────────────────
// Pide en un solo request todos los símbolos stooq pedidos. Formato sd2t2ohlcv:
// Symbol,Date,Time,Open,High,Low,Close,Volume. Usamos Close como precio.
// stooq no da variación día-a-día en este formato → variacion_pct = 0.
async function getStooqBatch(nombres: string[]): Promise<Record<string, QuoteResult>> {
  const out: Record<string, QuoteResult> = {}
  const simbolos = nombres.map(n => STOOQ_MAP[n]).filter(Boolean)
  if (!simbolos.length) return out
  // reverso: símbolo stooq (minúsculas) → nombre Yahoo
  const reverso: Record<string, string> = {}
  for (const n of nombres) if (STOOQ_MAP[n]) reverso[STOOQ_MAP[n].toLowerCase()] = n

  try {
    const url = `https://stooq.com/q/l/?s=${simbolos.join("+")}&f=sd2t2ohlcv&h&e=csv`
    // fetch nativo: host no registrado en el registry (ver nota del encabezado).
    const res = await fetch(url, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return out
    const csv = (await res.text()).trim()
    // Si stooq contesta HTML (404 o verificación JS) en vez de CSV, cortamos.
    if (csv.startsWith("<")) return out
    const lines = csv.split("\n")
    // línea 0 = header; una línea por símbolo
    for (const line of lines.slice(1)) {
      const cols = line.split(",")
      const sym = (cols[0] ?? "").toLowerCase().trim()
      const nombre = reverso[sym]
      if (!nombre) continue
      const close = parseFloat(cols[6] ?? "")   // Close
      if (!Number.isFinite(close)) continue      // "N/D" → sin dato
      out[nombre] = {
        precio: parseFloat(close.toFixed(4)),
        variacion_pct: 0, // stooq (este formato) no trae variación día-a-día
        ticker: STOOQ_MAP[nombre],
      }
    }
  } catch {
    // silencioso: si stooq falla, quedan para el stale-cache
  }
  return out
}

// ── SECUNDARIA: Frankfurter (FX) ────────────────────────────────────────────
// Un solo request con base USD; devuelve { rates: { EUR, BRL, CNY, ... } }.
// No trae variación día-a-día → variacion_pct = 0.
async function getFrankfurterBatch(nombres: string[]): Promise<Record<string, QuoteResult>> {
  const out: Record<string, QuoteResult> = {}
  const pedidos = nombres.filter(n => FRANKFURTER_MAP[n])
  if (!pedidos.length) return out
  const monedas = [...new Set(pedidos.map(n => FRANKFURTER_MAP[n].cur))]

  try {
    const url = `https://api.frankfurter.app/latest?from=USD&to=${monedas.join(",")}`
    // fetch nativo: host no registrado en el registry (ver nota del encabezado).
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return out
    const j = await res.json()
    const rates = j?.rates ?? {}
    for (const n of pedidos) {
      const { cur, invertir } = FRANKFURTER_MAP[n]
      const raw = rates[cur]
      if (typeof raw !== "number" || raw === 0) continue
      const precio = invertir ? 1 / raw : raw
      out[n] = { precio: parseFloat(precio.toFixed(4)), variacion_pct: 0, ticker: cur }
    }
  } catch {
    // silencioso: si Frankfurter falla, la FX queda para stooq o el stale-cache
  }
  return out
}

// ── SECUNDARIA: CoinGecko (batch, cripto) ───────────────────────────────────
// Trae precio USD y variación 24h. Host registrado → fetchRegistered.
async function getCoinGeckoBatch(nombres: string[]): Promise<Record<string, QuoteResult>> {
  const out: Record<string, QuoteResult> = {}
  const ids = nombres.map(n => COINGECKO_MAP[n]).filter(Boolean)
  if (!ids.length) return out
  const reverso: Record<string, string> = {}
  for (const n of nombres) if (COINGECKO_MAP[n]) reverso[COINGECKO_MAP[n]] = n

  try {
    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}` +
      `&vs_currencies=usd&include_24hr_change=true`
    const res = await fetchRegistered(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return out
    const j = await res.json()
    for (const [id, nombre] of Object.entries(reverso)) {
      const row = j?.[id]
      const precio = row?.usd
      if (typeof precio !== "number") continue
      const chg = typeof row?.usd_24h_change === "number" ? row.usd_24h_change : 0
      out[nombre] = {
        precio: parseFloat(precio.toFixed(4)),
        variacion_pct: parseFloat(chg.toFixed(2)),
        ticker: COINGECKO_MAP[nombre],
      }
    }
  } catch {
    // silencioso: si CoinGecko falla, la cripto queda para el stale-cache
  }
  return out
}

// Cotización secundaria para UN ticker (usada en la ruta ?ticker=...).
// Orden: Frankfurter (FX) → CoinGecko (cripto) → stooq (índices/commodities).
async function getSecondaryQuote(nombre: string): Promise<{ quote: QuoteResult; source: string } | null> {
  if (FRANKFURTER_MAP[nombre]) {
    const r = await getFrankfurterBatch([nombre])
    if (r[nombre]) return { quote: r[nombre], source: "frankfurter" }
  }
  if (COINGECKO_MAP[nombre]) {
    const r = await getCoinGeckoBatch([nombre])
    if (r[nombre]) return { quote: r[nombre], source: "coingecko" }
  }
  if (STOOQ_MAP[nombre]) {
    const r = await getStooqBatch([nombre])
    if (r[nombre]) return { quote: r[nombre], source: "stooq" }
  }
  return null
}

interface SnapshotResult {
  data: Record<string, QuoteResult | null>
  stale: boolean
  staleSince?: string
  sources: string[]
}

async function getSnapshot(): Promise<SnapshotResult> {
  // 1) Cache fresco.
  const fresco = leerFresco<Record<string, QuoteResult | null>>(SNAP_KEY)
  if (fresco) return { data: fresco, stale: false, sources: ["cache"] }

  // 2) PRIMARIA: Yahoo (todos los tickers en paralelo).
  const pairs = await Promise.allSettled(
    Object.entries(TICKERS).map(([n, t]) => getQuote(n, t)),
  )
  const live: Record<string, QuoteResult | null> = {}
  for (const n of Object.keys(TICKERS)) live[n] = null
  for (const p of pairs) {
    if (p.status === "fulfilled") {
      const [nombre, data] = p.value
      live[nombre] = data
    }
  }

  const sources: string[] = []
  if (Object.values(live).some(v => v != null)) sources.push("yahoo_finance")

  // 3) SECUNDARIA Frankfurter: FX que falte (anda bien, va primero).
  const faltanFK = Object.keys(FRANKFURTER_MAP).filter(n => live[n] == null)
  if (faltanFK.length) {
    const f = await getFrankfurterBatch(faltanFK)
    let uso = false
    for (const [n, q] of Object.entries(f)) {
      if (live[n] == null) { live[n] = q; uso = true }
    }
    if (uso) sources.push("frankfurter")
  }

  // 4) SECUNDARIA CoinGecko: cripto que falte.
  const faltanCG = Object.keys(COINGECKO_MAP).filter(n => live[n] == null)
  if (faltanCG.length) {
    const c = await getCoinGeckoBatch(faltanCG)
    let uso = false
    for (const [n, q] of Object.entries(c)) {
      if (live[n] == null) { live[n] = q; uso = true }
    }
    if (uso) sources.push("coingecko")
  }

  // 5) SECUNDARIA stooq: índices/commodities que falten (best-effort, ver nota).
  const faltanStooq = Object.keys(STOOQ_MAP).filter(n => live[n] == null)
  if (faltanStooq.length) {
    const s = await getStooqBatch(faltanStooq)
    let uso = false
    for (const [n, q] of Object.entries(s)) {
      if (live[n] == null) { live[n] = q; uso = true }
    }
    if (uso) sources.push("stooq")
  }

  const liveCount = Object.values(live).filter(v => v != null).length

  // 6) Merge con el último bueno: los tickers que NINGUNA fuente en vivo cubrió
  //    se completan con el último dato bueno (stale) si existe.
  const prev = leerUltimoBueno<Record<string, QuoteResult | null>>(SNAP_KEY)
  let usedStale = false
  const final: Record<string, QuoteResult | null> = {}
  for (const n of Object.keys(TICKERS)) {
    if (live[n] != null) {
      final[n] = live[n]
    } else if (prev?.data?.[n] != null) {
      final[n] = prev.data[n]
      usedStale = true
    } else {
      final[n] = null
    }
  }

  if (liveCount > 0) {
    // Hubo refresh en vivo → guardamos el merge (fresco + último bueno).
    guardarExito(SNAP_KEY, final, SNAP_TTL)
    return {
      data: final,
      stale: usedStale,
      staleSince: usedStale ? prev?.staleSince : undefined,
      sources,
    }
  }

  // 7) liveCount === 0 → TODO falló: servir el último snapshot bueno completo.
  if (prev) {
    return { data: prev.data, stale: true, staleSince: prev.staleSince, sources: ["stale-cache"] }
  }

  // 8) Nunca hubo dato bueno: devolvemos el mapa (con nulls) sin romper contrato.
  return { data: final, stale: false, sources: ["unavailable"] }
}

async function getHistorico(nombre: string, period = "1y"): Promise<[string, number][]> {
  const ticker = TICKERS[nombre]
  if (!ticker) return []

  const cacheKey = `yf_hist_${nombre}_${period}`
  const cached = getCache<[string, number][]>(cacheKey)
  if (cached) return cached

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${period}`
    const res = await fetchRegistered(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) return []

    const json = await res.json()
    const result_data = json?.chart?.result?.[0]
    const timestamps: number[] = result_data?.timestamp || []
    const closes: (number | null)[] = result_data?.indicators?.quote?.[0]?.close || []

    const data: [string, number][] = timestamps
      .map((ts, i) => {
        const c = closes[i]
        if (c == null) return null
        const dateStr = new Date(ts * 1000).toISOString().split("T")[0]
        return [dateStr, parseFloat(c.toFixed(4))] as [string, number]
      })
      .filter((x): x is [string, number] => x !== null)

    setCache(cacheKey, data, 3600)
    return data
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")
  const hist = searchParams.get("hist")
  const endpoint = searchParams.get("endpoint")

  try {
    // ── MACRO COMPARADA LATINOAMERICANA ─────────────────────────────────────
    if (endpoint === "macro_comparada") {
      return NextResponse.json(
        { error: { code: "SOURCE_NOT_CONFIGURED", message: "Usar /api/world-macro para macro comparada", retryable: false } },
        { status: 503 },
      )
    }

    // ── ELECTRICIDAD MUNDIAL (OWID) ─────────────────────────────────────────
    if (endpoint === "electricidad") {
      const cacheKey = "owid_electricidad"
      const cached = getCache<Record<string, unknown>[]>(cacheKey)
      if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), source: "Our World in Data — Ember / Energy Institute" })

      const OWID_ENTITIES = new Set(["Argentina", "Brazil", "China", "European Union (27)", "India", "United States"])
      const url = "https://ourworldindata.org/grapher/electricity-generation.csv?tab=chart"
      const res = await fetchRegistered(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        // Fallback stale: si OWID se cae, servir el último bueno si lo hay.
        const prev = leerUltimoBueno<Record<string, unknown>[]>("mundo:electricidad")
        if (prev) return NextResponse.json({ data: prev.data, stale: true, stale_since: prev.staleSince, updated_at: new Date().toISOString(), source: "stale-cache" })
        return NextResponse.json({ error: "OWID no disponible", data: [] }, { status: 502 })
      }

      const text = await res.text()
      const lines = text.trim().split("\n")
      const byYear: Record<string, Record<string, unknown>> = {}
      for (const line of lines.slice(1)) {
        const parts = line.split(",")
        const entity = parts[0]?.replace(/"/g, "").trim() ?? ""
        if (!OWID_ENTITIES.has(entity)) continue
        const year = parts[2]?.trim() ?? ""
        const twh = parseFloat(parts[3]?.trim() ?? "")
        if (!year || isNaN(twh)) continue
        if (!byYear[year]) byYear[year] = { date: `${year}-01-01` }
        byYear[year][entity] = parseFloat(twh.toFixed(2))
      }
      const data = Object.values(byYear).sort((a, b) =>
        (a.date as string).localeCompare(b.date as string)
      )

      setCache(cacheKey, data, 3600)
      guardarExito("mundo:electricidad", data, 3600) // también como último bueno
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "Our World in Data — Ember / Energy Institute Statistical Review" })
    }

    // ── HISTÓRICO DE UN TICKER ──────────────────────────────────────────────
    if (ticker && hist) {
      if (!(ticker in TICKERS)) {
        return NextResponse.json({ error: "ticker desconocido", valid: Object.keys(TICKERS) }, { status: 400 })
      }
      const histKey = `mundo:hist:${ticker}:${hist}`
      const data = await getHistorico(ticker, hist)
      if (data.length) {
        guardarExito(histKey, data, HIST_TTL) // guardar como último bueno
        return NextResponse.json({ data, ticker, period: hist, updated_at: new Date().toISOString(), source: "yahoo_finance", stale: false })
      }
      // Yahoo no trajo histórico → servir el último bueno (stale) si existe.
      const prev = leerUltimoBueno<[string, number][]>(histKey)
      if (prev) {
        return NextResponse.json({ data: prev.data, ticker, period: hist, updated_at: new Date().toISOString(), source: "stale-cache", stale: true, stale_since: prev.staleSince })
      }
      // Sin histórico previo: array vacío pero 200 (no rompemos el contrato).
      return NextResponse.json({ data: [], ticker, period: hist, updated_at: new Date().toISOString(), source: "unavailable", stale: false })
    }

    // ── SNAPSHOT DE UN TICKER ───────────────────────────────────────────────
    if (ticker) {
      const [, yahoo] = await getQuote(ticker, TICKERS[ticker] ?? ticker)
      let data: QuoteResult | null = yahoo
      let source = data ? "yahoo_finance" : ""
      let stale = false
      let staleSince: string | undefined

      // Secundaria si Yahoo no trajo nada.
      if (!data) {
        const sec = await getSecondaryQuote(ticker)
        if (sec) { data = sec.quote; source = sec.source }
      }

      const tKey = `mundo:t:${ticker}`
      if (data) {
        guardarExito(tKey, data, SNAP_TTL)
      } else {
        // Todo falló → último bueno del ticker, o del snapshot completo.
        const prevT = leerUltimoBueno<QuoteResult>(tKey)
        const prevSnap = leerUltimoBueno<Record<string, QuoteResult | null>>(SNAP_KEY)
        const fromSnap = prevSnap?.data?.[ticker] ?? null
        if (prevT) { data = prevT.data; stale = true; staleSince = prevT.staleSince; source = "stale-cache" }
        else if (fromSnap) { data = fromSnap; stale = true; staleSince = prevSnap?.staleSince; source = "stale-cache" }
      }

      return NextResponse.json({
        data,
        ticker,
        updated_at: new Date().toISOString(),
        source: source || "unavailable",
        stale,
        ...(staleSince ? { stale_since: staleSince } : {}),
      })
    }

    // ── SNAPSHOT COMPLETO ───────────────────────────────────────────────────
    const snap = await getSnapshot()
    return NextResponse.json({
      data: snap.data,
      tickers: Object.keys(TICKERS),
      updated_at: new Date().toISOString(),
      source: snap.sources.join("+") || "yahoo_finance",
      stale: snap.stale,
      ...(snap.staleSince ? { stale_since: snap.staleSince } : {}),
    })
  } catch (error) {
    console.error("[/api/mundo]", error)
    // Último recurso ante un error inesperado: intentar servir el snapshot stale.
    const prev = leerUltimoBueno<Record<string, QuoteResult | null>>(SNAP_KEY)
    if (prev && !ticker && !hist) {
      return NextResponse.json({
        data: prev.data,
        tickers: Object.keys(TICKERS),
        updated_at: new Date().toISOString(),
        source: "stale-cache",
        stale: true,
        stale_since: prev.staleSince,
      })
    }
    return NextResponse.json({ error: "Error al obtener datos de mercado", detail: String(error) }, { status: 500 })
  }
}
