"use client"

import { useCallback, useEffect, useState } from "react"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"

export interface CardHealthState {
  state: "checking" | "healthy" | "degraded" | "unknown"
  checkedAt: string | null
  endpoints: Array<{ label: string; path: string; ok: boolean; status: number | null; latencyMs: number }>
  refresh: () => void
}

/**
 * Antes esto pegaba a /api/status (salud GLOBAL de las ~25 fuentes externas
 * del sistema) e ignoraba cardId por completo -- una sola fuente caída en
 * cualquier parte (ej. EIA sin API key) marcaba TODAS las cards de la app
 * como "degradadas", incluidas las que no tienen nada que ver.
 *
 * Ahora chequea únicamente los endpoints propios de la card (ya declarados
 * en DATA_CARD_CATALOG para el buscador/Canvas), pegándoles directo -- si
 * esos responden bien, la card está "online" sin importar qué pase en el
 * resto del sistema.
 */
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

    const definition = DATA_CARD_BY_ID.get(cardId)
    if (!definition || definition.endpoints.length === 0) {
      setState("unknown")
      return
    }

    const controller = new AbortController()
    setState("checking")

    Promise.all(
      definition.endpoints.map(async (endpoint) => {
        const startedAt = performance.now()
        try {
          const response = await fetch(endpoint.path, {
            method: endpoint.method ?? "GET",
            headers: endpoint.body ? { "Content-Type": "application/json" } : undefined,
            body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
            signal: controller.signal,
            cache: "no-store",
          })
          return {
            label: endpoint.label,
            path: endpoint.path,
            ok: response.ok,
            status: response.status,
            latencyMs: Math.round(performance.now() - startedAt),
          }
        } catch {
          return {
            label: endpoint.label,
            path: endpoint.path,
            ok: false,
            status: null,
            latencyMs: Math.round(performance.now() - startedAt),
          }
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return
      setEndpoints(results)
      setCheckedAt(new Date().toISOString())
      setState(results.every((row) => row.ok) ? "healthy" : "degraded")
    })

    return () => controller.abort()
  }, [cardId, enabled, revision])

  return { state, checkedAt, endpoints, refresh }
}
