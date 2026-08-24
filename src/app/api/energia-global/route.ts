import { fetchRegistered } from "@/server/http/fetch-source"
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
    const url = `${EIA_BASE}/international/data/?api_key=${apiKey}&frequency=${frequency}&data[0]=value&facets[activityId][]=${dataConfig.activityId}&facets[productId][]=57&${countryFacets}&facets[unitId][]=${dataConfig.unit}&sort[0][column]=period&sort[0][direction]=desc&length=600`

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
    const url = `${EIA_BASE}/international/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[activityId][]=1&facets[productId][]=57&${countryFacets}&facets[unitId][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=600`

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
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "U.S. EIA — Crude oil incl. lease condensate (TBPD)",
      })
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

      return NextResponse.json({
        data: { ...data, HORMUZ_TOTAL: hormuzTotal },
        updated_at: new Date().toISOString(),
        source: "EIA — Suma producción SAU+IRN+IRQ+KWT+UAE+QAT+BHR",
      })
    }

    if (endpoint === "latam") {
      const data = await fetchEIAProduction(COUNTRY_GROUPS.latam, "LATAM")
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "U.S. EIA — LATAM crude oil production",
      })
    }

    if (endpoint === "consumption") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "1", "Consumption")
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "U.S. EIA — Crude oil consumption (TBPD)",
      })
    }

    if (endpoint === "reserves") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "2", "Reserves")
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "U.S. EIA — Proved crude oil reserves (BB)",
      })
    }

    if (endpoint === "refining") {
      const data = await fetchEIAData(COUNTRY_GROUPS.top, "3", "Refining")
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "U.S. EIA — Refinery crude oil capacity (TBPD)",
      })
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
      const yfUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketTime`
      const yfRes = await fetchRegistered(yfUrl, { headers: yfHeaders, signal: AbortSignal.timeout(12_000) })
      if (!yfRes.ok) throw new Error(`YF HTTP ${yfRes.status}`)
      const yfJson = await yfRes.json() as {
        quoteResponse?: { result?: Array<{ symbol: string; regularMarketPrice?: number; regularMarketChange?: number; regularMarketChangePercent?: number; regularMarketTime?: number }> }
      }
      const data = (yfJson.quoteResponse?.result ?? []).map((r) => ({
        ticker: r.symbol,
        nombre: nombres[r.symbol] ?? r.symbol,
        unidad: unidades[r.symbol] ?? "",
        precio: r.regularMarketPrice ?? null,
        cambio: r.regularMarketChange ?? null,
        cambioPct: r.regularMarketChangePercent ?? null,
        fechaActualizacion: r.regularMarketTime ? new Date(r.regularMarketTime * 1000).toISOString() : null,
      }))
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "Yahoo Finance futures" })
    }

    return NextResponse.json(
      { error: "Usar ?endpoint=production|consumption|reserves|refining|hormuz|latam|precios" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[/api/energia-global]", error)
    if (error instanceof Error && error.message.startsWith("SOURCE_NOT_CONFIGURED")) {
      return NextResponse.json(
        { error: { code: "SOURCE_NOT_CONFIGURED", message: "Fuente EIA no configurada", retryable: false } },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: "Error EIA API", detail: String(error) },
      { status: 500 }
    )
  }
}
