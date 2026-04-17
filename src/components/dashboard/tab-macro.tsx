/**
 * TabMacro — Macroeconomía argentina
 *
 * API: /api/macro?endpoint=emae
 *      /api/macro?endpoint=ipc
 *      /api/macro?endpoint=ipi
 *      /api/macro?endpoint=balanza
 *      /api/macro?endpoint=fiscal
 *
 * Portado de EconData_argy SeccionMacro.js + SeccionIPC.js
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { BBGAreaChart } from "../charts/bbg-area-chart"
import { BBGLineChart } from "../charts/bbg-line-chart"
import { FiscalSankeyView } from "./fiscal-sankey"
import { DownloadCSV } from "../ui/download-csv"
import { ChartDownload } from "../ui/chart-download"
import { SectionMeta } from "../ui/help-tooltip"
import {
  BarChart, Bar, Cell, LineChart, Line,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area,
  PieChart, Pie,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────

type Serie = [string, number][]
type MacroData = Record<string, Serie>

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}

function varSign(v: number | null | undefined): string {
  if (v == null) return ""
  return v >= 0 ? "+" : ""
}

// ── KPI Block ─────────────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  unit,
  var1,
  var1Label,
  var2,
  var2Label,
  valueColor,
}: {
  label: string
  value: string | null
  unit: string
  var1?: number | null
  var1Label?: string
  var2?: number | null
  var2Label?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid #1a1a1a",
        padding: "10px 14px",
        flex: "1 1 160px",
      }}
    >
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#FFA028", fontFamily: "monospace" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{unit}</div>
      {var1 != null && (
        <div style={{ fontSize: 10, color: varColor(var1), marginTop: 4 }}>
          {varSign(var1)}{fmtNum(var1)}% {var1Label}
        </div>
      )}
      {var2 != null && (
        <div style={{ fontSize: 10, color: varColor(var2) }}>
          {varSign(var2)}{fmtNum(var2)}% {var2Label}
        </div>
      )}
    </div>
  )
}

// ── Mini table ─────────────────────────────────────────────────────────────────

function MiniTable({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ background: "#060606", border: "1px solid #1a1a1a" }}>
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
        {title}
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 8px",
            background: i % 2 === 0 ? "#060606" : "#080808",
            fontSize: 11,
          }}
        >
          <span style={{ color: "#888" }}>{r.label}</span>
          <span style={{ color: r.color ?? "#fff", fontFamily: "monospace", fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Sub-tab bar ────────────────────────────────────────────────────────────────

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: active === t.key ? "rgba(255,160,40,0.08)" : "transparent",
            color: active === t.key ? "#FFA028" : "#888",
            border: active === t.key ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
            borderRadius: 20,
            padding: "5px 14px",
            fontSize: 10,
            fontWeight: active === t.key ? 600 : 400,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s",
            fontFamily: "monospace",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── IPC Ponderaciones ─────────────────────────────────────────────────────────

type PonderRow = { cat: string; actual: number; propuesto: number }

function usePonderaciones(): { rows: PonderRow[]; tipos: Record<string, string>; loading: boolean } {
  const [rows, setRows] = useState<PonderRow[]>([])
  const [tipos, setTipos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/macro?endpoint=ponderaciones")
      .then(r => r.json())
      .then(j => { setRows(j.data ?? []); setTipos(j.tipos ?? {}) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return { rows, tipos, loading }
}

export function PonderacionesTable() {
  const { rows, loading } = usePonderaciones()
  if (loading) return <div style={{ padding: 24, color: "#666", fontSize: 11 }}>Cargando ponderaciones…</div>

  const chartData = rows.map(p => ({ nombre: p.cat, "2004": p.actual, "2022": p.propuesto }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Gráfico de barras */}
      <div style={{ background: "#0a0a0a", border: "1px solid #333333", borderRadius: "2px", padding: "12px" }}>
        <div style={{ color: "#FFFFFF", fontSize: "11px", fontWeight: "bold", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Ponderaciones Canasta 2004 vs 2022
        </div>
        <div style={{ height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 140, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
              <XAxis type="number" stroke="#555555" fontSize={9} axisLine={{ stroke: "#333333" }} />
              <YAxis dataKey="nombre" type="category" stroke="#555555" fontSize={9} width={135} axisLine={{ stroke: "#333333" }} tick={{ fill: "#999999", fontSize: 9 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #333333", borderRadius: "0", fontSize: "10px", fontFamily: "monospace" }}
                labelStyle={{ color: "#FFA028" }}
              />
              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
              <Bar dataKey="2004" fill="#4FC3F7" name="Base 2016 (vigente)" />
              <Bar dataKey="2022" fill="#FFD54F" name="Base 2022 (propuesto)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla detallada */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 9, color: "#888", borderBottom: "1px solid #222" }}>División COICOP</th>
              <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#4FC3F7", borderBottom: "1px solid #222" }}>Base 2004</th>
              <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#FFD54F", borderBottom: "1px solid #222" }}>Base 2022</th>
              <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#888", borderBottom: "1px solid #222" }}>Δ p.p.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const delta = p.propuesto - p.actual
              return (
                <tr key={p.cat} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#aaa" }}>{p.cat}</td>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#4FC3F7", textAlign: "right", fontFamily: "monospace" }}>{p.actual.toFixed(1)}%</td>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFD54F", textAlign: "right", fontFamily: "monospace" }}>{p.propuesto.toFixed(1)}%</td>
                  <td style={{ padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "monospace", color: delta > 0 ? "#4AF6C3" : delta < 0 ? "#FF433D" : "#888" }}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: "6px 8px", fontSize: 9, color: "#666", borderTop: "1px solid #111" }}>
          Fuente: INDEC · /api/macro?endpoint=ponderaciones — ENGHo 2004/05 (base vigente) · ENGHo 2017/18 (actualización 2022)
        </div>
      </div>
    </div>
  )
}

// ── Tipos estructurales ───────────────────────────────────────────────────────

type EstructuralData = {
  pbi_usd: [string, number][]
  pbi_percapita: [string, number][]
  smvm: [string, number][]
  gini: [string, number][]
  natalidad: [string, number][]
  mortalidad_infantil: [string, number][]
  poblacion: [string, number][]
  esperanza_vida: [string, number][]
}

type LaboralData = {
  tasa_desempleo: [string, number][]
  tasa_actividad: [string, number][]
  tasa_empleo: [string, number][]
  tasa_subocupacion: [string, number][]
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ title, source }: { title: string; source?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", background: "#0d0d0d",
      borderTop: "2px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", marginTop: 8,
    }}>
      <span style={{ fontSize: 9, color: "#FFA028", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
        {title}
      </span>
      {source && (
        <span style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>{source}</span>
      )}
    </div>
  )
}

// ── EstructuralKPI ────────────────────────────────────────────────────────────

function EstructuralKPI({
  label, value, unit, year, nota, valueColor = "#4FC3F7",
}: {
  label: string; value: string | null; unit: string
  year?: string | null; nota?: string; valueColor?: string
}) {
  return (
    <div style={{
      background: "#0a0a0a", border: "1px solid #1a1a1a",
      padding: "10px 14px", flex: "1 1 160px", position: "relative",
    }}>
      {year && (
        <div style={{
          position: "absolute", top: 6, right: 8, fontSize: 8, color: "#333",
          fontFamily: "monospace", background: "#111", padding: "1px 4px", border: "1px solid #1a1a1a",
        }}>{year}</div>
      )}
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, paddingRight: 32 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: valueColor, fontFamily: "monospace" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{unit}</div>
      {nota && <div style={{ fontSize: 8, color: "#333", marginTop: 4, lineHeight: 1.4 }}>{nota}</div>}
    </div>
  )
}

// ── Tipos actividad expandida ─────────────────────────────────────────────────

type EmaeSectorialRow = {
  date: string
  agro: number | null; pesca: number | null; mineria: number | null
  industria: number | null; energia: number | null; construccion: number | null
  comercio: number | null; turismo: number | null; transporte: number | null
  finanzas: number | null; inmobiliarias: number | null; adm_publica: number | null
  ensenanza: number | null; salud: number | null; serv_comun: number | null
  imp_subsidios: number | null
}

type UCIRow = {
  date: string
  nivel_general: number | null
  alimentos: number | null
  textiles: number | null
  quimicos: number | null
  automotriz: number | null
  metalmecanica: number | null
  minerales: number | null
}

type SuperRow = {
  date: string
  corrientes_mm: number | null
  constantes_mm: number | null
}

type ConfianzaRow = {
  date: string
  icc_nacional: number | null
  situacion_personal: number | null
  situacion_macro: number | null
  bienes_durables: number | null
  capital: number | null
  gba: number | null
  interior: number | null
}

type ActividadData = {
  uci: UCIRow[]
  supermercados: SuperRow[]
}

type ConfianzaData = {
  data: ConfianzaRow[]
  ultimo: ConfianzaRow | null
}

type PiramideRow = { age: string; varones: number; mujeres: number }
type PiramideMeta = { year: string; country: string; total_m: number; total_f: number; total: number; proyeccion: boolean }

// ── Países para el explorador de pirámides ────────────────────────────────────
const PAISES = [
  // América del Sur
  { code: "32",  name: "Argentina" },
  { code: "68",  name: "Bolivia" },
  { code: "76",  name: "Brasil" },
  { code: "152", name: "Chile" },
  { code: "170", name: "Colombia" },
  { code: "218", name: "Ecuador" },
  { code: "600", name: "Paraguay" },
  { code: "604", name: "Perú" },
  { code: "858", name: "Uruguay" },
  { code: "862", name: "Venezuela" },
  // América del Norte y Central
  { code: "124", name: "Canadá" },
  { code: "484", name: "México" },
  { code: "840", name: "Estados Unidos" },
  // Europa
  { code: "276", name: "Alemania" },
  { code: "724", name: "España" },
  { code: "250", name: "Francia" },
  { code: "380", name: "Italia" },
  { code: "643", name: "Rusia" },
  { code: "826", name: "Reino Unido" },
  { code: "792", name: "Turquía" },
  // Asia
  { code: "156", name: "China" },
  { code: "356", name: "India" },
  { code: "392", name: "Japón" },
  { code: "410", name: "Corea del Sur" },
  { code: "682", name: "Arabia Saudita" },
  // África y Oceanía
  { code: "566", name: "Nigeria" },
  { code: "710", name: "Sudáfrica" },
  { code: "818", name: "Egipto" },
  { code: "36",  name: "Australia" },
  // Mundo
  { code: "900", name: "Mundo" },
]

// ── Componente reutilizable de pirámide ───────────────────────────────────────
function PyramidChart({ data, height = 400 }: { data: PiramideRow[]; height?: number }) {
  const total = data.reduce((s, r) => s + Math.abs(r.varones) + r.mujeres, 0) || 1
  const pctData = [...data].reverse().map(r => ({
    age: r.age,
    varones: parseFloat(((r.varones / total) * 100).toFixed(3)),
    mujeres: parseFloat(((r.mujeres / total) * 100).toFixed(3)),
    varones_abs: Math.abs(r.varones),
    mujeres_abs: r.mujeres,
  }))
  const maxPct = pctData.length > 0
    ? Math.max(...pctData.map(r => Math.max(Math.abs(r.varones), r.mujeres)))
    : 8
  const domain = Math.ceil(maxPct * 1.15)
  const fmtAbs = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1000)}k`

  return (
    <>
      {/* Hombre / Mujer labels */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 52px 2px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span style={{ color: "#4FC3F7" }}>◀ Hombre</span>
        <span style={{ color: "#F48FB1" }}>Mujer ▶</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={pctData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 40, bottom: 4 }}
          barCategoryGap="10%"
          barGap={1}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
          <XAxis
            type="number"
            domain={[-domain, domain]}
            tickFormatter={(v: number) => `${Math.abs(v).toFixed(0)}%`}
            tick={{ fontSize: 8, fill: "#555" }}
            axisLine={{ stroke: "#333" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="age"
            tick={{ fontSize: 8, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, borderRadius: 4 }}
            labelStyle={{ color: "#aaa", fontWeight: 700 }}
            formatter={(value: unknown, name: unknown) => {
              const v = value as number | undefined
              const n = name as string | undefined
              if (v == null) return ["—", n] as [string, string | undefined]
              const label = n === "varones" ? "Hombre" : "Mujer"
              return [`${Math.abs(v).toFixed(2)}%`, label] as [string, string]
            }}
          />
          <ReferenceLine x={0} stroke="#333" strokeWidth={1} />
          <Bar dataKey="varones" fill="#4FC3F7" radius={[0, 2, 2, 0]} maxBarSize={14} />
          <Bar dataKey="mujeres" fill="#F48FB1" radius={[2, 0, 0, 2]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

// ── Gráfico de serie de población total 1950–2100 ─────────────────────────────
type SeriePt = { year: number; total_m: number; total_f: number; total: number }

function PoblacionSerieChart({ country, selectedYear }: { country: string; selectedYear: number }) {
  const [serie, setSerie] = useState<SeriePt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const years = Array.from({ length: 16 }, (_, i) => 1950 + i * 10)
    Promise.all(
      years.map(y =>
        fetch(`/api/macro?endpoint=piramide&year=${y}&country=${country}`)
          .then(r => r.json())
          .then(j => j.total ? ({ year: y, total_m: j.total_m, total_f: j.total_f, total: j.total }) : null)
          .catch(() => null)
      )
    ).then(results => {
      setSerie(results.filter(Boolean) as SeriePt[])
      setLoading(false)
    })
  }, [country])

  const fmtPop = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`

  return (
    <div className="bbg-panel" style={{ marginTop: 8 }}>
      <div className="bbg-panel-header">POBLACIÓN TOTAL — EVOLUCIÓN 1950–2100</div>
      {loading ? (
        <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11 }}>Cargando serie de población...</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={serie} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 8, fill: "#555" }}
              axisLine={{ stroke: "#333" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtPop}
              tick={{ fontSize: 8, fill: "#555" }}
              axisLine={{ stroke: "#333" }}
              tickLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #333", fontSize: 10, borderRadius: 4 }}
              labelStyle={{ color: "#aaa", fontWeight: 700 }}
              formatter={(v: unknown, name: unknown) => {
                const val = v as number | undefined
                const n = name as string | undefined
                if (val == null) return ["—", n] as [string, string | undefined]
                const label = n === "total_m" ? "Hombre" : "Mujer"
                return [fmtPop(val), label] as [string, string]
              }}
            />
            <ReferenceLine
              x={2025}
              stroke="#444"
              strokeDasharray="4 3"
              label={{ value: "2025", position: "insideTopLeft", fill: "#444", fontSize: 8 }}
            />
            {selectedYear !== 2025 && (
              <ReferenceLine
                x={selectedYear}
                stroke="#FFA028"
                strokeDasharray="4 3"
                label={{ value: String(selectedYear), position: "insideTopLeft", fill: "#FFA028", fontSize: 8 }}
              />
            )}
            <Area dataKey="total_f" stackId="pop" fill="#F48FB1" stroke="#F48FB1" fillOpacity={0.55} name="Mujer" />
            <Area dataKey="total_m" stackId="pop" fill="#4FC3F7" stroke="#4FC3F7" fillOpacity={0.55} name="Hombre" />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div style={{ padding: "4px 12px 6px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: populationpyramid.net · UN World Population Prospects 2024 · Años &gt;2025 = proyecciones ONU
      </div>
    </div>
  )
}

type IcgRow = {
  date: string
  icg_general: number | null
  evaluacion: number | null
  interes: number | null
  eficiencia: number | null
  honestidad: number | null
  capacidad: number | null
}
type IcgData = { data: IcgRow[]; ultimo: IcgRow | null }

// ── EMAE Tab ──────────────────────────────────────────────────────────────────

function EmaeView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [laboralData, setLaboralData] = useState<LaboralData | null>(null)
  const [laboralLoading, setLaboralLoading] = useState(true)
  const [estructuralData, setEstructuralData] = useState<EstructuralData | null>(null)
  const [estructuralLoading, setEstructuralLoading] = useState(true)
  const [emaeSectorialData, setEmaeSectorialData] = useState<EmaeSectorialRow[]>([])
  const [emaeSectorialLoading, setEmaeSectorialLoading] = useState(true)
  const [emaeSubTab, setEmaeSubTab] = useState("actividad")
  const [emaeEstrTab, setEmaeEstrTab] = useState("indicadores")
  const [actividadData, setActividadData] = useState<ActividadData | null>(null)
  const [actividadLoading, setActividadLoading] = useState(true)
  const [confianzaData, setConfianzaData] = useState<ConfianzaData | null>(null)
  const [confianzaLoading, setConfianzaLoading] = useState(true)
  const [icgData, setIcgData] = useState<IcgData | null>(null)
  const [icgLoading, setIcgLoading] = useState(true)
  const [piramideData, setPiramideData] = useState<PiramideRow[]>([])
  const [piramideMeta, setPiramideMeta] = useState<PiramideMeta | null>(null)
  const [piramideLoading, setPiramideLoading] = useState(true)
  const [piramideYear, setPiramideYear] = useState(2025)

  useEffect(() => {
    setPiramideLoading(true)
    fetch(`/api/macro?endpoint=piramide&year=${piramideYear}&country=32`)
      .then(r => r.json())
      .then(j => { setPiramideData(j.data ?? []); setPiramideMeta(j); setPiramideLoading(false) })
      .catch(() => setPiramideLoading(false))
  }, [piramideYear])

  useEffect(() => {
    fetch("/api/macro?endpoint=emae")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))

    fetch("/api/macro?endpoint=laboral")
      .then((r) => r.json())
      .then((j) => { setLaboralData(j.data); setLaboralLoading(false) })
      .catch(() => setLaboralLoading(false))

    fetch("/api/macro?endpoint=estructural")
      .then((r) => r.json())
      .then((j) => { setEstructuralData(j.data); setEstructuralLoading(false) })
      .catch(() => setEstructuralLoading(false))

    fetch("/api/macro?endpoint=emae_sectorial")
      .then(r => r.json())
      .then(j => { setEmaeSectorialData(j.data ?? []); setEmaeSectorialLoading(false) })
      .catch(() => setEmaeSectorialLoading(false))

    fetch("/api/macro?endpoint=actividad")
      .then(r => r.json())
      .then(j => { setActividadData(j); setActividadLoading(false) })
      .catch(() => setActividadLoading(false))

    fetch("/api/macro?endpoint=confianza")
      .then(r => r.json())
      .then(j => { setConfianzaData(j); setConfianzaLoading(false) })
      .catch(() => setConfianzaLoading(false))

    fetch("/api/macro?endpoint=icg")
      .then(r => r.json())
      .then(j => { setIcgData(j); setIcgLoading(false) })
      .catch(() => setIcgLoading(false))

  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando EMAE...</div>

  const ultimoEmae = data?.emae?.[0]
  const varMensual = data?.emae_var_mensual?.[0]?.[1]
  const varInteranual = data?.emae_var_interanual?.[0]?.[1]
  const recentEmae = (data?.emae ?? []).slice(0, 12).reverse()

  const desempleo    = laboralData?.tasa_desempleo?.[0]
  const actividad    = laboralData?.tasa_actividad?.[0]
  const empleo       = laboralData?.tasa_empleo?.[0]
  const subocupacion = laboralData?.tasa_subocupacion?.[0]
  const periodoLaboral = desempleo?.[0] ?? null

  const pbiRec        = estructuralData?.pbi_usd?.[0]
  const pbiPcRec      = estructuralData?.pbi_percapita?.[0]
  const smvmRec       = estructuralData?.smvm?.[0]
  const giniRec       = estructuralData?.gini?.[0]
  const natalidadRec  = estructuralData?.natalidad?.[0]
  const mortalidadRec = estructuralData?.mortalidad_infantil?.[0]
  const esperanzaRec  = estructuralData?.esperanza_vida?.[0]
  const poblacionRec  = estructuralData?.poblacion?.[0]

  // Merge series demográficas en formato BBGLineChart
  const demograficoData = (() => {
    type DRow = { date: string; natalidad: number | null; mortalidad: number | null; esperanza: number | null }
    const m = new Map<string, DRow>()
    // Normaliza "2023" → "2023-01-01" para alinear fuentes distintas
    const norm = (d: string) => d.length === 4 ? `${d}-01-01` : d
    const set = (raw: string, k: keyof Omit<DRow, "date">, v: number) => {
      const d = norm(raw)
      const r = m.get(d) ?? { date: d, natalidad: null, mortalidad: null, esperanza: null }
      m.set(d, { ...r, [k]: v })
    }
    for (const [d, v] of (estructuralData?.natalidad ?? [])) set(d, "natalidad", v)
    for (const [d, v] of (estructuralData?.mortalidad_infantil ?? [])) set(d, "mortalidad", v)
    for (const [d, v] of (estructuralData?.esperanza_vida ?? [])) set(d, "esperanza", v)
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date))
  })()

  // PBI en millones de USD → convertir a billones para display
  const fmtBillones = (v: number | undefined) => {
    if (!v) return null
    const abs = v * 1e6  // datos.gob.ar entrega en millones de USD
    if (abs >= 1e12) return `USD ${(abs / 1e12).toFixed(2)}T`
    return `USD ${(abs / 1e9).toFixed(0)}B`
  }

  return (
    <div>
      <SectionMeta title="EMAE — Actividad Económica" help="El EMAE (Estimador Mensual de Actividad Económica) mide la evolución mensual de la actividad productiva argentina. Elaborado por INDEC. Valor base 2004 = 100. Variaciones positivas indican expansión económica." source="INDEC · datos.gob.ar" />
      {/* KPIs EMAE */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI
          label="EMAE"
          value={ultimoEmae ? fmtNum(ultimoEmae[1]) : null}
          unit={`Índice base 2004=100 · ${ultimoEmae?.[0] ?? ""}`}
          var1={varMensual} var1Label="mensual"
          var2={varInteranual} var2Label="interanual"
        />
        <KPI label="IPI Manufacturero" value={null} unit="Ver tab IPI" />
        <KPI label="Período" value={ultimoEmae?.[0] ?? null} unit="Último dato disponible" valueColor="#888" />
      </div>

      <SubTabs
        tabs={[
          { key: "actividad",   label: "Actividad" },
          { key: "sectorial",   label: "Apertura Sectorial" },
          { key: "laboral",     label: "Mercado Laboral" },
          { key: "estructural", label: "Estructural" },
          { key: "industria",   label: "Industria & Confianza" },
        ]}
        active={emaeSubTab}
        onChange={setEmaeSubTab}
      />

      {emaeSubTab === "actividad" && (<>
      {/* Gráfico EMAE */}
      {recentEmae.length > 0 && (
        <div style={{ padding: "8px 0" }}>
          <BBGAreaChart
            title="EMAE — EVOLUCIÓN 12 MESES"
            data={recentEmae.map(([d, v]) => ({ date: d, emae: v }))}
            areas={[{ key: "emae", name: "EMAE", color: "#FFA028" }]}
            height={280}
            formatValue={(v) => fmtNum(v)}
            defaultRange="all"
          />
        </div>
      )}

      {/* Tabla EMAE */}
      <MiniTable
        title="EMAE — Últimos 12 períodos"
        rows={recentEmae.map(([d, v]) => ({ label: d, value: fmtNum(v), color: "#FFA028" }))}
      />
      </>)}

      {emaeSubTab === "laboral" && (<>
      {/* ── MERCADO LABORAL ────────────────────────────────────────────── */}
      <SectionHeader
        title="Mercado Laboral — EPH"
        source={`INDEC · EPH Continua${periodoLaboral ? ` · ${periodoLaboral}` : ""}`}
      />
      {laboralLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando datos EPH...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <KPI
              label="Tasa de Desocupación"
              value={desempleo ? fmtNum(desempleo[1]) : null}
              unit="% de la PEA · 31 aglomerados"
              valueColor={desempleo ? (desempleo[1] > 10 ? "#FF433D" : desempleo[1] > 7 ? "#FFA028" : "#4AF6C3") : "#555"}
            />
            <KPI
              label="Tasa de Actividad (PEA)"
              value={actividad ? fmtNum(actividad[1]) : null}
              unit="% de la pob. total · 14 años y más"
              valueColor="#4FC3F7"
            />
            <KPI
              label="Tasa de Empleo"
              value={empleo ? fmtNum(empleo[1]) : null}
              unit="% de la pob. total · ocupados"
              valueColor="#4AF6C3"
            />
            <KPI
              label="Tasa de Subocupación"
              value={subocupacion ? fmtNum(subocupacion[1]) : null}
              unit="% de la PEA · menos de 35hs/sem"
              valueColor="#FFD54F"
            />
          </div>
          {(laboralData?.tasa_desempleo?.length ?? 0) > 0 && (
            <MiniTable
              title="Desempleo — Últimos 12 trimestres"
              rows={(laboralData?.tasa_desempleo ?? []).slice(0, 12).map(([d, v]) => ({
                label: d,
                value: `${fmtNum(v)}%`,
                color: v > 10 ? "#FF433D" : v > 7 ? "#FFA028" : "#4AF6C3",
              }))}
            />
          )}
        </>
      )}
      </>)}

      {emaeSubTab === "estructural" && (<>
      <SubTabs tabs={[{ key: "indicadores", label: "Indicadores" }, { key: "largo_plazo", label: "Largo Plazo (PIB)" }]}
        active={emaeEstrTab} onChange={setEmaeEstrTab} />
      {emaeEstrTab === "largo_plazo" && <PibHistoricoView />}
      {emaeEstrTab === "indicadores" && (<>
      {/* ── INDICADORES ESTRUCTURALES ──────────────────────────────────── */}
      <SectionHeader title="Indicadores Estructurales" source="INDEC · datos.gob.ar · World Bank" />
      {estructuralLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando indicadores estructurales...</div>
      ) : (
        <>
          {/* Fila 1 — Actividad económica */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <EstructuralKPI
              label="PBI" value={fmtBillones(pbiRec?.[1])}
              unit="PIB · USD corrientes · INDEC Cuentas Nacionales" year={pbiRec?.[0]} valueColor="#FFA028"
            />
            <EstructuralKPI
              label="PBI per Cápita"
              value={pbiPcRec ? `USD ${pbiPcRec[1].toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : null}
              unit="USD corrientes · por habitante · INDEC" year={pbiPcRec?.[0]} valueColor="#FFA028"
            />
            <EstructuralKPI
              label="Población"
              value={poblacionRec ? `${(poblacionRec[1] / 1e6).toFixed(1)}M` : null}
              unit="Habitantes totales · proyección INDEC" year={poblacionRec?.[0]} valueColor="#4FC3F7"
            />
          </div>

          {/* Fila 2 — Sociales */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111", marginTop: 1 }}>
            <EstructuralKPI
              label="Coeficiente de Gini"
              value={giniRec ? fmtNum(giniRec[1], 1) : null}
              unit="Desigualdad de ingresos per cápita familiar · EPH INDEC"
              year={giniRec?.[0]}
              valueColor={giniRec ? (giniRec[1] > 45 ? "#FF433D" : giniRec[1] > 35 ? "#FFA028" : "#4AF6C3") : "#555"}
              nota="0 = igualdad perfecta · 100 = máx. desigualdad · AL promedio ≈ 45"
            />
            <EstructuralKPI
              label="SMVM"
              value={smvmRec ? `$${smvmRec[1].toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : null}
              unit="Salario Mínimo Vital y Móvil · ARS · mensual · Ministerio de Trabajo"
              year={smvmRec?.[0]} valueColor="#4FC3F7"
            />
            <EstructuralKPI
              label="Esperanza de Vida" value={esperanzaRec ? `${fmtNum(esperanzaRec[1], 1)} años` : null}
              unit="Al nacer · años · World Bank" year={esperanzaRec?.[0]} valueColor="#4AF6C3"
            />
          </div>

          {/* Fila 3 — Demográficos */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111", marginTop: 1 }}>
            <EstructuralKPI
              label="Tasa de Natalidad" value={natalidadRec ? fmtNum(natalidadRec[1], 1) : null}
              unit="Nacimientos por cada 1.000 habitantes · INDEC" year={natalidadRec?.[0]} valueColor="#4AF6C3"
            />
            <EstructuralKPI
              label="Mortalidad Infantil" value={mortalidadRec ? fmtNum(mortalidadRec[1], 1) : null}
              unit="Muertes por cada 1.000 nacidos vivos (menores de 1 año) · INDEC"
              year={mortalidadRec?.[0]}
              valueColor={mortalidadRec ? (mortalidadRec[1] > 20 ? "#FF433D" : mortalidadRec[1] > 10 ? "#FFA028" : "#4AF6C3") : "#555"}
            />
          </div>

          {/* Gráfico 1 — Natalidad y Mortalidad Infantil (barras agrupadas) */}
          {demograficoData.length > 0 && (
            <div className="bbg-panel" style={{ marginTop: 8 }}>
              <div className="bbg-panel-header">NATALIDAD Y MORTALIDAD INFANTIL — EVOLUCIÓN HISTÓRICA</div>
              <div style={{ padding: "8px 4px 4px 0" }}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={demograficoData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={3}>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(0, 4)}
                      tick={{ fill: "#555", fontSize: 9 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 9 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={false}
                      tickFormatter={(v: number) => fmtNum(v, 1)}
                      label={{ value: "Por 1.000", angle: -90, position: "insideLeft", fill: "#555", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #333", fontSize: 10, color: "#FFA028" }}
                      formatter={(v: unknown) => { const val = v as number | undefined; return val != null ? fmtNum(val, 1) : "—" }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, color: "#888" }} iconType="rect" iconSize={10} />
                    <Bar dataKey="natalidad" name="Natalidad (c/1.000 hab.)"       fill="#4AF6C3" radius={[2, 2, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="mortalidad" name="Mort. Infantil (c/1.000 nac.)" fill="#FF433D" radius={[2, 2, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Gráfico 2 — Esperanza de Vida (barras simples) */}
          {demograficoData.some(d => d.esperanza !== null) && (
            <div className="bbg-panel" style={{ marginTop: 8 }}>
              <div className="bbg-panel-header">ESPERANZA DE VIDA AL NACER</div>
              <div style={{ padding: "8px 4px 4px 0" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={demograficoData.filter(d => d.esperanza !== null)} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barCategoryGap="40%">
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => v.slice(0, 4)}
                      tick={{ fill: "#555", fontSize: 9 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#555", fontSize: 9 }}
                      axisLine={{ stroke: "#333" }}
                      tickLine={false}
                      tickFormatter={(v: number) => fmtNum(v, 1)}
                      label={{ value: "Años", angle: -90, position: "insideLeft", fill: "#555", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #333", fontSize: 10, color: "#FFA028" }}
                      formatter={(v: unknown) => { const val = v as number | undefined; return val != null ? [`${fmtNum(val, 1)} años`, "Esperanza de vida"] as [string, string] : ["—", "Esperanza de vida"] as [string, string] }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="esperanza" name="Esperanza de vida (años)" fill="#4FC3F7" radius={[2, 2, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pirámide Poblacional Argentina — UN WPP con selector de año */}
          <div className="bbg-panel" style={{ marginTop: 8 }}>
            <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                PIRÁMIDE POBLACIONAL — ARGENTINA
                {piramideMeta?.proyeccion && (
                  <span style={{ fontSize: 8, fontWeight: 400, color: "#FFA028", marginLeft: 8 }}>· PROYECCIÓN ONU</span>
                )}
              </span>
              {piramideMeta && (
                <span style={{ fontSize: 8, fontWeight: 400, color: "#555", textTransform: "none" }}>
                  Total: <span style={{ color: "#fff" }}>{(piramideMeta.total / 1e6).toFixed(1)}M</span>
                  &nbsp;·&nbsp;<span style={{ color: "#4FC3F7" }}>V {(piramideMeta.total_m / 1e6).toFixed(1)}M</span>
                  &nbsp;·&nbsp;<span style={{ color: "#F48FB1" }}>M {(piramideMeta.total_f / 1e6).toFixed(1)}M</span>
                </span>
              )}
            </div>
            <div style={{ padding: "8px 12px 4px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Año</span>
              <input
                type="range" min={1950} max={2100} step={1} value={piramideYear}
                onChange={e => setPiramideYear(Number(e.target.value))}
                style={{ flex: 1, minWidth: 120, accentColor: "#FFA028", cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: piramideYear > 2025 ? "#FFA028" : "#4AF6C3", fontFamily: "monospace", minWidth: 38 }}>
                {piramideYear}
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                {[1950, 1975, 2000, 2025, 2050, 2100].map(y => (
                  <button key={y} onClick={() => setPiramideYear(y)} style={{
                    fontSize: 8, padding: "2px 5px", border: "none", borderRadius: 2, cursor: "pointer",
                    background: piramideYear === y ? "#FFA028" : "#1a1a1a",
                    color: piramideYear === y ? "#000" : "#555",
                  }}>{y}</button>
                ))}
              </div>
            </div>
            {piramideLoading ? (
              <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11 }}>Cargando pirámide...</div>
            ) : (
              <PyramidChart data={piramideData} height={400} />
            )}
            <div style={{ padding: "4px 12px 6px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
              Fuente: populationpyramid.net · UN World Population Prospects 2024 · Años &gt;2025 = proyecciones ONU
            </div>
          </div>

          <PoblacionSerieChart country="32" selectedYear={piramideYear} />

          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
            PBI, per cápita, población, Gini, natalidad y mortalidad: INDEC vía apis.datos.gob.ar ·
            Esperanza de vida: World Bank (SP.DYN.LE00.IN) · Pirámide: populationpyramid.net · UN WPP 2024 · El año en cada tarjeta = último dato publicado disponible.
          </div>
        </>
      )}
      </>)}
      </>)}

      {emaeSubTab === "sectorial" && (<>
      {/* ══ EMAE SECTORIAL ═══════════════════════════════════════════════════ */}
      <SectionHeader
        title="EMAE — Apertura Sectorial"
        source="INDEC · Índice Base 2004=100 · Valores originales"
      />
      {emaeSectorialLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando EMAE sectorial...</div>
      ) : emaeSectorialData.length === 0 ? (
        <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>
      ) : (
        <>
          {/* Ranking: barras horizontales ordenadas por variación interanual */}
          {(() => {
            const SECTORES: { key: keyof EmaeSectorialRow; label: string }[] = [
              { key: "agro",          label: "Agro, ganadería y silvicultura" },
              { key: "pesca",         label: "Pesca" },
              { key: "mineria",       label: "Minería" },
              { key: "industria",     label: "Industria Manufacturera" },
              { key: "energia",       label: "Electricidad, gas y agua" },
              { key: "construccion",  label: "Construcción" },
              { key: "comercio",      label: "Comercio mayorista y minorista" },
              { key: "turismo",       label: "Hoteles y restaurantes" },
              { key: "transporte",    label: "Transporte y comunicaciones" },
              { key: "finanzas",      label: "Intermediación financiera" },
              { key: "inmobiliarias", label: "Inmobiliarias y empresariales" },
              { key: "adm_publica",   label: "Administración pública" },
              { key: "ensenanza",     label: "Enseñanza" },
              { key: "salud",         label: "Servicios sociales y salud" },
              { key: "serv_comun",    label: "Otros servicios comunitarios" },
            ]
            const n = emaeSectorialData.length
            const ultimo  = emaeSectorialData[n - 1]
            const baseIA  = n >= 13 ? emaeSectorialData[n - 13] : null
            const baseMes = n >= 2  ? emaeSectorialData[n - 2]  : null
            const periodoLabel = ultimo?.date?.slice(0, 7) ?? ""

            const ranking = SECTORES.map(s => {
              const val   = ultimo?.[s.key]   as number | null
              const prev1 = baseMes?.[s.key]  as number | null
              const prev12= baseIA?.[s.key]   as number | null
              const varIA  = val && prev12 ? (val / prev12 - 1) * 100 : null
              const varMes = val && prev1  ? (val / prev1  - 1) * 100 : null
              return { ...s, varIA, varMes }
            })
            .filter(s => s.varIA != null)
            .sort((a, b) => (b.varIA ?? 0) - (a.varIA ?? 0))

            const maxAbs = Math.max(...ranking.map(s => Math.abs(s.varIA ?? 0)), 1)

            return (
              <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, fontWeight: 700 }}>
                    EMAE — VARIACIÓN INTERANUAL POR SECTOR · {periodoLabel}
                  </div>
                  <div style={{ fontSize: 8, color: "#333" }}>Base 2004=100 · INDEC</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {ranking.map(s => {
                    const v = s.varIA ?? 0
                    const positive = v >= 0
                    const barPct = Math.abs(v) / maxAbs * 44  // max 44% of width
                    return (
                      <div key={s.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr 56px", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 9, color: "#888", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.label}
                        </div>
                        <div style={{ position: "relative", height: 14, background: "#111", borderRadius: 2 }}>
                          {/* línea central */}
                          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#222" }} />
                          <div style={{
                            position: "absolute",
                            height: "100%", borderRadius: 2,
                            background: positive ? "#4AF6C3" : "#FF433D",
                            opacity: 0.85,
                            width: `${barPct}%`,
                            left: positive ? "50%" : `${50 - barPct}%`,
                          }} />
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                          color: positive ? "#4AF6C3" : "#FF433D",
                          textAlign: "right",
                        }}>
                          {positive ? "+" : ""}{v.toFixed(1)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
                {ranking.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 8, color: "#333" }}>
                    Variación interanual calculada desde índice. Mes anterior (m/m): {
                      ranking.slice(0, 3).map(s => `${s.label.split(" ")[0]} ${s.varMes != null ? (s.varMes >= 0 ? "+" : "") + s.varMes.toFixed(1) + "%" : "—"}`).join(" · ")
                    }
                  </div>
                )}
              </div>
            )
          })()}

          {/* Gráfico de líneas comparativo — todos los sectores con toggle */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="EMAE — EVOLUCIÓN SECTORIAL (ÍNDICE BASE 2004)"
              data={emaeSectorialData}
              enableLineToggle
              lines={[
                { key: "agro",          name: "Agro",         color: "#4AF6C3" },
                { key: "pesca",         name: "Pesca",        color: "#26C6DA" },
                { key: "mineria",       name: "Minería",      color: "#80CBC4" },
                { key: "industria",     name: "Industria",    color: "#FFA028" },
                { key: "energia",       name: "Energía",      color: "#FFD54F" },
                { key: "construccion",  name: "Construcc.",   color: "#FF433D" },
                { key: "comercio",      name: "Comercio",     color: "#4FC3F7" },
                { key: "turismo",       name: "Turismo",      color: "#F48FB1" },
                { key: "transporte",    name: "Transporte",   color: "#CE93D8" },
                { key: "finanzas",      name: "Finanzas",     color: "#7C83FD" },
                { key: "inmobiliarias", name: "Inmob.",       color: "#A5D6A7" },
                { key: "adm_publica",   name: "Adm. Púb.",   color: "#BCAAA4" },
                { key: "ensenanza",     name: "Enseñanza",   color: "#EF9A9A" },
                { key: "salud",         name: "Salud",        color: "#B39DDB" },
                { key: "serv_comun",    name: "Serv. Com.",   color: "#90A4AE" },
              ]}
              height={280}
              yAxisLabel="Índice 2004=100"
              defaultRange="all"
            />
          </div>
        </>
      )}
      </>)}

      {emaeSubTab === "industria" && (<>
      {/* ══ UTILIZACIÓN CAPACIDAD INSTALADA ══════════════════════════════════ */}
      <SectionHeader
        title="Actividad Industrial — Utilización de Capacidad Instalada"
        source="INDEC · UCI Base 2004 · % sobre capacidad total"
      />
      {actividadLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando UCI...</div>
      ) : !actividadData?.uci?.length ? (
        <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos UCI disponibles</div>
      ) : (
        <>
          {/* KPI nivel general */}
          {(() => {
            const ultimo = actividadData.uci[actividadData.uci.length - 1]
            return (
              <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
                <KPI
                  label="UCI — Nivel General"
                  value={ultimo?.nivel_general ? `${fmtNum(ultimo.nivel_general, 1)}%` : null}
                  unit={`Capacidad instalada utilizada · ${ultimo?.date ?? ""}`}
                  valueColor={
                    ultimo?.nivel_general
                      ? ultimo.nivel_general > 70 ? "#4AF6C3"
                        : ultimo.nivel_general > 60 ? "#FFA028" : "#FF433D"
                      : "#555"
                  }
                />
                <KPI label="Alimentos y Bebidas" value={ultimo?.alimentos   ? `${fmtNum(ultimo.alimentos, 1)}%`   : null} unit="% capacidad" valueColor="#4AF6C3" />
                <KPI label="Automotriz"          value={ultimo?.automotriz  ? `${fmtNum(ultimo.automotriz, 1)}%`  : null} unit="% capacidad" valueColor="#FFA028" />
                <KPI label="Metalmecánica"        value={ultimo?.metalmecanica ? `${fmtNum(ultimo.metalmecanica, 1)}%` : null} unit="% capacidad" valueColor="#4FC3F7" />
                <KPI label="Químicos"             value={ultimo?.quimicos   ? `${fmtNum(ultimo.quimicos, 1)}%`   : null} unit="% capacidad" valueColor="#CE93D8" />
              </div>
            )
          })()}

          {/* Gráfico UCI nivel general + sectores — BBGLineChart */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="UCI — NIVEL GENERAL Y SECTORES CLAVE"
              data={actividadData.uci}
              lines={[
                { key: "nivel_general", name: "General",     color: "#FFA028" },
                { key: "alimentos",     name: "Alimentos",   color: "#4AF6C3" },
                { key: "automotriz",    name: "Automotriz",  color: "#FF433D" },
                { key: "metalmecanica", name: "Metalméc.",   color: "#4FC3F7" },
                { key: "quimicos",      name: "Químicos",    color: "#CE93D8" },
              ]}
              height={240}
              yAxisLabel="%"
              formatValue={(v) => v.toFixed(1) + "%"}
              defaultRange="all"
            />
          </div>
        </>
      )}

      {/* ══ VENTAS SUPERMERCADOS ══════════════════════════════════════════════ */}
      <SectionHeader
        title="Ventas en Supermercados"
        source="INDEC · Miles de millones ARS · Corrientes y constantes base 2017"
      />
      {actividadLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando supermercados...</div>
      ) : !actividadData?.supermercados?.length ? (
        <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos de supermercados disponibles</div>
      ) : (
        <>
          {(() => {
            const sup = actividadData.supermercados
            const ultimo = sup[sup.length - 1]
            const anterior = sup.length >= 13 ? sup[sup.length - 13] : null
            const varConst = ultimo?.constantes_mm && anterior?.constantes_mm
              ? (((ultimo.constantes_mm - anterior.constantes_mm) / anterior.constantes_mm) * 100)
              : null
            return (
              <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
                <KPI
                  label="Ventas corrientes"
                  value={ultimo?.corrientes_mm ? `$${fmtNum(ultimo.corrientes_mm, 0)}B` : null}
                  unit={`Miles de millones ARS · ${ultimo?.date ?? ""}`}
                  valueColor="#FFA028"
                />
                <KPI
                  label="Ventas constantes"
                  value={ultimo?.constantes_mm ? `$${fmtNum(ultimo.constantes_mm, 0)}B` : null}
                  unit="Miles de millones ARS · Precios 2017"
                  valueColor="#4FC3F7"
                  var1={varConst} var1Label="i.a. real"
                />
              </div>
            )
          })()}

          {/* Gráfico supermercados corrientes vs constantes — BBGLineChart */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="VENTAS SUPERMERCADOS — CORRIENTES VS CONSTANTES"
              data={actividadData.supermercados}
              lines={[
                { key: "corrientes_mm", name: "Corrientes", color: "#FFA028" },
                { key: "constantes_mm", name: "Constantes (2017)", color: "#4FC3F7" },
              ]}
              height={220}
              yAxisLabel="MM ARS (miles de mill.)"
              formatValue={(v) => `$${fmtNum(v, 0)}B`}
              defaultRange="all"
            />
          </div>
        </>
      )}

      {/* ══ CONFIANZA DEL CONSUMIDOR ══════════════════════════════════════════ */}
      <SectionHeader
        title="Índice de Confianza del Consumidor — ICC"
        source="UTDT · Universidad Torcuato Di Tella · Encuesta mensual"
      />
      {confianzaLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando ICC...</div>
      ) : !confianzaData?.ultimo ? (
        <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>
      ) : (
        <>
          {/* KPIs último período */}
          <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
            <KPI
              label="ICC Nacional"
              value={confianzaData.ultimo.icc_nacional ? fmtNum(confianzaData.ultimo.icc_nacional, 1) : null}
              unit={`Índice · ${confianzaData.ultimo.date} · Sobre 50 = optimismo`}
              valueColor={
                confianzaData.ultimo.icc_nacional
                  ? confianzaData.ultimo.icc_nacional > 50 ? "#4AF6C3"
                    : confianzaData.ultimo.icc_nacional > 35 ? "#FFA028" : "#FF433D"
                  : "#555"
              }
            />
            <KPI
              label="Situación Personal"
              value={confianzaData.ultimo.situacion_personal ? fmtNum(confianzaData.ultimo.situacion_personal, 1) : null}
              unit="Subíndice — bienestar propio percibido"
              valueColor="#4FC3F7"
            />
            <KPI
              label="Situación Macroeconómica"
              value={confianzaData.ultimo.situacion_macro ? fmtNum(confianzaData.ultimo.situacion_macro, 1) : null}
              unit="Subíndice — percepción del contexto país"
              valueColor="#FFD54F"
            />
            <KPI
              label="Bienes Durables e Inmuebles"
              value={confianzaData.ultimo.bienes_durables ? fmtNum(confianzaData.ultimo.bienes_durables, 1) : null}
              unit="Subíndice — propensión a compras grandes"
              valueColor="#CE93D8"
            />
          </div>

          {/* Gráfico ICC nacional + subíndices — BBGLineChart */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="ICC — NACIONAL Y SUBÍNDICES"
              data={confianzaData.data}
              lines={[
                { key: "icc_nacional",       name: "ICC Nacional",    color: "#FFA028" },
                { key: "situacion_personal",  name: "Sit. Personal",  color: "#4FC3F7" },
                { key: "situacion_macro",     name: "Sit. Macro",     color: "#FFD54F" },
                { key: "bienes_durables",     name: "Bienes Dur.",    color: "#CE93D8" },
              ]}
              height={240}
              yAxisLabel="Índice"
              formatValue={(v) => fmtNum(v, 1)}
              showZeroLine
              defaultRange="all"
            />
          </div>

          {/* Gráfico desagregado regional — Capital, GBA, Interior */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="ICC — DESAGREGADO REGIONAL"
              data={confianzaData.data}
              lines={[
                { key: "capital",  name: "CABA",    color: "#4AF6C3" },
                { key: "gba",      name: "GBA",     color: "#FFA028" },
                { key: "interior", name: "Interior", color: "#4FC3F7" },
              ]}
              height={200}
              yAxisLabel="Índice"
              formatValue={(v) => fmtNum(v, 1)}
              defaultRange="all"
            />
          </div>

          {/* Nota metodológica */}
          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
            Fuente: Universidad Torcuato Di Tella (UTDT) · Encuesta mensual a hogares del AMBA e interior urbano ·
            Índice compuesto: situación personal + situación macroeconómica + bienes durables ·
            Escala: por debajo de 35 = pesimismo marcado · 35-50 = cautela · 50+ = optimismo.
          </div>
        </>
      )}

      {/* ══ CONFIANZA EN EL GOBIERNO ══════════════════════════════════════════ */}
      <SectionHeader
        title="Índice de Confianza en el Gobierno — ICG"
        source="UTDT · Universidad Torcuato Di Tella · Encuesta mensual"
      />
      {icgLoading ? (
        <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando ICG...</div>
      ) : !icgData?.ultimo ? (
        <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>
      ) : (
        <>
          {/* KPIs último período */}
          <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
            <KPI
              label="ICG General"
              value={icgData.ultimo.icg_general ? fmtNum(icgData.ultimo.icg_general, 2) : null}
              unit={`Índice · ${icgData.ultimo.date} · Sobre 5`}
              valueColor={
                icgData.ultimo.icg_general
                  ? icgData.ultimo.icg_general >= 3 ? "#4AF6C3"
                    : icgData.ultimo.icg_general >= 2 ? "#FFA028" : "#FF433D"
                  : "#555"
              }
            />
            <KPI
              label="Honestidad"
              value={icgData.ultimo.honestidad ? fmtNum(icgData.ultimo.honestidad, 2) : null}
              unit="Subíndice — percepción de probidad"
              valueColor="#4AF6C3"
            />
            <KPI
              label="Capacidad"
              value={icgData.ultimo.capacidad ? fmtNum(icgData.ultimo.capacidad, 2) : null}
              unit="Subíndice — competencia percibida"
              valueColor="#7C83FD"
            />
            <KPI
              label="Eficiencia"
              value={icgData.ultimo.eficiencia ? fmtNum(icgData.ultimo.eficiencia, 2) : null}
              unit="Subíndice — gestión de recursos"
              valueColor="#FFD54F"
            />
          </div>

          {/* Gráfico ICG — evolución y subíndices */}
          <div style={{ padding: "8px 0" }}>
            <BBGLineChart
              title="ICG — EVOLUCIÓN Y SUBÍNDICES"
              data={icgData.data}
              lines={[
                { key: "icg_general", name: "ICG General", color: "#FFA028" },
                { key: "honestidad",  name: "Honestidad",  color: "#4AF6C3" },
                { key: "capacidad",   name: "Capacidad",   color: "#7C83FD" },
                { key: "eficiencia",  name: "Eficiencia",  color: "#FFD54F" },
                { key: "evaluacion",  name: "Evaluación",  color: "#4FC3F7" },
              ]}
              height={240}
              yAxisLabel="Índice (0–5)"
              formatValue={(v) => fmtNum(v, 2)}
              defaultRange="all"
            />
          </div>

          {/* Nota metodológica */}
          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
            Fuente: Universidad Torcuato Di Tella (UTDT) · Encuesta mensual · Escala 0–5 ·
            Subíndices: evaluación general, interés general, eficiencia, honestidad y capacidad ·
            Por debajo de 2 = desconfianza marcada · 2–3 = confianza moderada · 3+ = confianza alta.
          </div>
        </>
      )}
      </>)}
    </div>
  )
}

// ── Mi Inflación Component ──────────────────────────────────────────────────────

export function MiInflacionView() {
  const { rows: PONDERACIONES, tipos: TIPOS_API } = usePonderaciones()
  const [modo, setModo] = useState<"inicio" | "gasto" | "encuesta" | "ajuste" | "resultado">("inicio")
  const [gastos, setGastos] = useState<Record<string, number>>({})
  const [ponderaciones, setPonderaciones] = useState<Record<string, number>>({})
  const [encuestaRespuestas, setEncuestaRespuestas] = useState<Record<number, number>>({})
  const [ipcDataMi, setIpcDataMi] = useState<Record<string, [string, number][]> | null>(null)

  // Initialize gastos/ponderaciones once rows are fetched
  useEffect(() => {
    if (PONDERACIONES.length === 0) return
    setGastos(prev => {
      if (Object.keys(prev).length > 0) return prev
      return Object.fromEntries(PONDERACIONES.map(p => [p.cat, 0]))
    })
    setPonderaciones(prev => {
      if (Object.keys(prev).length > 0) return prev
      return Object.fromEntries(PONDERACIONES.map(p => [p.cat, p.actual]))
    })
  }, [PONDERACIONES])

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then(r => r.json())
      .then(j => setIpcDataMi(j.data ?? null))
      .catch(() => {})
  }, [])

  // ── Cálculo IPC personal ──────────────────────────────────────────────────
  const getLatestVarPct = (series: [string, number][] | undefined): number | null => {
    if (!series || series.length < 2) return null
    const sorted = [...series].sort((a, b) => a[0].localeCompare(b[0]))
    const last = sorted.at(-1)![1], prev = sorted.at(-2)![1]
    if (!prev) return null
    return ((last / prev) - 1) * 100
  }
  const ipcGeneralMensual: number | null = (() => {
    if (!ipcDataMi?.ipc_var_mensual?.length) return null
    const sorted = [...ipcDataMi.ipc_var_mensual].sort((a, b) => a[0].localeCompare(b[0]))
    const v = sorted.at(-1)?.[1]
    return v != null ? v * 100 : null
  })()
  const miRates = {
    alimentos: getLatestVarPct(ipcDataMi?.ipc_alimentos),
    regulados: getLatestVarPct(ipcDataMi?.ipc_regulados),
    nucleo:    getLatestVarPct(ipcDataMi?.ipc_nucleo),
  }
  const CAT_TIPO_MI = TIPOS_API as Record<string, keyof typeof miRates>
  const tuIpc: number | null = (() => {
    const fallback = ipcGeneralMensual
    let sum = 0
    for (const p of PONDERACIONES) {
      const tipo = (CAT_TIPO_MI[p.cat] ?? "nucleo") as keyof typeof miRates
      const rate = miRates[tipo] ?? fallback
      if (rate == null) continue
      sum += (ponderaciones[p.cat] / 100) * rate
    }
    return sum > 0 ? sum : null
  })()
  const diffIpc = tuIpc != null && ipcGeneralMensual != null ? tuIpc - ipcGeneralMensual : null

  const handleGastoChange = (cat: string, value: number) => {
    setGastos({ ...gastos, [cat]: Math.max(0, value) })
  }

  const calcularPonderacionesDesdeGasto = () => {
    const total = Object.values(gastos).reduce((a, b) => a + b, 0)
    if (total <= 0) return

    const nuevas = Object.fromEntries(
      Object.entries(gastos).map(([cat, gasto]) => [
        cat,
        parseFloat(((gasto / total) * 100).toFixed(1))
      ])
    )
    setPonderaciones(nuevas)
    setModo("ajuste")
  }

  const handlePonderacionChange = (cat: string, value: number) => {
    const updated = { ...ponderaciones, [cat]: Math.max(0, Math.min(100, value)) }
    const sum = Object.values(updated).reduce((a, b) => a + b, 0)
    if (sum > 0) {
      const factor = 100 / sum
      for (const key in updated) {
        updated[key] = parseFloat((updated[key] * factor).toFixed(1))
      }
    }
    setPonderaciones(updated)
  }

  const sumaPonderaciones = Object.values(ponderaciones).reduce((a, b) => a + b, 0)

  return (
    <div style={{ padding: "8px 12px" }}>
      {/* MODO INICIO */}
      {modo === "inicio" && (
        <>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 16, lineHeight: 1.5 }}>
            Calcula tu IPC personalizado. Elige cómo ingresar tus datos:
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setModo("gasto")}
              style={{
                background: "#0a5f4d",
                color: "#4AF6C3",
                border: "1px solid #4AF6C3",
                padding: "12px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "2px",
              }}
            >
              Ingresar Montos (ARS)
            </button>
            <button
              onClick={() => setModo("encuesta")}
              style={{
                background: "#0a5f4d",
                color: "#4AF6C3",
                border: "1px solid #4AF6C3",
                padding: "12px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "2px",
              }}
            >
              Responder Encuesta
            </button>
            <button
              onClick={() => setModo("ajuste")}
              style={{
                background: "#1a4d3e",
                color: "#FFA028",
                border: "1px solid #FFA028",
                padding: "12px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "2px",
              }}
            >
              Ajustar Manualmente
            </button>
            <button
              onClick={() => setModo("resultado")}
              style={{
                background: "#2a3a2a",
                color: "#999",
                border: "1px solid #555",
                padding: "12px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: "2px",
              }}
            >
              Ver Resultado
            </button>
          </div>

          <div style={{ fontSize: 8, color: "#555", padding: "8px", background: "#060606", border: "1px solid #111", lineHeight: 1.5 }}>
            Basado en datos INDEC. Los valores se normalizan automáticamente a 100%.
          </div>
        </>
      )}

      {/* MODO GASTO */}
      {modo === "gasto" && (
        <>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 12 }}>
            Ingresa cuánto gastas al mes en cada categoría (en ARS). Las ponderaciones se calcularán automáticamente.
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12 }}>
            {PONDERACIONES.map((p) => (
              <div key={p.cat} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 9, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                  {p.cat}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#555", lineHeight: "24px" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    value={gastos[p.cat] || 0}
                    onChange={(e) => handleGastoChange(p.cat, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      flex: 1,
                      background: "#1a1a1a",
                      border: "1px solid #333",
                      color: "#FFA028",
                      padding: "4px 8px",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 8, color: "#666", paddingTop: 8, borderTop: "1px solid #222" }}>
              Total: ${Object.values(gastos).reduce((a, b) => a + b, 0).toLocaleString("es-AR")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={calcularPonderacionesDesdeGasto}
              style={{
                background: "#4AF6C3",
                color: "#000",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Calcular Ponderaciones
            </button>
            <button
              onClick={() => setModo("inicio")}
              style={{
                background: "#444",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Volver
            </button>
          </div>
        </>
      )}

      {/* MODO ENCUESTA */}
      {modo === "encuesta" && (
        <>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 12 }}>
            Responde 8 preguntas sobre tus gastos mensuales (en ARS). Se calcula automáticamente tu perfil de gasto.
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12, maxHeight: "400px", overflowY: "auto" }}>
            {[
              { q: "¿Cuánto en alimentos y bebidas?", key: 0 },
              { q: "¿Cuánto en vivienda (alquiler/servicios)?", key: 1 },
              { q: "¿Cuánto en transporte?", key: 2 },
              { q: "¿Cuánto en salud?", key: 3 },
              { q: "¿Cuánto en educación?", key: 4 },
              { q: "¿Cuánto en ropa/indumentaria?", key: 5 },
              { q: "¿Cuánto en recreación/cultura?", key: 6 },
              { q: "¿Cuánto en comunicación (teléfono/internet)?", key: 7 },
              { q: "¿Cuánto en restaurantes/hoteles?", key: 8 },
            ].map((item) => (
              <div key={item.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 9, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                  {item.q}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "#555", lineHeight: "24px", minWidth: "16px" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    onChange={(e) => setEncuestaRespuestas({ ...encuestaRespuestas, [item.key]: parseFloat(e.target.value) || 0 })}
                    style={{
                      flex: 1,
                      background: "#1a1a1a",
                      border: "1px solid #333",
                      color: "#4AF6C3",
                      padding: "4px 6px",
                      fontSize: 9,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const total = Object.values(encuestaRespuestas).reduce((a, b) => a + b, 0)
                if (total > 0) {
                  const temp: Record<string, number> = {}
                  temp["Alimentos y bebidas"] = encuestaRespuestas[0] || 0
                  temp["Vivienda y servicios"] = encuestaRespuestas[1] || 0
                  temp["Transporte"] = encuestaRespuestas[2] || 0
                  temp["Salud"] = encuestaRespuestas[3] || 0
                  temp["Educación"] = encuestaRespuestas[4] || 0
                  temp["Indumentaria"] = encuestaRespuestas[5] || 0
                  temp["Recreación y cultura"] = encuestaRespuestas[6] || 0
                  temp["Comunicación"] = encuestaRespuestas[7] || 0
                  temp["Restaurantes/hoteles"] = encuestaRespuestas[8] || 0

                  // Distribuir resto entre categorías menores
                  const gastosContemp = Object.entries(temp).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>)
                  const totalTemp = Object.values(gastosContemp).reduce((a, b) => a + b, 0)

                  // Categorías sin pregunta directa
                  const resto = Math.max(0, totalTemp * 0.08) // 8% de gastos menores
                  const restoPerCat = resto / 3

                  if (!temp["Beb. alcohólicas/tabaco"]) temp["Beb. alcohólicas/tabaco"] = restoPerCat
                  if (!temp["Equipamiento hogar"]) temp["Equipamiento hogar"] = restoPerCat
                  if (!temp["Otros bienes/servicios"]) temp["Otros bienes/servicios"] = restoPerCat

                  setGastos(temp)
                  calcularPonderacionesDesdeGasto()
                }
              }}
              style={{
                background: "#4AF6C3",
                color: "#000",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                flex: 1,
              }}
            >
              Calcular mi Perfil
            </button>
            <button
              onClick={() => setModo("inicio")}
              style={{
                background: "#444",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Volver
            </button>
          </div>
        </>
      )}

      {/* MODO AJUSTE */}
      {modo === "ajuste" && (
        <>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 12 }}>
            Ajusta las ponderaciones según necesites. Los valores se normalizan automáticamente.
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12 }}>
            {PONDERACIONES.map((p) => (
              <div key={p.cat} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>{p.cat}</label>
                  <span style={{ fontSize: 9, color: "#FFA028", fontFamily: "monospace" }}>
                    {ponderaciones[p.cat]?.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={ponderaciones[p.cat] ?? p.actual}
                  onChange={(e) => handlePonderacionChange(p.cat, parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#FFA028" }}
                />
              </div>
            ))}
            <div style={{ fontSize: 8, color: sumaPonderaciones === 100 ? "#4AF6C3" : "#FF433D", paddingTop: 8, borderTop: "1px solid #222" }}>
              Total: {sumaPonderaciones.toFixed(1)}%
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setModo("resultado")}
              style={{
                background: "#FFA028",
                color: "#000",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ver tu IPC
            </button>
            <button
              onClick={() => { setPonderaciones(Object.fromEntries(PONDERACIONES.map(p => [p.cat, p.actual]))); setModo("inicio") }}
              style={{
                background: "#444",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Restaurar INDEC
            </button>
            <button
              onClick={() => setModo("inicio")}
              style={{
                background: "#333",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Volver
            </button>
          </div>
        </>
      )}

      {/* MODO RESULTADO */}
      {modo === "resultado" && (
        <>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, marginBottom: 12, background: "#111" }}>
            <KPI label="Tu IPC (Est.)" value={tuIpc != null ? fmtNum(tuIpc) : "—"} unit="% mensual" valueColor="#FFA028" />
            <KPI label="IPC General INDEC" value={ipcGeneralMensual != null ? fmtNum(ipcGeneralMensual) : "—"} unit="% mensual" />
            <KPI label="Diferencia" value={diffIpc != null ? fmtNum(diffIpc) : "—"} unit="p.p." valueColor={diffIpc != null ? (diffIpc > 0 ? "#FF433D" : "#4AF6C3") : "#777"} />
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#FFA028", fontWeight: 600, marginBottom: 8 }}>Tu Canasta vs INDEC</div>
            <table style={{ width: "100%", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  <th style={{ textAlign: "left", padding: "4px 0", color: "#555" }}>Categoría</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#FFA028" }}>Tu %</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#4AF6C3" }}>INDEC %</th>
                </tr>
              </thead>
              <tbody>
                {PONDERACIONES.filter(p => ponderaciones[p.cat] > 0).map((p) => (
                  <tr key={p.cat} style={{ borderBottom: "1px solid #111" }}>
                    <td style={{ padding: "3px 0", color: "#888", fontSize: 8 }}>{p.cat}</td>
                    <td style={{ padding: "3px 0", textAlign: "right", color: "#FFA028", fontFamily: "monospace" }}>
                      {ponderaciones[p.cat]?.toFixed(1)}%
                    </td>
                    <td style={{ padding: "3px 0", textAlign: "right", color: "#4AF6C3", fontFamily: "monospace" }}>
                      {p.actual.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 9, color: "#666", padding: "8px", background: "#060606", border: "1px solid #111", marginBottom: 12, lineHeight: 1.5 }}>
            <strong>Nota:</strong> Esta es una estimación de tu IPC personalizado. Para mayor precisión, consulta datos.gob.ar
          </div>

          <button
            onClick={() => setModo("inicio")}
            style={{
              background: "#444",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              fontSize: 10,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Editar
          </button>
        </>
      )}
    </div>
  )
}

// ── IPC Histórica 1943–presente ───────────────────────────────────────────────
interface IpcHistoricoRow { anio: number; inflacion: number; nota?: string }

function IpcHistoricaView() {
  const [serie, setSerie] = useState<IpcHistoricoRow[]>([])
  const [stats, setStats] = useState<{ pico: IpcHistoricoRow; promedio: number; total_anios: number; desde: number; hasta: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ipc-historico")
      .then(r => r.json())
      .then(j => {
        setSerie(j.data?.serie ?? [])
        setStats(j.data?.stats ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 10, fontFamily: "monospace" }}>Cargando histórico 1943–presente...</div>

  const chartData = serie.map(r => ({ anio: String(r.anio), inflacion: r.inflacion, nota: r.nota }))

  return (
    <div style={{ padding: "8px 12px" }}>
      {/* KPIs */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111", marginBottom: 8 }}>
        {stats?.pico && (
          <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
            <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Pico histórico</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FF433D", fontFamily: "monospace" }}>
              {stats.pico.inflacion >= 1000
                ? `${(stats.pico.inflacion / 1000).toFixed(1)}k%`
                : `${stats.pico.inflacion.toFixed(0)}%`
              }
            </div>
            <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>{stats.pico.anio} — {stats.pico.nota ?? "Hiperinflación"}</div>
          </div>
        )}
        {stats?.promedio != null && (
          <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
            <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Promedio {stats.desde}–{stats.hasta}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFA028", fontFamily: "monospace" }}>{stats.promedio.toFixed(1)}%</div>
            <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>inflación anual promedio</div>
          </div>
        )}
        {serie.at(-1) && (
          <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
            <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
              {serie.at(-1)!.anio} {serie.at(-1)!.nota?.includes("curso") ? "(en curso)" : ""}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#4AF6C3", fontFamily: "monospace" }}>{serie.at(-1)!.inflacion.toFixed(1)}%</div>
            <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>último año disponible</div>
          </div>
        )}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111", display: "flex", alignItems: "flex-end" }}>
          <DownloadCSV
            data={serie.map(r => ({ año: r.anio, inflacion_pct: r.inflacion, nota: r.nota ?? "" }))}
            filename="ipc-historico-1943"
          />
        </div>
      </div>

      {/* Gráfico — BarChart con color por intensidad */}
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 16 }} barCategoryGap="4%">
          <CartesianGrid stroke="#0d0d0d" strokeDasharray="3 3" />
          <XAxis
            dataKey="anio"
            tick={{ fill: "#555", fontSize: 7 }}
            axisLine={{ stroke: "#222" }}
            tickLine={false}
            interval={9}
          />
          <YAxis
            tick={{ fill: "#555", fontSize: 8 }}
            axisLine={{ stroke: "#222" }}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k%` : `${v.toFixed(0)}%`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, fontFamily: "monospace", color: "#fff" }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#aaa" }}
            formatter={(v: unknown, _: unknown, props: { payload?: IpcHistoricoRow }) => {
              const val = Number(v)
              const nota = props.payload?.nota
              return [`${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}%${nota ? ` — ${nota}` : ""}`, "Inflación anual"]
            }}
            labelFormatter={(l: unknown) => `Año ${l}`}
          />
          <Bar dataKey="inflacion" radius={[2, 2, 0, 0]}>
            {chartData.map((r) => (
              <Cell
                key={r.anio}
                fill={r.inflacion >= 100 ? "#FF433D" : r.inflacion >= 50 ? "#FFA028" : r.inflacion < 0 ? "#4FC3F7" : "#4AF6C3"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 8, color: "#aaa", fontFamily: "monospace", flexWrap: "wrap" }}>
        <span style={{ color: "#FF433D" }}>■ ≥100% (hiperinflación)</span>
        <span style={{ color: "#FFA028" }}>■ 50–99%</span>
        <span style={{ color: "#4AF6C3" }}>■ 0–49%</span>
        <span style={{ color: "#4FC3F7" }}>■ deflación</span>
      </div>
      <div style={{ fontSize: 8, color: "#777", marginTop: 4, fontFamily: "monospace" }}>
        Fuente: INDEC / BCRA (1943–2016) · datos.gob.ar IPC mensual (2017–presente) · Escala logarítmica
      </div>
    </div>
  )
}

// ── IPC Tab ────────────────────────────────────────────────────────────────────

// ── Breakeven Section ─────────────────────────────────────────────────────────

interface BreakevenData {
  tasas: { badlar_tna: number | null; badlar_tea: number | null; tpm_tna: number | null; tpm_tea: number | null; fecha: string | null }
  cer:   { inflacion_anual_trailing: number | null; inflacion_mensual_trailing: number | null; fecha: string | null }
  lecaps: { ticker: string; vencimiento: string; dias_vto: number; tem: number | null; tea: number | null }[]
  rem:   { inflacion_12m: number | null; dolar_12m: number | null; tasa_12m: number | null; fecha: string | null }
  breakeven: { lecap_corto_tea: number | null; real_vs_rem: number | null; inflac_vs_cer: number | null; interpretation: string | null }
}

interface RemParticipante {
  institucion: string
  inflacion_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
}

function BreakEvenSection() {
  const [bkData, setBkData] = useState<BreakevenData | null>(null)
  const [participantes, setParticipantes] = useState<RemParticipante[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/breakeven").then(r => r.json()).catch(() => null),
      fetch("/api/rem").then(r => r.json()).catch(() => null),
    ]).then(([bk, rem]) => {
      setBkData(bk?.data ?? null)
      setParticipantes(rem?.data?.participantes ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 10, fontFamily: "monospace" }}>Cargando expectativas de mercado...</div>

  const bk = bkData?.breakeven
  const rem = bkData?.rem
  const tasas = bkData?.tasas
  const cer = bkData?.cer

  // Color semáforo para tasa real
  const realColor = bk?.real_vs_rem == null ? "#555" : bk.real_vs_rem > 5 ? "#4AF6C3" : bk.real_vs_rem > 0 ? "#FFA028" : "#FF433D"

  return (
    <div style={{ borderTop: "1px solid #111", marginTop: 4 }}>
      {/* Header */}
      <div style={{ padding: "8px 12px 6px", background: "#050505", borderBottom: "1px solid #111" }}>
        <div style={{ fontSize: 9, color: "#FFA028", fontFamily: "monospace", letterSpacing: 1.5, fontWeight: 700 }}>
          EXPECTATIVAS DE MERCADO — BREAKEVEN INFLACIÓN
        </div>
        <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace", marginTop: 2 }}>
          Breakeven = TEA LECAP (tasa fija) − inflación esperada REM · Mide la tasa real implícita que descuenta el mercado
        </div>
      </div>

      {/* KPIs breakeven */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#0d0d0d" }}>
        {/* Tasa fija: LECAP TEA */}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>LECAP más corta · TEA</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FFD700", fontFamily: "monospace" }}>
            {bk?.lecap_corto_tea != null ? `${bk.lecap_corto_tea.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>tasa fija de mercado · anual</div>
        </div>

        {/* REM inflación 12M */}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>REM inflación 12M</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#FF433D", fontFamily: "monospace" }}>
            {rem?.inflacion_12m != null ? `${rem.inflacion_12m.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>mediana analistas · BCRA {rem?.fecha ?? ""}</div>
        </div>

        {/* Breakeven real implícito */}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: `1px solid ${realColor}33` }}>
          <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Tasa real implícita</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: realColor, fontFamily: "monospace" }}>
            {bk?.real_vs_rem != null ? `${bk.real_vs_rem >= 0 ? "+" : ""}${bk.real_vs_rem.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>LECAP TEA − inflac. REM</div>
        </div>

        {/* CER trailing */}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>CER trailing 30d</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#CE93D8", fontFamily: "monospace" }}>
            {cer?.inflacion_anual_trailing != null ? `${cer.inflacion_anual_trailing.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>inflación anualizada observada · BCRA</div>
        </div>

        {/* BADLAR */}
        <div style={{ flex: "1 1 150px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
          <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>BADLAR privados</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#4FC3F7", fontFamily: "monospace" }}>
            {tasas?.badlar_tna != null ? `${tasas.badlar_tna.toFixed(1)}%` : "—"}
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>TNA · depósitos &gt;$1MM · {tasas?.fecha ?? ""}</div>
        </div>
      </div>

      {/* Gráfico forward — inflación mensual proyectada 12 meses */}
      {(bk?.lecap_corto_tea != null || rem?.inflacion_12m != null) && (() => {
        const lecapMensual = bk?.lecap_corto_tea != null
          ? (Math.pow(1 + bk.lecap_corto_tea / 100, 1 / 12) - 1) * 100 : null
        const remMensual = rem?.inflacion_12m != null
          ? (Math.pow(1 + rem.inflacion_12m / 100, 1 / 12) - 1) * 100 : null
        const cerMensual = cer?.inflacion_anual_trailing != null
          ? (Math.pow(1 + cer.inflacion_anual_trailing / 100, 1 / 12) - 1) * 100 : null
        const hoy = new Date()
        const forwardData = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(hoy.getFullYear(), hoy.getMonth() + i + 1, 1)
          const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`
          return { mes, label, lecap: lecapMensual, rem: remMensual, cer: cerMensual }
        })
        return (
          <div style={{ padding: "8px 12px 4px" }}>
            <div style={{ fontSize: 9, color: "#666", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
              INFLACIÓN MENSUAL ESPERADA — PRÓXIMOS 12 MESES (proyección flat desde valores actuales)
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={forwardData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, fontFamily: "monospace" }}
                  formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)}% mensual`, String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 8, color: "#666" }} />
                {lecapMensual != null && <Line type="monotone" dataKey="lecap" name="LECAP Breakeven" stroke="#FFD700" strokeWidth={2} dot={false} />}
                {remMensual   != null && <Line type="monotone" dataKey="rem"   name="REM Analistas"   stroke="#FFA028" strokeWidth={2} dot={false} />}
                {cerMensual   != null && <Line type="monotone" dataKey="cer"   name="CER Trailing"    stroke="#CE93D8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />}
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 8, color: "#333", marginTop: 2, fontFamily: "monospace" }}>
              Proyección lineal — LECAP TEA → mensual | REM 12M → mensual | CER anualizado 30d → mensual
            </div>
          </div>
        )
      })()}

      {/* Interpretación */}
      {bk?.interpretation && (
        <div style={{
          margin: "1px 0", padding: "8px 14px",
          background: realColor + "0d", borderLeft: `4px solid ${realColor}`,
          fontSize: 9, color: realColor, fontFamily: "monospace",
        }}>
          {bk.interpretation}
        </div>
      )}

      {/* Curva LECAP */}
      {(bkData?.lecaps?.length ?? 0) > 0 && (
        <div style={{ padding: "8px 12px 4px" }}>
          <div style={{ fontSize: 9, color: "#666", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>CURVA LECAP/BONCAP — TASA FIJA DE MERCADO</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(bkData?.lecaps ?? []).map(l => (
              <div key={l.ticker} style={{
                padding: "6px 10px", background: "#080808",
                border: "1px solid #1a1a1a", borderRadius: 3, minWidth: 90, textAlign: "center",
              }}>
                <div style={{ fontSize: 8, color: "#FFD700", fontFamily: "monospace", fontWeight: 700 }}>{l.ticker}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFF", fontFamily: "monospace" }}>
                  {l.tem != null ? `${l.tem.toFixed(2)}%` : "—"}
                </div>
                <div style={{ fontSize: 7, color: "#444", fontFamily: "monospace" }}>TEM · {l.dias_vto}d</div>
                <div style={{ fontSize: 7, color: "#555", fontFamily: "monospace" }}>
                  {l.tea != null ? `TEA ${l.tea.toFixed(1)}%` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top-10 participantes REM */}
      {participantes.length > 0 && (
        <div style={{ padding: "8px 12px 12px" }}>
          <div style={{ fontSize: 9, color: "#666", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
            REM — PRONÓSTICOS INDIVIDUALES · INFLACIÓN 12M (últimos {participantes.length} participantes)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
              <thead>
                <tr>
                  {["Institución", "Inflac. 12M", "USD 12M", "Tasa 12M"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: "#555", textAlign: h === "Institución" ? "left" : "right", borderBottom: "1px solid #1a1a1a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                    <td style={{ padding: "3px 8px", color: "#aaa", fontFamily: "monospace", fontSize: 9, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.institucion}
                    </td>
                    <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700,
                      color: p.inflacion_12m != null ? (p.inflacion_12m > 50 ? "#FF433D" : p.inflacion_12m > 25 ? "#FFA028" : "#4AF6C3") : "#555" }}>
                      {p.inflacion_12m != null ? `${p.inflacion_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", color: "#4FC3F7" }}>
                      {p.dolar_12m != null ? `$${Math.round(p.dolar_12m).toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", color: "#FFD700" }}>
                      {p.tasa_12m != null ? `${p.tasa_12m.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", marginTop: 4 }}>
            Fuente: BCRA · REM · Último relevamiento disponible · Ordenado por inflación esperada ascendente
          </div>
        </div>
      )}
    </div>
  )
}

function IpcView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ipcTab, setIpcTab] = useState("serie")
  const [ipcYear, setIpcYear] = useState<string>("all")

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando IPC...</div>

  // Los datos vienen en proporción (0.025 = 2.5%) → multiplicar ×100
  const varMensual    = data?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = data?.ipc_var_interanual?.[0]?.[1]

  // Variaciones de componentes desde series de nivel (IPC_t / IPC_{t-1} - 1) * 100
  const getVarMens = (key: string) => {
    const s = data?.[key] ?? []
    return s.length >= 2 ? ((s[0][1] / s[1][1] - 1) * 100) : null
  }

  // Serie histórica mensual ordenada cronológicamente (valores en proporción → ×100)
  const serieCompleta = (data?.ipc_var_mensual ?? [])
    .slice()
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]): [string, number] => [d, v * 100])   // ← escala correcta

  // Componentes (nucleo, alimentos, regulados) también como var mensual %
  const buildComp = (key: string): Map<string, number> => {
    const m = new Map<string, number>()
    const s = (data?.[key] ?? []).slice().sort((a: [string, number], b: [string, number]) => a[0].localeCompare(b[0]))
    for (let i = 1; i < s.length; i++) {
      const v = ((s[i][1] / s[i - 1][1]) - 1) * 100
      m.set(s[i][0], v)
    }
    return m
  }
  const nucleoMap    = buildComp("ipc_nucleo")
  const alimentosMap = buildComp("ipc_alimentos")
  const reguladosMap = buildComp("ipc_regulados")

  const years = Array.from(new Set(serieCompleta.map(([d]) => d.slice(0, 4)))).sort()
  const serieFiltrada = ipcYear === "all" ? serieCompleta : serieCompleta.filter(([d]) => d.startsWith(ipcYear))

  // Datos para el gráfico de línea
  const chartData = serieFiltrada.map(([d, v]) => ({
    date: d,
    total:      v,
    nucleo:     nucleoMap.get(d)    ?? null,
    alimentos:  alimentosMap.get(d) ?? null,
    regulados:  reguladosMap.get(d) ?? null,
  }))

  const fmtTick = (d: string) => { const p = d.split("-"); return p.length >= 2 ? p[1] + "/" + p[0].slice(2) : d }

  return (
    <div>
      <SectionMeta title="IPC — Inflación" help="El IPC mide la variación mensual de los precios al consumidor. Elaborado por INDEC. La variación interanual compara con el mismo mes del año anterior." source="INDEC · datos.gob.ar" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="IPC Var. Mensual"  value={varMensual    != null ? fmtNum(varMensual * 100)    : null} unit="% mensual · último dato" />
        <KPI label="IPC Interanual"    value={varInteranual != null ? fmtNum(varInteranual)        : null} unit="% interanual · último dato" />
        <KPI label="IPC Núcleo"        value={getVarMens("ipc_nucleo")     != null ? fmtNum(getVarMens("ipc_nucleo")!)     : null} unit="% mensual · excl. estac. y reg." />
        <KPI label="Alimentos"         value={getVarMens("ipc_alimentos")  != null ? fmtNum(getVarMens("ipc_alimentos")!)  : null} unit="% mensual" />
        <KPI label="Regulados"         value={getVarMens("ipc_regulados")  != null ? fmtNum(getVarMens("ipc_regulados")!)  : null} unit="% mensual" />
        <KPI label="Estacionales"      value={getVarMens("ipc_estacionales") != null ? fmtNum(getVarMens("ipc_estacionales")!) : null} unit="% mensual" />
      </div>

      <SubTabs
        tabs={[
          { key: "serie",     label: "Serie Mensual" },
          { key: "historica", label: "Histórica 1943–" },
          { key: "canasta",   label: "Canasta 2016 vs 2022" },
          { key: "personal",  label: "Mi Inflación" },
          { key: "mundo",     label: "Inflación Mundial" },
        ]}
        active={ipcTab}
        onChange={setIpcTab}
      />

      {ipcTab === "serie" && (
        <div>
          {/* Selector de año + descarga */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 8, color: "#444", fontFamily: "monospace", marginRight: 2 }}>AÑO:</span>
              {["all", ...years].map(y => (
                <button key={y} onClick={() => setIpcYear(y)} style={{
                  fontSize: 9, padding: "3px 8px", border: "none", borderRadius: 2, cursor: "pointer",
                  background: ipcYear === y ? "#FFA028" : "transparent",
                  color:      ipcYear === y ? "#000"    : "#666",
                  fontFamily: "monospace",
                }}>{y === "all" ? "TODO" : y}</button>
              ))}
            </div>
            <DownloadCSV
              data={serieFiltrada.map(([d, v]) => ({ periodo: d, ipc_total_pct: v.toFixed(2), nucleo_pct: (nucleoMap.get(d) ?? ""), alimentos_pct: (alimentosMap.get(d) ?? "") }))}
              filename="ipc-mensual"
            />
          </div>

          {/* Gráfico de LÍNEA — múltiples componentes */}
          <div style={{ padding: "0 8px 8px" }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#333" }} tickLine={false}
                  tickFormatter={fmtTick} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#333" }} tickLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #333", fontSize: 10, color: "#FFA028" }}
                  formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)}%`, String(name)]}
                  labelFormatter={(l) => `Período: ${String(l)}`}
                />
                <Legend wrapperStyle={{ fontSize: 9, color: "#888" }} />
                <ReferenceLine y={0} stroke="#222" />
                <Line type="monotone" dataKey="total"     name="IPC Total"    stroke="#FFA028" strokeWidth={2}   dot={false} connectNulls />
                <Line type="monotone" dataKey="nucleo"    name="Núcleo"        stroke="#4AF6C3" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="alimentos" name="Alimentos"     stroke="#FF433D" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 2" />
                <Line type="monotone" dataKey="regulados" name="Regulados"     stroke="#4FC3F7" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>

            <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>Fuente: INDEC · IPC Nacional · datos.gob.ar</div>
          </div>

          {/* Sección breakeven + REM + top-10 */}
          <BreakEvenSection />
        </div>
      )}

      {ipcTab === "historica" && <IpcHistoricaView />}

      {ipcTab === "canasta" && <PonderacionesTable />}

      {ipcTab === "personal" && <MiInflacionView />}

      {ipcTab === "mundo" && (
        <div style={{ padding: "0 0 4px" }}>
          <iframe
            src="/api/inflation-map?type=global"
            style={{ width: "100%", height: 480, border: "none", background: "#060606", display: "block" }}
            title="Mapa de inflación mundial"
            loading="lazy"
          />
          <div style={{ padding: "4px 12px", fontSize: 8, color: "#333", fontFamily: "monospace", borderTop: "1px solid #0e0e0e" }}>
            Mapa generado con datos de inflación global · lapizarra.ar
          </div>
        </div>
      )}
    </div>
  )
}

// ── Balanza Tab ────────────────────────────────────────────────────────────────

function ComposicionExportView() {
  const [raw, setRaw] = useState<{ expo: Record<string, unknown>[]; impo: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<"expo" | "impo">("expo")

  useEffect(() => {
    fetch("/api/macro?endpoint=argendata_comext")
      .then((r) => r.json())
      .then((j) => {
        setRaw({
          expo: j.data?.expo?.series ?? [],
          impo: j.data?.impo?.series ?? [],
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando composición...</div>
  if (!raw || (!raw.expo.length && !raw.impo.length)) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos de composición.</div>

  const data = modo === "expo" ? raw.expo : raw.impo
  const products = Object.keys(data[0] ?? {}).filter((k) => k !== "date")
  const COLORS = ["#4AF6C3", "#FFA028", "#4FC3F7", "#FF433D", "#FFD54F", "#CE93D8", "#F48FB1", "#80CBC4", "#A5D6A7", "#BCAAA4", "#EF9A9A", "#7C83FD"]
  const lines = products.map((p, i) => ({ key: p, name: p, color: COLORS[i % COLORS.length] }))

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "#1a1200" : "none",
    border: `1px solid ${active ? "#FFA028" : "#222"}`,
    borderRadius: 3, cursor: "pointer",
    padding: "3px 10px", fontSize: 9,
    fontFamily: "monospace", letterSpacing: 0.5,
    color: active ? "#FFA028" : "#555",
  })

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 0" }}>
        <div style={{ fontSize: 9, color: "#555", fontFamily: "monospace", letterSpacing: 1 }}>
          COMPOSICIÓN POR RUBRO (USD MILLONES ANUALES)
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={btnStyle(modo === "expo")} onClick={() => setModo("expo")}>Exportaciones</button>
          <button style={btnStyle(modo === "impo")} onClick={() => setModo("impo")}>Importaciones</button>
        </div>
      </div>
      <BBGLineChart
        title={modo === "expo" ? "EXPORTACIONES POR RUBRO" : "IMPORTACIONES POR RUBRO"}
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel="USD millones"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: Argendata/Fundar — INDEC · Licencia CC BY-NC-ND 4.0
      </div>
    </div>
  )
}

function BalanzaView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [balanzaTab, setBalanzaTab] = useState("flujos")
  const [balanzaYear, setBalanzaYear] = useState<string>("all")

  useEffect(() => {
    fetch("/api/macro?endpoint=balanza")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const lastExpo = data?.exportaciones?.[0]?.[1]
  const lastImpo = data?.importaciones?.[0]?.[1]
  const lastSaldo = data?.saldo_comercial?.[0]?.[1]

  // Construir serie completa unificando expo/impo/saldo
  const allRows = (data?.exportaciones ?? []).map(([d]) => ({
    d,
    expo:  data?.exportaciones?.find((r)  => r[0] === d)?.[1] ?? null,
    impo:  data?.importaciones?.find((r)  => r[0] === d)?.[1] ?? null,
    saldo: data?.saldo_comercial?.find((r) => r[0] === d)?.[1] ?? null,
  })).sort((a, b) => a.d.localeCompare(b.d))

  // Años disponibles
  const years = Array.from(new Set(allRows.map(r => r.d.slice(0, 4)))).sort()

  // Filtrar por año seleccionado
  const rows = balanzaYear === "all" ? allRows : allRows.filter(r => r.d.startsWith(balanzaYear))

  // Para el gráfico: formato con label corto mes-año
  const chartData = rows.map(r => ({
    label: r.d,
    Exportaciones: r.expo,
    Importaciones: r.impo,
    Saldo: r.saldo,
  }))

  const fmtMillones = (v: number) => `$${Math.round(v).toLocaleString("es-AR")}M`

  return (
    <div>
      <SectionMeta title="Balanza Comercial" help="Diferencia entre exportaciones e importaciones de bienes. Saldo positivo = superávit comercial. Datos mensuales en millones de USD. Fuente: INDEC Intercambio Comercial Argentino." source="INDEC · datos.gob.ar" />
      <SubTabs tabs={[{ key: "flujos", label: "Flujos Mensuales" }, { key: "composicion", label: "Composición" }, { key: "socios", label: "Socios Comerciales" }]}
        active={balanzaTab} onChange={setBalanzaTab} />
      {balanzaTab === "flujos" && (<>
        {loading ? (
          <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando balanza...</div>
        ) : (<>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <KPI label="Exportaciones" value={lastExpo != null ? `USD ${fmtNum(lastExpo, 0)}M` : null} unit="último dato disponible" />
            <KPI label="Importaciones" value={lastImpo != null ? `USD ${fmtNum(lastImpo, 0)}M` : null} unit="último dato disponible" />
            <KPI
              label="Saldo Comercial"
              value={lastSaldo != null ? `USD ${lastSaldo >= 0 ? "+" : ""}${fmtNum(lastSaldo, 0)}M` : null}
              unit="último dato disponible"
              valueColor={lastSaldo == null ? "#888" : lastSaldo >= 0 ? "#4AF6C3" : "#FF433D"}
            />
          </div>

          {/* Selector de año + descarga */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 8, color: "#444", fontFamily: "monospace", marginRight: 2 }}>AÑO:</span>
              {["all", ...years].map(y => (
                <button key={y} onClick={() => setBalanzaYear(y)} style={{
                  fontSize: 9, padding: "3px 8px", border: "none", borderRadius: 2, cursor: "pointer",
                  background: balanzaYear === y ? "#FFA028" : "transparent",
                  color:      balanzaYear === y ? "#000"    : "#666",
                  fontFamily: "monospace",
                }}>{y === "all" ? "TODO" : y}</button>
              ))}
            </div>
            <DownloadCSV data={rows.map(r => ({ periodo: r.d, exportaciones: r.expo ?? "", importaciones: r.impo ?? "", saldo: r.saldo ?? "" }))} filename="balanza-comercial" />
          </div>

          {/* ComposedChart: líneas Expo/Impo + barras Saldo */}
          <div style={{ padding: "0 8px 8px" }}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#555", fontSize: 8 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                  tickFormatter={(d: string) => {
                    const parts = d.split("-")
                    return parts.length >= 2 ? parts[1] + "/" + parts[0].slice(2) : d
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#555", fontSize: 8 }}
                  axisLine={{ stroke: "#333" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${fmtNum(Math.abs(v), 0)}`}
                />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #333", fontSize: 10, color: "#ccc" }}
                  formatter={(value: unknown, name: unknown) => [`USD ${fmtNum(Number(value), 0)}M`, String(name)]}
                  labelFormatter={(l: unknown) => { const s = String(l); const p = s.split("-"); return p.length >= 2 ? `${p[1]}/${p[0]}` : s }}
                />
                <Legend wrapperStyle={{ fontSize: 9, color: "#888" }} />
                <ReferenceLine y={0} stroke="#555" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="Exportaciones" stroke="#4AF6C3" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Importaciones" stroke="#FF433D" strokeWidth={2} dot={false} connectNulls />
                <Bar dataKey="Saldo" barSize={6}>
                  {rows.map((r) => (
                    <Cell key={r.d} fill={r.saldo != null && r.saldo >= 0 ? "#4AF6C3" : "#FF433D"} opacity={0.6} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>Fuente: INDEC · Intercambio Comercial Argentino · datos.gob.ar — valores en USD millones</div>
          </div>
        </>)}
      </>)}
      {balanzaTab === "composicion" && <ComposicionExportView />}
      {balanzaTab === "socios"      && <BalanzaSociosView />}
    </div>
  )
}

// ── Balanza Socios Comerciales ──────────────────────────────────────────────────

function BalanzaSociosView() {
  const [data, setData] = useState<{ nombre: string; expo: number; impo: number; saldo: number; total: number }[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<"mapa" | "tabla">("mapa")

  useEffect(() => {
    fetch("/api/balanza-socios")
      .then(r => r.json())
      .then(j => {
        const socios = j.data?.socios ?? j.data ?? j
        if (Array.isArray(socios)) {
          setData(socios.map((s: Record<string, unknown>) => ({
            nombre: String(s.nombre ?? s.pais ?? ""),
            expo:   Number(s.expo ?? s.exportaciones ?? 0),
            impo:   Number(s.impo ?? s.importaciones ?? 0),
            saldo:  Number(s.saldo ?? 0),
            total:  Number(s.total ?? 0),
          })))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: "none", border: "none",
    borderBottom: active ? "2px solid #FFA028" : "2px solid transparent",
    cursor: "pointer", padding: "5px 14px",
    fontSize: 9, fontFamily: "monospace", color: active ? "#FFA028" : "#444",
    letterSpacing: 1, textTransform: "uppercase",
  })

  return (
    <div>
      <div style={{ background: "#060606", borderBottom: "1px solid #111", display: "flex", paddingLeft: 8 }}>
        <button style={btnStyle(vista === "mapa")}  onClick={() => setVista("mapa")}>Mapa</button>
        <button style={btnStyle(vista === "tabla")} onClick={() => setVista("tabla")}>Tabla</button>
      </div>

      {vista === "mapa" && (
        <div>
          <div style={{ padding: "6px 12px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070707" }}>
            <div style={{ fontSize: 9, color: "#FFA028", fontFamily: "monospace", letterSpacing: 1 }}>
              SOCIOS COMERCIALES — AÑO DE REFERENCIA: 2023
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 8, color: "#555", fontFamily: "monospace" }}>
              <span style={{ color: "#4AF6C3" }}>■</span> Superávit (ARG exporta más)
              <span style={{ color: "#FF433D" }}>■</span> Déficit (ARG importa más)
            </div>
          </div>
          <iframe
            src="/api/balanza-map"
            style={{ width: "100%", height: 480, border: "none", background: "#060606", display: "block" }}
            title="Mapa socios comerciales Argentina 2023"
            loading="lazy"
          />
          <div style={{ padding: "4px 12px", fontSize: 8, color: "#333", fontFamily: "monospace", borderTop: "1px solid #0e0e0e" }}>
            Fuente: INDEC · Comtrade · datos 2023 · lapizarra.ar
          </div>
        </div>
      )}

      {vista === "tabla" && (
        loading
          ? <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando...</div>
          : !data?.length
            ? <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Sin datos</div>
            : (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5 }}>PRINCIPALES SOCIOS (USD millones · 2023/2024)</div>
                  <DownloadCSV
                    data={data.map(r => ({ pais: r.nombre, exportaciones_usd_m: r.expo, importaciones_usd_m: r.impo, saldo_usd_m: r.saldo }))}
                    filename="balanza_socios"
                  />
                </div>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 80px", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 8, color: "#333", textAlign: "right", fontFamily: "monospace" }}>PAÍS</div>
                  <div style={{ fontSize: 8, color: "#4AF6C3", fontFamily: "monospace" }}>EXPO →</div>
                  <div style={{ fontSize: 8, color: "#FF433D", fontFamily: "monospace" }}>IMPO ←</div>
                  <div style={{ fontSize: 8, color: "#555", textAlign: "right", fontFamily: "monospace" }}>SALDO</div>
                </div>
                {[...data].sort((a, b) => b.total - a.total).map(r => {
                  const maxVal = Math.max(...data.flatMap(d => [d.expo, d.impo]))
                  return (
                    <div key={r.nombre} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 80px", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 9, color: "#ccc", textAlign: "right", fontFamily: "monospace" }}>{r.nombre}</div>
                      <div style={{ position: "relative", height: 14, background: "#0d0d0d" }}>
                        <div style={{ position: "absolute", height: "100%", background: "#4AF6C3", opacity: 0.7, width: `${(r.expo / maxVal * 100).toFixed(1)}%` }} />
                        <span style={{ position: "absolute", right: 4, top: 1, fontSize: 8, color: "#4AF6C3", fontFamily: "monospace" }}>{r.expo.toLocaleString("es-AR")}</span>
                      </div>
                      <div style={{ position: "relative", height: 14, background: "#0d0d0d" }}>
                        <div style={{ position: "absolute", height: "100%", background: "#FF433D", opacity: 0.6, width: `${(r.impo / maxVal * 100).toFixed(1)}%` }} />
                        <span style={{ position: "absolute", right: 4, top: 1, fontSize: 8, color: "#FF433D", fontFamily: "monospace" }}>{r.impo.toLocaleString("es-AR")}</span>
                      </div>
                      <div style={{ fontSize: 9, fontFamily: "monospace", textAlign: "right", color: r.saldo >= 0 ? "#4AF6C3" : "#FF433D", fontWeight: 700 }}>
                        {r.saldo >= 0 ? "+" : ""}{r.saldo.toLocaleString("es-AR")}
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <span style={{ fontSize: 8, color: "#4AF6C3" }}>■ Exportaciones</span>
                  <span style={{ fontSize: 8, color: "#FF433D" }}>■ Importaciones</span>
                </div>
              </div>
            )
      )}
    </div>
  )
}

// ── Fiscal Tab ─────────────────────────────────────────────────────────────────

function FiscalView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [serie, setSerie] = useState("resultado_primario")

  useEffect(() => {
    fetch("/api/macro?endpoint=fiscal")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando fiscal...</div>

  const serieOpts = [
    { key: "resultado_primario", label: "Resultado Primario" },
    { key: "resultado_financiero", label: "Resultado Financiero" },
    { key: "recaudacion", label: "Recaudación" },
  ]

  const lastPrimario = data?.resultado_primario?.[0]?.[1]
  const lastFinanciero = data?.resultado_financiero?.[0]?.[1]
  const lastRecaudacion = data?.recaudacion?.[0]?.[1]

  const selectedRows = (data?.[serie] ?? []).slice(0, 24)

  return (
    <div>
      <SectionMeta title="Resultado Fiscal" help="Resultado financiero del Sector Público Nacional: ingresos menos gastos totales. Déficit primario excluye intereses de deuda. Superávit primario = ingresos > gastos primarios." source="Ministerio de Economía · datos.gob.ar" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI
          label="Resultado Primario"
          value={lastPrimario != null ? lastPrimario.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor={lastPrimario == null ? "#888" : lastPrimario >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        <KPI
          label="Resultado Financiero"
          value={lastFinanciero != null ? lastFinanciero.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor={lastFinanciero == null ? "#888" : lastFinanciero >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        <KPI
          label="Recaudación"
          value={lastRecaudacion != null ? lastRecaudacion.toLocaleString("es-AR") : null}
          unit="$ millones"
          valueColor="#FFA028"
        />
      </div>

      <SubTabs tabs={serieOpts} active={serie} onChange={setSerie} />

      <MiniTable
        title={`${serieOpts.find((s) => s.key === serie)?.label} — Últimos 24 períodos`}
        rows={selectedRows.map(([d, v]) => ({
          label: d,
          value: v.toLocaleString("es-AR"),
          color: v >= 0 ? "#4AF6C3" : "#FF433D",
        }))}
      />
    </div>
  )
}

// ── PIB Histórico (Argendata/Maddison) ─────────────────────────────────────────

function PibHistoricoView() {
  const [data, setData] = useState<{ nivel: Record<string, unknown>[]; relativo: Record<string, unknown>[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pibSubTab, setPibSubTab] = useState("nivel")

  useEffect(() => {
    fetch("/api/macro?endpoint=argendata_crecim")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando PIB histórico...</div>
  if (!data || !data.nivel.length) return <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>

  const ultimo = data.nivel[data.nivel.length - 1] as Record<string, unknown>
  const argVal = ultimo?.Argentina as number | undefined
  const braVal = ultimo?.Brasil    as number | undefined
  const chlVal = ultimo?.Chile     as number | undefined
  const anio   = (ultimo?.date as string | undefined)?.slice(0, 4) ?? ""

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="PIB pc ARG" value={argVal ? `USD ${Math.round(argVal).toLocaleString("es-AR")}` : null}
          unit={`USD PPP 2011 · ${anio} · Maddison`} valueColor="#FFA028" />
        <KPI label="vs Brasil" value={argVal && braVal ? `${((argVal / braVal - 1) * 100).toFixed(1)}%` : null}
          unit="ARG vs Brasil · + = ARG mayor PIB pc"
          valueColor={argVal && braVal ? (argVal > braVal ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="vs Chile" value={argVal && chlVal ? `${((argVal / chlVal - 1) * 100).toFixed(1)}%` : null}
          unit="ARG vs Chile · + = ARG mayor PIB pc"
          valueColor={argVal && chlVal ? (argVal > chlVal ? "#4AF6C3" : "#FF433D") : "#555"} />
      </div>
      <SubTabs tabs={[{ key: "nivel", label: "Nivel (USD PPP)" }, { key: "relativo", label: "Relativo a ARG" }]}
        active={pibSubTab} onChange={setPibSubTab} />
      {pibSubTab === "nivel" && (
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="PIB PER CÁPITA — EVOLUCIÓN 1900-2022 (USD PPP 2011)" data={data.nivel}
            lines={[
              { key: "Argentina",      name: "Argentina", color: "#FFA028" },
              { key: "Brasil",         name: "Brasil",    color: "#4AF6C3" },
              { key: "Chile",          name: "Chile",     color: "#4FC3F7" },
              { key: "México",   name: "México",    color: "#CE93D8" },
              { key: "Estados Unidos", name: "USA",       color: "#FF433D" },
            ]}
            enableLineToggle height={280} yAxisLabel="USD PPP 2011"
            formatValue={v => `USD ${Math.round(v).toLocaleString("en")}`} defaultRange="all" />
        </div>
      )}
      {pibSubTab === "relativo" && (
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="ARG vs LATAM — PIB PER CÁPITA RELATIVO (OTRO PAÍS = 1)" data={data.relativo}
            lines={[
              { key: "Brasil",  name: "ARG/Brasil",  color: "#4AF6C3" },
              { key: "Chile",   name: "ARG/Chile",   color: "#4FC3F7" },
              { key: "México",  name: "ARG/México",  color: "#CE93D8" },
              { key: "Uruguay", name: "ARG/Uruguay", color: "#FFD54F" },
            ]}
            enableLineToggle height={280} yAxisLabel="Ratio (>1 = ARG encima)"
            formatValue={v => v.toFixed(2)} defaultRange="all" showZeroLine />
          <div style={{ padding: "4px 10px 0", fontSize: 8, color: "#555" }}>
            Ratio = PIB pc ARG / PIB pc País. Mayor que 1 → Argentina tiene mayor PIB per cápita que ese país.
          </div>
        </div>
      )}
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Maddison Project Database 2023 · vía Argendata/Fundar (CC BY-NC-ND 4.0)
      </div>
    </div>
  )
}


// ── Pirámides Poblacionales ────────────────────────────────────────────────────

function PiramidesView() {
  const [country, setCountry] = useState("32")
  const [year, setYear] = useState(2025)
  const [data, setData] = useState<PiramideRow[]>([])
  const [meta, setMeta] = useState<PiramideMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/macro?endpoint=piramide&year=${year}&country=${country}`)
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setMeta(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [country, year])

  const paisName = PAISES.find(p => p.code === country)?.name ?? country

  return (
    <div>
      <div className="bbg-panel" style={{ marginBottom: 8 }}>
        <div className="bbg-panel-header">EXPLORADOR DE PIRÁMIDES POBLACIONALES</div>
        <div style={{ padding: "10px 12px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>País</div>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{ background: "#0a0a0a", color: "#ccc", border: "1px solid #333", padding: "5px 10px", fontSize: 11, borderRadius: 2, cursor: "pointer" }}
            >
              {PAISES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Año:&nbsp;
              <span style={{ color: year > 2025 ? "#FFA028" : "#4AF6C3", fontWeight: 700, fontFamily: "monospace" }}>{year}</span>
              {year > 2025 && <span style={{ color: "#FFA028", marginLeft: 6 }}>· PROYECCIÓN ONU</span>}
            </div>
            <input
              type="range" min={1950} max={2100} step={1} value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#FFA028", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#444", marginTop: 2 }}>
              <span>1950</span><span>2025</span><span>2100</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Acceso rápido</div>
            <div style={{ display: "flex", gap: 2 }}>
              {[1950, 1975, 2000, 2025, 2050, 2075, 2100].map(y => (
                <button key={y} onClick={() => setYear(y)} style={{
                  fontSize: 8, padding: "3px 6px", border: "none", borderRadius: 2, cursor: "pointer",
                  background: year === y ? "#FFA028" : "#1a1a1a",
                  color: year === y ? "#000" : "#555",
                }}>{y}</button>
              ))}
            </div>
          </div>
          {meta && (
            <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
              {[
                { label: "Total",   value: `${(meta.total   / 1e6).toFixed(1)}M`, color: "#fff"     },
                { label: "Varones", value: `${(meta.total_m / 1e6).toFixed(1)}M`, color: "#4FC3F7"  },
                { label: "Mujeres", value: `${(meta.total_f / 1e6).toFixed(1)}M`, color: "#F48FB1"  },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase" }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bbg-panel">
        <div className="bbg-panel-header">
          {paisName.toUpperCase()} · {year}
          {meta?.proyeccion && <span style={{ fontSize: 8, fontWeight: 400, color: "#FFA028", marginLeft: 8 }}>· PROYECCIÓN ONU</span>}
        </div>
        {loading ? (
          <div style={{ padding: 40, color: "#555", textAlign: "center", fontSize: 11 }}>Cargando pirámide de {paisName}...</div>
        ) : data.length > 0 ? (
          <>
            <PyramidChart data={data} height={480} />
            <div style={{ padding: "4px 12px 8px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
              Fuente: populationpyramid.net · UN World Population Prospects 2024 · Años &gt;2025 = proyecciones ONU · Código de país: {country}
            </div>
          </>
        ) : (
          <div style={{ padding: 40, color: "#444", textAlign: "center", fontSize: 11 }}>Sin datos disponibles para {paisName} {year}</div>
        )}
      </div>
      <PoblacionSerieChart country={country} selectedYear={year} />
    </div>
  )
}

// ── Desigualdad e Informalidad (Argendata) ─────────────────────────────────────

type DesigualdadData = {
  gini_arg: [string, number][]
  gini_mundo: { pais: string; gini: number }[]
  informalidad: { productiva: [string, number][]; legal: [string, number][] }
  desempleo_mundial: Record<string, unknown>[]
}

function DesigualdadView() {
  const [data, setData] = useState<DesigualdadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState("gini_arg")

  useEffect(() => {
    fetch("/api/macro?endpoint=argendata_desigualdad")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Cargando indicadores de desigualdad...</div>
  if (!data) return <div style={{ padding: 12, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>

  const giniUltimo    = data.gini_arg[data.gini_arg.length - 1]
  const giniMin       = data.gini_arg.reduce((a, b) => b[1] < a[1] ? b : a, data.gini_arg[0])
  const giniMax       = data.gini_arg.reduce((a, b) => b[1] > a[1] ? b : a, data.gini_arg[0])
  const prodUlt       = data.informalidad.productiva[data.informalidad.productiva.length - 1]
  const legalUlt      = data.informalidad.legal[data.informalidad.legal.length - 1]
  const giniMundoRank = [...data.gini_mundo].sort((a, b) => b.gini - a.gini).slice(0, 20)
  const giniArgRank   = giniMundoRank.findIndex(r => r.pais === "Argentina") + 1
  const maxGini       = giniMundoRank[0]?.gini ?? 60
  const giniArgData   = data.gini_arg.map(([date, gini]) => ({ date, gini }))
  const infData = (() => {
    const m = new Map<string, { date: string; productiva: number | null; legal: number | null }>()
    for (const [d, v] of data.informalidad.productiva) m.set(d, { date: d, productiva: v, legal: m.get(d)?.legal ?? null })
    for (const [d, v] of data.informalidad.legal) { const r = m.get(d) ?? { date: d, productiva: null, legal: null }; m.set(d, { ...r, legal: v }) }
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date))
  })()

  return (
    <div>
      <SubTabs tabs={[
        { key: "gini_arg",     label: "Gini ARG" },
        { key: "gini_mundo",   label: "Gini Mundial" },
        { key: "informalidad", label: "Informalidad" },
      ]} active={subTab} onChange={setSubTab} />

      {subTab === "gini_arg" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
          <KPI label="Gini Actual"       value={giniUltimo ? fmtNum(giniUltimo[1], 1) : null}
            unit={`Escala 0-100 · ${giniUltimo?.[0]?.slice(0, 4) ?? ""}`} valueColor="#FFA028" />
          <KPI label="Mínimo histórico" value={giniMin ? fmtNum(giniMin[1], 1) : null}
            unit={`Mayor igualdad · ${giniMin?.[0]?.slice(0, 4) ?? ""}`} valueColor="#4AF6C3" />
          <KPI label="Máximo histórico" value={giniMax ? fmtNum(giniMax[1], 1) : null}
            unit={`Mayor desigualdad · ${giniMax?.[0]?.slice(0, 4) ?? ""}`} valueColor="#FF433D" />
        </div>
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="COEFICIENTE DE GINI — ARGENTINA 1974-2024" data={giniArgData}
            lines={[{ key: "gini", name: "Gini", color: "#FFA028" }]}
            height={240} yAxisLabel="Índice Gini" formatValue={v => fmtNum(v, 1)} defaultRange="all" showZeroLine={false} />
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
          CEDLAS con base en EPH/INDEC · Empalme metodológico entre encuestas · Cobertura urbana · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}

      {subTab === "gini_mundo" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
          <KPI label="Gini ARG"                  value={giniUltimo ? fmtNum(giniUltimo[1], 1) : null} unit="Escala 0-100" valueColor="#FFA028" />
          <KPI label="Ranking (más desiguales)" value={giniArgRank > 0 ? `#${giniArgRank}` : null}
            unit={`de ${data.gini_mundo.length} países`} valueColor="#FFA028" />
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px", marginTop: 8 }}>
          <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
            GINI MUNDIAL — TOP 20 PAÍSES MÁS DESIGUALES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {giniMundoRank.map(r => {
              const isArg = r.pais === "Argentina"
              const barPct = r.gini / maxGini * 78
              return (
                <div key={r.pais} style={{ display: "grid", gridTemplateColumns: "130px 1fr 44px", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 9, color: isArg ? "#FFA028" : "#888", textAlign: "right",
                    fontWeight: isArg ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pais}</div>
                  <div style={{ position: "relative", height: 12, background: "#111", borderRadius: 2 }}>
                    <div style={{ position: "absolute", height: "100%", borderRadius: 2,
                      background: isArg ? "#FFA028" : "#4FC3F7", opacity: 0.8, width: `${barPct}%` }} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                    color: isArg ? "#FFA028" : "#4FC3F7", textAlign: "right" }}>{r.gini.toFixed(1)}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", marginTop: 4 }}>
          SEDLAC/Banco Mundial · Snapshot de último año disponible por país · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}

      {subTab === "informalidad" && (<>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
          <KPI label="Informalidad Productiva" value={prodUlt ? `${fmtNum(prodUlt[1], 1)}%` : null}
            unit={`Baja productividad · ${prodUlt?.[0]?.slice(0, 4) ?? ""}`} valueColor="#4AF6C3" />
          <KPI label="Informalidad Legal"       value={legalUlt ? `${fmtNum(legalUlt[1], 1)}%` : null}
            unit={`Sin aportes previsionales · ${legalUlt?.[0]?.slice(0, 4) ?? ""}`} valueColor="#4FC3F7" />
        </div>
        <div style={{ padding: "8px 0" }}>
          <BBGLineChart title="TASA DE INFORMALIDAD — ARGENTINA 1988-2022" data={infData}
            lines={[
              { key: "productiva", name: "Def. Productiva", color: "#4AF6C3" },
              { key: "legal",      name: "Def. Legal",      color: "#4FC3F7" },
            ]}
            height={240} yAxisLabel="%" formatValue={v => `${fmtNum(v, 1)}%`} defaultRange="all" />
        </div>
        <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
          Def. productiva: empleo en unidades de baja productividad · Def. legal: sin aportes al sistema previsional ·
          SEDLAC/Banco Mundial con base en EPH · vía Argendata/Fundar (CC BY-NC-ND 4.0)
        </div>
      </>)}
    </div>
  )
}

// ── FX — Tipo de Cambio Histórico + Bandas Cambiarias ─────────────────────────

// ── Bandas cambiarias — cargadas desde /api/bcra-bands ───────────────────────
// Fase 1 (11-abr-2025 → 31-dic-2025): Piso −1%/mes · Techo +1%/mes
// Fase 2 (desde 1-ene-2026): IPC T-2 real de INDEC vía datos.gob.ar
// Ver: src/app/api/bcra-bands/route.ts

interface FXEntry {
  date: string
  oficial?:   number
  blue?:      number
  mep?:       number
  ccl?:       number
  mayorista?: number
  cripto?:    number
}

const PERIOD_OPTS = [
  { label: "1M",  value: "1m"  },
  { label: "3M",  value: "3m"  },
  { label: "6M",  value: "6m"  },
  { label: "1A",  value: "1y"  },
  { label: "MAX", value: "max" },
]

const FX_LINES = [
  { key: "oficial",   name: "Oficial",   color: "#4AF6C3" },
  { key: "blue",      name: "Blue",      color: "#FFA028" },
  { key: "mep",       name: "MEP",       color: "#4FC3F7" },
  { key: "ccl",       name: "CCL",       color: "#CE93D8" },
  { key: "cripto",    name: "Cripto",    color: "#FFD54F" },
  { key: "mayorista", name: "Mayorista", color: "#81C784" },
]

// ── TCR sub-view ───────────────────────────────────────────────────────────────

interface TCRKpis {
  itcrm: number | null
  itcrm_var_mes: number | null
  itcr_brl: number | null
  itcr_eur: number | null
  fecha: string
}

interface TCRBigMacRow {
  iso: string
  name: string
  subval_pct: number
  adj_subval_pct: number
  dollar_price: number
}

function TCRSubView() {
  const [kpis, setKpis]       = useState<TCRKpis | null>(null)
  const [serie, setSerie]     = useState<Record<string, unknown>[]>([])
  const [ranking, setRanking] = useState<TCRBigMacRow[]>([])
  const [modo, setModo]       = useState<"simple" | "ajustado">("ajustado")
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/tcr").then(r => r.json()),
      fetch("/api/big-mac").then(r => r.json()),
    ]).then(([tcr, bm]) => {
      setKpis(tcr.data?.kpis ?? null)
      // Mapear fecha → date para BBGLineChart
      setSerie((tcr.data?.serie ?? []).map((r: Record<string, unknown>) => ({
        date:       r.fecha,
        itcrm:      r.ITCRM,
        itcr_brl:   r["ITCR-BRL"],
        itcr_eur:   r["ITCR-EUR"],
      })))
      setRanking(bm.data?.ranking ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando TCR...</div>

  const subvalKey = modo === "ajustado" ? "adj_subval_pct" : "subval_pct"
  const sorted = [...ranking].sort((a, b) => a[subvalKey] - b[subvalKey])
  const maxAbs = Math.max(...sorted.map(r => Math.abs(r[subvalKey])), 1)

  // Termómetro ITCRM: percentiles históricos
  const itcrmValues = serie.map(r => Number(r.itcrm)).filter(v => !isNaN(v) && v > 0)
  const q25 = itcrmValues.length > 4 ? (() => {
    const sorted2 = [...itcrmValues].sort((a, b) => a - b)
    return sorted2[Math.floor(sorted2.length * 0.25)]
  })() : null
  const q75 = itcrmValues.length > 4 ? (() => {
    const sorted2 = [...itcrmValues].sort((a, b) => a - b)
    return sorted2[Math.floor(sorted2.length * 0.75)]
  })() : null
  const itcrmActual = kpis?.itcrm ?? null
  const zonaItcrm = itcrmActual == null || q25 == null || q75 == null
    ? "neutral"
    : itcrmActual < q25 ? "atraso"
    : itcrmActual > q75 ? "competitivo"
    : "neutral"
  const zonaConfig = {
    atraso:      { color: "#FF433D", label: "ZONA ROJA — ATRASO CAMBIARIO", desc: "El TCR está por debajo del cuartil histórico bajo. El productor tiende a retener grano esperando una corrección." },
    neutral:     { color: "#FFA028", label: "ZONA NEUTRAL",                  desc: "El TCR se encuentra en el rango histórico normal (Q25–Q75). Las decisiones dependen de necesidades de caja." },
    competitivo: { color: "#4AF6C3", label: "ZONA VERDE — TIPO DE CAMBIO COMPETITIVO", desc: "El TCR supera el cuartil histórico alto. Incentivo fuerte para fijar precios y liquidar exportaciones." },
  }

  const itcrmColor = itcrmActual != null
    ? kpis!.itcrm! > 120 ? "#4AF6C3" : kpis!.itcrm! > 90 ? "#FFA028" : "#FF433D"
    : "#555"

  const csvTCR = serie.map(r => ({
    fecha: r.date, itcrm: r.itcrm ?? "", itcr_brl: r.itcr_brl ?? "", itcr_eur: r.itcr_eur ?? ""
  })) as Record<string, unknown>[]

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="ITCRM Multilateral"
          value={kpis?.itcrm != null ? fmtNum(kpis.itcrm, 1) : null}
          unit={`Base dic-2010=100 · ${kpis?.fecha ?? "—"}`}
          valueColor={itcrmColor} />
        <KPI label="Var. Mensual ITCRM"
          value={kpis?.itcrm_var_mes != null ? `${kpis.itcrm_var_mes >= 0 ? "+" : ""}${fmtNum(kpis.itcrm_var_mes, 2)}%` : null}
          unit="respecto al mes anterior"
          valueColor={kpis?.itcrm_var_mes != null ? (kpis.itcrm_var_mes >= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="ITCR Bilateral BRL"
          value={kpis?.itcr_brl != null ? fmtNum(kpis.itcr_brl, 2) : null}
          unit="ARG vs Brasil · Base 2010=100"
          valueColor="#4FC3F7" />
        <KPI label="ITCR Bilateral EUR"
          value={kpis?.itcr_eur != null ? fmtNum(kpis.itcr_eur, 2) : null}
          unit="ARG vs Eurozona · Base 2010=100"
          valueColor="#CE93D8" />
      </div>

      {/* Termómetro ITCRM */}
      {itcrmActual != null && q25 != null && q75 != null && (
        <div style={{
          margin: "1px 0", padding: "10px 14px",
          background: zonaConfig[zonaItcrm].color + "0d",
          border: `1px solid ${zonaConfig[zonaItcrm].color}33`,
          borderLeft: `4px solid ${zonaConfig[zonaItcrm].color}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: zonaConfig[zonaItcrm].color, fontFamily: "monospace", letterSpacing: 1.5 }}>
                {zonaConfig[zonaItcrm].label}
              </div>
              <div style={{ fontSize: 9, color: "#888", fontFamily: "monospace", marginTop: 3, maxWidth: 500 }}>
                {zonaConfig[zonaItcrm].desc}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 8, color: "#555", fontFamily: "monospace" }}>
              <span>Q25 hist: <strong style={{ color: "#FF433D" }}>{q25.toFixed(1)}</strong></span>
              <span>Actual: <strong style={{ color: zonaConfig[zonaItcrm].color }}>{itcrmActual.toFixed(1)}</strong></span>
              <span>Q75 hist: <strong style={{ color: "#4AF6C3" }}>{q75.toFixed(1)}</strong></span>
            </div>
          </div>
          {/* Barra de posición */}
          <div style={{ marginTop: 8, position: "relative" }}>
            <div style={{ height: 6, background: "linear-gradient(to right, #FF433D 0%, #FFA028 33%, #4AF6C3 100%)", borderRadius: 3, opacity: 0.4 }} />
            {(() => {
              const allVals = itcrmValues
              const minV = Math.min(...allVals)
              const maxV = Math.max(...allVals)
              const pct = Math.max(0, Math.min(100, ((itcrmActual - minV) / (maxV - minV)) * 100))
              return (
                <div style={{
                  position: "absolute", top: -3, left: `${pct}%`,
                  transform: "translateX(-50%)",
                  width: 12, height: 12,
                  borderRadius: "50%",
                  background: zonaConfig[zonaItcrm].color,
                  border: "2px solid #000",
                  boxShadow: `0 0 6px ${zonaConfig[zonaItcrm].color}`,
                }} />
              )
            })()}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#333", fontFamily: "monospace", marginTop: 8 }}>
            <span>Mín hist. {Math.min(...itcrmValues).toFixed(0)}</span>
            <span>Máx hist. {Math.max(...itcrmValues).toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Gráfico ITCRM */}
      {serie.length > 0 && (
        <div ref={chartRef} style={{ padding: "8px 12px 4px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <ChartDownload csvData={csvTCR} filename="itcrm-historico" chartRef={chartRef} />
          </div>
          <BBGLineChart
            title="ITCRM — ÍNDICE DE TIPO DE CAMBIO REAL MULTILATERAL"
            data={serie}
            lines={[
              { key: "itcrm",    name: "ITCRM Multilateral", color: "#FFA028" },
              { key: "itcr_brl", name: "ITCR-BRL",           color: "#4FC3F7" },
              { key: "itcr_eur", name: "ITCR-EUR",           color: "#CE93D8" },
            ]}
            height={260}
            yAxisLabel="Índice (base 2010=100)"
            showZeroLine={false}
            defaultRange="1y"
            enableDateRange={true}
            enableLineToggle={true}
          />
          <div style={{ fontSize: 8, color: "#333", padding: "2px 4px" }}>
            Fuente: BCRA · Base diciembre 2010 = 100 · Índice ponderado por comercio bilateral
          </div>
        </div>
      )}

      {/* Ranking competitividad mundial — Big Mac Index */}
      {sorted.length > 0 && (
        <div style={{ padding: "8px 12px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, fontFamily: "monospace" }}>
              COMPETITIVIDAD CAMBIARIA MUNDIAL — BIG MAC INDEX
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setModo("ajustado")} style={{
                background: modo === "ajustado" ? "#1a1200" : "none",
                border: `1px solid ${modo === "ajustado" ? "#FFA028" : "#222"}`,
                borderRadius: 3, cursor: "pointer", padding: "3px 8px",
                fontSize: 8, fontFamily: "monospace",
                color: modo === "ajustado" ? "#FFA028" : "#555",
              }}>PPP ajustado</button>
              <button onClick={() => setModo("simple")} style={{
                background: modo === "simple" ? "#1a1200" : "none",
                border: `1px solid ${modo === "simple" ? "#FFA028" : "#222"}`,
                borderRadius: 3, cursor: "pointer", padding: "3px 8px",
                fontSize: 8, fontFamily: "monospace",
                color: modo === "simple" ? "#FFA028" : "#555",
              }}>Simple</button>
            </div>
          </div>
          <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace", marginBottom: 8 }}>
            Verde = moneda subvaluada (más competitiva) · Rojo = sobrevaluada (menos competitiva)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {sorted.map(r => {
              const val = r[subvalKey]
              const isArg = r.iso === "ARG"
              const color = val < -15 ? "#4AF6C3" : val < 0 ? "#81C784" : val < 15 ? "#FFA028" : "#FF433D"
              const barPct = Math.abs(val) / maxAbs * 100
              const barLeft = val < 0  // negativo = barra va a la izquierda (depreciado)
              return (
                <div key={r.iso} style={{
                  display: "grid", gridTemplateColumns: "100px 1fr 60px",
                  gap: 8, alignItems: "center",
                  background: isArg ? "#0d0900" : "transparent",
                  borderRadius: isArg ? 3 : 0,
                  padding: isArg ? "3px 6px" : "1px 0",
                  border: isArg ? "1px solid #2a1800" : "none",
                }}>
                  <div style={{ fontSize: 9, color: isArg ? "#FFA028" : "#aaa", fontFamily: "monospace", textAlign: "right" }}>
                    {r.name}
                  </div>
                  <div style={{ position: "relative", height: 12, background: "#0d0d0d", borderRadius: 2 }}>
                    <div style={{
                      position: "absolute", height: "100%", borderRadius: 2,
                      background: color, opacity: 0.7,
                      width: `${barPct / 2}%`,
                      ...(barLeft
                        ? { right: "50%", left: "auto" }
                        : { left: "50%", right: "auto" }
                      ),
                    }} />
                    {/* Centro line */}
                    <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#222" }} />
                  </div>
                  <div style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color, textAlign: "right" }}>
                    {val >= 0 ? "+" : ""}{val.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", marginTop: 8, borderTop: "1px solid #111", paddingTop: 6 }}>
            Fuente: The Economist · Big Mac Index · PPP ajustado controla por nivel de ingreso per cápita
          </div>
        </div>
      )}
    </div>
  )
}

// ── FX View principal ─────────────────────────────────────────────────────────

function FXView() {
  const [raw, setRaw]         = useState<FXEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fxTab, setFxTab]     = useState<"cotizaciones" | "tcr">("cotizaciones")
  const [visible, setVisible] = useState<Record<string, boolean>>({
    oficial: true, blue: true, mep: true, ccl: true, cripto: false, mayorista: false,
  })
  const [bands, setBands] = useState<Record<string, { piso: number; techo: number }>>({})
  const chartRef = useRef<HTMLDivElement>(null)

  // Siempre traemos el máximo histórico — BBGLineChart filtra por rango en el cliente
  useEffect(() => {
    setLoading(true)
    fetch("/api/tc-historico?period=max")
      .then(r => r.json())
      .then(j => { setRaw(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Bandas cambiarias — máxima precisión con IPC T-2 real (datos.gob.ar)
  useEffect(() => {
    fetch("/api/bcra-bands")
      .then(r => r.json())
      .then(j => {
        const map: Record<string, { piso: number; techo: number }> = {}
        for (const d of (j.data ?? []) as { date: string; piso: number; techo: number }[]) {
          map[d.date] = { piso: d.piso, techo: d.techo }
        }
        setBands(map)
      })
      .catch(() => {})
  }, [])

  // Datos históricos enriquecidos con bandas
  const historical = raw.map(r => ({
    ...r,
    banda_inf: bands[r.date]?.piso  ?? null,
    banda_sup: bands[r.date]?.techo ?? null,
  }))

  // Fechas futuras: sólo bandas (sin cotizaciones aún)
  const lastDate = raw.at(-1)?.date ?? ""
  const futureBands = Object.entries(bands)
    .filter(([date]) => date > lastDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { piso, techo }]) => ({
      date,
      oficial: null, blue: null, mep: null, ccl: null, cripto: null, mayorista: null,
      banda_inf: piso,
      banda_sup: techo,
    }))

  const data = [...historical, ...futureBands]

  const last  = raw.at(-1)
  const prev5 = raw.at(-5)

  const varPct = (key: keyof FXEntry) => {
    const curr = last?.[key] as number | undefined
    const p    = prev5?.[key] as number | undefined
    if (curr == null || p == null || p === 0) return null
    return ((curr / p) - 1) * 100
  }

  if (loading) return (
    <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>
      Cargando tipos de cambio...
    </div>
  )

  const csvData = data.map(r => ({
    fecha: r.date,
    oficial:   r.oficial   ?? "",
    blue:      r.blue      ?? "",
    mep:       r.mep       ?? "",
    ccl:       r.ccl       ?? "",
    cripto:    r.cripto    ?? "",
    mayorista: r.mayorista ?? "",
    banda_piso:  r.banda_inf ?? "",
    banda_techo: r.banda_sup ?? "",
  }))

  return (
    <div>
      <SectionMeta title="FX — Tipo de Cambio" help="Cotizaciones del dólar en los distintos mercados. Las bandas cambiarias son pisos/techos fijados por el BCRA desde abril 2025. Oficial = mercado regulado. Blue = mercado informal. MEP y CCL = operaciones bursátiles." source="argentinadatos.com · BCRA" />
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 12px", borderBottom: "1px solid #1a1a1a", background: "#080808" }}>
        {([
          { key: "cotizaciones", label: "Cotizaciones" },
          { key: "tcr",          label: "TCR / Competitividad" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFxTab(t.key)} style={{
            fontSize: 9, padding: "4px 12px", border: "none", borderRadius: 2, cursor: "pointer",
            background: fxTab === t.key ? "#FFA028" : "transparent",
            color:      fxTab === t.key ? "#000"    : "#666",
            fontWeight: fxTab === t.key ? 700       : 400,
            fontFamily: "monospace", letterSpacing: 0.5,
          }}>{t.label}</button>
        ))}
      </div>

      {fxTab === "tcr" && <TCRSubView />}
      {fxTab === "cotizaciones" && <>
      {/* KPIs */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        {FX_LINES.map(({ key, name, color }) => {
          const val = last?.[key as keyof FXEntry] as number | undefined
          const v   = varPct(key as keyof FXEntry)
          return (
            <div key={key} style={{
              flex: "1 1 130px", padding: "10px 14px",
              background: "#080808", border: "1px solid #111",
            }}>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace", marginBottom: 2 }}>
                {name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1.2 }}>
                {val != null ? `$${val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
              </div>
              {v != null && (
                <div style={{ fontSize: 9, color: v >= 0 ? "#FF433D" : "#4AF6C3", fontFamily: "monospace", marginTop: 2 }}>
                  {v >= 0 ? "+" : ""}{fmtNum(v, 2)}% semanal
                </div>
              )}
            </div>
          )
        })}
        {/* Banda cambiaria actual */}
        {last && (
          <div style={{ flex: "1 1 130px", padding: "10px 14px", background: "#080808", border: "1px solid #222" }}>
            <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace", marginBottom: 4 }}>
              Banda BCRA
            </div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#ccc", lineHeight: 1.9 }}>
              <span style={{ color: "#4AF6C3" }}>↑ Piso:   ${bands[last.date]?.piso?.toFixed(0)  ?? "—"}</span><br />
              <span style={{ color: "#FF433D" }}>↓ Techo: ${bands[last.date]?.techo?.toFixed(0) ?? "—"}</span>
            </div>
            <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", marginTop: 2 }}>Piso −1%/mes · Techo +1%/mes · Fase 2 desde ene-2026 IPC T-2</div>
          </div>
        )}
      </div>

      {/* Toggle de series + descarga */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", flexWrap: "wrap", gap: 8,
        borderBottom: "1px solid #0d0d0d",
      }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#444", fontFamily: "monospace", marginRight: 4 }}>SERIES:</span>
          {FX_LINES.map(({ key, name, color }) => (
            <button key={key} onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 8, padding: "3px 8px", border: `1px solid ${visible[key] ? color + "80" : "#1a1a1a"}`,
              borderRadius: 3, cursor: "pointer", fontFamily: "monospace",
              background: visible[key] ? color + "15" : "transparent",
              color:      visible[key] ? color         : "#444",
            }}>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: visible[key] ? color : "#222",
              }} />
              {name}
            </button>
          ))}
        </div>
        <ChartDownload csvData={csvData} filename="tipos-de-cambio" chartRef={chartRef} />
      </div>

      {/* Gráfico — BBGLineChart tiene su propio selector de rango (1S/1M/3M/6M/1A/YTD/MAX) */}
      <div style={{ padding: "0 12px 4px" }} ref={chartRef}>
        <BBGLineChart
          title="TIPOS DE CAMBIO ARS/USD"
          data={data as unknown as Record<string, unknown>[]}
          lines={[
            ...FX_LINES
              .filter(l => visible[l.key])
              .map(l => ({ key: l.key, name: l.name, color: l.color })),
            { key: "banda_inf", name: "Piso banda",  color: "#4AF6C3", dashed: true },
            { key: "banda_sup", name: "Techo banda", color: "#FF433D", dashed: true },
          ]}
          height={340}
          yAxisLabel="ARS/USD"
          formatValue={v => `$${Math.round(v).toLocaleString("es-AR")}`}
          defaultRange="1y"
          showZeroLine={false}
          enableLineToggle={false}
          enableDateRange={true}
        />
        <div style={{ fontSize: 8, color: "#333", marginTop: 4, padding: "0 4px" }}>
          Fuente: argentinadatos.com · Bandas BCRA desde 11-abr-2025 · F1 (hasta dic-2025): Piso −1%/mes · Techo +1%/mes · F2 (ene-2026+): IPC T-2 real vía INDEC/datos.gob.ar · proyección 3 meses
        </div>
      </div>
      <FXExpectativasSection lastOficial={last?.oficial ?? null} />
      </>}
    </div>
  )
}

// ── FX Expectativas (REM forward + Polymarket) ────────────────────────────────
function FXExpectativasSection({ lastOficial }: { lastOficial: number | null }) {
  const [remData, setRemData]   = useState<{ dolar_12m: number | null; fecha: string | null } | null>(null)
  const [polyData, setPolyData] = useState<{ question: string; probability: number; slug: string }[]>([])

  useEffect(() => {
    fetch("/api/breakeven")
      .then(r => r.json())
      .then(j => setRemData(j.data?.rem ?? null))
      .catch(() => {})
    fetch("/api/polymarket?category=argentina")
      .then(r => r.json())
      .then(j => setPolyData(j.data ?? []))
      .catch(() => {})
  }, [])

  if (!remData?.dolar_12m && polyData.length === 0) return null

  const dolar12m = remData?.dolar_12m
  const monthlyRate = dolar12m != null ? Math.pow(1 + dolar12m / 100, 1 / 12) - 1 : null
  const base = lastOficial

  const hoy = new Date()
  const forwardData = base != null && monthlyRate != null
    ? Array.from({ length: 13 }, (_, i) => {
        if (i === 0) {
          return { label: "HOY", oficial_fwd: base, rem_fwd: base }
        }
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
        const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`
        return { label, oficial_fwd: null, rem_fwd: parseFloat((base * Math.pow(1 + monthlyRate, i)).toFixed(0)) }
      })
    : []

  // Polymarket: buscar mercado de mayor volumen sobre dólar/devaluación argentina
  const polyMarketFX = polyData.find(m =>
    /dollar|dolar|peso|devaluación|devaluation|ars|tc|tipo de cambio/i.test(m.question)
  )

  return (
    <div style={{ borderTop: "1px solid #111", marginTop: 4, padding: "8px 12px" }}>
      <div style={{ fontSize: 9, color: "#FFA028", fontFamily: "monospace", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
        EXPECTATIVAS TC — PRÓXIMOS 12 MESES
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        {dolar12m != null && (
          <div style={{ flex: "1 1 140px", padding: "8px 12px", background: "#080808", border: "1px solid #111" }}>
            <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>REM — USD en 12M</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#4FC3F7", fontFamily: "monospace" }}>+{dolar12m.toFixed(1)}%</div>
            <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>mediana analistas · {remData?.fecha ?? ""}</div>
          </div>
        )}
        {polyMarketFX && (
          <div style={{ flex: "1 1 200px", padding: "8px 12px", background: "#080808", border: "1px solid #222" }}>
            <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Polymarket</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FFA028", fontFamily: "monospace" }}>{polyMarketFX.probability}%</div>
            <div style={{ fontSize: 8, color: "#888", fontFamily: "monospace", lineHeight: 1.4, marginTop: 2 }}>{polyMarketFX.question.slice(0, 80)}</div>
          </div>
        )}
      </div>
      {forwardData.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={forwardData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#111" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={false} />
            <YAxis tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#222" }} tickLine={false}
              tickFormatter={(v: number) => `$${v.toLocaleString("es-AR")}`} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, fontFamily: "monospace" }}
              formatter={(v: unknown) => [`$${Number(v).toLocaleString("es-AR")}`, "Proyección REM"]} />
            <Line type="monotone" dataKey="oficial_fwd" name="Tipo de cambio oficial actual" stroke="#4AF6C3" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
            <Line type="monotone" dataKey="rem_fwd" name="Proyección REM" stroke="#4FC3F7" strokeWidth={2} dot={false} strokeDasharray="5 3" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", marginTop: 2 }}>
        Proyección compuesta mensual desde dólar oficial · REM BCRA · Polymarket Gamma API
      </div>
    </div>
  )
}

// ── Big Mac Index ──────────────────────────────────────────────────────────────

interface BigMacCountry {
  iso: string
  nombre: string
  dollar_price: number
  subval_pct: number
  adj_subval_pct: number
}

interface BigMacData {
  argentina: {
    local_price: number
    dollar_price: number
    tc_bigmac: number
    subval_pct: number
    adj_subval_pct: number | null
    date: string
  } | null
  usa_precio: number
  ranking: BigMacCountry[]
  historico_arg: { date: string; dollar_price: number; subval_pct: number }[]
  ultima_fecha: string
}

function BigMacView() {
  const [data, setData] = useState<BigMacData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<"simple" | "ajustado">("simple")

  useEffect(() => {
    fetch("/api/big-mac")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando Big Mac Index...</div>

  const arg = data?.argentina
  const subvalKey = modo === "ajustado" ? "adj_subval_pct" : "subval_pct"
  const ranking = data?.ranking?.slice().sort((a, b) => a[subvalKey] - b[subvalKey]) ?? []
  const maxAbs = Math.max(...ranking.map(r => Math.abs(r[subvalKey])), 1)

  return (
    <div>
      <SectionMeta title="Big Mac Index" help="Medida de paridad de poder adquisitivo (PPP) calculada por The Economist. Compara el precio de la hamburguesa en distintos países. Si el índice sugiere subvaluación, la moneda local sería más 'barata' que lo que indica el tipo de cambio de mercado." source="The Economist" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Precio BM ARG (USD)"
          value={arg?.dollar_price != null ? `USD ${fmtNum(arg.dollar_price, 2)}` : null}
          unit={`Fecha: ${arg?.date ?? "—"}`}
          valueColor="#FFA028" />
        <KPI label="TC Big Mac implícito"
          value={arg?.tc_bigmac != null ? `$${fmtNum(arg.tc_bigmac, 0)}` : null}
          unit="Precio ARG / Precio USA"
          valueColor="#4FC3F7" />
        <KPI label="Subvaluación vs USD"
          value={arg?.subval_pct != null ? `${arg.subval_pct >= 0 ? "+" : ""}${fmtNum(arg.subval_pct, 1)}%` : null}
          unit="Negativo = barato vs USA"
          valueColor={arg?.subval_pct != null ? (arg.subval_pct >= 0 ? "#FF433D" : "#4AF6C3") : "#555"} />
      </div>

      {/* Selector modo */}
      <div style={{ padding: "8px 12px 4px", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>Vista:</span>
        {(["simple", "ajustado"] as const).map(m => (
          <button key={m} onClick={() => setModo(m)} style={{
            fontSize: 8, padding: "3px 8px", border: "none", cursor: "pointer", borderRadius: 2,
            background: modo === m ? "#FFA028" : "#1a1a1a",
            color:      modo === m ? "#000"    : "#555",
            fontFamily: "monospace", textTransform: "uppercase",
          }}>
            {m === "simple" ? "Simple" : "Ajustado por PIB pc"}
          </button>
        ))}
      </div>

      {/* Ranking */}
      {ranking.length > 0 && (
        <div style={{ padding: "4px 12px 12px" }}>
          <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 8 }}>
            RANKING DE MONEDAS — Big Mac vs USD (negativo = más barato)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {ranking.map(r => {
              const val    = r[subvalKey]
              const isArg  = r.iso === "ARG"
              const barPct = Math.abs(val) / maxAbs * 60
              const color  = val <= 0 ? "#4AF6C3" : "#FF433D"
              return (
                <div key={r.iso} style={{ display: "grid", gridTemplateColumns: "110px 24px 1fr 60px", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 9, color: isArg ? "#FFA028" : "#888", textAlign: "right",
                    fontWeight: isArg ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.nombre}
                  </div>
                  <div style={{ fontSize: 8, color: "#555", textAlign: "center", fontFamily: "monospace" }}>{r.iso}</div>
                  <div style={{ position: "relative", height: 12, background: "#0d0d0d" }}>
                    <div style={{
                      position: "absolute", height: "100%",
                      background: isArg ? "#FFA028" : color, opacity: 0.75,
                      width: `${barPct}%`,
                      left: val <= 0 ? `${60 - barPct}%` : "60%",
                    }} />
                    {/* Centro */}
                    <div style={{ position: "absolute", left: "60%", top: 0, bottom: 0, width: 1, background: "#333" }} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                    color: isArg ? "#FFA028" : color, textAlign: "right" }}>
                    {val >= 0 ? "+" : ""}{fmtNum(val, 1)}%
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 8, color: "#333", marginTop: 8, borderTop: "1px solid #111", paddingTop: 4 }}>
            Fuente: The Economist Big Mac Index · github.com/TheEconomist/big-mac-data ·
            Datos semestrales · No constituye análisis de inversión.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Riesgo País ────────────────────────────────────────────────────────────────

interface HistoricoEntry { date: string; valor: number; sma30?: number; sma90?: number }

interface RiesgoData {
  actual: {
    riesgoPaisBps: number
    fecha: string
  } | null
  historico: HistoricoEntry[]
  historicoConSMA: HistoricoEntry[]
  regionales: Record<string, { bps: number | null }>
  alertas: string[]
}

function RiesgoPaisView() {
  const [data, setData] = useState<RiesgoData | null>(null)
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/riesgo-pais")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando Riesgo País...</div>

  const bps      = data?.actual?.riesgoPaisBps
  const historico = data?.historicoConSMA ?? data?.historico ?? []
  const regionales: { pais: string; valor: number }[] = data?.regionales
    ? Object.entries(data.regionales)
        .filter(([, d]) => d.bps != null)
        .map(([pais, d]) => ({ pais: pais.charAt(0).toUpperCase() + pais.slice(1), valor: d.bps as number }))
    : []

  // Variaciones
  const ult    = historico.at(-1)
  const hace5  = historico.at(-5)   // ~1 semana
  const hace22 = historico.at(-22)  // ~1 mes
  const var1w  = ult && hace5  ? ult.valor - hace5.valor  : null
  const var1m  = ult && hace22 ? ult.valor - hace22.valor : null

  const bpsColor = bps != null
    ? bps < 500 ? "#4AF6C3" : bps < 1000 ? "#FFA028" : "#FF433D"
    : "#555"

  const maxReg = Math.max(...regionales.map(r => r.valor), 1)

  return (
    <div>
      <SectionMeta title="Riesgo País" help="El EMBI+ mide el spread de los bonos soberanos argentinos sobre los Treasuries de EE.UU. A mayor valor, mayor riesgo percibido por los inversores. Por encima de 1000 bps se considera riesgo muy alto." source="argentinadatos.com · BCRA" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="EMBI+ Argentina"
          value={bps != null ? String(Math.round(bps)) : null}
          unit={`bps · ${data?.actual?.fecha ?? "—"} · ${bps != null ? (bps < 500 ? "BAJO" : bps < 1000 ? "MEDIO" : "ALTO") : ""}`}
          valueColor={bpsColor} />
        <KPI label="Var. 1 semana"
          value={var1w != null ? `${var1w >= 0 ? "+" : ""}${Math.round(var1w)} bps` : null}
          unit="~5 ruedas"
          valueColor={var1w != null ? (var1w <= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="Var. 1 mes"
          value={var1m != null ? `${var1m >= 0 ? "+" : ""}${Math.round(var1m)} bps` : null}
          unit="~22 ruedas"
          valueColor={var1m != null ? (var1m <= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
      </div>

      {historico.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5 }}>
              EMBI+ ARGENTINA — HISTÓRICO CON MEDIAS MÓVILES
            </div>
            <ChartDownload
              csvData={historico.map(r => ({ fecha: r.date, embi: r.valor, sma30: r.sma30 ?? "", sma90: r.sma90 ?? "" }))}
              filename="riesgo-pais"
              chartRef={chartRef}
            />
          </div>
          <div ref={chartRef}>
          <BBGLineChart
            title=""
            data={historico.slice(-500) as unknown as Record<string, unknown>[]}
            lines={[
              { key: "valor", name: "EMBI+", color: "#FF433D" },
              { key: "sma30", name: "SMA30", color: "#FFA028" },
              { key: "sma90", name: "SMA90", color: "#4FC3F7" },
            ]}
            height={260}
            yAxisLabel="bps"
            formatValue={v => `${Math.round(v)} bps`}
            defaultRange="all"
            showZeroLine={false}
            enableLineToggle
          />
          </div>{/* end chartRef */}
        </div>
      )}

      {regionales.length > 0 && (
        <div style={{ padding: "8px 12px 12px" }}>
          <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 8 }}>
            COMPARATIVO REGIONAL — EMBI+ (bps)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...regionales].sort((a, b) => b.valor - a.valor).map(r => {
              const isArg = r.pais === "Argentina"
              const barPct = r.valor / maxReg * 75
              return (
                <div key={r.pais} style={{ display: "grid", gridTemplateColumns: "110px 1fr 60px", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 9, color: isArg ? "#FFA028" : "#888", textAlign: "right",
                    fontWeight: isArg ? 700 : 400 }}>{r.pais}</div>
                  <div style={{ position: "relative", height: 12, background: "#0d0d0d" }}>
                    <div style={{ position: "absolute", height: "100%",
                      background: isArg ? "#FFA028" : "#4FC3F7", opacity: 0.75, width: `${barPct}%` }} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                    color: isArg ? "#FFA028" : "#4FC3F7", textAlign: "right" }}>
                    {Math.round(r.valor)}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Fuente: BCRA / JPMorgan EMBI+ · bps = puntos básicos sobre Treasuries USA
          </div>
        </div>
      )}
    </div>
  )
}

// ── Deuda Pública ──────────────────────────────────────────────────────────────

type VencDet = {
  anio: string
  moneda: string
  tipo: string
  acreedor_tipo: string
  acreedor: string
  monto: number
}

interface DeudaData {
  data: {
    historico_pib:       { anio: string; deuda_pib: number }[]
    ultimo:              { anio: string; deuda_pib: number | null }
    vencimientos:        { anio: string; monto: number }[]
    vencimientos_detalle: VencDet[]
    composicion_acreedor: { nombre: string; pct: number }[]
    composicion_moneda:   { nombre: string; pct: number }[]
    is_live: boolean
  }
  source: string
}

// Colors for stacked vencimientos by type
const TIPO_COLORS: Record<string, string> = {
  "FMI":                 "#FF433D",
  "Multilateral":        "#FFA028",
  "Bilateral":           "#FFD54F",
  "Bono externo":        "#4AF6C3",
  "Instrumento local":   "#4FC3F7",
  "Intra-sector público":"#CE93D8",
}

const dropStyle: React.CSSProperties = {
  background: "#0d0d0d",
  color: "#ccc",
  border: "1px solid #2a2a2a",
  borderRadius: 2,
  padding: "4px 8px",
  fontSize: 10,
  fontFamily: "monospace",
  cursor: "pointer",
  outline: "none",
  minWidth: 140,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  paddingRight: 24,
}

function VencimientosFilter({ detalle }: { detalle: VencDet[] }) {
  const monedas = Array.from(new Set(detalle.map(d => d.moneda))).sort()
  const tipos   = Array.from(new Set(detalle.map(d => d.tipo))).sort()
  const acTipos = Array.from(new Set(detalle.map(d => d.acreedor_tipo))).sort()

  const [fMoneda,   setFMoneda]   = useState("")
  const [fTipo,     setFTipo]     = useState("")
  const [fAcTipo,   setFAcTipo]   = useState("")
  const [fAcreedor, setFAcreedor] = useState("")

  const filtrado = detalle.filter(d =>
    (!fMoneda   || d.moneda        === fMoneda)   &&
    (!fTipo     || d.tipo          === fTipo)     &&
    (!fAcTipo   || d.acreedor_tipo === fAcTipo)   &&
    (!fAcreedor || d.acreedor      === fAcreedor)
  )

  const acreedores = Array.from(new Set(
    detalle
      .filter(d =>
        (!fMoneda || d.moneda        === fMoneda) &&
        (!fTipo   || d.tipo          === fTipo)   &&
        (!fAcTipo || d.acreedor_tipo === fAcTipo)
      )
      .map(d => d.acreedor)
  )).sort()

  const anos = Array.from(new Set(filtrado.map(d => d.anio))).sort()
  const tiposActivos = Array.from(new Set(filtrado.map(d => d.tipo))).sort()
  const barData = anos.map(anio => {
    const row: Record<string, number | string> = { anio }
    for (const tipo of tiposActivos) {
      row[tipo] = Math.round(filtrado.filter(d => d.anio === anio && d.tipo === tipo).reduce((s, d) => s + d.monto, 0))
    }
    row["total"] = Math.round(filtrado.filter(d => d.anio === anio).reduce((s, d) => s + d.monto, 0))
    return row
  })

  const isFiltered = !!(fMoneda || fTipo || fAcTipo || fAcreedor)

  const resetAll = () => { setFMoneda(""); setFTipo(""); setFAcTipo(""); setFAcreedor("") }

  return (
    <div style={{ padding: "10px 14px" }}>
      {/* Header + filters in one compact bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, whiteSpace: "nowrap", fontFamily: "monospace" }}>
          VENCIMIENTOS PRÓXIMOS
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Moneda */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "#555", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Moneda</span>
            <select style={{ ...dropStyle, borderColor: fMoneda ? "#FFA028" : "#2a2a2a" }}
              value={fMoneda} onChange={e => setFMoneda(e.target.value)}>
              <option value="">Todas</option>
              {monedas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Tipo deuda */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "#555", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Tipo</span>
            <select style={{ ...dropStyle, borderColor: fTipo ? "#FFA028" : "#2a2a2a" }}
              value={fTipo} onChange={e => { setFTipo(e.target.value); setFAcreedor("") }}>
              <option value="">Todos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Acreedor tipo */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "#555", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Sector</span>
            <select style={{ ...dropStyle, borderColor: fAcTipo ? "#FFA028" : "#2a2a2a" }}
              value={fAcTipo} onChange={e => { setFAcTipo(e.target.value); setFAcreedor("") }}>
              <option value="">Todos</option>
              {acTipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Acreedor específico */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8, color: "#555", letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>Acreedor</span>
            <select style={{ ...dropStyle, minWidth: 180, borderColor: fAcreedor ? "#FFA028" : "#2a2a2a" }}
              value={fAcreedor} onChange={e => setFAcreedor(e.target.value)}>
              <option value="">Todos</option>
              {acreedores.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Reset */}
          {isFiltered && (
            <button onClick={resetAll} style={{ background: "transparent", border: "1px solid #333", color: "#666", borderRadius: 2, padding: "4px 10px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>
              ✕ Reset
            </button>
          )}
        </div>

        {/* Total chip */}
        {isFiltered && (
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#FF433D", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
            Total: USD {fmtNum(filtrado.reduce((s, d) => s + d.monto, 0), 0)}M
          </div>
        )}
      </div>

      {/* Stacked bar chart */}
      {barData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" vertical={false} />
            <XAxis dataKey="anio" stroke="#333" fontSize={9} tick={{ fill: "#888" }} />
            <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${Math.round(v / 1000)}B`} />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, fontFamily: "monospace" }}
              formatter={(v: unknown, name: unknown) => [`USD ${fmtNum(v as number, 0)}M`, String(name)]}
            />
            {tiposActivos.map(tipo => (
              <Bar key={tipo} dataKey={tipo} stackId="a" fill={TIPO_COLORS[tipo] ?? "#888"} radius={tipo === tiposActivos[tiposActivos.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ padding: 20, color: "#555", textAlign: "center", fontSize: 11 }}>Sin datos para la selección</div>
      )}

      {/* Totals below each bar — alineados con el área del chart (left margin = 0, right = 12) */}
      <div style={{ display: "flex", paddingLeft: 42, paddingRight: 12, marginTop: 2 }}>
        {barData.map(r => (
          <div key={r.anio as string} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#FF433D", fontFamily: "monospace" }}>
            {fmtNum(r["total"] as number, 0)}M
          </div>
        ))}
      </div>

      {/* Legend — debajo, centrada */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 8 }}>
        {tiposActivos.map(tipo => (
          <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, background: TIPO_COLORS[tipo] ?? "#888", flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: "#888" }}>{tipo}</span>
          </div>
        ))}
      </div>

      {/* Breakdown table — only when filtering by specific acreedor */}
      {isFiltered && filtrado.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 10, borderTop: "1px solid #111", paddingTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "monospace" }}>
            <thead>
              <tr>
                {["Año", "Acreedor", "Tipo", "Moneda", "USD M"].map(h => (
                  <th key={h} style={{ padding: "3px 8px", color: "#555", textAlign: h === "USD M" ? "right" : "left", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid #1a1a1a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtrado].sort((a, b) => a.anio.localeCompare(b.anio) || b.monto - a.monto).map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                  <td style={{ padding: "3px 8px", color: "#888" }}>{d.anio}</td>
                  <td style={{ padding: "3px 8px", color: "#ccc" }}>{d.acreedor}</td>
                  <td style={{ padding: "3px 8px" }}>
                    <span style={{ color: TIPO_COLORS[d.tipo] ?? "#888", background: `${TIPO_COLORS[d.tipo]}18`, padding: "1px 6px", borderRadius: 2 }}>{d.tipo}</span>
                  </td>
                  <td style={{ padding: "3px 8px", color: "#666" }}>{d.moneda}</td>
                  <td style={{ padding: "3px 8px", color: "#FF433D", textAlign: "right", fontWeight: 700 }}>
                    {fmtNum(d.monto, 0)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid #1a1a1a" }}>
                <td colSpan={4} style={{ padding: "4px 8px", color: "#666" }}>Total selección</td>
                <td style={{ padding: "4px 8px", color: "#FF433D", textAlign: "right", fontWeight: 700 }}>
                  {fmtNum(filtrado.reduce((s, d) => s + d.monto, 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 8, color: "#444", marginTop: 8 }}>
        Fuente: Secretaría de Finanzas · USD millones equiv. · Estimaciones indicativas basadas en informes oficiales de deuda
      </div>
    </div>
  )
}

function DeudaView() {
  const [licitaciones, setLicitaciones] = useState<{
    fecha: string; adjudicado_bn: number | null; vencimientos_bn: number | null; rollover_pct: number | null; url: string
  }[] | null>(null)
  const [stock, setStock] = useState<DeudaData | null>(null)
  const [subTab, setSubTab] = useState<"licitaciones" | "stock">("licitaciones")
  const [loadingLic, setLoadingLic] = useState(true)
  const [loadingStock, setLoadingStock] = useState(false)

  useEffect(() => {
    fetch("/api/deuda?n=6")
      .then(r => r.json())
      .then(j => { setLicitaciones(j.data); setLoadingLic(false) })
      .catch(() => setLoadingLic(false))
  }, [])

  useEffect(() => {
    if (subTab === "stock" && !stock) {
      setLoadingStock(true)
      fetch("/api/deuda?endpoint=stock")
        .then(r => r.json())
        .then(j => { setStock(j); setLoadingStock(false) })
        .catch(() => setLoadingStock(false))
    }
  }, [subTab, stock])

  const PIE_COLORS = ["#FFA028", "#4AF6C3", "#4FC3F7", "#CE93D8"]

  return (
    <div>
      <SectionMeta title="Deuda Pública" help="Stock y estructura de la deuda del Estado Nacional. Incluye deuda con FMI, bonistas externos, organismos multilaterales (BID, CAF, BM) y sector público. Las licitaciones muestran las colocaciones de deuda en el mercado local." source="Ministerio de Economía" />
      <SubTabs tabs={[
        { key: "licitaciones", label: "Licitaciones" },
        { key: "stock",        label: "Stock & Composición" },
      ]} active={subTab} onChange={k => setSubTab(k as "licitaciones" | "stock")} />

      {subTab === "licitaciones" && (
        loadingLic
          ? <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando licitaciones...</div>
          : (
            <div style={{ padding: "8px 12px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #222" }}>
                    {["Fecha", "Adjudicado (B$)", "Vencimientos (B$)", "Rollover %"].map(h => (
                      <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: "right", fontWeight: 400, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(licitaciones ?? []).map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 8px", color: "#666" }}>{r.fecha}</td>
                      <td style={{ padding: "3px 8px", color: "#FFA028", textAlign: "right" }}>
                        {r.adjudicado_bn != null ? fmtNum(r.adjudicado_bn, 1) : "—"}
                      </td>
                      <td style={{ padding: "3px 8px", color: "#4FC3F7", textAlign: "right" }}>
                        {r.vencimientos_bn != null ? fmtNum(r.vencimientos_bn, 1) : "—"}
                      </td>
                      <td style={{ padding: "3px 8px", textAlign: "right",
                        color: r.rollover_pct != null ? (r.rollover_pct >= 100 ? "#4AF6C3" : "#FF433D") : "#555",
                        fontWeight: 700 }}>
                        {r.rollover_pct != null ? `${fmtNum(r.rollover_pct, 1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
                Fuente: argentina.gob.ar/economia/licitaciones · Rollover &gt;100% = renovación con superávit de deuda
              </div>
            </div>
          )
      )}

      {subTab === "stock" && (
        loadingStock
          ? <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando stock de deuda...</div>
          : stock ? (
            <div>
              <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
                <KPI label="Deuda / PIB"
                  value={stock.data.ultimo.deuda_pib != null ? `${fmtNum(stock.data.ultimo.deuda_pib, 1)}%` : null}
                  unit={`Año ${stock.data.ultimo.anio} · ${stock.data.is_live ? "Datos oficiales" : "Estimación"}`}
                  valueColor={stock.data.ultimo.deuda_pib != null
                    ? (stock.data.ultimo.deuda_pib < 70 ? "#4AF6C3" : stock.data.ultimo.deuda_pib < 90 ? "#FFA028" : "#FF433D")
                    : "#555"} />
              </div>

              {/* Histórico deuda/PIB */}
              {stock.data.historico_pib.length > 0 && (
                <div style={{ padding: "8px 12px 0" }}>
                  <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 4 }}>DEUDA / PIB — EVOLUCIÓN</div>
                  <BBGAreaChart
                    title=""
                    data={stock.data.historico_pib.map(r => ({ date: r.anio + "-01-01", valor: r.deuda_pib }))}
                    areas={[{ key: "valor", name: "Deuda/PIB", color: "#FFA028" }]}
                    height={220}
                    yAxisLabel="%"
                    formatValue={v => `${fmtNum(v, 1)}%`}
                    defaultRange="all"
                  />
                </div>
              )}

              {/* Vencimientos próximos — con filtros */}
              {stock.data.vencimientos_detalle?.length > 0 && (
                <VencimientosFilter detalle={stock.data.vencimientos_detalle} />
              )}

              {/* Composición por acreedor y moneda — PieCharts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, padding: "0 12px 8px" }}>
                {([
                  { title: "Por Acreedor", data: stock.data.composicion_acreedor },
                  { title: "Por Moneda",   data: stock.data.composicion_moneda },
                ] as const).map((section, si) => (
                  <div key={section.title} style={{ background: "#080808", border: "1px solid #111", padding: "12px 16px" }}>
                    <div style={{ fontSize: 8, color: "#FFA028", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" }}>{section.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      {/* Donut fijo 260×260 */}
                      <div style={{ flexShrink: 0, width: 260, height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={section.data.map(d => ({ name: d.nombre, value: d.pct }))}
                              cx="50%" cy="50%"
                              innerRadius="38%" outerRadius="50%"
                              dataKey="value" stroke="none"
                              paddingAngle={2}
                            >
                              {section.data.map((_, ii) => (
                                <Cell key={ii} fill={PIE_COLORS[(si * 4 + ii) % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, fontFamily: "monospace" }}
                              formatter={(v: unknown, name: unknown) => [`${v}%`, String(name)]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div style={{ flex: 1 }}>
                        {section.data.map((item, ii) => (
                          <div key={item.nombre} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 8, height: 8, background: PIE_COLORS[(si * 4 + ii) % PIE_COLORS.length], flexShrink: 0, borderRadius: 1 }} />
                            <div style={{ flex: 1, fontSize: 10, color: "#aaa", lineHeight: 1.3 }}>{item.nombre}</div>
                            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#fff", fontWeight: 700, minWidth: 36, textAlign: "right" }}>{item.pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "4px 12px", fontSize: 8, color: "#333" }}>
                {stock.source}
              </div>
            </div>
          ) : <div style={{ padding: 24, color: "#444", textAlign: "center", fontSize: 11 }}>Sin datos disponibles</div>
      )}
    </div>
  )
}

// ── Señoreaje ──────────────────────────────────────────────────────────────────

type SenorejaAnual = {
  anio: number
  inflacion_anual: number
  mp_promedio: number
  senoraje: number
  senoraje_nominal?: number
  pbi_nominal?: number | null
  senoraje_pct_pbi?: number | null
}
type SenorejaData = {
  serie_anual: SenorejaAnual[]
  estimacion_2026: {
    meses_disponibles: number
    senoraje_parcial: number
    senoraje_estimado_anual: number
    inflacion_parcial: number
  } | null
  params: {
    alpha: number
    k: number
    r2: number
    pi_star: number
    pi_star_pct: number
    s_max: number
  }
  laffer_curve: { pi: number; senoraje: number }[]
}

// Reusable label style for KPI cards
const kpiLabel: React.CSSProperties = { fontSize: 9, color: "#ccc", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }
const kpiUnit:  React.CSSProperties = { fontSize: 9, color: "#bbb", marginTop: 2 }

function SenorejaView() {
  const [data, setData] = useState<SenorejaData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/senoraje")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: "#888", textAlign: "center", fontSize: 11 }}>Cargando señoreaje…</div>
  if (!data) return <div style={{ padding: 40, color: "#888", textAlign: "center", fontSize: 11 }}>Sin datos</div>

  const { serie_anual, estimacion_2026, params, laffer_curve } = data
  const anio2025 = serie_anual.find(r => r.anio === 2025)

  // Observed dots on Laffer curve
  const obsPoints = serie_anual.map(r => ({ pi: Math.round(r.inflacion_anual * 10) / 10, senoraje: r.senoraje, anio: r.anio }))

  // Historical + estimate bar data (with % PBI)
  const hasPbi = serie_anual.some(r => r.senoraje_pct_pbi != null)
  const barData = [
    ...serie_anual.map(r => ({ label: String(r.anio), senoraje: r.senoraje, pct_pbi: r.senoraje_pct_pbi ?? undefined, tipo: "obs" })),
    ...(estimacion_2026 ? [{ label: "2026e", senoraje: estimacion_2026.senoraje_estimado_anual, pct_pbi: undefined, tipo: "est" }] : []),
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPI row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 140px" }}>
          <div style={kpiLabel}>α Cagan estimado</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFA028", fontFamily: "monospace" }}>{fmtNum(params.alpha, 3)}</div>
          <div style={kpiUnit}>semi-elasticidad dinero</div>
          <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>R² = {fmtNum(params.r2, 3)}</div>
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 140px" }}>
          <div style={kpiLabel}>π* óptima (Laffer)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#4AF6C3", fontFamily: "monospace" }}>{fmtNum(params.pi_star_pct, 1)}%</div>
          <div style={kpiUnit}>inflación anual de max señoreaje</div>
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 140px" }}>
          <div style={kpiLabel}>Señoreaje máx. teórico</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#4AF6C3", fontFamily: "monospace" }}>{fmtNum(params.s_max / 1000, 0)}B</div>
          <div style={kpiUnit}>millones ARS reales (base)</div>
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 140px" }}>
          <div style={kpiLabel}>Señoreaje 2025</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: anio2025 ? "#fff" : "#666", fontFamily: "monospace" }}>
            {anio2025 ? fmtNum(anio2025.senoraje / 1000, 0) + "B" : "—"}
          </div>
          <div style={kpiUnit}>
            {anio2025?.senoraje_pct_pbi != null ? `${fmtNum(anio2025.senoraje_pct_pbi, 1)}% del PBI` : "millones ARS reales"}
          </div>
        </div>
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 140px" }}>
          <div style={kpiLabel}>Señoreaje 2026e</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: estimacion_2026 ? "#FFA028" : "#666", fontFamily: "monospace" }}>
            {estimacion_2026 ? fmtNum(estimacion_2026.senoraje_estimado_anual / 1000, 0) + "B" : "—"}
          </div>
          <div style={kpiUnit}>
            {estimacion_2026 ? `estimado · ${estimacion_2026.meses_disponibles} meses disp.` : "sin datos"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
        {/* Señoreaje histórico anual */}
        <div style={{ background: "#050505", padding: 16 }}>
          <div style={{ fontSize: 10, color: "#ccc", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Señoreaje Anual Histórico
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={barData} margin={{ top: 8, right: hasPbi ? 44 : 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111" />
              <XAxis dataKey="label" stroke="#333" fontSize={9} tick={{ fill: "#888" }} />
              <YAxis yAxisId="left" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${Math.round(v / 1000)}B`} />
              {hasPbi && <YAxis yAxisId="right" orientation="right" stroke="#FFA028" fontSize={9} tick={{ fill: "#FFA028" }} tickFormatter={v => `${v}%`} domain={[0, "auto"]} />}
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, color: "#fff" }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#aaa" }}
                formatter={(v: unknown, name: unknown) => {
                  if (name === "pct_pbi") return [`${fmtNum(v as number, 2)}% del PBI`, "% PBI"]
                  return [`${fmtNum((v as number) / 1000, 1)}B ARS reales`, "Señoreaje"]
                }}
              />
              <ReferenceLine yAxisId="left" y={params.s_max} stroke="#FFA028" strokeDasharray="4 4" label={{ value: "S máx", fill: "#FFA028", fontSize: 9, position: "right" }} />
              <Bar yAxisId="left" dataKey="senoraje" radius={[2, 2, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.tipo === "est" ? "#FFA028" : "#4AF6C3"} opacity={d.tipo === "est" ? 0.7 : 0.85} />
                ))}
              </Bar>
              {hasPbi && <Line yAxisId="right" type="monotone" dataKey="pct_pbi" stroke="#FFA028" strokeWidth={2} dot={{ r: 3, fill: "#FFA028" }} isAnimationActive={false} connectNulls />}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#bbb", marginTop: 4 }}>Naranja = estimado 2026 · línea punteada = S máx teórico{hasPbi ? " · línea continua naranja = % del PBI" : ""}</div>
        </div>

        {/* Curva de Laffer */}
        <div style={{ background: "#050505", padding: 16 }}>
          <div style={{ fontSize: 10, color: "#ccc", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Curva de Laffer Monetaria
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111" />
              <XAxis
                dataKey="pi"
                type="number"
                domain={[0, 500]}
                stroke="#333"
                fontSize={9}
                tick={{ fill: "#888" }}
                tickFormatter={v => `${v}%`}
                label={{ value: "Inflación anual (%)", fill: "#888", fontSize: 8, position: "insideBottom", offset: -2 }}
              />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${Math.round(v / 1000)}B`} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, color: "#fff" }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#aaa" }}
                formatter={(v: unknown, name: unknown) => [
                  name === "senoraje" ? `${fmtNum((v as number) / 1000, 1)}B ARS reales` : `${fmtNum(v as number, 0)}% anual`,
                  name === "senoraje" ? "Señoreaje teórico" : "Señoreaje obs.",
                ]}
                labelFormatter={v => `π = ${v}%`}
              />
              <ReferenceLine x={params.pi_star_pct} stroke="#FFA028" strokeDasharray="4 4"
                label={{ value: `π*=${fmtNum(params.pi_star_pct, 0)}%`, fill: "#FFA028", fontSize: 9, position: "insideTopRight" }}
              />
              {/* Theoretical Laffer line */}
              <Line data={laffer_curve} type="monotone" dataKey="senoraje" dot={false}
                stroke="#4AF6C3" strokeWidth={2} isAnimationActive={false} />
              {/* Observed annual dots */}
              <Line
                data={obsPoints}
                type="linear"
                dataKey="senoraje"
                dot={{ r: 4, fill: "#FFA028", stroke: "#FFA028" }}
                stroke="none"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#bbb", marginTop: 4 }}>
            Curva teórica Cagan · Puntos naranjas = observaciones anuales · π* = inflación de recaudación máxima
          </div>
        </div>

        {/* Saldos reales M/P */}
        <div style={{ background: "#050505", padding: 16 }}>
          <div style={{ fontSize: 10, color: "#ccc", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Saldos Reales M/P (Base Monetaria)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={serie_anual} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="gradMP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4AF6C3" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4AF6C3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#111" />
              <XAxis dataKey="anio" stroke="#333" fontSize={9} tick={{ fill: "#888" }} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${Math.round(v / 1000)}B`} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, color: "#fff" }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#aaa" }}
                formatter={(v: unknown) => [`${fmtNum((v as number) / 1000, 1)}B ARS reales`, "M/P promedio anual"]}
              />
              <Area type="monotone" dataKey="mp_promedio" stroke="#4AF6C3" strokeWidth={2} fill="url(#gradMP)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#bbb", marginTop: 4 }}>Saldos monetarios reales anualizados · base período inicial</div>
        </div>

        {/* Inflación anual observada */}
        <div style={{ background: "#050505", padding: 16 }}>
          <div style={{ fontSize: 10, color: "#ccc", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            Inflación Anual Observada
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={serie_anual} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111" />
              <XAxis dataKey="anio" stroke="#333" fontSize={9} tick={{ fill: "#888" }} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 10, color: "#fff" }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#aaa" }}
                formatter={(v: unknown) => [`${fmtNum(v as number, 1)}%`, "Inflación anual"]}
              />
              <ReferenceLine y={params.pi_star_pct} stroke="#FFA028" strokeDasharray="4 4"
                label={{ value: `π*`, fill: "#FFA028", fontSize: 9, position: "right" }}
              />
              <Bar dataKey="inflacion_anual" fill="#FF6B6B" radius={[2, 2, 0, 0]} opacity={0.8} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#bbb", marginTop: 4 }}>Línea naranja = π* (inflación de máximo señoreaje teórico)</div>
        </div>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111" }}>
        Modelo Cagan (1956) · α estimado por MCO sobre datos anuales de saldos reales e inflación ·
        Señoreaje = π × (M/P) · Fuente: BCRA API v4.0 (Var 15 Base Monetaria) · datos.gob.ar IPC mensual · World Bank (PBI nominal ARS)
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const MACRO_TABS = [
  { key: "emae",        label: "EMAE"             },
  { key: "ipc",         label: "IPC"              },
  { key: "balanza",     label: "Balanza Comercial" },
  { key: "fiscal",      label: "Fiscal"           },
  { key: "desigualdad", label: "Desigualdad"      },
  { key: "piramides",   label: "Pirámides"        },
  { key: "fx",          label: "FX"               },
  { key: "bigmac",      label: "Big Mac Index"    },
  { key: "riesgo",      label: "Riesgo País"      },
  { key: "deuda",       label: "Deuda Pública"    },
  { key: "senoraje",   label: "Señoreaje"        },
]

export function TabMacro({ initialSubtab }: { initialSubtab?: string | null }) {
  const [activeTab, setActiveTab] = useState(initialSubtab ?? "emae")

  return (
    <div>
      <SubTabs tabs={MACRO_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "emae"        && <EmaeView />}
      {activeTab === "ipc"         && <IpcView />}
      {activeTab === "balanza"     && <BalanzaView />}
      {activeTab === "fiscal"      && <FiscalSankeyView />}
      {activeTab === "desigualdad" && <DesigualdadView />}
      {activeTab === "piramides"   && <PiramidesView />}
      {activeTab === "fx"          && <FXView />}
      {activeTab === "bigmac"      && <BigMacView />}
      {activeTab === "riesgo"      && <RiesgoPaisView />}
      {activeTab === "deuda"       && <DeudaView />}
      {activeTab === "senoraje"    && <SenorejaView />}
    </div>
  )
}
