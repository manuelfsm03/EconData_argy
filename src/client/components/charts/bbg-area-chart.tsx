"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { InfoTooltip } from "@/client/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

export type DateRange = "1w" | "1m" | "3m" | "6m" | "1y" | "ytd" | "all"

interface AreaConfig {
  key: string
  name: string
  color: string
  fillOpacity?: number
}

interface BBGAreaChartProps {
  data: Record<string, unknown>[]
  areas: AreaConfig[]
  title: string
  glossaryKey?: string
  yAxisLabel?: string
  height?: number
  stacked?: boolean
  formatValue?: (v: number) => string
  enableDateRange?: boolean
  defaultRange?: DateRange
}

function compactNum(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + "T"
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "B"
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + "K"
  return v.toFixed(1)
}

function fmtDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
  } catch { return dateStr }
}

function fmtDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
  } catch { return dateStr }
}

function filterDataByRange(data: Record<string, unknown>[], range: DateRange): Record<string, unknown>[] {
  if (range === "all" || data.length === 0) return data

  const now = new Date()
  const cutoff = new Date()

  switch (range) {
    case "1w": cutoff.setDate(now.getDate() - 7); break
    case "1m": cutoff.setMonth(now.getMonth() - 1); break
    case "3m": cutoff.setMonth(now.getMonth() - 3); break
    case "6m": cutoff.setMonth(now.getMonth() - 6); break
    case "1y": cutoff.setFullYear(now.getFullYear() - 1); break
    case "ytd": cutoff.setMonth(0); cutoff.setDate(1); break
    default: return data
  }

  return data.filter(d => {
    const dateStr = d.date as string
    if (!dateStr) return false
    const date = new Date(dateStr + "T00:00:00")
    return date >= cutoff
  })
}

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "1w", label: "1S" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1A" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "MAX" },
]

export function BBGAreaChart({
  data, areas, title, glossaryKey, yAxisLabel, height = 180, stacked, formatValue,
  enableDateRange = true, defaultRange = "1m"
}: BBGAreaChartProps) {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const fmt = formatValue || compactNum

  const filteredData = useMemo(() => {
    return filterDataByRange(data, range)
  }, [data, range])

  const yDomain = useMemo(() => {
    const values: number[] = filteredData.flatMap((d) =>
      areas.flatMap((a) => {
        const v = d[a.key]
        return typeof v === "number" ? [v] : []
      })
    )
    if (values.length === 0) return [0, 100] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.05, Math.abs(max) * 0.02)
    return [min - pad, max + pad] as const
  }, [filteredData, areas])

  // Y drag-to-scale state
  const [yOverride, setYOverride] = useState<{ min: number; max: number } | null>(null)
  const yDragRef = useRef<{ startY: number; startMin: number; startMax: number } | null>(null)
  const chartWrapperRef = useRef<HTMLDivElement>(null)

  const effectiveDomain = useMemo((): [number, number] => {
    if (yOverride) return [yOverride.min, yOverride.max]
    return [yDomain[0], yDomain[1]]
  }, [yDomain, yOverride])

  // Reset Y override when range changes
  const prevRangeRef = useRef(range)
  useEffect(() => {
    if (prevRangeRef.current !== range) {
      setYOverride(null)
      prevRangeRef.current = range
    }
  }, [range])

  const startYDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const domain = yOverride ?? { min: yDomain[0], max: yDomain[1] }
    yDragRef.current = { startY: e.clientY, startMin: domain.min, startMax: domain.max }

    const onMove = (ev: MouseEvent) => {
      if (!yDragRef.current) return
      const dy = ev.clientY - yDragRef.current.startY
      const span = yDragRef.current.startMax - yDragRef.current.startMin
      const center = (yDragRef.current.startMax + yDragRef.current.startMin) / 2
      const factor = Math.max(0.05, 1 + dy * 0.005)
      const newSpan = span * factor
      setYOverride({ min: center - newSpan / 2, max: center + newSpan / 2 })
    }
    const onUp = () => {
      yDragRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [yDomain, yOverride])

  // Wheel zoom — non-passive to allow preventDefault
  useEffect(() => {
    const el = chartWrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setYOverride((prev) => {
        const base = prev ?? { min: yDomain[0], max: yDomain[1] }
        const factor = e.deltaY > 0 ? 1.08 : 0.925
        const center = (base.max + base.min) / 2
        const newSpan = (base.max - base.min) * factor
        return { min: center - newSpan / 2, max: center + newSpan / 2 }
      })
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [yDomain])

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <span style={{ display: "flex", alignItems: "center" }}>
          {title}
          {glossaryKey && GLOSSARY[glossaryKey] && (
            <InfoTooltip
              text={GLOSSARY[glossaryKey].text}
              source={GLOSSARY[glossaryKey].source}
              url={GLOSSARY[glossaryKey].url}
              position="bottom"
            />
          )}
        </span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {yOverride && (
            <button
              onClick={() => setYOverride(null)}
              title="Resetear escala Y"
              style={{
                fontSize: "9px", padding: "1px 6px", background: "transparent",
                border: "1px solid #FFA02866", color: "var(--amber)", cursor: "pointer", borderRadius: 2,
              }}
            >AUTO</button>
          )}
          {enableDateRange && (
            <div style={{ display: "flex", gap: "2px" }}>
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    border: "none",
                    background: range === opt.value ? "var(--amber)" : "transparent",
                    color: range === opt.value ? "var(--bg)" : "var(--text-dim)",
                    cursor: "pointer",
                    borderRadius: "2px",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={chartWrapperRef} style={{ padding: "4px 4px 0 0", position: "relative" }}>
        {/* Y-axis drag zone overlay */}
        <div
          onMouseDown={startYDrag}
          onDoubleClick={() => setYOverride(null)}
          title="Arrastrá ↕ para ajustar escala Y · rueda para zoom · doble clic para auto"
          style={{
            position: "absolute",
            left: 0, top: 0,
            width: 54, bottom: 26,
            cursor: "ns-resize",
            zIndex: 10,
            borderLeft: yOverride ? "2px solid #FFA02855" : "2px solid transparent",
            transition: "border-color 0.2s",
          }}
        />
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {areas.map((a) => (
                <linearGradient key={a.key} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={a.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={a.color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date" tickFormatter={fmtDateShort}
              tick={{ fill: "var(--text-mute)", fontSize: 9 }}
              axisLine={{ stroke: "var(--border-hi)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={effectiveDomain}
              tick={{ fill: "var(--text-mute)", fontSize: 9 }}
              axisLine={{ stroke: "var(--border-hi)" }}
              tickLine={false}
              tickFormatter={fmt}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", fill: "var(--text-mute)", fontSize: 9 } : undefined}
            />
            <Tooltip
              contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border-hi)", fontSize: "10px", color: "var(--amber)" }}
              labelFormatter={(label) => fmtDateFull(String(label))}
              formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: "9px", color: "#888888" }}
              iconType="rect" iconSize={10}
            />
            {areas.map((a) => (
              <Area
                key={a.key}
                type="monotone"
                dataKey={a.key}
                name={a.name}
                stroke={a.color}
                fill={`url(#grad-${a.key})`}
                fillOpacity={a.fillOpacity ?? 1}
                strokeWidth={1.5}
                stackId={stacked ? "1" : undefined}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
