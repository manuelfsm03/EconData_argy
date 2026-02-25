"use client"

import { useState, useEffect, useMemo } from "react"

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

    fetch("/api/bcra-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series_ids: seriesIds, period }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) {
          setError(json.error)
          setData([])
        } else {
          setData(json.data || [])
          setSource(json.metadata?.source || "")
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [key, period])

  return { data, loading, error, source }
}
