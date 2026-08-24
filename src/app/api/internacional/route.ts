import { fetchRegistered } from "@/server/http/fetch-source"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"
/**
 * /api/internacional — Divisas y DXY internacionales
 *
 * Fuente PRIMARIA: Yahoo Finance Chart API (público, sin auth)
 *   DX-Y.NYB  → DXY (Índice del dólar)
 *   EURUSD=X  → EUR/USD  (dólares por euro)
 *   JPYUSD=X  → JPY/USD  (dólares por yen, inverso de USD/JPY)
 *   BRL=X     → USD/BRL  (reales por dólar)
 *
 * REDUNDANCIA (si Yahoo falla):
 *   - Fuente SECUNDARIA FX: Frankfurter API (api.frankfurter.app), gratis y sin
 *     API key. Devuelve tasas base USD → EUR/JPY/BRL; las invertimos para dejar
 *     la MISMA convención que Yahoo. No trae variación diaria → chg queda null.
 *   - Fuente SECUNDARIA DXY: stooq.com (CSV del futuro del índice dólar, dx.f).
 *     OJO: stooq últimamente bloquea el acceso automático (404 en /q/l/ o página
 *     de verificación JS), así que es "best-effort": si contesta CSV lo usamos,
 *     si no, el DXY queda cubierto por el stale-cache. Frankfurter (FX) sí anda.
 *   - STALE-CACHE: si TODAS las fuentes fallan, servimos la última respuesta
 *     buena guardada en memoria, con flag { stale: true, stale_since }.
 *
 * Nota: Frankfurter y stooq NO están en el registro de fuentes (fetchRegistered
 * sólo permite hosts registrados), así que a esas dos les pegamos con fetch
 * nativo. Son URLs públicas fijas (sin input del usuario), no hay riesgo SSRF.
 */

import { NextResponse } from "next/server"

export const runtime = "nodejs"

const CACHE_KEY = "internacional:fx"
const TTL_SEG = 300 // 5 min de cache "fresco"

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

// Forma del bloque de datos que devuelve el endpoint (contrato con el frontend).
interface DatosFX {
  dxy: number | null
  eurUsd: number | null
  jpyUsd: number | null
  brlUsd: number | null
  dxyChg: number | null
  eurChg: number | null
  jpyChg: number | null
  brlChg: number | null
}

// ── PRIMARIA: Yahoo Finance ────────────────────────────────────────────────
async function getYFQuote(ticker: string): Promise<{ price: number | null; chg: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetchRegistered(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return { price: null, chg: null }
    const j = await res.json()
    const meta = j?.chart?.result?.[0]?.meta
    const last: number | null = meta?.regularMarketPrice ?? null
    const prev: number | null = meta?.chartPreviousClose ?? null
    const chg = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : null
    return { price: last != null ? parseFloat(last.toFixed(4)) : null, chg: chg != null ? parseFloat(chg.toFixed(2)) : null }
  } catch {
    return { price: null, chg: null }
  }
}

// ── SECUNDARIA FX: Frankfurter API ─────────────────────────────────────────
// Devuelve { rates: { EUR, JPY, BRL } } con base USD (X por dólar).
// Convertimos a la convención de Yahoo:
//   eurUsd = 1 / (EUR por USD)   (dólares por euro)
//   jpyUsd = 1 / (JPY por USD)   (dólares por yen)
//   brlUsd = BRL por USD         (reales por dólar, ya en esa convención)
async function getFrankfurterFX(): Promise<Partial<DatosFX>> {
  try {
    const url = "https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,BRL"
    // fetch nativo: host no registrado en el registry (ver nota del encabezado).
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    const j = await res.json()
    const r = j?.rates ?? {}
    const eur = typeof r.EUR === "number" && r.EUR !== 0 ? parseFloat((1 / r.EUR).toFixed(4)) : null
    const jpy = typeof r.JPY === "number" && r.JPY !== 0 ? parseFloat((1 / r.JPY).toFixed(4)) : null
    const brl = typeof r.BRL === "number" ? parseFloat(r.BRL.toFixed(4)) : null
    return { eurUsd: eur, jpyUsd: jpy, brlUsd: brl }
  } catch {
    return {}
  }
}

// ── SECUNDARIA DXY: stooq.com (CSV) ────────────────────────────────────────
// dx.f = futuro del índice dólar. Formato sd2t2ohlcv → columnas:
// Symbol,Date,Time,Open,High,Low,Close,Volume. Usamos Close como nivel del DXY.
async function getStooqDXY(): Promise<number | null> {
  try {
    const url = "https://stooq.com/q/l/?s=dx.f&f=sd2t2ohlcv&h&e=csv"
    // fetch nativo: host no registrado en el registry (ver nota del encabezado).
    const res = await fetch(url, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const csv = (await res.text()).trim()
    // Si stooq contesta HTML (página 404 o verificación JS) en vez de CSV, cortamos.
    if (csv.startsWith("<")) return null
    const lines = csv.split("\n")
    if (lines.length < 2) return null
    const cols = lines[1].split(",")
    // Close es la columna 7 (índice 6): Symbol,Date,Time,Open,High,Low,Close,Volume
    const close = parseFloat(cols[6] ?? "")
    return Number.isFinite(close) ? parseFloat(close.toFixed(4)) : null
  } catch {
    return null
  }
}

export async function GET() {
  // 1) Cache fresco: si está vigente, se sirve tal cual.
  const cached = leerFresco<DatosFX>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({ data: cached, cached: true, stale: false, updated_at: new Date().toISOString() })
  }

  // 2) PRIMARIA — Yahoo (los 4 tickers en paralelo).
  const [dxyRes, eurRes, jpyRes, brlRes] = await Promise.all([
    getYFQuote("DX-Y.NYB"),
    getYFQuote("EURUSD=X"),
    getYFQuote("JPYUSD=X"),
    getYFQuote("BRL=X"),
  ])

  const data: DatosFX = {
    dxy:    dxyRes.price,
    eurUsd: eurRes.price,
    jpyUsd: jpyRes.price,
    brlUsd: brlRes.price,
    dxyChg: dxyRes.chg,
    eurChg: eurRes.chg,
    jpyChg: jpyRes.chg,
    brlChg: brlRes.chg,
  }

  const fuentes: string[] = []
  if ([dxyRes.price, eurRes.price, jpyRes.price, brlRes.price].some(v => v != null)) {
    fuentes.push("yahoo_finance")
  }

  // 3) SECUNDARIAS — sólo para rellenar lo que Yahoo no trajo.
  //    Cada una en su propio try/catch (ya encapsulado en las funciones).
  const faltanFX = data.eurUsd == null || data.jpyUsd == null || data.brlUsd == null
  if (faltanFX) {
    const fk = await getFrankfurterFX()
    if (fk.eurUsd != null && data.eurUsd == null) data.eurUsd = fk.eurUsd
    if (fk.jpyUsd != null && data.jpyUsd == null) data.jpyUsd = fk.jpyUsd
    if (fk.brlUsd != null && data.brlUsd == null) data.brlUsd = fk.brlUsd
    if (fk.eurUsd != null || fk.jpyUsd != null || fk.brlUsd != null) fuentes.push("frankfurter")
  }
  if (data.dxy == null) {
    const dxy = await getStooqDXY()
    if (dxy != null) {
      data.dxy = dxy
      fuentes.push("stooq")
    }
  }

  // 4) ¿Cuántos de los 4 valores conseguimos en vivo?
  const conValor = [data.dxy, data.eurUsd, data.jpyUsd, data.brlUsd].filter(v => v != null).length

  // Snapshot casi completo (>=3 de 4) → lo guardamos como "último bueno".
  if (conValor >= 3) {
    guardarExito(CACHE_KEY, data, TTL_SEG)
  }

  // Conseguimos algo en vivo → lo devolvemos.
  if (conValor >= 1) {
    return NextResponse.json({
      data,
      stale: false,
      updated_at: new Date().toISOString(),
      source: fuentes.join("+") || "yahoo_finance",
    })
  }

  // 5) TODO falló → servimos el último dato bueno (stale) si existe.
  const stale = leerUltimoBueno<DatosFX>(CACHE_KEY)
  if (stale) {
    return NextResponse.json({
      data: stale.data,
      stale: true,
      stale_since: stale.staleSince,
      updated_at: new Date().toISOString(),
      source: "stale-cache",
    })
  }

  // 6) Nunca hubo un dato bueno: devolvemos la estructura vacía (sin romper el
  //    contrato) en vez de un 502.
  return NextResponse.json({
    data,
    stale: false,
    updated_at: new Date().toISOString(),
    source: "unavailable",
  })
}
