"use client"

import { useMemo } from "react"
import type { NumericProvenance } from "@/server/numeric/manifest"

type EiaPayload = {
  data?: Record<string, Array<[string, number]>>
  numericManifest?: NumericProvenance[]
}

export function NumericEnergyCard({ payload }: { payload: unknown }) {
  const response = payload as EiaPayload
  const provenance = response.numericManifest?.[0]
  const rows = useMemo(() => Object.entries(response.data ?? [])
    .map(([series, points]) => {
      const point = points.filter(([, value]) => Number.isFinite(value)).at(-1)
      return point ? { series, period: point[0], value: point[1] } : null
    })
    .filter((row): row is { series: string; period: string; value: number } => row != null)
    .sort((left, right) => right.value - left.value), [response.data])

  return (
    <div className="p-2">
      <div className="mb-2 border-b border-[var(--border)] pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--amber)]">Producción mundial de petróleo</div>
        <div className="mt-1 text-[9px] text-[var(--text-dim)]">
          Fuente: {provenance?.source ?? "unavailable"} · Unidad: {provenance?.unit ?? "not available"}
        </div>
        <div className="text-[9px] text-[var(--text-mute)]">
          asOf: {provenance?.asOf ?? "—"} · freshness: {provenance?.freshness ?? "unavailable"}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-[10px]">
        {rows.map((row) => (
          <div key={row.series} className="contents">
            <span className="truncate text-[var(--text-dim)]">{row.series}</span>
            <span className="font-mono text-[var(--text-mute)]">{row.period}</span>
            <span className="font-mono text-right text-[var(--text)]">{row.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
