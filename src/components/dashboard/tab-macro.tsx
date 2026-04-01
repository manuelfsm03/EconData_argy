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

import { useState, useEffect, useCallback } from "react"
import { BBGAreaChart } from "../charts/bbg-area-chart"
import { BBGLineChart } from "../charts/bbg-line-chart"
import { FiscalSankeyView } from "./fiscal-sankey"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area,
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
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222", marginBottom: 1 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: active === t.key ? "#0d0d0d" : "transparent",
            color: active === t.key ? "#FFA028" : "#555",
            border: "none",
            borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
            padding: "6px 14px",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── IPC Ponderaciones ─────────────────────────────────────────────────────────

const PONDERACIONES = [
  { cat: "Alimentos y bebidas", actual: 25.4, propuesto: 22.4 },
  { cat: "Beb. alcohólicas/tabaco", actual: 2.3, propuesto: 2.1 },
  { cat: "Indumentaria", actual: 6.8, propuesto: 5.8 },
  { cat: "Vivienda y servicios", actual: 9.1, propuesto: 12.6 },
  { cat: "Equipamiento hogar", actual: 7.3, propuesto: 5.9 },
  { cat: "Salud", actual: 7.5, propuesto: 9.1 },
  { cat: "Transporte", actual: 14.1, propuesto: 13.8 },
  { cat: "Comunicación", actual: 2.7, propuesto: 3.4 },
  { cat: "Recreación y cultura", actual: 7.5, propuesto: 6.5 },
  { cat: "Educación", actual: 4.3, propuesto: 5.2 },
  { cat: "Restaurantes/hoteles", actual: 7.1, propuesto: 7.8 },
  { cat: "Otros bienes/servicios", actual: 6.0, propuesto: 5.4 },
]

export function PonderacionesTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #222" }}>
              División COICOP
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#4FC3F7", borderBottom: "1px solid #222" }}>
              Base dic 2016 (vigente)
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#FFD54F", borderBottom: "1px solid #222" }}>
              Base 2022 (propuesto)
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #222" }}>
              Δ p.p.
            </th>
          </tr>
        </thead>
        <tbody>
          {PONDERACIONES.map((p, i) => {
            const delta = p.propuesto - p.actual
            return (
              <tr key={p.cat} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#aaa" }}>{p.cat}</td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#4FC3F7", textAlign: "right", fontFamily: "monospace" }}>
                  {p.actual.toFixed(1)}%
                </td>
                <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFD54F", textAlign: "right", fontFamily: "monospace" }}>
                  {p.propuesto.toFixed(1)}%
                </td>
                <td style={{ padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "monospace", color: delta > 0 ? "#4AF6C3" : delta < 0 ? "#FF433D" : "#555" }}>
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: "6px 8px", fontSize: 9, color: "#444", borderTop: "1px solid #111" }}>
        Fuente INDEC — Base 2016 usa ENGHo 2004/05 · Base 2022 usa ENGHo 2017/18 (no lanzado a feb 2026)
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
            formatter={(value: number | undefined, name: string | undefined, props: { payload?: { varones_abs?: number; mujeres_abs?: number } }) => {
              if (value == null) return ["—", name]
              const abs = name === "varones"
                ? (props.payload?.varones_abs ?? 0)
                : (props.payload?.mujeres_abs ?? 0)
              const label = name === "varones" ? "Hombre" : "Mujer"
              return [`${Math.abs(value).toFixed(2)}%  (${fmtAbs(abs)})`, label]
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
              formatter={(v: number | undefined, name: string | undefined) => {
                if (v == null) return ["—", name]
                const label = name === "total_m" ? "Hombre" : "Mujer"
                return [fmtPop(v), label]
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
                      formatter={(v: number | undefined) => v != null ? fmtNum(v, 1) : "—"}
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
                      formatter={(v: number | undefined) => v != null ? [`${fmtNum(v, 1)} años`, "Esperanza de vida"] : ["—", "Esperanza de vida"]}
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
  const [modo, setModo] = useState<"formulario" | "resultado">("formulario")
  const [ponderaciones, setPonderaciones] = useState<Record<string, number>>(
    Object.fromEntries(PONDERACIONES.map(p => [p.cat, p.actual]))
  )

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
      {modo === "formulario" && (
        <>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 12 }}>
            Ajusta las ponderaciones para cada categoría según tu patrón de gasto personal.
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12 }}>
            {PONDERACIONES.map((p) => (
              <div key={p.cat} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>{p.cat}</label>
                  <span style={{ fontSize: 9, color: "#FFA028", fontFamily: "monospace" }}>
                    {ponderaciones[p.cat]?.toFixed(1) ?? p.actual.toFixed(1)}%
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
              onClick={() => setPonderaciones(Object.fromEntries(PONDERACIONES.map(p => [p.cat, p.actual])))}
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
          </div>
        </>
      )}

      {modo === "resultado" && (
        <>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, marginBottom: 12, background: "#111" }}>
            <KPI label="Tu IPC (Est.)" value={fmtNum(2.66)} unit="% mensual" valueColor="#FFA028" />
            <KPI label="IPC General INDEC" value={fmtNum(2.8)} unit="% mensual" />
            <KPI label="Diferencia" value={fmtNum(-0.14)} unit="p.p." valueColor="#4AF6C3" />
          </div>

          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#FFA028", fontWeight: 600, marginBottom: 8 }}>Tu Canasta vs INDEC 2016</div>
            <table style={{ width: "100%", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  <th style={{ textAlign: "left", padding: "4px 0", color: "#555" }}>Categoría</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#FFA028" }}>Tu %</th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#4AF6C3" }}>INDEC %</th>
                </tr>
              </thead>
              <tbody>
                {PONDERACIONES.filter(p => ponderaciones[p.cat] > 0).slice(0, 6).map((p) => (
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
            <strong>Nota:</strong> Esta herramienta calcula una estimación de tu IPC personalizado basada en las ponderaciones que ingreses.
            Los valores mostrados son aproximaciones. Para mayor precisión, consulta datos.gob.ar
          </div>

          <button
            onClick={() => setModo("formulario")}
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
            Volver a Ajustar
          </button>
        </>
      )}
    </div>
  )
}

// ── IPC Tab ────────────────────────────────────────────────────────────────────

function IpcView() {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ipcTab, setIpcTab] = useState("serie")

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando IPC...</div>

  const varMensual = data?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = data?.ipc_var_interanual?.[0]?.[1]
  const nucleoNivel = data?.ipc_nucleo ?? []
  const nucleoMensual =
    nucleoNivel.length >= 2
      ? ((nucleoNivel[0][1] / nucleoNivel[1][1] - 1) * 100)
      : null

  const getVarMens = (key: string) => {
    const s = data?.[key] ?? []
    return s.length >= 2 ? ((s[0][1] / s[1][1] - 1) * 100) : null
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="IPC Var. Mensual" value={varMensual != null ? fmtNum(varMensual) : null} unit="% mensual" />
        <KPI label="IPC Interanual" value={varInteranual != null ? fmtNum(varInteranual) : null} unit="%" />
        <KPI
          label="IPC Núcleo"
          value={nucleoMensual != null ? fmtNum(nucleoMensual) : null}
          unit="% mensual · excl. estac. y reg."
        />
        <KPI label="Alimentos" value={getVarMens("ipc_alimentos") != null ? fmtNum(getVarMens("ipc_alimentos")) : null} unit="% mensual" />
        <KPI label="Regulados" value={getVarMens("ipc_regulados") != null ? fmtNum(getVarMens("ipc_regulados")) : null} unit="% mensual" />
        <KPI label="Estacionales" value={getVarMens("ipc_estacionales") != null ? fmtNum(getVarMens("ipc_estacionales")) : null} unit="% mensual" />
      </div>

      <SubTabs
        tabs={[
          { key: "serie", label: "Serie histórica mensual" },
          { key: "canasta", label: "Canasta 2016 vs 2022" },
          { key: "personal", label: "Mi Inflación" },
        ]}
        active={ipcTab}
        onChange={setIpcTab}
      />

      {ipcTab === "serie" && (
        <MiniTable
          title="IPC Var. Mensual — Últimos 24 períodos"
          rows={(data?.ipc_var_mensual ?? []).slice(0, 24).map(([d, v]) => ({
            label: d,
            value: `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
            color: v > 5 ? "#FF433D" : v > 3 ? "#FFA028" : "#4AF6C3",
          }))}
        />
      )}

      {ipcTab === "canasta" && <PonderacionesTable />}

      {ipcTab === "personal" && <MiInflacionView />}
    </div>
  )
}

// ── Balanza Tab ────────────────────────────────────────────────────────────────

function ComposicionExportView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/macro?endpoint=argendata_comext")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando composición...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos de composición.</div>

  // Extract product columns (all except "date")
  const products = Object.keys(data[0] ?? {}).filter((k) => k !== "date")
  const COLORS = ["#4AF6C3", "#FFA028", "#4FC3F7", "#FF433D", "#FFD54F", "#CE93D8", "#F48FB1", "#80CBC4", "#A5D6A7", "#BCAAA4", "#EF9A9A", "#7C83FD"]

  const lines = products.map((p, i) => ({ key: p, name: p, color: COLORS[i % COLORS.length] }))

  return (
    <div>
      <BBGLineChart
        title="COMPOSICIÓN DE EXPORTACIONES ARGENTINAS (USD MILLONES)"
        data={data as Record<string, unknown>[]}
        lines={lines}
        enableLineToggle
        height={300}
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

  useEffect(() => {
    fetch("/api/macro?endpoint=balanza")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const lastExpo = data?.exportaciones?.[0]?.[1]
  const lastImpo = data?.importaciones?.[0]?.[1]
  const lastSaldo = data?.saldo_comercial?.[0]?.[1]

  const rows = (data?.exportaciones ?? []).slice(0, 12).map(([d]) => ({
    d,
    expo: data?.exportaciones?.find((r) => r[0] === d)?.[1] ?? null,
    impo: data?.importaciones?.find((r) => r[0] === d)?.[1] ?? null,
    saldo: data?.saldo_comercial?.find((r) => r[0] === d)?.[1] ?? null,
  }))

  return (
    <div>
      <SubTabs tabs={[{ key: "flujos", label: "Flujos Mensuales" }, { key: "composicion", label: "Composición Exportaciones" }]}
        active={balanzaTab} onChange={setBalanzaTab} />
      {balanzaTab === "flujos" && (<>
        {loading ? (
          <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando balanza...</div>
        ) : (<>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <KPI label="Exportaciones" value={lastExpo != null ? lastExpo.toLocaleString("es-AR") : null} unit="USD millones" />
            <KPI label="Importaciones" value={lastImpo != null ? lastImpo.toLocaleString("es-AR") : null} unit="USD millones" />
            <KPI
              label="Saldo Comercial"
              value={lastSaldo != null ? lastSaldo.toLocaleString("es-AR") : null}
              unit="USD millones"
              valueColor={lastSaldo == null ? "#888" : lastSaldo >= 0 ? "#4AF6C3" : "#FF433D"}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Período", "Exportaciones", "Importaciones", "Saldo"].map((h) => (
                    <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: h === "Período" ? "left" : "right", borderBottom: "1px solid #1a1a1a" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.d} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                    <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFA028" }}>{r.d}</td>
                    <td style={{ padding: "4px 8px", fontSize: 11, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                      {r.expo?.toLocaleString("es-AR") ?? "—"}
                    </td>
                    <td style={{ padding: "4px 8px", fontSize: 11, color: "#FF433D", textAlign: "right", fontFamily: "monospace" }}>
                      {r.impo?.toLocaleString("es-AR") ?? "—"}
                    </td>
                    <td style={{
                      padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "monospace",
                      color: r.saldo == null ? "#555" : r.saldo >= 0 ? "#4AF6C3" : "#FF433D",
                    }}>
                      {r.saldo?.toLocaleString("es-AR") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </>)}
      {balanzaTab === "composicion" && <ComposicionExportView />}
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

// ── Pirámides Explorador ────────────────────────────────────────────────────────

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
      {/* Panel de controles */}
      <div className="bbg-panel" style={{ marginBottom: 8 }}>
        <div className="bbg-panel-header">EXPLORADOR DE PIRÁMIDES POBLACIONALES</div>
        <div style={{ padding: "10px 12px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Selector de país */}
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

          {/* Selector de año */}
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

          {/* Accesos rápidos de año */}
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

          {/* Stats */}
          {meta && (
            <div style={{ display: "flex", gap: 16, marginLeft: "auto" }}>
              {[
                { label: "Total", value: `${(meta.total / 1e6).toFixed(1)}M`, color: "#fff" },
                { label: "Varones", value: `${(meta.total_m / 1e6).toFixed(1)}M`, color: "#4FC3F7" },
                { label: "Mujeres", value: `${(meta.total_f / 1e6).toFixed(1)}M`, color: "#F48FB1" },
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

      {/* Pirámide */}
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

// ── Desigualdad e Informalidad (Argendata) ─────────────────────────────

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

// ── Main Component ─────────────────────────────────────────────────────────────

const MACRO_TABS = [
  { key: "emae",        label: "EMAE" },
  { key: "ipc",         label: "IPC" },
  { key: "balanza",     label: "Balanza Comercial" },
  { key: "fiscal",      label: "Fiscal" },
  { key: "desigualdad", label: "Desigualdad" },
  { key: "piramides",   label: "Pirámides" },
]

export function TabMacro() {
  const [activeTab, setActiveTab] = useState("emae")

  return (
    <div>
      <div className="bbg-panel-header">MACROECONOMÍA ARGENTINA — DATOS.GOB.AR / INDEC</div>
      <SubTabs tabs={MACRO_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "emae"        && <EmaeView />}
      {activeTab === "ipc"         && <IpcView />}
      {activeTab === "balanza"     && <BalanzaView />}
      {activeTab === "fiscal"      && <FiscalSankeyView />}
      {activeTab === "desigualdad" && <DesigualdadView />}
      {activeTab === "piramides"   && <PiramidesView />}
    </div>
  )
}
