import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"

/**
 * /api/commodities — Precios de futuros de materias primas en tiempo real.
 *
 * Fuente: Yahoo Finance batch quote (sin key, sin registro).
 * Misma infraestructura que /api/usa-stocks.
 *
 * Categorías:
 *   energia  — WTI, Brent, Gas natural, RBOB Gasolina
 *   metales  — Oro, Plata, Platino, Cobre
 *   agro     — Soja, Maíz, Trigo, Aceite de soja, Harina de soja
 *   todos    — default: todas las categorías
 *
 * Query params:
 *   ?categoria=energia|metales|agro|todos
 */

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/commodities",
}

type Categoria = "energia" | "metales" | "agro"

const COMMODITIES: Array<{ ticker: string; nombre: string; categoria: Categoria; unidad: string }> = [
  // ── Energía ──────────────────────────────────────────────────────────────
  { ticker: "CL=F",  nombre: "Petróleo WTI",      categoria: "energia", unidad: "USD/bbl" },
  { ticker: "BZ=F",  nombre: "Petróleo Brent",    categoria: "energia", unidad: "USD/bbl" },
  { ticker: "NG=F",  nombre: "Gas natural",        categoria: "energia", unidad: "USD/MMBtu" },
  { ticker: "RB=F",  nombre: "Gasolina RBOB",      categoria: "energia", unidad: "USD/gal" },
  // ── Metales ──────────────────────────────────────────────────────────────
  { ticker: "GC=F",  nombre: "Oro",               categoria: "metales", unidad: "USD/oz" },
  { ticker: "SI=F",  nombre: "Plata",             categoria: "metales", unidad: "USD/oz" },
  { ticker: "PL=F",  nombre: "Platino",           categoria: "metales", unidad: "USD/oz" },
  { ticker: "HG=F",  nombre: "Cobre",             categoria: "metales", unidad: "USD/lb" },
  // ── Índices de commodities ───────────────────────────────────────────────
  { ticker: "^CRB",  nombre: "CRB Commodity Index",categoria: "energia", unidad: "puntos" },
  { ticker: "GD=F",  nombre: "Commodity Index DJ", categoria: "energia", unidad: "puntos" },
  // ── Agro ─────────────────────────────────────────────────────────────────
  { ticker: "ZS=F",  nombre: "Soja",              categoria: "agro",    unidad: "USc/bu" },
  { ticker: "ZC=F",  nombre: "Maíz",              categoria: "agro",    unidad: "USc/bu" },
  { ticker: "ZW=F",  nombre: "Trigo",             categoria: "agro",    unidad: "USc/bu" },
  { ticker: "ZL=F",  nombre: "Aceite de soja",    categoria: "agro",    unidad: "USc/lb" },
  { ticker: "ZM=F",  nombre: "Harina de soja",    categoria: "agro",    unidad: "USD/ton" },
]

// Cache en memoria — 5 min para commodities
let _cacheStore: { data: unknown; expiry: number } | null = null

interface Quote {
  ticker: string
  nombre: string
  categoria: Categoria
  unidad: string
  precio: number | null
  cambio: number | null
  cambioPct: number | null
  fechaActualizacion: string | null
}

// v7/quote requiere auth desde 2025. Usamos v8/chart (sin auth, mismo que empresa/).
async function fetchYFChart(ticker: string): Promise<{ price: number; change: number; changePct: number; time: number } | null> {
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    try {
      const res = await fetchRegistered(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8_000) })
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
        const c = closes[i]
        if (c != null) valid.push({ close: c, time: timestamps[i] ?? 0 })
      }
      if (valid.length === 0) continue

      const last = valid[valid.length - 1]
      const prev = valid.length > 1 ? valid[valid.length - 2] : null
      const change = prev ? last.close - prev.close : 0
      const changePct = prev && prev.close > 0 ? (change / prev.close) * 100 : 0

      return { price: last.close, change, changePct, time: last.time }
    } catch {
      // próximo host
    }
  }
  return null
}

async function fetchYFQuotes(tickers: string[]): Promise<Map<string, { price: number; change: number; changePct: number; time: number }>> {
  const entries = await Promise.all(
    tickers.map(async (ticker) => [ticker, await fetchYFChart(ticker)] as const)
  )
  const map = new Map<string, { price: number; change: number; changePct: number; time: number }>()
  for (const [ticker, data] of entries) {
    if (data) map.set(ticker, data)
  }
  return map
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const catParam = searchParams.get("categoria") ?? "todos"

  // Cache fresco
  if (_cacheStore && _cacheStore.expiry > Date.now()) {
    const data = _cacheStore.data as Quote[]
    const filtered = catParam === "todos" ? data : data.filter((q) => q.categoria === catParam)
    return NextResponse.json({ data: filtered, cached: true, updated_at: new Date().toISOString() })
  }

  try {
    const tickers = COMMODITIES.map((c) => c.ticker)
    const quotes = await fetchYFQuotes(tickers)

    const data: Quote[] = COMMODITIES.map((c) => {
      const q = quotes.get(c.ticker)
      return {
        ticker: c.ticker,
        nombre: c.nombre,
        categoria: c.categoria,
        unidad: c.unidad,
        precio: q?.price ?? null,
        cambio: q ? parseFloat(q.change.toFixed(4)) : null,
        cambioPct: q ? parseFloat(q.changePct.toFixed(2)) : null,
        fechaActualizacion: q?.time ? new Date(q.time * 1000).toISOString() : null,
      }
    })

    _cacheStore = { data, expiry: Date.now() + 5 * 60 * 1000 } // 5 min

    const filtered = catParam === "todos" ? data : data.filter((q) => q.categoria === catParam)
    return NextResponse.json({
      data: filtered,
      cached: false,
      updated_at: new Date().toISOString(),
      fuente: "Yahoo Finance futures",
    })
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo obtener precios de commodities", detail: String(err) },
      { status: 503 },
    )
  }
}
