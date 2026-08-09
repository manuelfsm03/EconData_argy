"use client"

import { useCallback, useEffect, useState } from "react"

export interface CardHealthState {
  state: "checking" | "healthy" | "degraded" | "unknown"
  checkedAt: string | null
  endpoints: Array<{ label: string; path: string; ok: boolean; status: number | null; latencyMs: number }>
  refresh: () => void
}

export function useCardHealth(cardId: string, auto = true): CardHealthState {
  const [enabled, setEnabled] = useState(auto)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<CardHealthState["state"]>("checking")
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
    const controller = new AbortController()
    setState("checking")
    fetch(`/api/card-health?cardId=${encodeURIComponent(cardId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("health unavailable")
        return response.json()
      })
      .then((payload) => {
        setEndpoints(Array.isArray(payload.endpoints) ? payload.endpoints : [])
        setCheckedAt(typeof payload.checkedAt === "string" ? payload.checkedAt : null)
        setState(payload.ok ? "healthy" : "degraded")
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setState("unknown")
      })
    return () => controller.abort()
  }, [cardId, enabled, revision])

  return { state, checkedAt, endpoints, refresh }
}
