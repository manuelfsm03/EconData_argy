"use client"

import { useState, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: string): string {
  // d puede ser "2024-03-15" o "15/03/2024"
  if (!d) return ""
  if (d.includes("/")) return d
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y.slice(2)}`
}

// ── Sub-componentes reutilizables ──────────────────────────────────────────────

interface KPIProps {
  label: string
  value: string | null
  unit?: string
  valueColor?: string
}
function KPI({ label, value, unit, valueColor = "#fff" }: KPIProps) {
  return (
    <div style={{
      flex: "1 1 160px", padding: "10px 14px", background: "#080808",
      border: "1px solid #111", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, fontFamily: "monospace", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      {unit && (
        <div style={{ fontSize: 8, color: "#444", fontFamily: "monospace" }}>{unit}</div>
      )}
    </div>
  )
}

interface SubTabsProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (k: string) => void
}
function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #111", background: "#060606", paddingLeft: 8 }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: "none", border: "none",
            borderBottom: active === t.key ? "2px solid #4AF6C3" : "2px solid transparent",
            cursor: "pointer", padding: "7px 14px",
            fontSize: 10, fontFamily: "monospace", color: active === t.key ? "#4AF6C3" : "#555",
            letterSpacing: 1, textTransform: "uppercase" as const,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

const BCRA_TABS = [
  { key: "plazofijo", label: "Plazo Fijo"   },
  { key: "agregados", label: "Agregados"    },
  { key: "reservas",  label: "Reservas"     },
  { key: "compras",   label: "Compras BCRA" },
]

// ── Tipos de datos BCRA ────────────────────────────────────────────────────────

interface BCRAVariable {
  fecha: string
  valor: number
}

// ── Plazo Fijo ─────────────────────────────────────────────────────────────────

interface PlazoFijoData {
  badlar:   BCRAVariable[]
  tm20:     BCRAVariable[]
  tpm:      BCRAVariable[]
  pf30:     BCRAVariable[]
}

function PlazoFijoView() {
  const [data, setData] = useState<PlazoFijoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=plazofijo")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando tasas...</div>

  const badlarUlt = data?.badlar?.at(-1)?.valor
  const tm20Ult   = data?.tm20?.at(-1)?.valor
  const tpmUlt    = data?.tpm?.at(-1)?.valor
  const pf30Ult   = data?.pf30?.at(-1)?.valor

  // Merge histórico para el gráfico
  const chartData = (() => {
    if (!data) return []
    const m = new Map<string, Record<string, number>>()
    const add = (arr: BCRAVariable[], key: string) => {
      for (const r of arr) {
        const e = m.get(r.fecha) ?? {}
        m.set(r.fecha, { ...e, [key]: r.valor })
      }
    }
    add(data.badlar, "BADLAR")
    add(data.tpm,    "TPM")
    add(data.pf30,   "PF30")
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => ({ fecha, ...vals }))
      .slice(-96) // últimos 96 puntos
  })()

  const tableSrc = data?.badlar?.slice(-12).reverse() ?? []

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="BADLAR"           value={badlarUlt != null ? `${fmtNum(badlarUlt, 2)}%` : null} unit="Tasa nominales anual (TNA)" valueColor="#FFA028" />
        <KPI label="TM20"             value={tm20Ult   != null ? `${fmtNum(tm20Ult, 2)}%` : null}   unit="Tasa nominales anual (TNA)" valueColor="#4AF6C3" />
        <KPI label="Tasa Política M." value={tpmUlt    != null ? `${fmtNum(tpmUlt, 2)}%` : null}    unit="BCRA — referencia monetaria" valueColor="#4FC3F7" />
        <KPI label="PF 30d (TNA)"     value={pf30Ult   != null ? `${fmtNum(pf30Ult, 2)}%` : null}   unit="Promedio depósitos 30 días"  valueColor="#CE93D8" />
      </div>

      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 4 }}>EVOLUCIÓN — TASAS BCRA</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#111" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
              formatter={(value: unknown) => [`${fmtNum(value as number, 2)}%`]}
            />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
            <Area type="monotone" dataKey="BADLAR" stroke="#FFA028" fill="#FFA02820" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="TPM"    stroke="#4FC3F7" fill="#4FC3F720" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="PF30"   stroke="#CE93D8" fill="#CE93D820" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {tableSrc.length > 0 && (
        <div style={{ padding: "10px 12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Fecha", "BADLAR", "TPM", "PF30"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: "right", fontWeight: 400, letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableSrc.map(r => (
                <tr key={r.fecha} style={{ borderBottom: "1px solid #0d0d0d" }}>
                  <td style={{ padding: "3px 8px", color: "#666" }}>{fmtDate(r.fecha)}</td>
                  <td style={{ padding: "3px 8px", color: "#FFA028", textAlign: "right" }}>{fmtNum(r.valor, 2)}%</td>
                  <td style={{ padding: "3px 8px", color: "#4FC3F7", textAlign: "right" }}>
                    {data?.tpm?.find(x => x.fecha === r.fecha)?.valor != null
                      ? `${fmtNum(data!.tpm.find(x => x.fecha === r.fecha)!.valor, 2)}%`
                      : "—"}
                  </td>
                  <td style={{ padding: "3px 8px", color: "#CE93D8", textAlign: "right" }}>
                    {data?.pf30?.find(x => x.fecha === r.fecha)?.valor != null
                      ? `${fmtNum(data!.pf30.find(x => x.fecha === r.fecha)!.valor, 2)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Fuente: BCRA API (api.bcra.gob.ar) · Variables 7 (BADLAR), 8 (TM20), 6 (TPM) · TNA
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agregados Monetarios ───────────────────────────────────────────────────────

interface AgregadosData {
  base:        BCRAVariable[]
  circulacion: BCRAVariable[]
  m1:          BCRAVariable[]
  m2:          BCRAVariable[]
}

function AgregadosView() {
  const [data, setData] = useState<AgregadosData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=agregados")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando agregados monetarios...</div>

  const baseUlt = data?.base?.at(-1)?.valor
  const circUlt = data?.circulacion?.at(-1)?.valor
  const m1Ult   = data?.m1?.at(-1)?.valor
  const m2Ult   = data?.m2?.at(-1)?.valor

  // Variación interanual
  const iaBase = (() => {
    if (!data?.base || data.base.length < 13) return null
    const curr = data.base.at(-1)!.valor
    const prev = data.base.at(-13)!.valor
    return ((curr / prev) - 1) * 100
  })()

  const chartData = (() => {
    if (!data) return []
    const m = new Map<string, Record<string, number>>()
    const add = (arr: BCRAVariable[], key: string) => {
      for (const r of arr) {
        const e = m.get(r.fecha) ?? {}
        m.set(r.fecha, { ...e, [key]: r.valor / 1e6 }) // miles de mill → billones
      }
    }
    add(data.base,        "Base")
    add(data.circulacion, "Circulación")
    add(data.m1,          "M1")
    add(data.m2,          "M2")
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => ({ fecha, ...vals }))
      .slice(-36)
  })()

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Base Monetaria" value={baseUlt != null ? `$${fmtNum(baseUlt / 1e9, 1)}B` : null}
          unit={iaBase != null ? `i.a.: ${iaBase >= 0 ? "+" : ""}${fmtNum(iaBase, 1)}%` : "Miles de mill. ARS"}
          valueColor={iaBase != null ? (iaBase < 100 ? "#4AF6C3" : "#FFA028") : "#FFA028"} />
        <KPI label="Circulación"    value={circUlt != null ? `$${fmtNum(circUlt / 1e9, 1)}B` : null} unit="Miles de mill. ARS" valueColor="#4AF6C3" />
        <KPI label="M1"             value={m1Ult   != null ? `$${fmtNum(m1Ult   / 1e9, 1)}B` : null} unit="Circulación + Cta corriente" valueColor="#4FC3F7" />
        <KPI label="M2"             value={m2Ult   != null ? `$${fmtNum(m2Ult   / 1e9, 1)}B` : null} unit="M1 + Caja de ahorro"       valueColor="#CE93D8" />
      </div>

      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 4 }}>AGREGADOS MONETARIOS — ÚLTIMOS 36 MESES (BILLONES ARS)</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#111" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `$${v.toFixed(0)}B`} />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
              formatter={(value: unknown) => [`$${fmtNum(value as number, 2)}B`]}
            />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
            <Area type="monotone" dataKey="Base"        stroke="#FFA028" fill="#FFA02820" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="Circulación" stroke="#4AF6C3" fill="#4AF6C320" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="M1"          stroke="#4FC3F7" fill="#4FC3F720" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="M2"          stroke="#CE93D8" fill="#CE93D820" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
          Fuente: BCRA API · Variables 15 (Base Monetaria), 16 (Circulación), M1, M2 · Miles de millones ARS
        </div>
      </div>
    </div>
  )
}

// ── Reservas Internacionales ───────────────────────────────────────────────────

interface ReservasData {
  brutas:   BCRAVariable[]
  netas:    { fecha: string; brutas: number; netas: number; swap_china: number; encajes: number }[]
  ultima:   { brutas: number; netas: number; fecha: string; var_semanal_brutas: number | null }
}

function ReservasView() {
  const [data, setData] = useState<ReservasData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=reservas")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando reservas...</div>

  const ult = data?.ultima
  const chartData = data?.netas?.slice(-24) ?? []

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Reservas Brutas"
          value={ult?.brutas != null ? `USD ${fmtNum(ult.brutas / 1e9, 2)}B` : null}
          unit={ult?.var_semanal_brutas != null
            ? `Var. semanal: ${ult.var_semanal_brutas >= 0 ? "+" : ""}${fmtNum(ult.var_semanal_brutas, 0)}M`
            : `Fecha: ${ult?.fecha ?? "—"}`}
          valueColor="#FFA028" />
        <KPI label="Reservas Netas"
          value={ult?.netas != null ? `USD ${fmtNum(ult.netas / 1e9, 2)}B` : null}
          unit="Metodología F. Machado"
          valueColor={ult?.netas != null ? (ult.netas >= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="Diferencia (B-N)"
          value={ult?.brutas != null && ult?.netas != null
            ? `USD ${fmtNum((ult.brutas - ult.netas) / 1e9, 2)}B`
            : null}
          unit="Swap China + Encajes + DEGs"
          valueColor="#CE93D8" />
      </div>

      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 4 }}>
            RESERVAS BRUTAS vs. NETAS — ÚLTIMOS 24 MESES (USD millones)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" />
              <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
                tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `${(v / 1e3).toFixed(0)}B`} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
                formatter={(value: unknown) => [`USD ${fmtNum(value as number, 0)}M`]}
              />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
              <Area type="monotone" dataKey="brutas" name="Brutas" stroke="#FFA028" fill="#FFA02815" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="netas"  name="Netas"  stroke="#4AF6C3" fill="#4AF6C315" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Netas = Brutas − Swap China − Encajes USD − DEGs − Repos − Depósitos Gobierno ·
            Fuente: BCRA API + argentinadatos.com · Metodología: Federico Machado
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compras / Ventas BCRA (MULC) ──────────────────────────────────────────────

interface ComprasRow {
  fecha: string
  monto: number  // positivo = compra, negativo = venta
  acumulado_mensual: number
}

interface ComprasData {
  datos: ComprasRow[]
  resumen: {
    mes_actual: number
    acumulado_anual: number
    mayor_compra_periodo: number
    mayor_venta_periodo: number
  }
}

function ComprasView() {
  const [data, setData] = useState<ComprasData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=compras")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando compras/ventas...</div>

  const r = data?.resumen
  const chartData = data?.datos?.slice(-30) ?? []
  const tableData = data?.datos?.slice(-20).reverse() ?? []

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Posición Mes Actual"
          value={r?.mes_actual != null ? `USD ${fmtNum(Math.abs(r.mes_actual), 0)}M` : null}
          unit={r?.mes_actual != null ? (r.mes_actual >= 0 ? "Comprador neto" : "Vendedor neto") : ""}
          valueColor={r?.mes_actual != null ? (r.mes_actual >= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="Acumulado Anual"
          value={r?.acumulado_anual != null ? `USD ${fmtNum(Math.abs(r.acumulado_anual), 0)}M` : null}
          unit={r?.acumulado_anual != null ? (r.acumulado_anual >= 0 ? "Compras netas" : "Ventas netas") : ""}
          valueColor={r?.acumulado_anual != null ? (r.acumulado_anual >= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="Mayor Compra (período)"
          value={r?.mayor_compra_periodo != null ? `USD ${fmtNum(r.mayor_compra_periodo, 0)}M` : null}
          unit="Máxima compra diaria" valueColor="#4AF6C3" />
      </div>

      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, marginBottom: 4 }}>
            COMPRAS / VENTAS BCRA — ÚLTIMAS 30 RUEDAS (USD MILLONES)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" />
              <XAxis dataKey="fecha" tick={{ fontSize: 7, fill: "#555", fontFamily: "monospace" }}
                tickFormatter={d => d?.slice(5) ?? ""} interval={4} />
              <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `${v}M`} />
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
                formatter={(value: unknown) => [`USD ${fmtNum(value as number, 0)}M`]}
              />
              <Bar dataKey="monto" name="Monto"
                fill="#4AF6C3"
                label={false}
                // Color dinámico según signo
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({} as any)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tableData.length > 0 && (
        <div style={{ padding: "10px 12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Fecha", "Monto (USD M)", "Acum. Mensual"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: "right", fontWeight: 400, letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.fecha} style={{ borderBottom: "1px solid #0d0d0d" }}>
                  <td style={{ padding: "3px 8px", color: "#666" }}>{fmtDate(row.fecha)}</td>
                  <td style={{ padding: "3px 8px", textAlign: "right",
                    color: row.monto >= 0 ? "#4AF6C3" : "#FF433D", fontWeight: 700 }}>
                    {row.monto >= 0 ? "+" : ""}{fmtNum(row.monto, 0)}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right",
                    color: row.acumulado_mensual >= 0 ? "#4AF6C3" : "#FF433D" }}>
                    {row.acumulado_mensual >= 0 ? "+" : ""}{fmtNum(row.acumulado_mensual, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Fuente: argentinadatos.com · MULC — Mercado Único y Libre de Cambios · Positivo = BCRA comprador
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TabBCRA() {
  const [activeTab, setActiveTab] = useState("plazofijo")

  return (
    <div>
      <div style={{
        fontSize: 9, color: "#4AF6C3", letterSpacing: 2, fontFamily: "monospace",
        background: "#060606", borderBottom: "1px solid #111",
        padding: "6px 14px", textTransform: "uppercase",
      }}>
        BANCO CENTRAL DE LA REPÚBLICA ARGENTINA
      </div>
      <SubTabs tabs={BCRA_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "plazofijo" && <PlazoFijoView />}
      {activeTab === "agregados" && <AgregadosView />}
      {activeTab === "reservas"  && <ReservasView  />}
      {activeTab === "compras"   && <ComprasView   />}
    </div>
  )
}
