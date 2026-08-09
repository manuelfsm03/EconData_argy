/**
 * /api/riesgo-pais — Riesgo País EMBI+ Argentina
 *
 * Fuentes:
 *   - argentinadatos.com /v1/finanzas/indices/riesgo-pais  (histórico oficial EMBI+)
 *   - Yahoo Finance ^TNX (US 10Y treasury yield)
 *   - TIR GD30 desde DB local (calculada por /api/bonos)
 *   - Comparativos regionales: estimaciones EMBI+ fijas (sin API de pago)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
  Origin: "https://finance.yahoo.com",
  Referer: "https://finance.yahoo.com/",
}

async function getYFPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000), next: { revalidate: 900 } })
    if (!res.ok) return null
    const j = await res.json()
    return j?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
}

// Riesgo país desde argentinadatos.com (datos EMBI+ oficiales desde 1999)
async function fetchArgDatosHistorico(): Promise<Array<{ fecha: string; valor: number }>> {
  try {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais", {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    return (await res.json()) as Array<{ fecha: string; valor: number }>
  } catch { return [] }
}

// ── In-memory cache ────────────────────────────────────────────────────────────
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

export async function GET(_request: NextRequest) {
  const cacheKey = "riesgo_pais_v2"
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true, updated_at: new Date().toISOString() })

  // Fetch en paralelo
  const [argDatosHist, us10y, gd30Bond] = await Promise.all([
    fetchArgDatosHistorico(),
    getYFPrice("^TNX"),
    prisma.sovereignBond.findUnique({ where: { ticker: "GD30" } }).catch(() => null),
  ])

  // Valor actual = último de la serie
  const histSorted = [...argDatosHist].sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  const latestEntry = histSorted[histSorted.length - 1]
  const riesgoPaisBps = latestEntry?.valor ?? null

  // Últimas 2 semanas para variaciones
  const now = new Date()
  const d1w = new Date(now); d1w.setDate(now.getDate() - 7)
  const d1m = new Date(now); d1m.setMonth(now.getMonth() - 1)

  const last1w = histSorted.filter((e) => new Date(e.fecha) >= d1w).at(0)?.valor ?? null
  const last1m = histSorted.filter((e) => new Date(e.fecha) >= d1m).at(0)?.valor ?? null

  const var1w = riesgoPaisBps != null && last1w != null ? riesgoPaisBps - last1w : null
  const var1m = riesgoPaisBps != null && last1m != null ? riesgoPaisBps - last1m : null

  // TIR GD30 desde DB
  const arTir = gd30Bond?.tir ?? null
  const us10yPct = us10y ?? 4.5

  // Spread calculado
  const spreadAr = arTir != null ? arTir - us10yPct : null

  // Comparativos regionales fijos (EMBI+ oficiales históricos aproximados)
  const regionales = {
    argentina: { bps: riesgoPaisBps, moneda: "ARS", ticker: "GD30", fuente: "EMBI+ argentinadatos.com" },
    brasil: { bps: 225, moneda: "BRL", nota: "estimado EMBI+" },
    chile: { bps: 70, moneda: "CLP", nota: "estimado EMBI+" },
    colombia: { bps: 280, moneda: "COP", nota: "estimado EMBI+" },
    peru: { bps: 155, moneda: "PEN", nota: "estimado EMBI+" },
    mexico: { bps: 190, moneda: "MXN", nota: "estimado EMBI+" },
  }

  // Histórico: últimos 2 años para gráfico
  const cutoff2y = new Date(); cutoff2y.setFullYear(now.getFullYear() - 2)
  const historico2y = histSorted
    .filter((e) => new Date(e.fecha) >= cutoff2y)
    .map((e) => ({ date: e.fecha, valor: e.valor }))

  // SMA 30D y 90D sobre el histórico
  const historicoConSMA = calcularSMA(historico2y)

  // Ponderación por bono (estimación — contribución al EMBI AR es proporcional a outstanding)
  const ponderacionBonos = [
    { ticker: "GD35", outstanding: 14.79, pct: 21 },
    { ticker: "GD30", outstanding: 12.65, pct: 18 },
    { ticker: "GD41", outstanding: 11.15, pct: 16 },
    { ticker: "AL30", outstanding: 12.15, pct: 17 },
    { ticker: "AL35", outstanding: 10.27, pct: 14 },
    { ticker: "GD46", outstanding: 8.04, pct: 11 },
    { ticker: "AE38", outstanding: 4.57, pct: 6 },
  ]

  const alertas = []
  if (riesgoPaisBps != null) {
    if (riesgoPaisBps > 2000) alertas.push({ nivel: "crítico", mensaje: "Riesgo País > 2000 bps — acceso a crédito internacional prácticamente cerrado" })
    else if (riesgoPaisBps > 1000) alertas.push({ nivel: "alto", mensaje: "Riesgo País > 1000 bps — costo de financiamiento elevado" })
    else if (riesgoPaisBps > 500) alertas.push({ nivel: "moderado", mensaje: "Riesgo País entre 500-1000 bps — mercados con cautela" })
    else alertas.push({ nivel: "bajo", mensaje: "Riesgo País < 500 bps — condiciones de acceso a crédito normalizándose" })
  }

  const result = {
    actual: {
      riesgoPaisBps,
      var1w,
      var1m,
      spreadAr,
      us10y: us10yPct,
      arTir,
      gd30Precio: gd30Bond?.precio ?? null,
      metodologia: "EMBI+ oficial (argentinadatos.com) + spread GD30 vs US 10Y",
    },
    regionales,
    historico: historico2y,
    historicoConSMA,
    ponderacionBonos,
    alertas,
  }

  setCached(cacheKey, result, 3600) // 1h
  return NextResponse.json({ data: result, updated_at: new Date().toISOString(), source: "argentinadatos.com + yahoo_finance" })
}

function calcularSMA(data: Array<{ date: string; valor: number }>, windows = [30, 90]) {
  return data.map((punto, i) => {
    const result: Record<string, unknown> = { date: punto.date, valor: punto.valor }
    for (const window of windows) {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1)
      const avg = slice.reduce((sum, p) => sum + p.valor, 0) / slice.length
      result[`sma${window}`] = Math.round(avg)
    }
    return result
  })
}
