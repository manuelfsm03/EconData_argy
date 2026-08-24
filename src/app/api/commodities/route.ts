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

async function fetchYFQuotes(tickers: string[]): Promise<Map<string, { price: number; change: number; changePct: number; time: number }>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketTime`
  const res = await fetch(url, {
    headers: YF_HEADERS,
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`YF HTTP ${res.status}`)

  const json = await res.json() as {
    quoteResponse?: {
      result?: Array<{
        symbol: string
        regularMarketPrice?: number
        regularMarketChange?: number
        regularMarketChangePercent?: number
        regularMarketTime?: number
      }>
    }
  }

  const map = new Map<string, { price: number; change: number; changePct: number; time: number }>()
  for (const r of json.quoteResponse?.result ?? []) {
    if (r.regularMarketPrice != null) {
      map.set(r.symbol, {
        price: r.regularMarketPrice,
        change: r.regularMarketChange ?? 0,
        changePct: r.regularMarketChangePercent ?? 0,
        time: r.regularMarketTime ?? 0,
      })
    }
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
