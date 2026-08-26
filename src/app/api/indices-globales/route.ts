import { NextResponse } from "next/server"

/**
 * /api/indices-globales — Índices bursátiles del mundo en tiempo real.
 *
 * Fuente: Yahoo Finance batch quote (sin key, sin registro).
 * Misma infraestructura que /api/usa-stocks y /api/commodities.
 *
 * Regiones cubiertas: usa, europa, asia, latam
 *
 * Query params:
 *   ?region=usa|europa|asia|latam|todos
 */

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/world-indices",
}

type Region = "usa" | "europa" | "asia" | "latam"

const INDICES: Array<{ ticker: string; nombre: string; region: Region; pais: string }> = [
  // ── USA ──────────────────────────────────────────────────────────────────
  { ticker: "^GSPC",     nombre: "S&P 500",           region: "usa",    pais: "Estados Unidos" },
  { ticker: "^IXIC",     nombre: "Nasdaq Composite",  region: "usa",    pais: "Estados Unidos" },
  { ticker: "^DJI",      nombre: "Dow Jones",         region: "usa",    pais: "Estados Unidos" },
  { ticker: "^RUT",      nombre: "Russell 2000",      region: "usa",    pais: "Estados Unidos" },
  { ticker: "^VIX",      nombre: "VIX (Volatilidad)", region: "usa",    pais: "Estados Unidos" },
  { ticker: "DX-Y.NYB", nombre: "DXY (Dólar Index)", region: "usa",    pais: "Estados Unidos" },
  // ── Europa ───────────────────────────────────────────────────────────────
  { ticker: "^GDAXI",    nombre: "DAX",               region: "europa", pais: "Alemania" },
  { ticker: "^FTSE",     nombre: "FTSE 100",          region: "europa", pais: "Reino Unido" },
  { ticker: "^FCHI",     nombre: "CAC 40",            region: "europa", pais: "Francia" },
  { ticker: "^STOXX50E", nombre: "Euro Stoxx 50",     region: "europa", pais: "Eurozona" },
  { ticker: "^IBEX",     nombre: "IBEX 35",           region: "europa", pais: "España" },
  { ticker: "^AEX",      nombre: "AEX",               region: "europa", pais: "Países Bajos" },
  { ticker: "^SMI",      nombre: "SMI",               region: "europa", pais: "Suiza" },
  // ── Asia-Pacífico ────────────────────────────────────────────────────────
  { ticker: "^N225",     nombre: "Nikkei 225",        region: "asia",   pais: "Japón" },
  { ticker: "^HSI",      nombre: "Hang Seng",         region: "asia",   pais: "Hong Kong" },
  { ticker: "^KS11",     nombre: "KOSPI",             region: "asia",   pais: "Corea del Sur" },
  { ticker: "^AXJO",     nombre: "ASX 200",           region: "asia",   pais: "Australia" },
  { ticker: "^STI",      nombre: "Straits Times",     region: "asia",   pais: "Singapur" },
  // ── LATAM ────────────────────────────────────────────────────────────────
  { ticker: "^MERV",     nombre: "Merval",            region: "latam",  pais: "Argentina" },
  { ticker: "^BVSP",     nombre: "Bovespa",           region: "latam",  pais: "Brasil" },
  { ticker: "^MXX",      nombre: "IPC México",        region: "latam",  pais: "México" },
  { ticker: "^IPSA",     nombre: "IPSA",              region: "latam",  pais: "Chile" },
  { ticker: "^COLCAP",   nombre: "COLCAP",            region: "latam",  pais: "Colombia" },
]

// Cache en memoria — 2 min para índices
let _cacheStore: { data: unknown; expiry: number } | null = null

interface IndiceData {
  ticker: string
  nombre: string
  region: Region
  pais: string
  precio: number | null
  cambio: number | null
  cambioPct: number | null
  fechaActualizacion: string | null
}

// v7/quote requiere auth desde 2025. Usamos v8/chart (sin auth).
async function fetchYFChart(ticker: string): Promise<{ price: number; change: number; changePct: number; time: number } | null> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    try {
      const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue
      const json = await res.json() as { chart?: { result?: unknown[] } }
      const result = json?.chart?.result?.[0] as {
        timestamp?: number[]
        indicators?: { quote?: Array<{ close?: (number | null)[] }> }
      } | undefined
      if (!result) continue
      const closes = result.indicators?.quote?.[0]?.close ?? []
      const timestamps = result.timestamp ?? []
      const valid: { close: number; time: number }[] = []
      for (let i = 0; i < closes.length; i++) {
        const c = closes[i]; if (c != null) valid.push({ close: c, time: timestamps[i] ?? 0 })
      }
      if (valid.length === 0) continue
      const last = valid[valid.length - 1]
      const prev = valid.length > 1 ? valid[valid.length - 2] : null
      const change = prev ? last.close - prev.close : 0
      const changePct = prev && prev.close > 0 ? (change / prev.close) * 100 : 0
      return { price: last.close, change, changePct, time: last.time }
    } catch { /* próximo host */ }
  }
  return null
}

async function fetchYFQuotes(
  tickers: string[],
): Promise<Map<string, { price: number; change: number; changePct: number; time: number }>> {
  const entries = await Promise.all(tickers.map(async (t) => [t, await fetchYFChart(t)] as const))
  const map = new Map<string, { price: number; change: number; changePct: number; time: number }>()
  for (const [t, d] of entries) { if (d) map.set(t, d) }
  return map
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regionParam = searchParams.get("region") ?? "todos"

  // Cache fresco
  if (_cacheStore && _cacheStore.expiry > Date.now()) {
    const data = _cacheStore.data as IndiceData[]
    const filtered = regionParam === "todos" ? data : data.filter((d) => d.region === regionParam)
    return NextResponse.json({ data: filtered, cached: true, updated_at: new Date().toISOString() })
  }

  try {
    const tickers = INDICES.map((i) => i.ticker)
    const quotes = await fetchYFQuotes(tickers)

    const data: IndiceData[] = INDICES.map((idx) => {
      const q = quotes.get(idx.ticker)
      return {
        ticker: idx.ticker,
        nombre: idx.nombre,
        region: idx.region,
        pais: idx.pais,
        precio: q?.price ?? null,
        cambio: q ? parseFloat(q.change.toFixed(2)) : null,
        cambioPct: q ? parseFloat(q.changePct.toFixed(2)) : null,
        fechaActualizacion: q?.time ? new Date(q.time * 1000).toISOString() : null,
      }
    })

    _cacheStore = { data, expiry: Date.now() + 2 * 60 * 1000 } // 2 min

    const filtered = regionParam === "todos" ? data : data.filter((d) => d.region === regionParam)
    return NextResponse.json({
      data: filtered,
      cached: false,
      updated_at: new Date().toISOString(),
      fuente: "Yahoo Finance",
    })
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo obtener índices globales", detail: String(err) },
      { status: 503 },
    )
  }
}
