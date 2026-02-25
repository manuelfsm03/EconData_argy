/**
 * BCRA Data API Client
 * Fetches monetary/financial data from official BCRA API v4.0
 */

import { 
  bcraOfficialApi, 
  BCRA_VARIABLE_MAPPING,
  type BCRAVariableKey 
} from "@/lib/bcra-official-api"

// BCRA Variable definitions (for backwards compatibility)
export const BCRA_VARIABLES: Record<string, { id: string; label: string; unit: string }> = {
  reservas:           { id: "reservas", label: "Reservas Internacionales", unit: "USD MM" },
  tc_minorista:       { id: "tc_minorista", label: "Tipo de Cambio Minorista", unit: "ARS" },
  tc_mayorista:       { id: "tc_mayorista", label: "Tipo de Cambio Mayorista", unit: "ARS" },
  badlar:             { id: "badlar", label: "BADLAR Bancos Privados", unit: "%" },
  tm20:               { id: "tm20", label: "TM20 Bancos Privados", unit: "%" },
  depositos_30d:      { id: "depositos_30d", label: "Tasa Depósitos 30 días", unit: "%" },
  base_monetaria:     { id: "base_monetaria", label: "Base Monetaria", unit: "ARS MM" },
  circulacion:        { id: "circulacion", label: "Circulación Monetaria", unit: "ARS MM" },
  prestamos_privado:  { id: "prestamos_privado", label: "Préstamos Sector Privado", unit: "ARS MM" },
  cer:                { id: "cer", label: "CER", unit: "index" },
  uva:                { id: "uva", label: "UVA", unit: "index" },
  uvi:                { id: "uvi", label: "UVI", unit: "index" },
  tamar:              { id: "tamar", label: "TAMAR Bancos Privados", unit: "%" },
  depositos_efectivo: { id: "depositos_efectivo", label: "Depósitos Efectivo", unit: "ARS MM" },
  cajas_ahorro:       { id: "cajas_ahorro", label: "Cajas de Ahorro", unit: "ARS MM" },
}

export interface BCRADataPoint {
  date: string
  value: number
}

export interface BCRASeriesData {
  [seriesId: string]: BCRADataPoint[]
}

// Map frontend series IDs to BCRA API variable keys
const SERIES_TO_VARIABLE_KEY: Record<string, BCRAVariableKey> = {
  reservas: "RESERVAS_USD",
  tc_minorista: "TIPO_CAMBIO_MINORISTA",
  tc_mayorista: "TIPO_CAMBIO_MAYORISTA",
  badlar: "BADLAR_TNA",
  tm20: "TM20",
  depositos_30d: "TASA_DEPOSITOS_30D",
  base_monetaria: "BASE_MONETARIA",
  circulacion: "CIRCULACION_MONETARIA",
  prestamos_privado: "PRESTAMOS_PRIV_TOTAL_ARS",
  cer: "CER",
  uva: "UVA",
  uvi: "UVI",
  tamar: "TAMAR_TNA",
  depositos_efectivo: "DEPOSITOS_EFECTIVO",
  cajas_ahorro: "CAJAS_AHORRO",
}

/**
 * Fetch a single series from official BCRA API
 */
async function fetchBCRASeries(
  seriesId: string,
  startDate: string,
  endDate: string
): Promise<BCRADataPoint[]> {
  try {
    const variableKey = SERIES_TO_VARIABLE_KEY[seriesId]
    if (!variableKey) {
      console.warn(`Unknown series ID: ${seriesId}`)
      return []
    }
    
    const config = BCRA_VARIABLE_MAPPING[variableKey]
    const data = await bcraOfficialApi.getSeriesData(
      config.idVariable,
      startDate,
      endDate,
      2000 // Get up to 2000 data points
    )
    
    // Transform BCRA format to our format (BCRA returns dates DESC, we need ASC)
    return data
      .map(point => ({
        date: point.fecha,
        value: point.valor,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch (err) {
    console.error(`Error fetching series ${seriesId}:`, err)
    return []
  }
}

/**
 * Fetch multiple series in parallel using official BCRA API
 */
export async function fetchMultipleSeries(
  seriesIds: string[],
  startDate: string,
  endDate: string
): Promise<BCRASeriesData> {
  const results: BCRASeriesData = {}
  
  // Map series IDs to variable keys
  const variableKeys = seriesIds
    .map(id => SERIES_TO_VARIABLE_KEY[id])
    .filter(Boolean) as BCRAVariableKey[]
  
  if (variableKeys.length === 0) {
    return results
  }
  
  try {
    // Use the official API client to fetch multiple series
    const bcraData = await bcraOfficialApi.getMultipleSeriesData(
      variableKeys,
      startDate,
      endDate
    )
    
    // Map back to frontend series IDs
    for (const seriesId of seriesIds) {
      const variableKey = SERIES_TO_VARIABLE_KEY[seriesId]
      if (variableKey) {
        const config = BCRA_VARIABLE_MAPPING[variableKey]
        const data = bcraData[config.frontendId]
        if (data) {
          results[seriesId] = data
            .map(point => ({
              date: point.fecha,
              value: point.valor,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
        }
      }
    }
  } catch (err) {
    console.error("Error fetching multiple series:", err)
  }
  
  return results
}

/**
 * Merge multiple series into a single array keyed by date
 */
export function mergeSeriesByDate(seriesData: BCRASeriesData): Record<string, number | string>[] {
  const dateMap: Record<string, Record<string, number | string>> = {}

  for (const [seriesId, points] of Object.entries(seriesData)) {
    for (const point of points) {
      if (!dateMap[point.date]) {
        dateMap[point.date] = { date: point.date }
      }
      dateMap[point.date][seriesId] = point.value
    }
  }

  return Object.values(dateMap).sort((a, b) =>
    (a.date as string).localeCompare(b.date as string)
  )
}

/**
 * Get date range for a period
 */
export function getPeriodDates(period: string): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case "1w": start.setDate(end.getDate() - 7); break
    case "1m": start.setMonth(end.getMonth() - 1); break
    case "3m": start.setMonth(end.getMonth() - 3); break
    case "6m": start.setMonth(end.getMonth() - 6); break
    case "1y": start.setFullYear(end.getFullYear() - 1); break
    case "ytd": start.setMonth(0); start.setDate(1); break
    case "2y": start.setFullYear(end.getFullYear() - 2); break
    case "5y": start.setFullYear(end.getFullYear() - 5); break
    case "max": start.setFullYear(2000); break
    default: start.setMonth(end.getMonth() - 1)
  }

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  return { start: fmt(start), end: fmt(end) }
}
