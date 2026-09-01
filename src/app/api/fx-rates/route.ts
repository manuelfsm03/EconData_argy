import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"
import { parseEcbRatesCsv, type EcbFxRate } from "@/server/domain/ecb-fx-rates"

/**
 * /api/fx-rates — Tipos de cambio diarios (EUR como base).
 *
 * Fuente: ECB Statistical Data Warehouse API (sin key, sin registro).
 * URL: https://data-api.ecb.europa.eu/service/data/EXR/D.{PAIRS}.EUR.SP00.A
 *      ?format=csvdata&lastNObservations=1
 *
 * Pares cubiertos (unidades de moneda extranjera por 1 EUR):
 *   USD, GBP, JPY, CAD, AUD, CHF, CNY, SEK, NOK, MXN, BRL
 *
 * El CSV de ECB usa convención: unidades de moneda extranjera por 1 EUR.
 * Ejemplo: USD=1.09 → 1 EUR = 1.09 USD.
 *
 * TTL cache: 4h (datos diarios, se actualiza una vez por día hábil).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CACHE_KEY = "fx-rates:ecb"
const TTL_SEG  = 4 * 3600

// Pares: monedas cotizadas por 1 EUR
const PAIRS = "USD+GBP+JPY+CAD+AUD+CHF+CNY+SEK+NOK+MXN+BRL"

function ratesResponse(rates: EcbFxRate[], options: { cached?: boolean; stale?: boolean; staleSince?: string } = {}) {
  const timestamp = rates.map((rate) => rate.fecha).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const source = options.stale ? "stale-cache" : "ECB Statistical Data Warehouse"
  return NextResponse.json({
    data: rates,
    cached: options.cached ?? false,
    stale: options.stale ?? false,
    ...(options.staleSince ? { stale_since: options.staleSince } : {}),
    source,
    timestamp,
    asOf: timestamp,
    checked_at: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "X-Data-Source": source,
      ...(timestamp ? { "X-Data-As-Of": timestamp } : {}),
      "X-Data-Freshness": options.stale ? "stale" : "fresh",
    },
  })
}

async function fetchEcbRates(): Promise<EcbFxRate[] | null> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${PAIRS}.EUR.SP00.A?format=csvdata&lastNObservations=1`
  try {
    const res = await fetchRegistered(url, {
      headers: { Accept: "text/csv, */*" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null

    const rates = parseEcbRatesCsv(await res.text())
    return rates.length > 0 ? rates : null
  } catch {
    return null
  }
}

export async function GET() {
  const cached = leerFresco<EcbFxRate[]>(CACHE_KEY)
  if (cached) {
    return ratesResponse(cached, { cached: true })
  }

  const rates = await fetchEcbRates()

  if (!rates) {
    const stale = leerUltimoBueno<EcbFxRate[]>(CACHE_KEY)
    if (stale) {
      return ratesResponse(stale.data, { stale: true, staleSince: stale.staleSince })
    }
    return NextResponse.json({ error: "ECB no disponible" }, { status: 503 })
  }

  guardarExito(CACHE_KEY, rates, TTL_SEG)

  return ratesResponse(rates)
}
