"use client"

import { useState, useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts"

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
  yAxisLabel?: string
  yAxisRight?: { label: string; format?: (v: number) => string }
  height?: number
  showZeroLine?: boolean
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

export function BBGLineChart({
  data, lines, title, yAxisLabel, yAxisRight, height = 180,
  showZeroLine, formatValue, enableDateRange = true, defaultRange = "1m"
}: BBGLineChartProps) {
  const [range, setRange] = useState<DateRange>(defaultRange)
  const fmt = formatValue || compactNum
  
  const filteredData = useMemo(() => {
    return filterDataByRange(data, range)
  }, [data, range])

  // Dominios Y ajustados a los datos visibles + padding (eje izquierdo y derecho)
  const yDomainLeft = useMemo(() => {
    const leftLines = lines.filter((l) => !l.yAxisId || l.yAxisId === "left")
    const values: number[] = filteredData.flatMap((d) =>
      leftLines.flatMap((l) => {
        const v = d[l.key]
        return typeof v === "number" ? [v] : []
      })
    )
    if (values.length === 0) return ["auto", "auto"] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.05, Math.abs(max) * 0.02)
    return [min - pad, max + pad] as const
  }, [filteredData, lines])

  const yDomainRight = useMemo(() => {
    if (!yAxisRight) return ["auto", "auto"] as const
    const rightLines = lines.filter((l) => l.yAxisId === "right")
    const values: number[] = filteredData.flatMap((d) =>
      rightLines.flatMap((l) => {
        const v = d[l.key]
        return typeof v === "number" ? [v] : []
      })
    )
    if (values.length === 0) return ["auto", "auto"] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.05, Math.abs(max) * 0.02)
    return [min - pad, max + pad] as const
  }, [filteredData, lines, yAxisRight])

  // Overrides manuales de escala
  const [scaleMin, setScaleMin] = useState("")
  const [scaleMax, setScaleMax] = useState("")
  const isOverriding = scaleMin !== "" || scaleMax !== ""

  const effectiveDomainLeft = useMemo((): [number | string, number | string] => {
    const uMin = scaleMin !== "" ? parseFloat(scaleMin) : null
    const uMax = scaleMax !== "" ? parseFloat(scaleMax) : null
    return [
      uMin !== null && !isNaN(uMin) ? uMin : yDomainLeft[0],
      uMax !== null && !isNaN(uMax) ? uMax : yDomainLeft[1],
    ]
  }, [yDomainLeft, scaleMin, scaleMax])

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {/* Escala manual */}
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <span style={{ fontSize: "9px", color: "#444", letterSpacing: 1 }}>Y:</span>
            <input
              type="number"
              placeholder={typeof yDomainLeft[0] === "number" ? String(Math.round(yDomainLeft[0] as number)) : "min"}
              value={scaleMin}
              onChange={(e) => setScaleMin(e.target.value)}
              style={{
                width: 52, fontSize: "9px", background: "#0d0d0d",
                border: `1px solid ${scaleMin ? "#FFA028" : "#333"}`,
                color: scaleMin ? "#FFA028" : "#666",
                padding: "1px 4px", borderRadius: 2, outline: "none",
              }}
            />
            <span style={{ fontSize: "9px", color: "#333" }}>–</span>
            <input
              type="number"
              placeholder={typeof yDomainLeft[1] === "number" ? String(Math.round(yDomainLeft[1] as number)) : "max"}
              value={scaleMax}
              onChange={(e) => setScaleMax(e.target.value)}
              style={{
                width: 52, fontSize: "9px", background: "#0d0d0d",
                border: `1px solid ${scaleMax ? "#FFA028" : "#333"}`,
                color: scaleMax ? "#FFA028" : "#666",
                padding: "1px 4px", borderRadius: 2, outline: "none",
              }}
            />
            {isOverriding && (
              <button
                onClick={() => { setScaleMin(""); setScaleMax("") }}
                style={{
                  fontSize: "9px", padding: "1px 5px", background: "transparent",
                  border: "1px solid #555", color: "#888", cursor: "pointer", borderRadius: 2,
                }}
              >
                AUTO
              </button>
            )}
          </div>
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
                    background: range === opt.value ? "#FFA028" : "transparent",
                    color: range === opt.value ? "#000" : "#888",
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
      <div style={{ padding: "4px 4px 0 0" }}>
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
            {lines.map((l) => (
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
