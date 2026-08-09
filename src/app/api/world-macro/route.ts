/**
 * /api/world-macro — Indicadores macro mundiales
 * Fuente: World Bank Open Data API (sin auth)
 * Endpoints:
 *   GET /api/world-macro?indicator=gdp_growth
 *   GET /api/world-macro?indicator=gdp_per_capita
 *   GET /api/world-macro?indicator=inflation
 *   GET /api/world-macro?indicator=unemployment
 */

import { NextRequest, NextResponse } from "next/server"

const WB_BASE = "https://api.worldbank.org/v2"
const COUNTRIES = "ARG;BRA;USA;CHN;MEX;CHL;COL;DEU;JPN;IND"

const INDICATORS: Record<string, { code: string; label: string; unit: string }> = {
  gdp_growth:     { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth", unit: "%" },
  gdp_per_capita: { code: "NY.GDP.PCAP.CD", label: "GDP per Capita", unit: "USD" },
  inflation:      { code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI)", unit: "%" },
  unemployment:   { code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%" },
  trade_pct_gdp:  { code: "NE.TRD.GNFS.ZS", label: "Trade/GDP", unit: "%" },
  debt_pct_gdp:   { code: "GC.DOD.TOTL.GD.ZS", label: "Govt Debt/GDP", unit: "%" },
  current_account:{ code: "BN.CAB.XOKA.GD.ZS", label: "Current Account/GDP", unit: "%" },
  fdi_inflows:    { code: "BX.KLT.DINV.WD.GD.ZS", label: "FDI Inflows/GDP", unit: "%" },
}

// In-memory cache
const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

async function fetchWBIndicator(code: string): Promise<Record<string, [string, number][]>> {
  const cacheKey = `wb_${code}`
  const cached = getCache<Record<string, [string, number][]>>(cacheKey)
  if (cached) return cached

  const url = `${WB_BASE}/country/${COUNTRIES}/indicator/${code}?format=json&date=2000:2025&per_page=500`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      // Mantenerse por debajo del timeout del health monitor y de Vercel Hobby.
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) throw new Error(`World Bank API ${res.status}`)

    const json = await res.json()
    const result: Record<string, [string, number][]> = {}

    for (const row of (json[1] || [])) {
      if (row.value == null) continue
      const c = row.countryiso3code
      if (!result[c]) result[c] = []
      result[c].push([row.date, row.value])
    }

    // Sort by year descending
    for (const k of Object.keys(result)) {
      result[k].sort((a, b) => Number(b[0]) - Number(a[0]))
    }

    setCache(cacheKey, result, 86400) // Cache 24h
    return result
  } catch (error) {
    console.error(`[WB] Error fetching ${code}:`, error)
    return {}
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const indicator = searchParams.get("indicator") ?? "gdp_growth"

  try {
    const meta = INDICATORS[indicator]
    if (!meta) {
      return NextResponse.json(
        {
          error: `Indicadores válidos: ${Object.keys(INDICATORS).join(", ")}`,
        },
        { status: 400 }
      )
    }

    const data = await fetchWBIndicator(meta.code)

    return NextResponse.json({
      data,
      indicator,
      label: meta.label,
      unit: meta.unit,
      updated_at: new Date().toISOString(),
      source: "World Bank Open Data",
    })
  } catch (error) {
    console.error("[/api/world-macro]", error)
    return NextResponse.json(
      { error: "Error World Bank API", detail: String(error) },
      { status: 500 }
    )
  }
}
