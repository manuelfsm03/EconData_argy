"use client"

/**
 * TabTiposCambio — Histórico de tipos de cambio AR/USD
 * Fuente: /api/tc-historico → argentinadatos.com
 * Gráfico multi-línea + tabla últimos 30 días
 */

import { useState, useEffect, useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"

interface TCEntry {
  date: string
  blue?: number
  mep?: number
  ccl?: number
  oficial?: number
  mayorista?: number
}

type Period = "1m" | "3m" | "6m" | "1y" | "max"

const PERIODS: { value: Period; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1A" },
  { value: "max", label: "MAX" },
]

const LINES: { key: keyof Omit<TCEntry, "date">; name: string; color: string }[] = [
  { key: "blue", name: "Blue", color: "#4AF6C3" },
  { key: "ccl", name: "CCL", color: "#FFA028" },
  { key: "mep", name: "MEP", color: "#FFD700" },
  { key: "mayorista", name: "Mayorista", color: "#888888" },
  { key: "oficial", name: "Oficial", color: "#aaaaaa" },
]

function fmtDate(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) }
  catch { return d }
}

function fmtDateShort(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }) }
  catch { return d }
}

function fmtNum(v: number | undefined | null): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Brecha vs oficial
function brecha(v: number | undefined, oficial: number | undefined): string {
  if (!v || !oficial || oficial === 0) return "—"
  return ((v - oficial) / oficial * 100).toFixed(1) + "%"
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#0d0d0d", border: "1px solid #333", padding: "8px 12px",
      fontSize: 11, minWidth: 160,
    }}>
      <div style={{ color: "#666", marginBottom: 4, fontSize: 9 }}>{fmtDate(label)}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "#fff", fontFamily: "monospace" }}>${fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Vista del gráfico ─────────────────────────────────────────────────────────
function GraficoTC({ data }: { data: TCEntry[] }) {
  const [visibles, setVisibles] = useState<Set<string>>(new Set(["blue", "ccl", "mep", "oficial"]))

  const toggleLine = (key: string) => {
    setVisibles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: 4, padding: "6px 12px", borderBottom: "1px solid #1a1a1a" }}>
        {LINES.map((l) => (
          <button
            key={l.key}
            onClick={() => toggleLine(l.key)}
            style={{
              fontSize: 9, padding: "3px 8px",
              background: visibles.has(l.key) ? l.color + "22" : "transparent",
              border: `1px solid ${visibles.has(l.key) ? l.color : "#333"}`,
              color: visibles.has(l.key) ? l.color : "#555",
              cursor: "pointer", borderRadius: 2,
              textTransform: "uppercase", letterSpacing: 1,
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <XAxis
              dataKey="date" tickFormatter={fmtDateShort}
              tick={{ fill: "#555", fontSize: 9 }}
              axisLine={{ stroke: "#333" }} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#555", fontSize: 9 }}
              axisLine={{ stroke: "#333" }} tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 9, color: "#888", paddingTop: 4 }}
              iconType="line" iconSize={10}
            />
            {LINES.filter((l) => visibles.has(l.key)).map((l) => (
              <Line
                key={l.key}
                type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color} dot={false} strokeWidth={1.5}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Tabla últimos días ────────────────────────────────────────────────────────
function TablaHistorico({ data }: { data: TCEntry[] }) {
  const ultimos30 = useMemo(() => [...data].reverse().slice(0, 30), [data])

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Fecha", "Blue", "MEP", "CCL", "Mayorista", "Oficial", "Brecha Blue/Ofic", "Brecha CCL/Ofic"].map((h, i) => (
              <th key={h} style={{
                padding: "4px 8px", fontSize: 9, color: "#555",
                textAlign: i === 0 ? "left" : "right",
                borderBottom: "1px solid #1a1a1a",
                whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ultimos30.map((row, i) => (
            <tr key={row.date} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
              <td style={{ padding: "4px 8px", fontSize: 10, color: "#888" }}>{fmtDate(row.date)}</td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                {row.blue ? `$${fmtNum(row.blue)}` : "—"}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFD700", textAlign: "right", fontFamily: "monospace" }}>
                {row.mep ? `$${fmtNum(row.mep)}` : "—"}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFA028", textAlign: "right", fontFamily: "monospace" }}>
                {row.ccl ? `$${fmtNum(row.ccl)}` : "—"}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#999", textAlign: "right", fontFamily: "monospace" }}>
                {row.mayorista ? `$${fmtNum(row.mayorista)}` : "—"}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#aaa", textAlign: "right", fontFamily: "monospace" }}>
                {row.oficial ? `$${fmtNum(row.oficial)}` : "—"}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#ff8", textAlign: "right", fontFamily: "monospace" }}>
                {brecha(row.blue, row.oficial)}
              </td>
              <td style={{ padding: "4px 8px", fontSize: 11, color: "#ff8", textAlign: "right", fontFamily: "monospace" }}>
                {brecha(row.ccl, row.oficial)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── KPIs superiores ───────────────────────────────────────────────────────────
function KPIStrip({ data }: { data: TCEntry[] }) {
  const latest = data[data.length - 1]
  const prev = data[data.length - 2]

  if (!latest) return null

  const kpis = LINES.map((l) => {
    const cur = latest[l.key]
    const prv = prev?.[l.key]
    const pct = cur != null && prv != null && prv > 0 ? ((cur - prv) / prv) * 100 : null
    return { ...l, value: cur, pct }
  })

  return (
    <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, flexWrap: "wrap" }}>
      {kpis.map((k) => (
        <div key={k.key} style={{ flex: "1 1 110px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{k.name}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>
            {k.value ? `$${fmtNum(k.value)}` : "—"}
          </div>
          {k.pct != null && (
            <div style={{ fontSize: 9, color: k.pct >= 0 ? "#4AF6C3" : "#FF433D", marginTop: 2 }}>
              {k.pct >= 0 ? "+" : ""}{k.pct.toFixed(2)}% 1D
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function TabTiposCambio() {
  const [period, setPeriod] = useState<Period>("1y")
  const [data, setData] = useState<TCEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/tc-historico?period=${period}`)
      .then((r) => r.json())
      .then((j) => { setData(j.data ?? []); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [period])

  return (
    <div>
      {/* Header */}
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>TIPOS DE CAMBIO — HISTÓRICO</span>
        <div style={{ display: "flex", gap: 2 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                fontSize: 9, padding: "2px 8px",
                background: period === p.value ? "#FFA028" : "transparent",
                color: period === p.value ? "#000" : "#666",
                border: `1px solid ${period === p.value ? "#FFA028" : "#333"}`,
                cursor: "pointer", borderRadius: 2,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>
          Cargando histórico de tipos de cambio...
        </div>
      )}
      {error && (
        <div style={{ padding: 16, color: "#FF433D", fontSize: 11 }}>
          Error cargando datos: {error}
        </div>
      )}

      {!loading && data.length > 0 && (
        <>
          {/* KPI strip */}
          <KPIStrip data={data} />

          {/* Chart */}
          <div style={{ marginTop: 1 }}>
            <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
              Evolución tipos de cambio (ARS/USD) — venta
            </div>
            <GraficoTC data={data} />
          </div>

          {/* Table */}
          <div style={{ marginTop: 1 }}>
            <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
              Últimos 30 días — precio de venta (ARS)
            </div>
            <TablaHistorico data={data} />
          </div>

          <div style={{ padding: "4px 8px", fontSize: 9, color: "#333", borderTop: "1px solid #111" }}>
            Fuente: argentinadatos.com · Precios de venta en ARS · {data.length} registros cargados
          </div>
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>
          No hay datos disponibles para el período seleccionado.
        </div>
      )}
    </div>
  )
}
