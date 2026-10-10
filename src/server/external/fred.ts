/**
 * Cliente FRED (Federal Reserve Economic Data — St. Louis Fed).
 *
 * Requiere env var FRED_API_KEY (gratis en https://fred.stlouisfed.org/docs/api/api_key.html).
 * Si la key no está seteada, las funciones devuelven null (degradación grácil):
 * el llamador tiene que estar preparado para caer a otra fuente o a un default.
 *
 * Series útiles:
 *   - DGS10  → US 10-Year Treasury Constant Maturity Rate (daily, %)
 *   - DFEDTARU → Federal Funds Target Upper Bound
 *   - DTB3   → 3-Month Treasury Bill
 *
 * NOTA: FRED no publica series EMBI+ regionales gratuitas — JPMorgan cobra
 * por el índice. Para los EMBI de Brasil/Chile/Colombia/Perú/México seguimos
 * usando valores de referencia manual (ver /api/riesgo-pais).
 */

import { fetchRegistered } from "@/server/http/fetch-source"

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

/**
 * Trae la última observación numérica de una serie FRED.
 * Devuelve null si:
 *   - no hay FRED_API_KEY seteada
 *   - la request falla o timeoutea
 *   - el valor viene vacío / no parseable (FRED usa "." para "sin dato")
 */
export async function fetchFREDLatest(seriesId: string): Promise<number | null> {
  const key = process.env.FRED_API_KEY
  if (!key) return null
  try {
    const url = `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}&api_key=${key}&file_type=json&sort_order=desc&limit=1`
    const res = await fetchRegistered(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const j = await res.json() as { observations?: Array<{ value?: unknown }> }
    const raw = j?.observations?.[0]?.value
    if (raw == null) return null
    const v = parseFloat(String(raw))
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}
