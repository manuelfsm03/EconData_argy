import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

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

const CACHE_KEY = "fx-rates:ecb"
const TTL_SEG  = 4 * 3600

// Pares: monedas cotizadas por 1 EUR
const PAIRS = "USD+GBP+JPY+CAD+AUD+CHF+CNY+SEK+NOK+MXN+BRL"

const PAIR_META: Record<string, { nombre: string; simbolo: string }> = {
  USD: { nombre: "Dólar estadounidense", simbolo: "USD" },
  GBP: { nombre: "Libra esterlina",      simbolo: "GBP" },
  JPY: { nombre: "Yen japonés",          simbolo: "JPY" },
  CAD: { nombre: "Dólar canadiense",     simbolo: "CAD" },
  AUD: { nombre: "Dólar australiano",    simbolo: "AUD" },
  CHF: { nombre: "Franco suizo",         simbolo: "CHF" },
  CNY: { nombre: "Yuan chino",           simbolo: "CNY" },
  SEK: { nombre: "Corona sueca",         simbolo: "SEK" },
  NOK: { nombre: "Corona noruega",       simbolo: "NOK" },
  MXN: { nombre: "Peso mexicano",        simbolo: "MXN" },
  BRL: { nombre: "Real brasileño",       simbolo: "BRL" },
}

interface TipoCambio {
  par: string        // ej. "EUR/USD"
  nombre: string
  valor: number      // unidades de moneda extranjera por 1 EUR
  fecha: string | null
}

async function fetchEcbRates(): Promise<TipoCambio[] | null> {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${PAIRS}.EUR.SP00.A?format=csvdata&lastNObservations=1`
  try {
    const res = await fetchRegistered(url, {
      headers: { Accept: "text/csv, */*" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null

    const text = await res.text()
    const lines = text.trim().split("\n")

    // Detectar columnas KEY y OBS_VALUE desde el header
    const header = lines[0]?.split(",").map((h) => h.trim().replace(/"/g, ""))
    if (!header) return null

    const keyIdx   = header.indexOf("KEY")
    const dateIdx  = header.indexOf("TIME_PERIOD")
    const valueIdx = header.indexOf("OBS_VALUE")
    if (keyIdx < 0 || valueIdx < 0) return null

    const rates: TipoCambio[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""))
      if (!cols[keyIdx]) continue

      // KEY ejemplo: "D.USD.EUR.SP00.A"
      const keyParts = cols[keyIdx].split(".")
      const currency = keyParts[1]
      if (!currency || !PAIR_META[currency]) continue

      const valor = parseFloat(cols[valueIdx] ?? "")
      if (!Number.isFinite(valor)) continue

      rates.push({
        par:    `EUR/${currency}`,
        nombre: PAIR_META[currency].nombre,
        valor:  parseFloat(valor.toFixed(5)),
        fecha:  dateIdx >= 0 ? (cols[dateIdx] ?? null) : null,
      })
    }

    return rates.length > 0 ? rates : null
  } catch {
    return null
  }
}

export async function GET() {
  const cached = leerFresco<TipoCambio[]>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({
      data: cached, cached: true, updated_at: new Date().toISOString(),
      fuente: "ECB Statistical Data Warehouse (sin key)",
    })
  }

  const rates = await fetchEcbRates()

  if (!rates) {
    const stale = leerUltimoBueno<TipoCambio[]>(CACHE_KEY)
    if (stale) {
      return NextResponse.json({
        data: stale.data, stale: true, stale_since: stale.staleSince,
        updated_at: new Date().toISOString(),
      })
    }
    return NextResponse.json({ error: "ECB no disponible" }, { status: 503 })
  }

  guardarExito(CACHE_KEY, rates, TTL_SEG)

  return NextResponse.json({
    data: rates,
    cached: false,
    updated_at: new Date().toISOString(),
    fuente: "ECB Statistical Data Warehouse — EXR diario (sin key, monedas por 1 EUR)",
  })
}
