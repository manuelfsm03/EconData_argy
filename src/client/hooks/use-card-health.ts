"use client"

import { useCallback, useEffect, useState } from "react"

export interface CardHealthState {
  state: "checking" | "healthy" | "degraded" | "unknown"
  checkedAt: string | null
  endpoints: Array<{ label: string; path: string; ok: boolean; status: number | null; latencyMs: number }>
  refresh: () => void
}

type SourceStatus = {
  name?: string
  source?: string
  status?: "success" | "error" | "running" | "pending"
}

export function useCardHealth(_cardId: string, auto = true): CardHealthState {
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
    const controller = new AbortController()
    setState("checking")
    const startedAt = performance.now()
    fetch("/api/status", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("status unavailable")
        return response.json() as Promise<SourceStatus[]>
      })
      .then((statuses) => {
        const latencyMs = Math.round(performance.now() - startedAt)
        const rows = Array.isArray(statuses) ? statuses : []
        const observed = rows.filter((row) => row.status === "success" || row.status === "error")
        setEndpoints(observed.map((row) => ({
          label: row.name ?? row.source ?? "Fuente",
          path: row.source ?? "status",
          ok: row.status === "success",
          status: row.status === "success" ? 200 : 502,
          latencyMs,
        })))
        setCheckedAt(new Date().toISOString())
        setState(observed.length === 0 ? "unknown" : observed.every((row) => row.status === "success") ? "healthy" : "degraded")
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setState("unknown")
      })
    return () => controller.abort()
  }, [enabled, revision])

  return { state, checkedAt, endpoints, refresh }
}
