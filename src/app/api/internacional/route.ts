import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/internacional — Divisas y DXY internacionales
 *
 * Fuente: Yahoo Finance Chart API (público, sin auth)
 * Tickers:
 *   DX-Y.NYB  → DXY (Índice del dólar)
 *   EURUSD=X  → EUR/USD
 *   JPYUSD=X  → JPY/USD (inverso de USD/JPY)
 *   BRL=X     → USD/BRL (reales por dólar)
 */

import { NextResponse } from "next/server"

export const runtime = "nodejs"

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
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

export async function GET() {
  const cacheKey = "internacional_fx_v1"
  const cached = getCached<unknown>(cacheKey)
  if (cached) {
    return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })
  }

  const [dxyRes, eurRes, jpyRes, brlRes] = await Promise.all([
    getYFQuote("DX-Y.NYB"),
    getYFQuote("EURUSD=X"),
    getYFQuote("JPYUSD=X"),
    getYFQuote("BRL=X"),
  ])

  const data = {
    dxy:    dxyRes.price,
    eurUsd: eurRes.price,
    jpyUsd: jpyRes.price,
    brlUsd: brlRes.price,
    dxyChg: dxyRes.chg,
    eurChg: eurRes.chg,
    jpyChg: jpyRes.chg,
    brlChg: brlRes.chg,
  }

  setCached(cacheKey, data, 300)
  return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "yahoo_finance" })
}
