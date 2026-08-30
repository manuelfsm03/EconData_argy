import { fetchRegistered } from "@/server/http/fetch-source"
import { freshnessFor } from "@/server/cache/data-cache"
import { unavailableNumeric, type NumericFreshness, type NumericProvenance } from "@/server/numeric/manifest"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
/**
 * /api/energia-global — Producción mundial de petróleo
 * Fuente: U.S. Energy Information Administration (EIA) API v2
 * Auth: API key gratuita (env: EIA_API_KEY)
 * Endpoints:
 *   GET /api/energia-global?endpoint=production  — top productores
 *   GET /api/energia-global?endpoint=hormuz      — flujo Estrecho de Ormuz
 *   GET /api/energia-global?endpoint=latam       — ARG vs BRA vs VEN vs COL
 */

import { NextRequest, NextResponse } from "next/server"

const EIA_BASE = "https://api.eia.gov/v2"

const COUNTRY_GROUPS = {
  top: ["USA", "SAU", "RUS", "CAN", "IRQ", "CHN", "UAE", "BRA", "IRN", "KWT"],
  hormuz: ["SAU", "IRN", "IRQ", "KWT", "UAE", "QAT", "BHR"],
  latam: ["ARG", "BRA", "VEN", "COL", "ECU", "MEX"],
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  USA: "United States",
  RUS: "Russia",
  SAU: "Saudi Arabia",
  CAN: "Canada",
  CHN: "China",
  BRA: "Brazil",
  IRN: "Iran",
  IRQ: "Iraq",
  KWT: "Kuwait",
  UAE: "United Arab Emirates",
  QAT: "Qatar",
  BHR: "Bahrain",
  ARG: "Argentina",
  VEN: "Venezuela",
  COL: "Colombia",
  ECU: "Ecuador",
  MEX: "Mexico",
}


// Cache en memoria
const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

function latestAsOf(data: Record<string, [string, number][]>): string | null {
  const periods = Object.values(data).flatMap((series) => series.map(([period]) => period)).sort()
  const period = periods.at(-1)
  if (!period) return null
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number)
    return new Date(Date.UTC(year, month, 0, 23, 59, 59)).toISOString()
  }
  if (/^\d{4}$/.test(period)) return `${period}-12-31T23:59:59.000Z`
  return Number.isFinite(Date.parse(period)) ? new Date(period).toISOString() : null
}

function successResponse(
  data: Record<string, [string, number][]>,
  source: string,
  unit: string,
  transform: string,
) {
  const retrievedAt = new Date().toISOString()
  const asOf = latestAsOf(data)
  const freshness: NumericFreshness = asOf
    ? freshnessFor(asOf, SOURCE_REGISTRY.eia.freshness)
    : "unavailable"
  if (!asOf || freshness !== "fresh") {
    throw new Error("NUMERIC_DATA_STALE")
  }
  const numericManifest: NumericProvenance = {
    source: "eia",
    unit,
    transform,
    asOf,
    retrievedAt,
    freshness,
    estimate: false,
    status: "available",
  }
  return NextResponse.json({ data, asOf, retrievedAt, updated_at: retrievedAt, freshness, estimate: false, numericManifest: [numericManifest], source })
}

// Mapeo de tipos de datos a IDs y unidades EIA
const EIA_DATA_TYPES: Record<string, { activityId: string; unit: string; description: string }> = {
  "1": { activityId: "2", unit: "TBPD", description: "Crude oil consumption" },
  "2": { activityId: "0", unit: "BB", description: "Proved crude oil reserves" },
  "3": { activityId: "10", unit: "TBPD", description: "Refinery capacity" },
}

async function fetchEIAData(
  countries: string[],
  dataTypeId: string,
  label: string
): Promise<Record<string, [string, number][]>> {
  const cacheKey = `eia_${dataTypeId}_${countries.sort().join("_")}`
  const cached = getCache<Record<string, [string, number][]>>(cacheKey)
  if (cached) return cached

  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) throw new Error("EIA_API_KEY not set — register free at eia.gov/opendata")

  try {
    const dataConfig = EIA_DATA_TYPES[dataTypeId]
    if (!dataConfig) throw new Error(`Unknown data type: ${dataTypeId}`)

    const countryFacets = countries.map((c) => `facets[countryRegionId][]=${c}`).join("&")
    const frequency = dataTypeId === "2" ? "annual" : "monthly"
    const url = `${EIA_BASE}/international/data/?api_key=${apiKey}&frequency=${frequency}&data[0]=value&facets[activityId][]=${dataConfig.activityId}&facets[productId][]=57&${countryFacets}&facets[unit][]=${dataConfig.unit}&sort[0][column]=period&sort[0][direction]=desc&length=600`

    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 21600 },
    })
    if (!res.ok) throw new Error(`EIA API ${res.status}`)

    const json = (await res.json()) as {
      response?: {
        data?: Array<{
          countryRegionId: string
          period: string
          value: string
        }>
      }
    }

    const result: Record<string, [string, number][]> = {}
    for (const row of json.response?.data || []) {
      const codeOrName = row.countryRegionId
      const countryName = COUNTRY_CODE_MAP[codeOrName] || codeOrName
      const p = row.period
      const v = parseFloat(row.value)
      if (isNaN(v)) continue
      if (!result[countryName]) result[countryName] = []
      result[countryName].push([p, v])
    }

    for (const k of Object.keys(result)) result[k].sort((a, b) => b[0].localeCompare(a[0]))

    setCache(cacheKey, result, 3600 * 6) // 6h cache
    return result
  } catch (error) {
    console.error(`[EIA] Error fetching ${label}:`, error)
    throw error
  }
}

async function fetchEIAProduction(
  countries: string[],
  label: string
): Promise<Record<string, [string, number][]>> {
  const cacheKey = `eia_prod_${countries.sort().join("_")}`
  const cached = getCache<Record<string, [string, number][]>>(cacheKey)
  if (cached) return cached

  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) throw new Error("SOURCE_NOT_CONFIGURED:EIA_API_KEY")

  try {
    const countryFacets = countries.map((c) => `facets[countryRegionId][]=${c}`).join("&")
    const url = `${EIA_BASE}/international/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[activityId][]=1&facets[productId][]=57&${countryFacets}&facets[unit][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=600`

    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 21600 },
    })
    if (!res.ok) throw new Error(`EIA API ${res.status}`)

    const json = (await res.json()) as {
      response?: {
        data?: Array<{
          countryRegionId: string
          period: string
          value: string
        }>
      }
    }

    const result: Record<string, [string, number][]> = {}
    for (const row of json.response?.data || []) {
      const codeOrName = row.countryRegionId
      const countryName = COUNTRY_CODE_MAP[codeOrName] || codeOrName
      const p = row.period
      const v = parseFloat(row.value)
      if (isNaN(v)) continue
      if (!result[countryName]) result[countryName] = []
      result[countryName].push([p, v])
    }

    for (const k of Object.keys(result)) result[k].sort((a, b) => b[0].localeCompare(a[0]))

    setCache(cacheKey, result, 3600 * 6) // 6h cache
    return result
  } catch (error) {
    console.error(`[EIA] Error fetching ${label}:`, error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") ?? "production"

  try {
    if (endpoint === "production") {
      const data = await fetchEIAProduction(COUNTRY_GROUPS.top, "Top 10 productores")
      return successResponse(data, "U.S. EIA — Crude oil incl. lease condensate (TBPD)", "thousand barrels per day", "EIA production value; no client-side numeric transformation")
    }

    if (endpoint === "hormuz") {
      const data = await fetchEIAProduction(COUNTRY_GROUPS.hormuz, "Estrecho de Ormuz")

      // Calcular total del estrecho
      const periods = new Set<string>()
      for (const s of Object.values(data)) {
        for (const [p] of s) periods.add(p)
      }
      const hormuzTotal: [string, number][] = Array.from(periods)
        .sort()
        .reverse()
        .map((period) => {
          let total = 0
          for (const s of Object.values(data)) {
            const pt = s.find(([p]) => p === period)
            if (pt) total += pt[1]
          }
          return [period, Math.round(total)]
        })

      return successResponse({ ...data, HORMUZ_TOTAL: hormuzTotal }, "EIA — Suma producción SAU+IRN+IRQ+KWT+UAE+QAT+BHR", "thousand barrels per day", "EIA production values summed by matching period for HORMUZ_TOTAL")
    }

    if (endpoint === "latam") {
      const data = await fetchEIAProduction(COUNTRY_GROUPS.latam, "LATAM")
      return successResponse(data, "U.S. EIA — LATAM crude oil production", "thousand barrels per day", "EIA production value; no client-side numeric transformation")
    }

    if (endpoint === "consumption") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "1", "Consumption")
      return successResponse(data, "U.S. EIA — Crude oil consumption (TBPD)", "thousand barrels per day", "EIA consumption value; no client-side numeric transformation")
    }

    if (endpoint === "reserves") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "2", "Reserves")
      return successResponse(data, "U.S. EIA — Proved crude oil reserves (BB)", "billion barrels", "EIA proved reserve value; no client-side numeric transformation")
    }

    if (endpoint === "refining") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "3", "Refining")
      return successResponse(data, "U.S. EIA — Refinery crude oil capacity (TBPD)", "thousand barrels per day", "EIA refinery capacity value; no client-side numeric transformation")
    }

    // Precios spot de energía via Yahoo Finance — sin EIA_API_KEY
    if (endpoint === "precios") {
      const tickers = ["CL=F", "BZ=F", "NG=F", "RB=F"]
      const nombres: Record<string, string> = {
        "CL=F": "Petróleo WTI",
        "BZ=F": "Petróleo Brent",
        "NG=F": "Gas natural",
        "RB=F": "Gasolina RBOB",
      }
      const unidades: Record<string, string> = {
        "CL=F": "USD/bbl",
        "BZ=F": "USD/bbl",
        "NG=F": "USD/MMBtu",
        "RB=F": "USD/gal",
      }
      const yfHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Origin: "https://finance.yahoo.com",
        Referer: "https://finance.yahoo.com/commodities",
      }
      // v7/quote requiere auth desde 2025; usamos v8/chart por ticker
      async function fetchChart(t: string) {
        for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
          try {
            const r = await fetchRegistered(`https://${host}/v8/finance/chart/${encodeURIComponent(t)}?interval=1d&range=5d`, { headers: yfHeaders, signal: AbortSignal.timeout(8_000) })
            if (!r.ok) continue
            const j = await r.json() as { chart?: { result?: unknown[] } }
            const res = j?.chart?.result?.[0] as { timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } } | undefined
            if (!res) continue
            const closes = res.indicators?.quote?.[0]?.close ?? []
            const valid = closes.map((c, i) => c != null ? { c, t: (res.timestamp ?? [])[i] ?? 0 } : null).filter(Boolean) as { c: number; t: number }[]
            if (!valid.length) continue
            const last = valid[valid.length - 1], prev = valid[valid.length - 2]
            const change = prev ? last.c - prev.c : 0
            return { price: last.c, change, changePct: prev && prev.c > 0 ? (change / prev.c) * 100 : 0, time: last.t }
          } catch { /* next host */ }
        }
        return null
      }
      const results = await Promise.all(tickers.map(async (t) => ({ ticker: t, q: await fetchChart(t) })))
      const data = results.map(({ ticker, q }) => ({
        ticker,
        nombre: nombres[ticker] ?? ticker,
        unidad: unidades[ticker] ?? "",
        precio: q?.price ?? null,
        cambio: q?.change ?? null,
        cambioPct: q?.changePct ?? null,
        fechaActualizacion: q?.time ? new Date(q.time * 1000).toISOString() : null,
      }))
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "Yahoo Finance futures" })
    }

    return NextResponse.json(
      { error: "Usar ?endpoint=production|consumption|reserves|refining|hormuz|latam|precios" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[/api/energia-global]", error)
    const message = error instanceof Error ? error.message : "SOURCE_UNAVAILABLE"
    if (message.startsWith("SOURCE_NOT_CONFIGURED") || message.includes("EIA API 403") || message === "NUMERIC_DATA_STALE") {
      return NextResponse.json(
        {
          error: { code: message.includes("403") ? "SOURCE_UNAVAILABLE" : message === "NUMERIC_DATA_STALE" ? "DATA_EXPIRED" : "SOURCE_NOT_CONFIGURED", message: message.includes("403") ? "Fuente EIA no disponible" : message === "NUMERIC_DATA_STALE" ? "Datos EIA vencidos" : "Fuente EIA no configurada", retryable: false },
          numeric: unavailableNumeric(message.includes("403") ? "EIA returned HTTP 403" : "EIA source is not fresh"),
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Fuente EIA no disponible", retryable: true }, numeric: unavailableNumeric("EIA request failed") },
      { status: 503 },
    )
  }
}
