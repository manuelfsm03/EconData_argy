"use client"

import { useState, useEffect, useRef } from "react"
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
function KPI({ label, value, unit, valueColor = "var(--text)" }: KPIProps) {
  return (
    <div style={{
      flex: "1 1 160px", padding: "10px 14px", background: "var(--bg-row-alt)",
      border: "1px solid var(--bg-elev-2)", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, fontFamily: "var(--font-data)", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      {unit && (
        <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>{unit}</div>
      )}
    </div>
  )
}

// ── Sub-tabs estilo rendimientos.co ──────────────────────────────────────────

const BCRA_TABS = [
  { key: "plazofijo", label: "Plazo Fijo",     icon: "%" },
  { key: "tasas",     label: "Tasas de Ref.",  icon: "§" },
  { key: "agregados", label: "Agregados",      icon: "Σ" },
  { key: "reservas",  label: "Reservas",       icon: "⬡" },
  { key: "compras",   label: "Compras BCRA",   icon: "⇄" },
  { key: "rem",       label: "REM",            icon: "◎" },
]

interface SubTabsProps {
  active: string
  onChange: (k: string) => void
}

function SubTabs({ active, onChange }: SubTabsProps) {
  return (
    <div style={{
      background: "var(--bg)",
      borderBottom: "1px solid var(--bg-elev-2)",
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
              border: isActive ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
              borderRadius: 20,
              cursor: "pointer",
              padding: "5px 14px",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              fontFamily: "var(--font-data)",
            }}
          >
            <span style={{
              fontSize: 11,
              color: isActive ? "var(--amber)" : "var(--text-mute)",
              fontFamily: "var(--font-data)",
              fontWeight: 700,
              lineHeight: 1,
            }}>
              {t.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontFamily: "var(--font-data)",
              color: isActive ? "var(--amber)" : "var(--text-dim)",
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

  if (loading) return <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>Cargando tasas...</div>

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
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
        <KPI label="BADLAR Bancos Privados" value={badlarUlt != null ? `${fmtNum(badlarUlt, 2)}%` : null}
          unit="TNA · Var 7 BCRA API" valueColor="var(--amber)" />
        <KPI label="TM20 Bancos Privados"   value={tm20Ult   != null ? `${fmtNum(tm20Ult, 2)}%` : null}
          unit="TNA · Var 8 BCRA API" valueColor="var(--positive)" />
        <KPI label="Tasa de Política Mon."  value={tpmUlt    != null ? `${fmtNum(tpmUlt, 2)}%` : null}
          unit="TPM · Var 6 BCRA API" valueColor="var(--sky)" />
        <KPI label="Depósitos 30d"          value={pf30Ult   != null ? `${fmtNum(pf30Ult, 2)}%` : null}
          unit="TNA · Var 12 BCRA API" valueColor="#CE93D8" />
      </div>
      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: "var(--positive)", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
            EVOLUCIÓN TASAS — ÚLTIMOS 96 REGISTROS
          </div>
          <DownloadCSV data={chartData} filename="tasas-bcra" />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-elev-2)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontFamily: "var(--font-data)", fontSize: 10 }}
              formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`]} />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-data)" }} />
            <Area type="monotone" dataKey="BADLAR" stroke="var(--amber)" fill="#FFA02820" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="TPM"    stroke="var(--sky)" fill="#4FC3F720" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="PF30"   stroke="#CE93D8" fill="#CE93D820" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {tableSrc.length > 0 && (
        <div style={{ padding: "10px 12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Fecha", "BADLAR", "TPM", "Dep. 30d"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "var(--text-dim)", textAlign: "right", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableSrc.map(r => {
                const tpmVal  = data?.tpm?.find(x => x.fecha === r.fecha)?.valor
                const pf30Val = data?.pf30?.find(x => x.fecha === r.fecha)?.valor
                return (
                  <tr key={r.fecha} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                    <td style={{ padding: "3px 8px", color: "var(--text-dim)" }}>{fmtDate(r.fecha)}</td>
                    <td style={{ padding: "3px 8px", color: "var(--amber)", textAlign: "right" }}>{fmtNum(r.valor, 2)}%</td>
                    <td style={{ padding: "3px 8px", color: "var(--sky)", textAlign: "right" }}>{tpmVal  != null ? `${fmtNum(tpmVal, 2)}%`  : "—"}</td>
                    <td style={{ padding: "3px 8px", color: "#CE93D8", textAlign: "right" }}>{pf30Val != null ? `${fmtNum(pf30Val, 2)}%` : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "var(--text-mute)", marginTop: 4 }}>
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

  if (loading) return <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>Cargando agregados monetarios...</div>

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
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
        <KPI label="Base Monetaria"
          value={fmt(baseUlt)}
          unit={iaBase != null ? `i.a.: ${iaBase >= 0 ? "+" : ""}${fmtNum(iaBase, 1)}% · Var 15` : "Var 15 BCRA API"}
          valueColor="var(--amber)" />
        <KPI label="Circulación Monetaria"
          value={fmt(circUlt)}
          unit="Sin encajes · Var 16 BCRA API"
          valueColor="var(--positive)" />
        <KPI label="M1  (Billetes + Depósitos Vista)"
          value={fmt(m1Ult)}
          unit="Vars 17 + 21 BCRA API"
          valueColor="var(--sky)" />
        <KPI label="M2  (M1 + Cajas de Ahorro)"
          value={fmt(m2Ult)}
          unit="Vars 17 + 21 + 22 BCRA API"
          valueColor="#CE93D8" />
        <KPI label="M3  (M2 + Plazos Fijos)"
          value={fmt(m3Ult)}
          unit="Vars 17 + 21 + 22 + 23 BCRA API"
          valueColor="var(--yellow)" />
      </div>

      <div style={{ padding: "8px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: "var(--positive)", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
            AGREGADOS MONETARIOS — ÚLTIMOS 36 MESES (BILLONES ARS)
          </div>
          <DownloadCSV data={chartData} filename="agregados-monetarios-bcra" />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-elev-2)" />
            <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
              tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
              tickFormatter={v => `$${typeof v === "number" ? v.toFixed(0) : v}B`} />
            <Tooltip contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontFamily: "var(--font-data)", fontSize: 10 }}
              formatter={(v: unknown) => [`$${fmtNum(v as number, 2)}B`]} />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-data)" }} />
            <Area type="monotone" dataKey="M3"   stroke="var(--yellow)" fill="#FFD54F15" strokeWidth={1}   dot={false} />
            <Area type="monotone" dataKey="M2"   stroke="#CE93D8" fill="#CE93D815" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="M1"   stroke="var(--sky)" fill="#4FC3F715" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="Base" stroke="var(--amber)" fill="#FFA02820" strokeWidth={2}   dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 8, color: "var(--text-mute)", marginTop: 4 }}>
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

  if (loading) return <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>Cargando reservas...</div>

  const ult = data?.ultima
  const chartData = data?.netas?.slice(-24) ?? []

  return (
    <div>
      <SectionMeta title="Reservas Internacionales" help="Reservas internacionales brutas del BCRA en USD. Las reservas netas excluyen encajes en moneda extranjera, el swap con China y las obligaciones de corto plazo con el FMI y otros acreedores." source="BCRA API" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
        <KPI label="Reservas Brutas"
          value={ult?.brutas != null ? `USD ${fmtNum(ult.brutas / 1e3, 2)}B` : null}
          unit={ult?.var_semanal_brutas != null
            ? `Var. semanal: ${ult.var_semanal_brutas >= 0 ? "+" : ""}${fmtNum(ult.var_semanal_brutas, 0)}M · Var 1 BCRA API`
            : `Fecha: ${ult?.fecha ?? "—"} · Var 1 BCRA API`}
          valueColor="var(--amber)" />
        <KPI label="Reservas Netas"
          value={ult?.netas != null ? `USD ${fmtNum(ult.netas / 1e3, 2)}B` : null}
          unit="Metodología F. Machado"
          valueColor={ult?.netas != null ? (ult.netas >= 0 ? "var(--positive)" : "var(--negative)") : "var(--text-mute)"} />
        <KPI label="Diferencia (B − N)"
          value={ult?.brutas != null && ult?.netas != null
            ? `USD ${fmtNum((ult.brutas - ult.netas) / 1e3, 2)}B`
            : null}
          unit="Swap China + Encajes + DEGs"
          valueColor="#CE93D8" />
      </div>
      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ fontSize: 9, color: "var(--positive)", letterSpacing: 1.5, marginBottom: 4, fontFamily: "var(--font-data)" }}>
            RESERVAS BRUTAS vs. NETAS — ÚLTIMOS 24 MESES (USD millones)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-elev-2)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
                tickFormatter={d => d?.slice(0, 7) ?? ""} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
                tickFormatter={v => `${(Number(v) / 1e3).toFixed(0)}B`} />
              <Tooltip contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontFamily: "var(--font-data)", fontSize: 10 }}
                formatter={(v: unknown) => [`USD ${fmtNum(v as number, 0)}M`]} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-data)" }} />
              <Area type="monotone" dataKey="brutas" name="Brutas" stroke="var(--amber)" fill="#FFA02815" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="netas"  name="Netas"  stroke="var(--positive)" fill="#4AF6C315" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8, color: "var(--text-mute)", marginTop: 4 }}>
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

  if (loading) return <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>Cargando compras/ventas...</div>

  const r = data?.resumen
  const chartData = (data?.datos ?? []).map(row => ({
    ...row,
    color: row.monto >= 0 ? "var(--positive)" : "var(--negative)",
  }))
  const tableData = (data?.datos ?? []).slice(-20).reverse()

  return (
    <div>
      <SectionMeta title="Compras BCRA — MULC" help="Intervenciones del BCRA en el mercado cambiario (Mercado Único y Libre de Cambios). Compras netas (+) aumentan reservas; ventas netas (-) las reducen. El acumulado anual refleja la posición compradora/vendedora del año." source="BCRA · argentinadatos.com" />
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
        <KPI label="Posición Mes Actual"
          value={r?.mes_actual != null ? `USD ${fmtNum(Math.abs(r.mes_actual), 0)}M` : null}
          unit={r?.mes_actual != null ? (r.mes_actual >= 0 ? "Comprador neto" : "Vendedor neto") : ""}
          valueColor={r?.mes_actual != null ? (r.mes_actual >= 0 ? "var(--positive)" : "var(--negative)") : "var(--text-mute)"} />
        <KPI label="Acumulado Anual"
          value={r?.acumulado_anual != null ? `USD ${fmtNum(Math.abs(r.acumulado_anual), 0)}M` : null}
          unit={r?.acumulado_anual != null ? (r.acumulado_anual >= 0 ? "Compras netas" : "Ventas netas") : ""}
          valueColor={r?.acumulado_anual != null ? (r.acumulado_anual >= 0 ? "var(--positive)" : "var(--negative)") : "var(--text-mute)"} />
        <KPI label="Mayor Compra (período)"
          value={r?.mayor_compra_periodo != null ? `USD ${fmtNum(r.mayor_compra_periodo, 0)}M` : null}
          unit="Máxima compra diaria" valueColor="var(--positive)" />
      </div>

      {chartData.length > 0 && (
        <div style={{ padding: "8px 12px 0" }}>
          <div style={{ fontSize: 9, color: "var(--positive)", letterSpacing: 1.5, marginBottom: 4, fontFamily: "var(--font-data)" }}>
            COMPRAS / VENTAS BCRA EN EL MULC — ÚLTIMAS 30 RUEDAS (USD millones)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-elev-2)" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fontSize: 7, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }}
                tickFormatter={d => d?.slice(5) ?? ""} interval={4} />
              <YAxis tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "var(--font-data)" }} tickFormatter={v => `${v}M`} />
              <Tooltip contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontFamily: "var(--font-data)", fontSize: 10 }}
                formatter={(v: unknown) => [`USD ${fmtNum(v as number, 0)}M`]} />
              <Bar dataKey="monto" name="USD M" fill="var(--positive)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tableData.length > 0 && (
        <div style={{ padding: "10px 12px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Fecha", "Monto (USD M)", "Acum. Mensual (USD M)"].map(h => (
                  <th key={h} style={{ padding: "4px 8px", color: "var(--text-dim)", textAlign: "right", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.fecha} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                  <td style={{ padding: "3px 8px", color: "var(--text-dim)" }}>{fmtDate(row.fecha)}</td>
                  <td style={{ padding: "3px 8px", textAlign: "right",
                    color: row.monto >= 0 ? "var(--positive)" : "var(--negative)", fontWeight: 700 }}>
                    {row.monto >= 0 ? "+" : ""}{fmtNum(row.monto, 0)}
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "right",
                    color: row.acumulado_mensual >= 0 ? "var(--positive)" : "var(--negative)" }}>
                    {row.acumulado_mensual >= 0 ? "+" : ""}{fmtNum(row.acumulado_mensual, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "var(--text-mute)", marginTop: 4 }}>
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

  if (loading) return <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>Cargando REM...</div>

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
          <div style={{ padding: "4px 12px 2px", fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 1.5 }}>
            PROYECCIONES A 12 MESES — {fechaLabel.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
            <KPI
              label="Inflación 12M"
              value={kpis.inflacion_12m != null ? `${fmtNum(kpis.inflacion_12m, 1)}%` : null}
              unit="% acum. próx. 12 meses · mediana analistas"
              valueColor={kpis.inflacion_12m != null ? (kpis.inflacion_12m > 50 ? "var(--negative)" : kpis.inflacion_12m > 25 ? "var(--amber)" : "var(--positive)") : "var(--text-mute)"}
            />
            <KPI
              label="Inflación 24M"
              value={kpis.inflacion_24m != null ? `${fmtNum(kpis.inflacion_24m, 1)}%` : null}
              unit="% acum. próx. 24 meses · mediana"
              valueColor="var(--amber)"
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
              valueColor="var(--sky)"
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
              valueColor={kpis.tasa_real_12m != null ? (kpis.tasa_real_12m > 0 ? "var(--positive)" : "var(--negative)") : "var(--text-mute)"}
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
              { key: "inf12",  name: "Inflación 12M",    color: "var(--negative)" },
              { key: "inf24",  name: "Inflación 24M",    color: "var(--amber)", dashed: true },
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
          <div style={{ fontSize: 8, color: "var(--text-mute)", padding: "2px 4px" }}>
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
            lines={[{ key: "usd12", name: "Dólar 12M", color: "var(--sky)" }]}
            height={160}
            yAxisLabel="ARS/USD"
            showZeroLine={false}
            defaultRange="1y"
            enableDateRange={true}
            formatValue={(v) => `$${Math.round(v).toLocaleString("es-AR")}`}
          />
          <div style={{ fontSize: 8, color: "var(--text-mute)", padding: "2px 4px" }}>
            Mediana de analistas del REM. No es una predicción oficial del BCRA.
          </div>
        </div>
      )}

      {/* Tabla resumen últimos 12 meses */}
      {serie.length > 0 && (
        <div style={{ padding: "4px 12px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "var(--amber)", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
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
                    <th key={h} style={{ padding: "4px 8px", fontSize: 8, color: "var(--text-dim)", textAlign: h === "Relevamiento" ? "left" : "right", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serie.slice(-12).reverse().map((r, i) => (
                  <tr key={r.fecha} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-row-alt)" }}>
                    <td style={{ padding: "4px 8px", color: "var(--amber)", fontFamily: "var(--font-data)", fontSize: 10 }}>{r.fecha}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)", color: r.inflacion_12m != null && r.inflacion_12m > 50 ? "var(--negative)" : "var(--amber)" }}>
                      {r.inflacion_12m != null ? `${r.inflacion_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)", color: "var(--text-dim)" }}>
                      {r.inflacion_24m != null ? `${r.inflacion_24m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)", color: "#CE93D8" }}>
                      {r.nucleo_12m != null ? `${r.nucleo_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)", color: "var(--sky)" }}>
                      {r.dolar_12m != null ? `$${Math.round(r.dolar_12m).toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)", color: "#FFD700" }}>
                      {r.tasa_12m != null ? `${r.tasa_12m.toFixed(1)}%` : "—"}
                    </td>
                    <td style={{
                      padding: "4px 8px", textAlign: "right", fontFamily: "var(--font-data)",
                      color: r.tasa_real_12m != null ? (r.tasa_real_12m > 0 ? "var(--positive)" : "var(--negative)") : "var(--text-mute)",
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
        <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 11, textAlign: "center", fontFamily: "var(--font-data)" }}>
          Sin datos disponibles. El Excel del BCRA puede estar temporalmente inaccesible.
        </div>
      )}
    </div>
  )
}

// ── Tasas de Referencia ────────────────────────────────────────────────────────

const TASAS_CFG = [
  { key: "tamar",     label: "TAMAR",        sub: "Tasa mayorista bancos privados",    color: "#CE93D8" },
  { key: "badlar",    label: "BADLAR",        sub: "Dep. >$1M, 30-35 días",            color: "var(--amber)" },
  { key: "dep30",     label: "Dep. 30d",      sub: "Promedio todas las entidades",      color: "var(--sky)" },
  { key: "adelantos", label: "Adelantos CC",  sub: "Descubierto cta. cte.",             color: "var(--negative)" },
  { key: "prestamos", label: "Prést. Pers.",  sub: "Créditos al consumo",               color: "var(--positive)" },
] as const

type TasaKey = typeof TASAS_CFG[number]["key"]

interface TasasData {
  tamar:     BCRAVar[]
  badlar:    BCRAVar[]
  dep30:     BCRAVar[]
  adelantos: BCRAVar[]
  prestamos: BCRAVar[]
}

function TasasView() {
  const [data, setData]       = useState<TasasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRows, setShowRows] = useState(30)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/bcra?endpoint=tasas")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>
      Cargando tasas de referencia...
    </div>
  )

  if (!data) return (
    <div style={{ padding: 24, color: "var(--text-dim)", textAlign: "center", fontSize: 11, fontFamily: "var(--font-data)" }}>
      Error al cargar datos.
    </div>
  )

  // Último valor y delta vs ~22 registros atrás (~1 mes hábil)
  const getStats = (key: TasaKey) => {
    const serie = data[key] ?? []
    const last = serie.at(-1)?.valor ?? null
    const prev = serie.at(-22)?.valor ?? null
    const delta = last != null && prev != null ? last - prev : null
    const year = serie.slice(-250)
    const vals = year.map(r => r.valor)
    return {
      last,
      delta,
      max:  vals.length ? Math.max(...vals) : null,
      min:  vals.length ? Math.min(...vals) : null,
      var1y: vals.length >= 2 ? (serie.at(-1)!.valor - year[0].valor) : null,
    }
  }

  const stats = Object.fromEntries(TASAS_CFG.map(t => [t.key, getStats(t.key)])) as
    Record<TasaKey, ReturnType<typeof getStats>>

  // Datos para el gráfico comparativo
  const chartData = (() => {
    const m = new Map<string, Record<string, number>>()
    for (const t of TASAS_CFG) {
      for (const r of data[t.key] ?? []) {
        const e = m.get(r.fecha) ?? {}
        m.set(r.fecha, { ...e, [t.key]: r.valor })
      }
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => ({ date: fecha, ...vals }))
  })()

  // Tabla de datos unificada (desc)
  const tableDates = Array.from(
    new Set([...TASAS_CFG.flatMap(t => (data[t.key] ?? []).map(r => r.fecha))])
  ).sort((a, b) => b.localeCompare(a))

  const csvData = tableDates.map(f => ({
    fecha: f,
    ...Object.fromEntries(TASAS_CFG.map(t => [
      t.label, data[t.key]?.find(r => r.fecha === f)?.valor?.toFixed(2) ?? "",
    ])),
  }))

  // TNA → TEA y rendimientos
  const CAPITAL = 1_000_000
  const tea = (tna: number) => (Math.pow(1 + tna / 100 / 12, 12) - 1) * 100
  const rend30 = (tna: number) => CAPITAL * (tna / 100) * (30 / 365)
  const rend365 = (tna: number) => CAPITAL * (tea(tna) / 100)

  return (
    <div>
      <SectionMeta
        title="Tasas de Interés del BCRA"
        help="TAMAR, BADLAR y tasas activas del sistema financiero. Fuente: BCRA API v4.0, variables 44, 7, 12, 13, 14."
        source="BCRA API v4.0"
      />

      {/* ── KPI cards ── */}
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", padding: 1, background: "var(--bg-elev-2)" }}>
        {TASAS_CFG.map(t => {
          const s = stats[t.key]
          return (
            <div key={t.key} style={{
              flex: "1 1 160px", padding: "10px 14px",
              background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)",
            }}>
              <div style={{ fontSize: 9, color: t.color, fontFamily: "var(--font-data)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const }}>
                {t.label}
              </div>
              <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", marginBottom: 6 }}>
                {t.sub}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-data)", lineHeight: 1 }}>
                {s.last != null ? `${fmtNum(s.last)}%` : "—"}
              </div>
              {s.delta != null && (
                <div style={{ fontSize: 9, color: s.delta >= 0 ? "var(--negative)" : "var(--positive)", fontFamily: "var(--font-data)", marginTop: 4 }}>
                  {s.delta >= 0 ? "+" : ""}{fmtNum(s.delta)} pp vs mes ant.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Gráfico comparativo ── */}
      <div style={{ padding: "10px 12px 0", borderTop: "1px solid var(--bg-elev-2)" }}>
        <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" as const }}>
          Evolución comparativa
        </div>
        <div ref={chartRef}>
          <BBGLineChart
            title=""
            data={chartData as unknown as Record<string, unknown>[]}
            lines={TASAS_CFG.map(t => ({ key: t.key, name: t.label, color: t.color }))}
            height={280}
            formatValue={v => `${v.toFixed(2)}%`}
            defaultRange="1y"
            enableLineToggle={true}
            enableDateRange={true}
            showZeroLine={false}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 4px 0" }}>
          <ChartDownload csvData={csvData} filename="tasas-bcra" chartRef={chartRef} />
        </div>
      </div>

      {/* ── TNA vs TEA ── */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bg-elev-2)" }}>
        <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" as const }}>
          TNA vs TEA · Simulación $1.000.000
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Tasa", "TNA", "TEA", "Rend. 30 días", "Rend. 365 días"].map(h => (
                  <th key={h} style={{ padding: "5px 10px", color: "var(--text-dim)", textAlign: "right", fontWeight: 400, whiteSpace: "nowrap" as const }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASAS_CFG.map(t => {
                const tna = stats[t.key].last
                if (tna == null) return null
                return (
                  <tr key={t.key} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                    <td style={{ padding: "5px 10px", color: t.color, fontWeight: 700 }}>{t.label}</td>
                    <td style={{ padding: "5px 10px", color: "#ccc", textAlign: "right" }}>{fmtNum(tna)}%</td>
                    <td style={{ padding: "5px 10px", color: "var(--amber)", textAlign: "right" }}>{fmtNum(tea(tna))}%</td>
                    <td style={{ padding: "5px 10px", color: "var(--positive)", textAlign: "right" }}>
                      ${rend30(tna).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: "5px 10px", color: "var(--positive)", textAlign: "right" }}>
                      ${rend365(tna).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 8, color: "var(--text-mute)", fontFamily: "var(--font-data)", marginTop: 4 }}>
            Simulación teórica sobre $1.000.000. TEA = (1 + TNA/12)^12 − 1. Rend. 30d = Capital × TNA × 30/365.
          </div>
        </div>
      </div>

      {/* ── Estadísticas por tasa ── */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bg-elev-2)" }}>
        <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" as const }}>
          Estadísticas — Últimos 12 meses
        </div>
        <div style={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {TASAS_CFG.map(t => {
            const s = stats[t.key]
            return (
              <div key={t.key} style={{ flex: "1 1 140px", padding: "8px 12px", background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)" }}>
                <div style={{ fontSize: 9, color: t.color, fontWeight: 700, fontFamily: "var(--font-data)", marginBottom: 6 }}>{t.label}</div>
                {([
                  ["Actual",        s.last   != null ? `${fmtNum(s.last)}%`   : "—"],
                  ["Máximo",        s.max    != null ? `${fmtNum(s.max)}%`    : "—"],
                  ["Mínimo",        s.min    != null ? `${fmtNum(s.min)}%`    : "—"],
                  ["Var. (pp)",     s.var1y  != null ? `${fmtNum(s.var1y)} pp` : "—"],
                ] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>{lbl}</span>
                    <span style={{ fontSize: 8, color: lbl === "Actual" ? "var(--text)" : "var(--text-dim)", fontFamily: "var(--font-data)" }}>{val}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabla de datos ── */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bg-elev-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 1.5, textTransform: "uppercase" as const }}>
            Tabla de datos
          </div>
          <DownloadCSV data={csvData} filename="tasas-referencia-bcra" />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "4px 10px", color: "var(--text-dim)", textAlign: "left", fontWeight: 400 }}>Fecha</th>
                {TASAS_CFG.map(t => (
                  <th key={t.key} style={{ padding: "4px 10px", color: t.color, textAlign: "right", fontWeight: 600 }}>
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableDates.slice(0, showRows).map(f => (
                <tr key={f} style={{ borderBottom: "1px solid var(--bg-elev)" }}>
                  <td style={{ padding: "3px 10px", color: "var(--text-dim)" }}>{fmtDate(f)}</td>
                  {TASAS_CFG.map(t => {
                    const val = data[t.key]?.find(r => r.fecha === f)?.valor
                    return (
                      <td key={t.key} style={{ padding: "3px 10px", color: t.color, textAlign: "right" }}>
                        {val != null ? `${fmtNum(val)}%` : "—"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableDates.length > showRows && (
          <button
            onClick={() => setShowRows(n => n + 30)}
            style={{
              marginTop: 8, width: "100%", padding: "6px", background: "none",
              border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-dim)",
              fontFamily: "var(--font-data)", fontSize: 9, cursor: "pointer",
            }}
          >
            Mostrar más ({tableDates.length - showRows} restantes)
          </button>
        )}
        <div style={{ fontSize: 8, color: "var(--text-mute)", fontFamily: "var(--font-data)", marginTop: 6 }}>
          Fuente: BCRA API v4.0 · Variables 44 (TAMAR), 7 (BADLAR), 12 (Dep. 30d), 13 (Adelantos CC), 14 (Prést. Pers.)
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TabBCRA({ initialSubtab }: { initialSubtab?: string | null }) {
  const [activeTab, setActiveTab] = useState(initialSubtab ?? "plazofijo")

  return (
    <div>
      {/* Header */}
      <div style={{
        fontSize: 9, color: "var(--positive)", letterSpacing: 2, fontFamily: "var(--font-data)",
        background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)",
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
      {activeTab === "tasas"     && <TasasView     />}
      {activeTab === "agregados" && <AgregadosView />}
      {activeTab === "reservas"  && <ReservasView  />}
      {activeTab === "compras"   && <ComprasView   />}
      {activeTab === "rem"       && <REMView       />}
    </div>
  )
}
