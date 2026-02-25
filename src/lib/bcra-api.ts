/**
 * BCRA Data API Client
 * Fetches monetary/financial data from local database with fallback to sample data for demo
 */

import { prisma } from "@/lib/prisma"

// BCRA Variable definitions
export const BCRA_VARIABLES: Record<string, { id: string; label: string; unit: string }> = {
  reservas:           { id: "reservas", label: "Reservas Internacionales", unit: "USD MM" },
  tc_minorista:       { id: "tc_minorista", label: "Tipo de Cambio Minorista", unit: "ARS" },
  tc_mayorista:       { id: "tc_mayorista", label: "Tipo de Cambio Mayorista", unit: "ARS" },
  badlar:             { id: "badlar", label: "BADLAR Bancos Privados", unit: "%" },
  tm20:               { id: "tm20", label: "TM20 Bancos Privados", unit: "%" },
  depositos_30d:      { id: "depositos30d", label: "Tasa Depósitos 30 días", unit: "%" },
  base_monetaria:     { id: "baseMonetaria", label: "Base Monetaria", unit: "ARS MM" },
  circulacion:        { id: "circulacion", label: "Circulación Monetaria", unit: "ARS MM" },
  prestamos_privado:  { id: "prestamosPrivado", label: "Préstamos Sector Privado", unit: "ARS MM" },
  cer:                { id: "cer", label: "CER", unit: "index" },
  uva:                { id: "uva", label: "UVA", unit: "index" },
  uvi:                { id: "uvi", label: "UVI", unit: "index" },
}

export interface BCRADataPoint {
  date: string
  value: number
}

export interface BCRASeriesData {
  [seriesId: string]: BCRADataPoint[]
}

// Generate sample data for demo purposes
function generateSampleData(seriesId: string, days: number): BCRADataPoint[] {
  const data: BCRADataPoint[] = []
  const end = new Date()
  
  // Base values and volatility for each series
  const configs: Record<string, { base: number; volatility: number; trend: number }> = {
    reservas: { base: 28000, volatility: 500, trend: -10 },
    base_monetaria: { base: 45000000, volatility: 1000000, trend: 50000 },
    circulacion: { base: 12000000, volatility: 300000, trend: 15000 },
    prestamos_privado: { base: 18000000, volatility: 200000, trend: 8000 },
    tc_minorista: { base: 1220, volatility: 15, trend: 1.2 },
    tc_mayorista: { base: 1190, volatility: 12, trend: 1.1 },
    badlar: { base: 35, volatility: 0.5, trend: -0.02 },
    tm20: { base: 34, volatility: 0.4, trend: -0.015 },
    depositos_30d: { base: 32, volatility: 0.3, trend: -0.01 },
    cer: { base: 8500, volatility: 50, trend: 8 },
    uva: { base: 1350, volatility: 8, trend: 1.2 },
    uvi: { base: 720, volatility: 4, trend: 0.6 },
  }
  
  const config = configs[seriesId] || { base: 1000, volatility: 50, trend: 0 }
  let currentValue = config.base - (days * config.trend) // Start from earlier value
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(end)
    date.setDate(date.getDate() - i)
    
    // Add random walk with trend
    const randomChange = (Math.random() - 0.5) * config.volatility
    currentValue += config.trend + randomChange
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, currentValue)
    })
  }
  
  return data
}

/**
 * Fetch a single series from database or generate sample data
 */
async function fetchBCRASeries(
  seriesId: string,
  startDate: string,
  endDate: string
): Promise<BCRADataPoint[]> {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Map series ID to database field
    const fieldMap: Record<string, string> = {
      reservas: "reservas",
      base_monetaria: "baseMonetaria",
      circulacion: "circulacion",
      prestamos_privado: "prestamosPrivado",
      tc_minorista: "tcMinorista",
      tc_mayorista: "tcMayorista",
      badlar: "badlar",
      tm20: "tm20",
      depositos_30d: "depositos30d",
      cer: "cer",
      uva: "uva",
      uvi: "uvi",
    }
    
    const dbField = fieldMap[seriesId]
    if (!dbField) {
      console.warn(`Unknown series ID: ${seriesId}`)
      return generateSampleData(seriesId, 365)
    }
    
    // Query database
    const records = await prisma.bCRAMonetaryData.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
        [dbField]: {
          not: null,
        },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        [dbField]: true,
      },
    })
    
    if (records.length > 0) {
      return records.map((r: Record<string, unknown>) => ({
        date: (r.date as Date).toISOString().split('T')[0],
        value: r[dbField] as number,
      }))
    }
    
    // If no database records, generate sample data for demo
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return generateSampleData(seriesId, days)
  } catch (err) {
    console.error(`Error fetching series ${seriesId}:`, err)
    // Return sample data on error
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    return generateSampleData(seriesId, days)
  }
}

/**
 * Fetch multiple series in parallel
 */
export async function fetchMultipleSeries(
  seriesIds: string[],
  startDate: string,
  endDate: string
): Promise<BCRASeriesData> {
  const results: BCRASeriesData = {}

  const fetches = seriesIds.map(async (seriesId) => {
    const data = await fetchBCRASeries(seriesId, startDate, endDate)
    results[seriesId] = data
  })

  await Promise.all(fetches)
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
