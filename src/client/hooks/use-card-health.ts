"use client"

import { useCallback, useEffect, useState } from "react"
import { probeCardEndpoint, selectCardHealthProbes, type CardHealthProbeResult } from "@/client/lib/card-health"

export interface CardHealthState {
  state: "checking" | "healthy" | "degraded" | "unknown"
  checkedAt: string | null
  endpoints: CardHealthProbeResult[]
  refresh: () => void
}

export function useCardHealth(cardId: string, auto = true): CardHealthState {
  const [enabled, setEnabled] = useState(auto)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<CardHealthState["state"]>(auto ? "checking" : "unknown")
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<CardHealthState["endpoints"]>([])

  const refresh = useCallback(() => {
    setEnabled(true)
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setState("unknown")
      return
    }

    const probes = selectCardHealthProbes(cardId)
    if (probes.length === 0) {
      setEndpoints([])
      setCheckedAt(null)
      setState("unknown")
      return
    }

    const controller = new AbortController()
    setState("checking")

    Promise.all(probes.map((probe) => probeCardEndpoint(probe, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return
        setEndpoints(results)
        setCheckedAt(new Date().toISOString())
        setState(results.every((row) => row.ok) ? "healthy" : "degraded")
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setState("unknown")
      })

    return () => controller.abort()
  }, [cardId, enabled, revision])

  return { state, checkedAt, endpoints, refresh }
}
