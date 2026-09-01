import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/tc-historico — Histórico de tipos de cambio ARS/USD
 *
 * Fuente: api.argentinadatos.com
 * Endpoints usados:
 *   /v1/cotizaciones/dolares/blue
 *   /v1/cotizaciones/dolares/bolsa           (MEP)
 *   /v1/cotizaciones/dolares/contadoconliqui (CCL)
 *   /v1/cotizaciones/dolares/oficial
 *   /v1/cotizaciones/dolares/mayorista
 *
 * Query params:
 *   ?period=1m|3m|6m|1y|max  (default: 1y)
 */

import { NextRequest, NextResponse } from "next/server"
import { leerFresco, guardarExito, leerUltimoBueno } from "@/server/http/stale-cache"

export const dynamic = "force-dynamic"

const BASE = "https://api.argentinadatos.com/v1/cotizaciones/dolares"

interface RawEntry {
  casa: string
  compra: number
  venta: number
  fecha: string
}

interface MergedEntry {
  date: string
  blue?: number
  mep?: number
  ccl?: number
  oficial?: number
  mayorista?: number
  cripto?: number
}

type TcHistoricoResult = {
  data: MergedEntry[]
  count: number
  period: string
  updated_at: string
  asOf: string
  source: string
}

function responseFor(result: TcHistoricoResult, options: { cached?: boolean; stale?: boolean; staleSince?: string } = {}) {
  const effectiveSource = options.stale ? "stale-cache" : result.source
  return NextResponse.json({
    ...result,
    timestamp: result.asOf,
    checked_at: new Date().toISOString(),
    ...(options.cached ? { cached: true } : {}),
    ...(options.stale ? { stale: true, stale_since: options.staleSince } : {}),
  }, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "X-Data-Source": effectiveSource,
      "X-Data-As-Of": result.asOf,
      "X-Data-Freshness": options.stale ? "stale" : "fresh",
    },
  })
}

async function fetchTipo(tipo: string): Promise<RawEntry[]> {
  try {
    const res = await fetchRegistered(`${BASE}/${tipo}`, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      // No usar next.revalidate porque filtramos por period en memoria
    })
    if (!res.ok) return []
    return (await res.json()) as RawEntry[]
  } catch {
    return []
  }
}

function cutoffFromPeriod(period: string): Date {
  const now = new Date()
  const d = new Date(now)
  switch (period) {
    case "1m": d.setMonth(now.getMonth() - 1); break
    case "3m": d.setMonth(now.getMonth() - 3); break
    case "6m": d.setMonth(now.getMonth() - 6); break
    case "1y": d.setFullYear(now.getFullYear() - 1); break
    case "max": d.setFullYear(2010); break
    default: d.setFullYear(now.getFullYear() - 1); break
  }
  return d
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "1y"

  const cacheKey = `tc-historico:${period}`

  // Nivel 1 — fresco: dentro del TTL, no volver a la fuente
  const fresco = leerFresco<TcHistoricoResult>(cacheKey)
  if (fresco) {
    return responseFor(fresco, { cached: true })
  }

  // Fetch all in parallel
  const [blueRaw, mepRaw, cclRaw, oficialRaw, mayoristaRaw, criptoRaw] = await Promise.all([
    fetchTipo("blue"),
    fetchTipo("bolsa"),
    fetchTipo("contadoconliqui"),
    fetchTipo("oficial"),
    fetchTipo("mayorista"),
    fetchTipo("cripto"),
  ])

  // Falla total: todas las fuentes devolvieron vacío → fallback stale
  const todoVacio = [blueRaw, mepRaw, cclRaw, oficialRaw, mayoristaRaw, criptoRaw].every(a => a.length === 0)
  if (todoVacio) {
    const stale = leerUltimoBueno<TcHistoricoResult>(cacheKey)
    if (stale) {
      return responseFor(stale.data, { stale: true, staleSince: stale.staleSince })
    }
    return NextResponse.json({ error: "fuente no disponible" }, { status: 503 })
  }

  const cutoff = cutoffFromPeriod(period)

  // Merge by date
  const mapa: Record<string, MergedEntry> = {}

  const addRows = (rows: RawEntry[], key: keyof Omit<MergedEntry, "date">) => {
    for (const r of rows) {
      if (!r.fecha || new Date(r.fecha) < cutoff) continue
      if (!mapa[r.fecha]) mapa[r.fecha] = { date: r.fecha }
      if (r.venta && r.venta > 0) mapa[r.fecha][key] = r.venta
    }
  }

  addRows(blueRaw,      "blue")
  addRows(mepRaw,       "mep")
  addRows(cclRaw,       "ccl")
  addRows(oficialRaw,   "oficial")
  addRows(mayoristaRaw, "mayorista")
  addRows(criptoRaw,    "cripto")

  const merged = Object.values(mapa).sort((a, b) => (a.date > b.date ? 1 : -1))
  const asOf = merged.at(-1)?.date ?? ""

  if (!asOf) {
    return NextResponse.json({ error: "fuente sin observaciones válidas" }, { status: 503 })
  }

  const result: TcHistoricoResult = {
    data: merged,
    count: merged.length,
    period,
    updated_at: asOf,
    asOf,
    source: "ArgentinaDatos",
  }

  // TTL: 2h para datos históricos (cambian 1x/día)
  guardarExito(cacheKey, result, 7200)

  return responseFor(result)
}
