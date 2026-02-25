"use client"

import { useState, useEffect, useMemo } from "react"

const BCRA_API_BASE = "https://api.bcra.gob.ar/estadisticas/v4.0"

// Map frontend series IDs to BCRA API variable IDs
const SERIES_TO_VARIABLE: Record<string, number> = {
  reservas: 1,
  tc_minorista: 4,
  tc_mayorista: 5,
  badlar: 7,
  tm20: 8,
  depositos_30d: 12,
  base_monetaria: 15,
  circulacion: 16,
  prestamos_privado: 25,
  cer: 30,
  uva: 31,
  uvi: 32,
  depositos_efectivo: 20,
  cajas_ahorro: 22,
  plazos_fijos: 23,
}

function getPeriodDates(period: string): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case "1w": start.setDate(end.getDate() - 7); break
    case "1m": start.setMonth(end.getMonth() - 1); break
    case "3m": start.setMonth(end.getMonth() - 3); break
    case "6m": start.setMonth(end.getMonth() - 6); break
    case "1y": start.setFullYear(end.getFullYear() - 1); break
    case "2y": start.setFullYear(end.getFullYear() - 2); break
    case "3y": start.setFullYear(end.getFullYear() - 3); break
    case "max": start.setFullYear(end.getFullYear() - 5); break
    case "ytd": start.setMonth(0); start.setDate(1); break
    default: start.setMonth(end.getMonth() - 1)
  }

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  return { start: fmt(start), end: fmt(end) }
}

interface UseBCRADataResult {
  data: Record<string, number | string>[]
  loading: boolean
  error: string | null
  source: string
}

export function useBCRAData(
  seriesIds: string[],
  period = "1y"
): UseBCRADataResult {
  const [data, setData] = useState<Record<string, number | string>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState("")

  const key = useMemo(() => seriesIds.sort().join(","), [seriesIds])

  useEffect(() => {
    if (seriesIds.length === 0) {
      setData([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const { start, end } = getPeriodDates(period)

    // Fetch each series directly from BCRA API (browser-side, no Vercel proxy)
    const fetchSeries = async () => {
      const results: Record<string, { fecha: string; valor: number }[]> = {}

      // Fetch in batches of 3
      for (let i = 0; i < seriesIds.length; i += 3) {
        const batch = seriesIds.slice(i, i + 3)
        const promises = batch.map(async (seriesId) => {
          const varId = SERIES_TO_VARIABLE[seriesId]
          if (!varId) return { seriesId, data: [] }

          try {
            const url = `${BCRA_API_BASE}/monetarias/${varId}?desde=${start}&hasta=${end}&limit=2000`
            const res = await fetch(url)
            if (!res.ok) return { seriesId, data: [] }
            const json = await res.json()
            const detalle = json.results?.[0]?.detalle || []
            return { seriesId, data: detalle }
          } catch {
            return { seriesId, data: [] }
          }
        })

        const batchResults = await Promise.all(promises)
        for (const { seriesId, data } of batchResults) {
          results[seriesId] = data
        }

        // Small delay between batches
        if (i + 3 < seriesIds.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }

      return results
    }

    fetchSeries()
      .then((results) => {
        if (cancelled) return

        const hasData = Object.values(results).some((arr) => arr.length > 0)
        if (!hasData) {
          setError("No data returned from BCRA API")
          setData([])
          return
        }

        // Merge all series by date
        const dateMap: Record<string, Record<string, number | string>> = {}
        for (const [seriesId, points] of Object.entries(results)) {
          for (const point of points) {
            if (!dateMap[point.fecha]) {
              dateMap[point.fecha] = { date: point.fecha }
            }
            dateMap[point.fecha][seriesId] = point.valor
          }
        }

        const merged = Object.values(dateMap).sort((a, b) =>
          (a.date as string).localeCompare(b.date as string)
        )

        setData(merged)
        setSource("BCRA_API_v4.0")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [key, period])

  return { data, loading, error, source }
}
