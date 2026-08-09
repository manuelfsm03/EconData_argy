"use client"

import { Activity, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react"
import { useCardHealth } from "@/client/hooks/use-card-health"
import { cn } from "@/lib/utils"

export function CardHealthBadge({ cardId, compact = false, auto = true }: { cardId: string; compact?: boolean; auto?: boolean }) {
  const health = useCardHealth(cardId, auto)
  const title = health.endpoints.length
    ? health.endpoints.map((endpoint) => `${endpoint.label}: ${endpoint.ok ? `OK · ${endpoint.latencyMs} ms` : `error ${endpoint.status ?? "timeout"}`}`).join("\n")
    : "Comprobando endpoints"

  const Icon = health.state === "checking" ? LoaderCircle : health.state === "healthy" ? Activity : health.state === "degraded" ? CircleAlert : RefreshCw
  const label = health.state === "checking" ? "Chequeando" : health.state === "healthy" ? "Datos online" : health.state === "degraded" ? "Datos degradados" : auto ? "Sin estado" : "Chequear"

  return (
    <button
      type="button"
      onClick={health.refresh}
      title={`${label}\n${title}`}
      className={cn(
        "canvas-card-interactive inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] transition-colors",
        health.state === "healthy" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
        health.state === "degraded" && "border-red-500/25 bg-red-500/10 text-red-400",
        (health.state === "checking" || health.state === "unknown") && "border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-dim)]"
      )}
    >
      <Icon size={10} className={health.state === "checking" ? "animate-spin" : ""} />
      {!compact && label}
    </button>
  )
}
