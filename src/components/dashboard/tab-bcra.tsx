"use client"

import { useState, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { BBGLineChart } from "../charts/bbg-line-chart"
import { DownloadCSV } from "../ui/download-csv"
import { ChartDownload } from "../ui/chart-download"
import { SectionMeta } from "../ui/help-tooltip"

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: string): string {
  if (!d) return ""
  if (d.includes("/")) return d
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y.slice(2)}`
}

// ── KPI card ──────────────────────────────────────────────────────────────────

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

// ── Sub-tabs estilo rendimientos.co ──────────────────────────────────────────

const BCRA_TABS = [
  { key: "plazofijo", label: "Plazo Fijo",   icon: "%" },
  { key: "agregados", label: "Agregados",    icon: "Σ" },
  { key: "reservas",  label: "Reservas",     icon: "⬡" },
  { key: "compras",   label: "Compras BCRA", icon: "⇄" },
  { key: "rem",       label: "REM",          icon: "◎" },
]

interface SubTabsProps {
  active: string
  onChange: (k: string) => void
}

function SubTabs({ active, onChange }: SubTabsProps) {
  return (
    <div style={{
      background: "#050505",
      borderBottom: "1px solid #111",
      display: "flex",
      alignItems: "center",
      padding: "10px 14px",
      gap: 6,
      flexWrap: "wrap",
    }}>
      {BCRA_TABS.map(t => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: isActive ? "rgba(255,160,40,0.08)" : "transparent",
              border: isActive ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
              borderRadius: 20,
              cursor: "pointer",
              padding: "5px 14px",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              fontFamily: "monospace",
            }}
          >
            <span style={{
              fontSize: 11,
              color: isActive ? "#FFA028" : "#555",
              fontFamily: "monospace",
              fontWeight: 700,
              lineHeight: 1,
            }}>
              {t.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontFamily: "monospace",
              color: isActive ? "#FFA028" : "#888",
              fontWeight: isActive ? 600 : 400,
              letterSpacing: 0.5,
              textTransform: "uppercase" as const,
            }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Plazo Fijo ─────────────────────────────────────────────────────────────────
// Vars BCRA: 7=BADLAR, 8=TM20, 6=TPM, 12=Tasa depósitos 30d

interface BCRAVar { fecha: string; valor: number }

function PlazoFijoView() {
  const [data, setData] = useState<{ badlar: BCRAVar[]; tm20: BCRAVar[]; tpm: BCRAVar[]; pf30: BCRAVar[] } | null>(null)
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

  const chartData = (() => {
    if (!data) return []
    const m = new Map<string, Record<string, number>>()
    const add = (arr: BCRAVar[], key: string) => {
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
      .slice(-96)
  })()

  const tableSrc = data?.badlar?.slice(-12).reverse() ?? []

  return (
    <div>
      <SectionMeta title="Tasas — Plazo Fijo" help="BADLAR = tasa promedio de depósitos a plazo fijo mayores a $1 millón en bancos privados. Referencia para rendimientos de inversión minorista. TM20 = tasa por depósitos mayores a $20 millones. TPM = Tasa de Política Monetaria del BCRA." source="BCRA API" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="BADLAR Bancos Privados" value={badlarUlt != null ? `${fmtNum(badlarUlt, 2)}%` : null}
          unit="TNA · Var 7 BCRA API" valueColor="#FFA028" />
        <KPI label="TM20 Bancos Privados"   value={tm20Ult   != null ? `${fmtNum(tm20Ult, 2)}%` : null}
          unit="TNA · Var 8 BCRA API" valueColor="#4AF6C3" />
        <KPI label="Tasa de Política Mon."  value={tpmUlt    != null ? `${fmtNum(tpmUlt, 2)}%` : null}
          unit="TPM · Var 6 BCRA API" valueColor="#4FC3F7" />
        <KPI label="Depósitos 30d"          value={pf30Ult   != null ? `${fmtNum(pf30Ult, 2)}%` : null}
          unit="TNA · Var 12 BCRA API" valueColor="#CE93D8" />
      </div>
      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, fontFamily: "monospace" }}>
            EVOLUCIÓN TASAS — ÚLTIMOS 96 REGISTROS
          </div>
          <DownloadCSV data={chartData} filename="tasas-bcra" />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#111" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
              formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`]} />
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
                {["Fecha", "BADLAR", "TPM", "Dep. 30d"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: "right", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableSrc.map(r => {
                const tpmVal  = data?.tpm?.find(x => x.fecha === r.fecha)?.valor
                const pf30Val = data?.pf30?.find(x => x.fecha === r.fecha)?.valor
                return (
                  <tr key={r.fecha} style={{ borderBottom: "1px solid #0d0d0d" }}>
                    <td style={{ padding: "3px 8px", color: "#666" }}>{fmtDate(r.fecha)}</td>
                    <td style={{ padding: "3px 8px", color: "#FFA028", textAlign: "right" }}>{fmtNum(r.valor, 2)}%</td>
                    <td style={{ padding: "3px 8px", color: "#4FC3F7", textAlign: "right" }}>{tpmVal  != null ? `${fmtNum(tpmVal, 2)}%`  : "—"}</td>
                    <td style={{ padding: "3px 8px", color: "#CE93D8", textAlign: "right" }}>{pf30Val != null ? `${fmtNum(pf30Val, 2)}%` : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Fuente: BCRA API v4.0 · api.bcra.gob.ar · Variables 7 (BADLAR), 8 (TM20), 6 (TPM), 12 (Dep. 30d)
          </div>
        </div>
      )}
    </div>
  )
}

// ── Agregados Monetarios ───────────────────────────────────────────────────────
// Vars BCRA:
//   15 = Base Monetaria
//   16 = Circulación Monetaria (base sin encajes)
//   17 = Billetes y monedas en poder del público
//   21 = Depósitos en cta cte sector privado
//   22 = Cajas de ahorro
//   23 = Depósitos a plazo
// M1 = var17 + var21  (efectivo + depósitos vista)
// M2 = M1 + var22     (+ cajas de ahorro)
// M3 = M2 + var23     (+ plazos fijos)

function AgregadosView() {
  const [data, setData] = useState<{
    base: BCRAVar[]; circulacion: BCRAVar[]; billetes: BCRAVar[]
    dep_cc: BCRAVar[]; cajas_ahorro: BCRAVar[]; dep_plazo: BCRAVar[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=agregados")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando agregados monetarios...</div>

  // Últimos valores
  const baseUlt     = data?.base?.at(-1)?.valor
  const circUlt     = data?.circulacion?.at(-1)?.valor
  const billetesUlt = data?.billetes?.at(-1)?.valor
  const depCCUlt    = data?.dep_cc?.at(-1)?.valor
  const cajasUlt    = data?.cajas_ahorro?.at(-1)?.valor
  const depPlazoUlt = data?.dep_plazo?.at(-1)?.valor

  // M1 = billetes + dep_cc; M2 = M1 + cajas; M3 = M2 + dep_plazo
  const m1Ult = billetesUlt != null && depCCUlt    != null ? billetesUlt + depCCUlt    : null
  const m2Ult = m1Ult       != null && cajasUlt    != null ? m1Ult + cajasUlt          : null
  const m3Ult = m2Ult       != null && depPlazoUlt != null ? m2Ult + depPlazoUlt       : null

  // Variación i.a. base
  const iaBase = (() => {
    if (!data?.base || data.base.length < 13) return null
    const curr = data.base.at(-1)!.valor
    const prev = data.base.at(-13)!.valor
    return ((curr / prev) - 1) * 100
  })()

  // Serie para gráfico: M1, M2, M3, Base (en billions)
  const chartData = (() => {
    if (!data) return []
    const B = (arr: BCRAVar[]) => new Map(arr.map(r => [r.fecha, r.valor]))
    const mBill = B(data.billetes ?? [])
    const mCC   = B(data.dep_cc ?? [])
    const mCaj  = B(data.cajas_ahorro ?? [])
    const mPlazo = B(data.dep_plazo ?? [])
    const mBase  = B(data.base ?? [])

    const fechas = [...new Set([
      ...mBill.keys(), ...mCC.keys(), ...mCaj.keys()
    ])].sort().slice(-36)

    return fechas.map(fecha => {
      const bill  = mBill.get(fecha)  ?? null
      const cc    = mCC.get(fecha)    ?? null
      const cajas = mCaj.get(fecha)   ?? null
      const plazo = mPlazo.get(fecha) ?? null
      const base  = mBase.get(fecha)  ?? null
      const m1 = bill != null && cc    != null ? (bill + cc)    / 1e6 : null
      const m2 = m1   != null && cajas != null ? m1 + cajas / 1e6     : null
      const m3 = m2   != null && plazo != null ? m2 + plazo / 1e6     : null
      return {
        fecha,
        "Base":  base  != null ? base  / 1e6 : null,
        "M1":    m1,
        "M2":    m2,
        "M3":    m3,
      }
    })
  })()

  const fmt = (v: number | null | undefined) =>
    v != null ? `$${fmtNum(v / 1e6, 1)}B` : "—"

  return (
    <div>
      <SectionMeta title="Agregados Monetarios" help="M1 = dinero en circulación + depósitos a la vista. M2 = M1 + cajas de ahorro. M3 = M2 + depósitos a plazo. Base Monetaria = pasivos monetarios del BCRA (billetes + reservas bancarias)." source="BCRA API" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Base Monetaria"
          value={fmt(baseUlt)}
          unit={iaBase != null ? `i.a.: ${iaBase >= 0 ? "+" : ""}${fmtNum(iaBase, 1)}% · Var 15` : "Var 15 BCRA API"}
          valueColor="#FFA028" />
        <KPI label="Circulación Monetaria"
          value={fmt(circUlt)}
          unit="Sin encajes · Var 16 BCRA API"
          valueColor="#4AF6C3" />
        <KPI label="M1  (Billetes + Depósitos Vista)"
          value={fmt(m1Ult)}
          unit="Vars 17 + 21 BCRA API"
          valueColor="#4FC3F7" />
        <KPI label="M2  (M1 + Cajas de Ahorro)"
          value={fmt(m2Ult)}
          unit="Vars 17 + 21 + 22 BCRA API"
          valueColor="#CE93D8" />
        <KPI label="M3  (M2 + Plazos Fijos)"
          value={fmt(m3Ult)}
          unit="Vars 17 + 21 + 22 + 23 BCRA API"
          valueColor="#FFD54F" />
      </div>

      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, fontFamily: "monospace" }}>
            AGREGADOS MONETARIOS — ÚLTIMOS 36 MESES (BILLONES ARS)
          </div>
          <DownloadCSV data={chartData} filename="agregados-monetarios-bcra" />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#111" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
              tickFormatter={v => `$${typeof v === "number" ? v.toFixed(0) : v}B`} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
              formatter={(v: unknown) => [`$${fmtNum(v as number, 2)}B`]} />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
            <Area type="monotone" dataKey="M3"   stroke="#FFD54F" fill="#FFD54F15" strokeWidth={1}   dot={false} />
            <Area type="monotone" dataKey="M2"   stroke="#CE93D8" fill="#CE93D815" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="M1"   stroke="#4FC3F7" fill="#4FC3F715" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="Base" stroke="#FFA028" fill="#FFA02820" strokeWidth={2}   dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
          Fuente: BCRA API v4.0 · api.bcra.gob.ar ·
          M1 = Billetes (var 17) + Dep. vista (var 21) ·
          M2 = M1 + Cajas ahorro (var 22) ·
          M3 = M2 + Dep. plazo (var 23)
        </div>
      </div>
    </div>
  )
}

// ── Reservas Internacionales ───────────────────────────────────────────────────

function ReservasView() {
  const [data, setData] = useState<{
    brutas: BCRAVar[]
    netas: { fecha: string; brutas: number; netas: number; swap_china: number; encajes: number }[]
    ultima: { brutas: number | null; netas: number | null; fecha: string | null; var_semanal_brutas: number | null }
  } | null>(null)
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
      <SectionMeta title="Reservas Internacionales" help="Reservas internacionales brutas del BCRA en USD. Las reservas netas excluyen encajes en moneda extranjera, el swap con China y las obligaciones de corto plazo con el FMI y otros acreedores." source="BCRA API" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
        <KPI label="Reservas Brutas"
          value={ult?.brutas != null ? `USD ${fmtNum(ult.brutas / 1e3, 2)}B` : null}
          unit={ult?.var_semanal_brutas != null
            ? `Var. semanal: ${ult.var_semanal_brutas >= 0 ? "+" : ""}${fmtNum(ult.var_semanal_brutas, 0)}M · Var 1 BCRA API`
            : `Fecha: ${ult?.fecha ?? "—"} · Var 1 BCRA API`}
          valueColor="#FFA028" />
        <KPI label="Reservas Netas"
          value={ult?.netas != null ? `USD ${fmtNum(ult.netas / 1e3, 2)}B` : null}
          unit="Metodología F. Machado"
          valueColor={ult?.netas != null ? (ult.netas >= 0 ? "#4AF6C3" : "#FF433D") : "#555"} />
        <KPI label="Diferencia (B − N)"
          value={ult?.brutas != null && ult?.netas != null
            ? `USD ${fmtNum((ult.brutas - ult.netas) / 1e3, 2)}B`
            : null}
          unit="Swap China + Encajes + DEGs"
          valueColor="#CE93D8" />
      </div>
      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, marginBottom: 4, fontFamily: "monospace" }}>
            RESERVAS BRUTAS vs. NETAS — ÚLTIMOS 24 MESES (USD millones)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" />
              <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
                tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }}
                tickFormatter={v => `${(Number(v) / 1e3).toFixed(0)}B`} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
                formatter={(v: unknown) => [`USD ${fmtNum(v as number, 0)}M`]} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }} />
              <Area type="monotone" dataKey="brutas" name="Brutas" stroke="#FFA028" fill="#FFA02815" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="netas"  name="Netas"  stroke="#4AF6C3" fill="#4AF6C315" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "#333", marginTop: 4 }}>
            Brutas: Var 1 BCRA API · Netas: argentinadatos.com + metodología F. Machado
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compras / Ventas BCRA en el MULC ──────────────────────────────────────────

interface ComprasRow { fecha: string; monto: number; acumulado_mensual: number }

function ComprasView() {
  const [data, setData] = useState<{
    datos: ComprasRow[]
    resumen: { mes_actual: number | null; acumulado_anual: number; mayor_compra_periodo: number; mayor_venta_periodo: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=compras")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando compras/ventas...</div>

  const r = data?.resumen
  const chartData = (data?.datos ?? []).map(row => ({
    ...row,
    color: row.monto >= 0 ? "#4AF6C3" : "#FF433D",
  }))
  const tableData = (data?.datos ?? []).slice(-20).reverse()

  return (
    <div>
      <SectionMeta title="Compras BCRA — MULC" help="Intervenciones del BCRA en el mercado cambiario (Mercado Único y Libre de Cambios). Compras netas (+) aumentan reservas; ventas netas (-) las reducen. El acumulado anual refleja la posición compradora/vendedora del año." source="BCRA · argentinadatos.com" />
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
          <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, marginBottom: 4, fontFamily: "monospace" }}>
            COMPRAS / VENTAS BCRA EN EL MULC — ÚLTIMAS 30 RUEDAS (USD millones)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fontSize: 7, fill: "#555", fontFamily: "monospace" }}
                tickFormatter={d => d?.slice(5) ?? ""} interval={4} />
              <YAxis tick={{ fontSize: 8, fill: "#555", fontFamily: "monospace" }} tickFormatter={v => `${v}M`} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontFamily: "monospace", fontSize: 10 }}
                formatter={(v: unknown) => [`USD ${fmtNum(v as number, 0)}M`]} />
              <Bar dataKey="monto" name="USD M" fill="#4AF6C3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tableData.length > 0 && (
        <div style={{ padding: "10px 12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Fecha", "Monto (USD M)", "Acum. Mensual (USD M)"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: "right", fontWeight: 400 }}>{h}</th>
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

// ── REM — Relevamiento de Expectativas de Mercado ─────────────────────────────

interface RemRow {
  fecha: string
  inflacion_12m: number | null
  inflacion_24m: number | null
  nucleo_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  tasa_real_12m: number | null
}

interface RemKpis {
  inflacion_12m: number | null
  inflacion_24m: number | null
  nucleo_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  tasa_real_12m: number | null
  fecha: string | null
}

function REMView() {
  const [serie, setSerie] = useState<RemRow[]>([])
  const [kpis, setKpis]   = useState<RemKpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/rem")
      .then(r => r.json())
      .then(j => {
        setSerie(j.data?.serie ?? [])
        setKpis(j.data?.kpis ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24, color: "#555", textAlign: "center", fontSize: 11, fontFamily: "monospace" }}>Cargando REM...</div>

  // Datos para el gráfico histórico (inflación 12M y dólar proyectado)
  const chartData = serie.map(r => ({
    date: r.fecha,
    inf12:  r.inflacion_12m,
    inf24:  r.inflacion_24m,
    nuc12:  r.nucleo_12m,
    tasa12: r.tasa_12m,
    real12: r.tasa_real_12m,
  })) as Record<string, unknown>[]

  const chartDolar = serie.map(r => ({
    date:  r.fecha,
    usd12: r.dolar_12m,
  })) as Record<string, unknown>[]

  const fechaLabel = kpis?.fecha ? `Relevamiento ${kpis.fecha}` : ""

  return (
    <div>
      <SectionMeta
        title="REM — Expectativas de Mercado"
        help="El REM (Relevamiento de Expectativas de Mercado) consolida mensualmente las proyecciones de analistas privados sobre inflación, tipo de cambio, tasas e indicadores reales. Publicado por el BCRA. Los valores son medianas del consenso."
        source="BCRA — Relevamiento de Expectativas de Mercado"
      />

      {/* KPIs del último relevamiento */}
      {kpis && (
        <>
          <div style={{ padding: "4px 12px 2px", fontSize: 8, color: "#444", fontFamily: "monospace", letterSpacing: 1.5 }}>
            PROYECCIONES A 12 MESES — {fechaLabel.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "#111" }}>
            <KPI
              label="Inflación 12M"
              value={kpis.inflacion_12m != null ? `${fmtNum(kpis.inflacion_12m, 1)}%` : null}
              unit="% acum. próx. 12 meses · mediana analistas"
              valueColor={kpis.inflacion_12m != null ? (kpis.inflacion_12m > 50 ? "#FF433D" : kpis.inflacion_12m > 25 ? "#FFA028" : "#4AF6C3") : "#555"}
            />
            <KPI
              label="Inflación 24M"
              value={kpis.inflacion_24m != null ? `${fmtNum(kpis.inflacion_24m, 1)}%` : null}
              unit="% acum. próx. 24 meses · mediana"
              valueColor="#FFA028"
            />
            <KPI
              label="IPC Núcleo 12M"
              value={kpis.nucleo_12m != null ? `${fmtNum(kpis.nucleo_12m, 1)}%` : null}
              unit="% núcleo próx. 12 meses"
              valueColor="#CE93D8"
            />
            <KPI
              label="Dólar proyectado"
              value={kpis.dolar_12m != null ? `$${Math.round(kpis.dolar_12m).toLocaleString("es-AR")}` : null}
              unit="ARS/USD en 12 meses · mediana"
              valueColor="#4FC3F7"
            />
            <KPI
              label="Tasa interés 12M"
              value={kpis.tasa_12m != null ? `${fmtNum(kpis.tasa_12m, 1)}%` : null}
              unit="TNA % próx. 12 meses"
              valueColor="#FFD700"
            />
            <KPI
              label="Tasa real 12M"
              value={kpis.tasa_real_12m != null ? `${kpis.tasa_real_12m >= 0 ? "+" : ""}${fmtNum(kpis.tasa_real_12m, 2)}%` : null}
              unit="Fisher: ((1+tasa)/(1+inflac)-1)×100"
              valueColor={kpis.tasa_real_12m != null ? (kpis.tasa_real_12m > 0 ? "#4AF6C3" : "#FF433D") : "#555"}
            />
          </div>
        </>
      )}

      {/* Gráfico histórico de inflación proyectada */}
      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 4px" }}>
          <BBGLineChart
            title="INFLACIÓN PROYECTADA — EVOLUCIÓN DEL CONSENSO"
            data={chartData}
            lines={[
              { key: "inf12",  name: "Inflación 12M",    color: "#FF433D" },
              { key: "inf24",  name: "Inflación 24M",    color: "#FFA028", dashed: true },
              { key: "nuc12",  name: "Núcleo 12M",       color: "#CE93D8" },
              { key: "tasa12", name: "Tasa interés 12M", color: "#FFD700", dashed: true },
            ]}
            height={220}
            yAxisLabel="%"
            showZeroLine={false}
            defaultRange="1y"
            enableDateRange={true}
            enableLineToggle={true}
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
          <div style={{ fontSize: 8, color: "#333", padding: "2px 4px" }}>
            Fuente: BCRA · REM · Medianas del consenso de analistas privados
          </div>
        </div>
      )}

      {/* Gráfico dólar proyectado */}
      {chartDolar.length > 0 && (
        <div style={{ padding: "4px 12px 8px" }}>
          <BBGLineChart
            title="TIPO DE CAMBIO PROYECTADO A 12 MESES (ARS/USD)"
            data={chartDolar}
            lines={[{ key: "usd12", name: "Dólar 12M", color: "#4FC3F7" }]}
            height={160}
            yAxisLabel="ARS/USD"
            showZeroLine={false}
            defaultRange="1y"
            enableDateRange={true}
            formatValue={(v) => `$${Math.round(v).toLocaleString("es-AR")}`}
          />
          <div style={{ fontSize: 8, color: "#333", padding: "2px 4px" }}>
            Mediana de analistas del REM. No es una predicción oficial del BCRA.
          </div>
        </div>
      )}

      {/* Tabla resumen últimos 12 meses */}
      {serie.length > 0 && (
        <div style={{ padding: "4px 12px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 1.5, fontFamily: "monospace" }}>
              HISTORIAL — ÚLTIMOS 12 RELEVAMIENTOS
            </div>
            <DownloadCSV
              data={serie.map(r => ({
                fecha: r.fecha,
                inflacion_12m: r.inflacion_12m ?? "",
                inflacion_24m: r.inflacion_24m ?? "",
                nucleo_12m: r.nucleo_12m ?? "",
                dolar_12m: r.dolar_12m ?? "",
                tasa_12m: r.tasa_12m ?? "",
                tasa_real_12m: r.tasa_real_12m ?? "",
              }))}
              filename="rem-bcra"
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr>
                  {["Relevamiento", "Inflac. 12M", "Inflac. 24M", "Núcleo 12M", "USD 12M", "Tasa 12M", "Tasa Real"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: "#555", textAlign: h === "Relevamiento" ? "left" : "right", borderBottom: "1px solid #1a1a1a", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serie.slice(-12).reverse().map((r, i) => (
                  <tr key={r.fecha} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                    <td style={{ padding: "4px 8px", color: "#FFA028", fontFamily: "monospace", fontSize: 10 }}>{r.fecha}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: r.inflacion_12m != null && r.inflacion_12m > 50 ? "#FF433D" : "#FFA028" }}>
                      {r.inflacion_12m != null ? `${r.inflacion_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: "#888" }}>
                      {r.inflacion_24m != null ? `${r.inflacion_24m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: "#CE93D8" }}>
                      {r.nucleo_12m != null ? `${r.nucleo_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: "#4FC3F7" }}>
                      {r.dolar_12m != null ? `$${Math.round(r.dolar_12m).toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", color: "#FFD700" }}>
                      {r.tasa_12m != null ? `${r.tasa_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{
                      padding: "4px 8px", textAlign: "right", fontFamily: "monospace",
                      color: r.tasa_real_12m != null ? (r.tasa_real_12m > 0 ? "#4AF6C3" : "#FF433D") : "#555",
                    }}>
                      {r.tasa_real_12m != null ? `${r.tasa_real_12m >= 0 ? "+" : ""}${r.tasa_real_12m.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!kpis && serie.length === 0 && (
        <div style={{ padding: 24, color: "#555", fontSize: 11, textAlign: "center", fontFamily: "monospace" }}>
          Sin datos disponibles. El Excel del BCRA puede estar temporalmente inaccesible.
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
      {/* Header */}
      <div style={{
        fontSize: 9, color: "#4AF6C3", letterSpacing: 2, fontFamily: "monospace",
        background: "#060606", borderBottom: "1px solid #111",
        padding: "5px 14px", textTransform: "uppercase",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 11 }}>🏦</span>
        BANCO CENTRAL DE LA REPÚBLICA ARGENTINA
      </div>

      {/* Sub-nav estilo rendimientos.co */}
      <SubTabs active={activeTab} onChange={setActiveTab} />

      {/* Contenido */}
      {activeTab === "plazofijo" && <PlazoFijoView />}
      {activeTab === "agregados" && <AgregadosView />}
      {activeTab === "reservas"  && <ReservasView  />}
      {activeTab === "compras"   && <ComprasView   />}
      {activeTab === "rem"       && <REMView       />}
    </div>
  )
}
