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

async function fetchEIAProduction(
  countries: string[],
  label: string
): Promise<Record<string, [string, number][]>> {
  const cacheKey = `eia_prod_${countries.sort().join("_")}`
  const cached = getCache<Record<string, [string, number][]>>(cacheKey)
  if (cached) return cached

  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) throw new Error("EIA_API_KEY not set — register free at eia.gov/opendata")

  try {
    const countryFacets = countries.map((c) => `facets[countryRegionId][]=${c}`).join("&")
    const url = `${EIA_BASE}/international/data/?api_key=${apiKey}&frequency=monthly&data[0]=value&facets[activityId][]=1&facets[productId][]=57&${countryFacets}&facets[unitId][]=TBPD&sort[0][column]=period&sort[0][direction]=desc&length=600`

    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(15000),
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
      const c = row.countryRegionId
      const p = row.period
      const v = parseFloat(row.value)
      if (isNaN(v)) continue
      if (!result[c]) result[c] = []
      result[c].push([p, v])
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

    return NextResponse.json(
      { error: "Usar ?endpoint=production|hormuz|latam" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[/api/energia-global]", error)
    return NextResponse.json(
      { error: "Error EIA API", detail: String(error) },
      { status: 500 }
    )
  }
}
