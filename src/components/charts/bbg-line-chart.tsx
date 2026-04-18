"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

export type DateRange = "1w" | "1m" | "3m" | "6m" | "1y" | "ytd" | "all"

interface LineConfig {
  key: string
  name: string
  color: string
  yAxisId?: "left" | "right"
  dashed?: boolean
}

interface BBGLineChartProps {
  data: Record<string, unknown>[]
  lines: LineConfig[]
  title: string
  glossaryKey?: string
  yAxisLabel?: string
  yAxisRight?: { label: string; format?: (v: number) => string }
  height?: number
  showZeroLine?: boolean
  formatValue?: (v: number) => string
  enableDateRange?: boolean
  defaultRange?: DateRange
  enableLineToggle?: boolean
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
    const d = parseDate(String(dateStr))
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
  } catch { return String(dateStr) }
}

function fmtDateFull(dateStr: string): string {
  try {
    const d = parseDate(String(dateStr))
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
  } catch { return String(dateStr) }
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const normalized = /^\d{4}-\d{2}$/.test(dateStr) ? dateStr + "-01" : dateStr
  return new Date(normalized + (normalized.includes("T") ? "" : "T00:00:00"))
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

  const filtered = data.filter(d => {
    const date = parseDate(d.date as string)
    if (isNaN(date.getTime())) return true
    return date >= cutoff
  })

  if (filtered.length < 2) {
    const months = range === "1w" ? 0 : range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : range === "1y" ? 12 : 6
    return data.slice(-Math.max(months * 4, 12))
  }

  return filtered
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

export function BBGLineChart({
  data, lines, title, glossaryKey, yAxisLabel, yAxisRight, height = 180,
  showZeroLine, formatValue, enableDateRange = true, defaultRange = "1m",
  enableLineToggle = false,
}: BBGLineChartProps) {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const fmt = formatValue || compactNum

  const toggleLine = (key: string) =>
    setHidden(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })

  const visibleLines = enableLineToggle ? lines.filter(l => !hidden.has(l.key)) : lines

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    return filterDataByRange(data, range)
  }, [data, range])

  const yDomainLeft = useMemo(() => {
    const leftLines = lines.filter((l) => !l.yAxisId || l.yAxisId === "left")
    const values: number[] = filteredData.flatMap((d) =>
      leftLines.flatMap((l) => {
        const v = d[l.key]
        return typeof v === "number" ? [v] : []
      })
    )
    if (values.length === 0) return [0, 100] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.05, Math.abs(max) * 0.02)
    return [min - pad, max + pad] as const
  }, [filteredData, lines])

  const yDomainRight = useMemo(() => {
    if (!yAxisRight) return [0, 100] as const
    const rightLines = lines.filter((l) => l.yAxisId === "right")
    const values: number[] = filteredData.flatMap((d) =>
      rightLines.flatMap((l) => {
        const v = d[l.key]
        return typeof v === "number" ? [v] : []
      })
    )
    if (values.length === 0) return [0, 100] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.05, Math.abs(max) * 0.02)
    return [min - pad, max + pad] as const
  }, [filteredData, lines, yAxisRight])

  // Y drag-to-scale state
  const [yOverride, setYOverride] = useState<{ min: number; max: number } | null>(null)
  const yDragRef = useRef<{ startY: number; startMin: number; startMax: number } | null>(null)
  const chartWrapperRef = useRef<HTMLDivElement>(null)

  const effectiveDomainLeft = useMemo((): [number, number] => {
    if (yOverride) return [yOverride.min, yOverride.max]
    return [yDomainLeft[0], yDomainLeft[1]]
  }, [yDomainLeft, yOverride])

  // Reset Y override when range or data changes (auto-rescale)
  // Only reset if user hasn't explicitly set it
  const prevRangeRef = useRef(range)
  useEffect(() => {
    if (prevRangeRef.current !== range) {
      setYOverride(null)
      prevRangeRef.current = range
    }
  }, [range])

  const startYDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const domain = yOverride ?? { min: yDomainLeft[0], max: yDomainLeft[1] }
    yDragRef.current = { startY: e.clientY, startMin: domain.min, startMax: domain.max }

    const onMove = (ev: MouseEvent) => {
      if (!yDragRef.current) return
      const dy = ev.clientY - yDragRef.current.startY
      const span = yDragRef.current.startMax - yDragRef.current.startMin
      const center = (yDragRef.current.startMax + yDragRef.current.startMin) / 2
      // drag down → expand range (zoom out); drag up → compress (zoom in)
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
  }, [yDomainLeft, yOverride])

  // Wheel zoom on chart — attached as non-passive to allow preventDefault
  useEffect(() => {
    const el = chartWrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setYOverride((prev) => {
        const base = prev ?? { min: yDomainLeft[0], max: yDomainLeft[1] }
        const factor = e.deltaY > 0 ? 1.08 : 0.925
        const center = (base.max + base.min) / 2
        const newSpan = (base.max - base.min) * factor
        return { min: center - newSpan / 2, max: center + newSpan / 2 }
      })
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [yDomainLeft])

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
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
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {enableLineToggle && lines.map(l => (
            <button
              key={l.key}
              onClick={() => toggleLine(l.key)}
              style={{
                fontSize: "9px", padding: "2px 7px", border: "none", borderRadius: "2px", cursor: "pointer",
                background: hidden.has(l.key) ? "#111" : l.color,
                color: hidden.has(l.key) ? "#444" : "#000",
                fontWeight: 700, letterSpacing: 0.5,
                opacity: hidden.has(l.key) ? 0.5 : 1,
              }}
            >{l.name}</button>
          ))}
          {enableLineToggle && <span style={{ width: 1, height: 12, background: "#222", margin: "0 2px" }} />}
          {yOverride && (
            <button
              onClick={() => setYOverride(null)}
              title="Resetear escala Y"
              style={{
                fontSize: "9px", padding: "1px 6px", background: "transparent",
                border: "1px solid #FFA02866", color: "#FFA028", cursor: "pointer", borderRadius: 2,
              }}
            >AUTO</button>
          )}
          {enableDateRange && (
            <>
              <span style={{ width: 1, height: 12, background: "#222", margin: "0 2px" }} />
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  style={{
                    fontSize: "9px", padding: "2px 6px", border: "none",
                    background: range === opt.value ? "#FFA028" : "transparent",
                    color: range === opt.value ? "#000" : "#888",
                    cursor: "pointer", borderRadius: "2px",
                  }}
                >{opt.label}</button>
              ))}
            </>
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
          <LineChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <XAxis
              dataKey="date" tickFormatter={fmtDateShort}
              tick={{ fill: "#555555", fontSize: 9 }}
              axisLine={{ stroke: "#333333" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              domain={effectiveDomainLeft}
              tick={{ fill: "#555555", fontSize: 9 }}
              axisLine={{ stroke: "#333333" }}
              tickLine={false}
              tickFormatter={fmt}
              label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", fill: "#555555", fontSize: 9 } : undefined}
            />
            {yAxisRight && (
              <YAxis
                yAxisId="right" orientation="right"
                domain={yDomainRight}
                tick={{ fill: "#555555", fontSize: 9 }}
                axisLine={{ stroke: "#333333" }}
                tickLine={false}
                tickFormatter={yAxisRight.format || fmt}
                label={yAxisRight.label ? { value: yAxisRight.label, angle: 90, position: "insideRight", fill: "#555555", fontSize: 9 } : undefined}
              />
            )}
            {showZeroLine && <ReferenceLine y={0} stroke="#333333" yAxisId="left" />}
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #333333", fontSize: "10px", color: "#FFA028" }}
              labelFormatter={(label) => fmtDateFull(String(label))}
              formatter={(value: unknown, name: unknown) => [fmt(Number(value)), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: "9px", color: "#888888" }}
              iconType="line" iconSize={10}
            />
            {visibleLines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                yAxisId={l.yAxisId || "left"}
                dot={false}
                strokeWidth={1.5}
                strokeDasharray={l.dashed ? "4 2" : undefined}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
