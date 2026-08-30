"use client"

import React from "react"

import { useEffect, useState, type ReactNode } from "react"
import {
  NUMERIC_RUNTIME_BINDINGS,
  NUMERIC_SURFACE_BY_ID,
  assessNumericResponseForCard,
  type NumericRuntimeStatus,
} from "@/server/numeric/manifest"

export type NumericBoundaryState = "checking" | NumericRuntimeStatus

function BoundaryMessage({ cardId, state }: { cardId: string; state: NumericBoundaryState }) {
  const surface = NUMERIC_SURFACE_BY_ID.get(cardId)
  const label = surface?.label ?? "Dato numérico"
  const message = state === "checking" ? "Verificando provenance…" : "Dato no disponible"
  return (
    <div
      data-numeric-status={state}
      data-numeric-card={cardId}
      className="flex min-h-24 flex-col items-center justify-center gap-1 p-4 text-center text-xs text-[var(--text-dim)]"
    >
      <span className="font-medium text-[var(--text)]">{label}</span>
      <span>{message}</span>
      {state === "unavailable" && <span className="font-mono text-[9px] text-[var(--text-mute)]">unavailable · sin provenance runtime</span>}
    </div>
  )
}

export function useNumericBoundary(cardId: string) {
  const [state, setState] = useState<NumericBoundaryState>("checking")
  const [payload, setPayload] = useState<unknown>(null)

  useEffect(() => {
    const binding = NUMERIC_RUNTIME_BINDINGS.find((entry) => entry.cardId === cardId)
    const controller = new AbortController()
    setState("checking")
    setPayload(null)

    if (!binding) {
      setState("unavailable")
      return () => controller.abort()
    }

    fetch(binding.endpoint, { method: binding.method, cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const nextPayload: unknown = await response.json().catch(() => null)
        if (!response.ok) return { status: "unavailable" as const, payload: nextPayload }
        return { status: assessNumericResponseForCard(cardId, nextPayload), payload: nextPayload }
      })
      .then((result) => {
        if (controller.signal.aborted) return
        setPayload(result.payload)
        setState(result.status)
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("unavailable")
      })

    return () => controller.abort()
  }, [cardId])

  return { state, payload }
}

export function NumericBoundary({ cardId, children }: { cardId: string; children: ReactNode | ((payload: unknown) => ReactNode) }) {
  const { state, payload } = useNumericBoundary(cardId)
  if (state !== "available") return <BoundaryMessage cardId={cardId} state={state} />
  return <>{typeof children === "function" ? children(payload) : children}</>
}
