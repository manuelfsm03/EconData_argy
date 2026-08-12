import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildErrorEnvelope, buildSuccessEnvelope } from "@/server/api/envelope"
import { freshnessFor } from "@/server/cache/data-cache"
import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"

const WB_BASE = "https://api.worldbank.org/v2"
const COUNTRIES = "ARG;BRA;USA;CHN;MEX;CHL;COL;DEU;JPN;IND"
const EXPECTED_COUNTRIES = COUNTRIES.split(";")
const WORLD_BANK = SOURCE_REGISTRY.world_bank

const INDICATORS: Record<string, { code: string; label: string; unit: string }> = {
  gdp_growth: { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth", unit: "%" },
  gdp_per_capita: { code: "NY.GDP.PCAP.CD", label: "GDP per Capita", unit: "USD" },
  inflation: { code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI)", unit: "%" },
  unemployment: { code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "%" },
  trade_pct_gdp: { code: "NE.TRD.GNFS.ZS", label: "Trade/GDP", unit: "%" },
  debt_pct_gdp: { code: "GC.DOD.TOTL.GD.ZS", label: "Govt Debt/GDP", unit: "%" },
  current_account: { code: "BN.CAB.XOKA.GD.ZS", label: "Current Account/GDP", unit: "%" },
  fdi_inflows: { code: "BX.KLT.DINV.WD.GD.ZS", label: "FDI Inflows/GDP", unit: "%" },
}

type WorldBankData = Record<string, [string, number][]>
type WorldBankResult = {
  data: WorldBankData
  asOf: string
  retrievedAt: string
  completeness: "complete" | "partial"
  warnings: string[]
}

const cache = new Map<string, { result: WorldBankResult; expiry: number }>()

async function fetchWBIndicator(code: string): Promise<WorldBankResult> {
  const cached = cache.get(code)
  if (cached && cached.expiry > Date.now()) return cached.result

  const url = `${WB_BASE}/country/${COUNTRIES}/indicator/${code}?format=json&date=2000:2025&per_page=500`
  const response = await fetchRegistered(url, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 21_600 },
  })
  if (!response.ok) throw new Error(`SOURCE_BAD_RESPONSE:${response.status}`)

  const payload = await response.json() as [unknown, Array<{
    value?: number | null
    date?: string
    countryiso3code?: string
  }>]
  const data: WorldBankData = {}
  for (const row of payload[1] ?? []) {
    if (row.value == null || !row.date || !row.countryiso3code) continue
    if (!data[row.countryiso3code]) data[row.countryiso3code] = []
    data[row.countryiso3code].push([row.date, row.value])
  }
  if (Object.keys(data).length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")
  for (const series of Object.values(data)) series.sort((left, right) => Number(right[0]) - Number(left[0]))

  const countryAsOf = Object.fromEntries(
    Object.entries(data).map(([country, series]) => [country, Number(series[0]?.[0])]),
  )
  const validLatestYears = Object.values(countryAsOf).filter(Number.isFinite)
  if (validLatestYears.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")
  const asOfYear = Math.min(...validLatestYears)
  const missingCountries = EXPECTED_COUNTRIES.filter((country) => !data[country])
  const laggingCountries = Object.entries(countryAsOf)
    .filter(([, year]) => year > asOfYear)
    .map(([country]) => country)
  const warnings = [
    ...(missingCountries.length > 0 ? [`Missing countries: ${missingCountries.join(",")}`] : []),
    ...(laggingCountries.length > 0 ? [`Country observations have different as-of years: ${laggingCountries.join(",")}`] : []),
  ]

  const result = {
    data,
    asOf: `${asOfYear}-12-31`,
    retrievedAt: new Date().toISOString(),
    completeness: warnings.length === 0 ? "complete" as const : "partial" as const,
    warnings,
  }
  cache.set(code, { result, expiry: Date.now() + WORLD_BANK.cache.freshSeconds * 1000 })
  return result
}

function headers(asOf: string, freshness: string): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${WORLD_BANK.cache.freshSeconds}, stale-while-revalidate=${WORLD_BANK.cache.staleWhileRevalidateSeconds}`,
    "X-Data-Source": WORLD_BANK.id,
    "X-Data-As-Of": asOf,
    "X-Data-Freshness": freshness,
  }
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const generatedAt = new Date().toISOString()
  const indicator = request.nextUrl.searchParams.get("indicator") ?? "gdp_growth"
  const dataset = `world_macro.${indicator}`
  const indicatorMeta = INDICATORS[indicator]

  if (!indicatorMeta) {
    return NextResponse.json(buildErrorEnvelope({
      requestId,
      dataset,
      generatedAt,
      code: "INVALID_INPUT",
      retryable: false,
    }), { status: 400 })
  }

  try {
    const result = await fetchWBIndicator(indicatorMeta.code)
    const freshness = freshnessFor(result.asOf, WORLD_BANK.freshness)
    if (freshness === "expired") {
      return NextResponse.json(buildErrorEnvelope({
        requestId,
        dataset,
        generatedAt,
        code: "DATA_EXPIRED",
        retryable: true,
      }), { status: 503, headers: headers(result.asOf, freshness) })
    }

    const envelope = buildSuccessEnvelope({
      requestId,
      dataset,
      data: result.data,
      generatedAt,
      asOf: result.asOf,
      freshness,
      completeness: result.completeness,
      source: {
        id: WORLD_BANK.id,
        publisher: WORLD_BANK.publisher,
        mode: "live",
        retrievedAt: result.retrievedAt,
        fallbackFrom: null,
      },
      warnings: [
        ...result.warnings,
        ...(freshness === "stale" ? ["World Bank observation is stale"] : []),
      ],
    })
    return NextResponse.json({
      ...envelope,
      // Legacy facade fields remain during frontend migration.
      data: result.data,
      indicator,
      label: indicatorMeta.label,
      unit: indicatorMeta.unit,
      updated_at: result.retrievedAt,
      source: WORLD_BANK.displayName,
    }, {
      headers: {
        ...headers(result.asOf, freshness),
        ...(freshness === "stale" ? { Warning: '110 - "Response is stale"' } : {}),
      },
    })
  } catch (error) {
    console.error("[/api/world-macro] source unavailable")
    const timeout = error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
    return NextResponse.json(buildErrorEnvelope({
      requestId,
      dataset,
      generatedAt,
      code: timeout ? "SOURCE_TIMEOUT" : "SOURCE_UNAVAILABLE",
      retryable: true,
    }), { status: timeout ? 504 : 502 })
  }
}
