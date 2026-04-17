"use client"

import { useState, useEffect } from "react"
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell,
} from "recharts"

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// USD prices always use English format (comma thousands, period decimal)
function fmtUSD(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—"
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—"
  return `${fmtNum(v, decimals)}%`
}

function changeColor(v: number | null | undefined): string {
  if (v == null) return "#888"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}

// ── Sub-tabs ───────────────────────────────────────────────────────────────────

const FIN_TABS = [
  { key: "acciones",   label: "Acciones",     icon: "▲" },
  { key: "bonos",      label: "Renta Fija",   icon: "§" },
  { key: "rofex",      label: "ROFEX",        icon: "⇄" },
  { key: "plazofijo",  label: "Plazo Fijo",   icon: "%" },
  { key: "commodities", label: "Commodities",    icon: "◈" },
  { key: "mundo",      label: "Mercados Mundo", icon: "⬡" },
  { key: "crypto",     label: "Cripto",         icon: "₿" },
]

function SubTabs({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <div style={{
      background: "#050505", borderBottom: "1px solid #111",
      display: "flex", alignItems: "center", padding: "10px 14px",
      gap: 6, flexWrap: "wrap",
    }}>
      {FIN_TABS.map(t => {
        const isActive = active === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: isActive ? "rgba(255,160,40,0.08)" : "transparent",
            border: isActive ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
            borderRadius: 20, cursor: "pointer", padding: "5px 14px",
            whiteSpace: "nowrap", transition: "all 0.15s", fontFamily: "monospace",
          }}>
            <span style={{ fontSize: 11, color: isActive ? "#FFA028" : "#555", fontWeight: 700 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: isActive ? "#FFA028" : "#888", fontWeight: isActive ? 600 : 400, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KPI({ label, value, unit, valueColor = "#fff", sub }: { label: string; value: string | null; unit?: string; valueColor?: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 150px", padding: "10px 14px", background: "#080808", border: "1px solid #111", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor, fontFamily: "monospace", lineHeight: 1 }}>{value ?? "—"}</div>
      {unit && <div style={{ fontSize: 8, color: "#bbb", fontFamily: "monospace" }}>{unit}</div>}
      {sub && <div style={{ fontSize: 8, color: "#666", fontFamily: "monospace" }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, color: "#ccc", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "monospace" }}>
      {title}
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: "#555", fontFamily: "monospace", fontSize: 10 }}>Cargando…</div>
}

const tooltipStyle = {
  contentStyle: { background: "#0a0a0a", border: "1px solid #222", fontSize: 10, color: "#fff" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#aaa" },
}

// ── ACCIONES ─────────────────────────────────────────────────────────────────

interface StockQuote {
  ticker: string
  category: string
  lastPrice: number | null
  closePrice: number | null
  openPrice: number | null
  change1D: number | null
  volume: number | null
  bid: number | null
  ask: number | null
}

function AccionesView() {
  const [data, setData] = useState<{ byCategory: Record<string, StockQuote[]>; categories: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState("all")

  useEffect(() => {
    fetch("/api/acciones?category=all")
      .then(r => r.json())
      .then(j => setData(j.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!data) return <div style={{ padding: 40, color: "#555", fontFamily: "monospace", fontSize: 10 }}>Sin datos</div>

  const allStocks = cat === "all"
    ? Object.values(data.byCategory).flat()
    : (data.byCategory[cat] ?? [])

  const withPrice = allStocks.filter(s => s.lastPrice != null)
  const top5Gain = [...withPrice].sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0)).slice(0, 5)
  const top5Loss = [...withPrice].sort((a, b) => (a.change1D ?? 0) - (b.change1D ?? 0)).slice(0, 5)
  const mervalTotal = withPrice.length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="Acciones con precio" value={String(mervalTotal)} unit="tickers activos" />
        <KPI label="Mejor del día" value={top5Gain[0] ? top5Gain[0].ticker : null} valueColor="#4AF6C3"
          unit={top5Gain[0]?.change1D != null ? `+${fmtPct(top5Gain[0].change1D)}` : undefined} />
        <KPI label="Peor del día" value={top5Loss[0] ? top5Loss[0].ticker : null} valueColor="#FF433D"
          unit={top5Loss[0]?.change1D != null ? fmtPct(top5Loss[0].change1D) : undefined} />
        <KPI label="Suben" value={String(withPrice.filter(s => (s.change1D ?? 0) > 0).length)} valueColor="#4AF6C3" unit="acciones" />
        <KPI label="Bajan" value={String(withPrice.filter(s => (s.change1D ?? 0) < 0).length)} valueColor="#FF433D" unit="acciones" />
      </div>

      {/* Filtro categorías */}
      <div style={{ padding: "8px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {["all", ...data.categories].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            fontSize: 9, fontFamily: "monospace", padding: "3px 10px",
            background: cat === c ? "rgba(255,160,40,0.12)" : "transparent",
            border: cat === c ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
            color: cat === c ? "#FFA028" : "#666", borderRadius: 20, cursor: "pointer",
          }}>{c === "all" ? "Todos" : c}</button>
        ))}
      </div>

      {/* Chart variaciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="Top 10 variación diaria" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...top5Gain, ...top5Loss.reverse()].map(s => ({ ticker: s.ticker, pct: s.change1D ?? 0 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" horizontal={false} />
              <XAxis type="number" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v.toFixed(1)}%`} />
              <YAxis type="category" dataKey="ticker" stroke="#333" fontSize={9} tick={{ fill: "#aaa" }} width={60} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`, "Variación"]} />
              <Bar dataKey="pct" radius={[0, 2, 2, 0]}>
                {[...top5Gain, ...top5Loss.reverse()].map((s, i) => (
                  <Cell key={i} fill={(s.change1D ?? 0) >= 0 ? "#4AF6C3" : "#FF433D"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mapa de calor simplificado */}
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="Screener" />
          <div style={{ overflowY: "auto", maxHeight: 260 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                  {["Ticker", "Sector", "Último", "Var. %", "Volumen"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: h === "Ticker" || h === "Sector" ? "left" : "right", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withPrice.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                    <td style={{ padding: "3px 8px", color: "#FFA028", fontWeight: 700 }}>{s.ticker}</td>
                    <td style={{ padding: "3px 8px", color: "#555" }}>{s.category}</td>
                    <td style={{ padding: "3px 8px", color: "#fff", textAlign: "right" }}>{fmtNum(s.lastPrice, 2)}</td>
                    <td style={{ padding: "3px 8px", color: changeColor(s.change1D), textAlign: "right", fontWeight: 700 }}>
                      {s.change1D != null ? `${s.change1D >= 0 ? "+" : ""}${fmtNum(s.change1D, 2)}%` : "—"}
                    </td>
                    <td style={{ padding: "3px 8px", color: "#555", textAlign: "right" }}>
                      {s.volume != null ? fmtNum(s.volume / 1e6, 2) + "M" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: api-merval (Railway) · Precios en tiempo real BYMA 24hs
      </div>
    </div>
  )
}

// ── BONOS ─────────────────────────────────────────────────────────────────────

interface BondRow {
  ticker: string
  nombre: string
  ley: string
  cupon: number
  vencimiento: string
  precio: number | null
  paridad: number | null
  tir: number | null
  currentYield: number | null
  durationMod: number | null
  vnResidual: number
}

function BonosView() {
  const [bonos, setBonos] = useState<BondRow[]>([])
  const [lecaps, setLecaps] = useState<{ ticker: string; tipo: string; vencimiento: string; diasVencimiento: number; precio: number | null; tir: number | null; tea: number | null; tem: number | null }[]>([])
  const [tab, setTab] = useState<"soberanos" | "lecap">("soberanos")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/bonos").then(r => r.json()),
      fetch("/api/bonos?tipo=lecap").then(r => r.json()),
    ]).then(([b, l]) => {
      setBonos(Array.isArray(b.data) ? b.data : [])
      setLecaps(Array.isArray(l.data) ? l.data : [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const withTir = bonos.filter(b => b.tir != null)
  const avgTir = withTir.length ? withTir.reduce((s, b) => s + (b.tir ?? 0), 0) / withTir.length : null
  const avgPar = bonos.filter(b => b.paridad != null).reduce((s, b, _, a) => s + (b.paridad ?? 0) / a.length, 0) || null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="Bonos soberanos" value={String(bonos.length)} unit="hard dollar" />
        <KPI label="TIR promedio" value={avgTir != null ? fmtPct(avgTir) : null} valueColor="#FFA028" unit="yield to maturity" />
        <KPI label="Paridad promedio" value={avgPar != null ? fmtPct(avgPar) : null} valueColor="#4AF6C3" unit="% del VN residual" />
        <KPI label="LECAPs / BONCAPs" value={String(lecaps.length)} unit="instrumentos locales" />
      </div>

      {/* Selector */}
      <div style={{ padding: "8px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", gap: 4 }}>
        {(["soberanos", "lecap"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontSize: 9, fontFamily: "monospace", padding: "3px 12px", borderRadius: 20, cursor: "pointer",
            background: tab === t ? "rgba(255,160,40,0.12)" : "transparent",
            border: tab === t ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
            color: tab === t ? "#FFA028" : "#666",
          }}>{t === "soberanos" ? "Soberanos Hard Dollar" : "LECAP / BONCAP"}</button>
        ))}
      </div>

      {tab === "soberanos" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
          {/* Curva de rendimientos */}
          <div style={{ background: "#050505", padding: 16 }}>
            <SectionTitle title="Curva de rendimientos (TIR vs Duration)" />
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
                <XAxis dataKey="dur" name="Duration" stroke="#333" fontSize={9} tick={{ fill: "#888" }} label={{ value: "Duration (años)", position: "insideBottom", offset: -10, fill: "#666", fontSize: 8 }} />
                <YAxis dataKey="tir" name="TIR" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} />
                <Tooltip {...tooltipStyle} cursor={{ stroke: "#333" }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as { ticker: string; tir: number; dur: number; paridad: number }
                  return (
                    <div style={{ background: "#0a0a0a", border: "1px solid #222", padding: "6px 10px", fontSize: 9, fontFamily: "monospace", color: "#fff" }}>
                      <div style={{ color: "#FFA028", fontWeight: 700 }}>{d.ticker}</div>
                      <div>TIR: {fmtPct(d.tir)}</div>
                      <div>Duration: {fmtNum(d.dur, 2)} años</div>
                      <div>Paridad: {fmtPct(d.paridad)}</div>
                    </div>
                  )
                }} />
                <Scatter
                  data={bonos.filter(b => b.tir != null && b.durationMod != null).map(b => ({ ticker: b.ticker, tir: b.tir, dur: b.durationMod, paridad: b.paridad ?? 0 }))}
                  fill="#FFA028"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla soberanos */}
          <div style={{ background: "#050505", padding: 16 }}>
            <SectionTitle title="Screener soberanos" />
            <div style={{ overflowY: "auto", maxHeight: 260 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Ticker", "Ley", "Vto.", "Precio", "Paridad", "TIR", "Duration"].map(h => (
                      <th key={h} style={{ padding: "4px 6px", color: "#555", textAlign: h === "Ticker" || h === "Ley" ? "left" : "right", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bonos.map((b, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                      <td style={{ padding: "3px 6px", color: "#FFA028", fontWeight: 700 }}>{b.ticker}</td>
                      <td style={{ padding: "3px 6px", color: "#555" }}>{b.ley}</td>
                      <td style={{ padding: "3px 6px", color: "#888" }}>{b.vencimiento?.slice(0, 7)}</td>
                      <td style={{ padding: "3px 6px", color: "#fff", textAlign: "right" }}>{b.precio != null ? fmtNum(b.precio, 2) : "—"}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", color: b.paridad != null && b.paridad < 50 ? "#FF433D" : "#4AF6C3" }}>
                        {b.paridad != null ? fmtPct(b.paridad) : "—"}
                      </td>
                      <td style={{ padding: "3px 6px", color: "#FFA028", textAlign: "right", fontWeight: 700 }}>{b.tir != null ? fmtPct(b.tir) : "—"}</td>
                      <td style={{ padding: "3px 6px", color: "#888", textAlign: "right" }}>{b.durationMod != null ? fmtNum(b.durationMod, 2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "lecap" && (
        <div style={{ padding: 16, background: "#050505" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111", marginBottom: 1 }}>
            {/* Curva LECAP */}
            <div style={{ background: "#050505", padding: 16 }}>
              <SectionTitle title="Curva LECAP / BONCAP — TEM vs plazo" />
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lecaps.filter(l => l.tem != null).sort((a, b) => a.diasVencimiento - b.diasVencimiento).map(l => ({ label: l.ticker, dias: l.diasVencimiento, tem: l.tem }))} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
                  <XAxis dataKey="dias" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}d`} />
                  <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} />
                  <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`, "TEM"]} />
                  <Line type="monotone" dataKey="tem" stroke="#FFD700" strokeWidth={2} dot={{ r: 3, fill: "#FFD700" }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla LECAP */}
            <div style={{ background: "#050505", padding: 16 }}>
              <SectionTitle title="Detalle instrumentos" />
              <div style={{ overflowY: "auto", maxHeight: 240 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                      {["Ticker", "Tipo", "Vto.", "Días", "Precio", "TEM", "TEA"].map(h => (
                        <th key={h} style={{ padding: "4px 6px", color: "#555", fontWeight: 400, textAlign: h === "Ticker" || h === "Tipo" ? "left" : "right" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lecaps.sort((a, b) => a.diasVencimiento - b.diasVencimiento).map((l, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                        <td style={{ padding: "3px 6px", color: "#FFA028", fontWeight: 700 }}>{l.ticker}</td>
                        <td style={{ padding: "3px 6px", color: "#555" }}>{l.tipo}</td>
                        <td style={{ padding: "3px 6px", color: "#888" }}>{l.vencimiento}</td>
                        <td style={{ padding: "3px 6px", color: "#888", textAlign: "right" }}>{l.diasVencimiento}</td>
                        <td style={{ padding: "3px 6px", color: "#fff", textAlign: "right" }}>{l.precio != null ? fmtNum(l.precio, 2) : "—"}</td>
                        <td style={{ padding: "3px 6px", color: "#FFD700", textAlign: "right", fontWeight: 700 }}>{l.tem != null ? fmtPct(l.tem) : "—"}</td>
                        <td style={{ padding: "3px 6px", color: "#aaa", textAlign: "right" }}>{l.tea != null ? fmtPct(l.tea) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: base local + Rava Bursátil (precios) · TIR calculada por Newton-Raphson sobre flujos futuros
      </div>
    </div>
  )
}

// ── ROFEX ─────────────────────────────────────────────────────────────────────

interface RofexRow {
  id: string
  date: string
  position: string
  maturity: string
  maturityLabel: string
  price: number
  devaluation: number
  monthlyDevaluation: number
  tna: number
  cft: number
  volume?: number | null
  openInterest?: number | null
  source?: "matba" | "db"
}

function RofexView() {
  const [data, setData] = useState<RofexRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/rofex")
      .then(r => r.json())
      .then(j => setData(Array.isArray(j) ? j : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!data.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "#555", fontFamily: "monospace", fontSize: 9 }}>
      Sin datos ROFEX — Matba API no disponible · verificar conectividad
    </div>
  )

  const maxDev = Math.max(...data.map(d => d.devaluation ?? 0))
  const nearFuture = data[0]
  const farFuture = data[data.length - 1]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="Posiciones activas" value={String(data.length)} unit="contratos en el mercado" />
        <KPI label="Posición más cercana" value={nearFuture?.maturityLabel ?? null} valueColor="#FFA028"
          unit={nearFuture ? `$${fmtNum(nearFuture.price, 2)} · Dev: ${fmtPct(nearFuture.devaluation)}` : undefined} />
        <KPI label="Posición más lejana" value={farFuture?.maturityLabel ?? null} valueColor="#4AF6C3"
          unit={farFuture ? `$${fmtNum(farFuture.price, 2)} · Dev: ${fmtPct(farFuture.devaluation)}` : undefined} />
        <KPI label="Devaluación máxima impl." value={fmtPct(maxDev)} valueColor="#FF6B6B" unit="según ROFEX" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
        {/* Precios futuros */}
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="Precio implícito USD/ARS por posición" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.map(d => ({ label: d.maturityLabel, price: d.price }))} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="label" stroke="#333" fontSize={8} tick={{ fill: "#888" }} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `$${Math.round(v)}`} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`$${fmtNum(v as number, 2)}`, "Precio"]} />
              <Bar dataKey="price" fill="#FFA028" radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Devaluación implícita */}
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="Devaluación implícita acumulada (%)" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.map(d => ({ label: d.maturityLabel, dev: d.devaluation, tna: d.tna }))} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="label" stroke="#333" fontSize={8} tick={{ fill: "#888" }} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`${fmtNum(v as number, 2)}%`, name === "dev" ? "Devaluación acum." : "TNA"]} />
              <Area type="monotone" dataKey="dev" stroke="#FF6B6B" fill="#FF6B6B22" strokeWidth={2} name="dev" />
              <Line type="monotone" dataKey="tna" stroke="#FFD700" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="tna" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ padding: 16, background: "#050505", borderTop: "1px solid #111" }}>
        <SectionTitle title="Tabla de posiciones" />
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
              {["Posición", "Vencimiento", "Precio", "Dev. Acum.", "Dev. Mensual", "TNA", "CFT"].map(h => (
                <th key={h} style={{ padding: "4px 8px", color: "#555", textAlign: h === "Posición" || h === "Vencimiento" ? "left" : "right", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                <td style={{ padding: "3px 8px", color: "#FFA028", fontWeight: 700 }}>{d.maturityLabel}</td>
                <td style={{ padding: "3px 8px", color: "#888" }}>{d.maturity?.slice(0, 10)}</td>
                <td style={{ padding: "3px 8px", color: "#fff", textAlign: "right" }}>${fmtNum(d.price, 2)}</td>
                <td style={{ padding: "3px 8px", color: "#FF6B6B", textAlign: "right" }}>{fmtPct(d.devaluation)}</td>
                <td style={{ padding: "3px 8px", color: "#aaa", textAlign: "right" }}>{fmtPct(d.monthlyDevaluation)}</td>
                <td style={{ padding: "3px 8px", color: "#FFD700", textAlign: "right" }}>{fmtPct(d.tna)}</td>
                <td style={{ padding: "3px 8px", color: "#aaa", textAlign: "right" }}>{fmtPct(d.cft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: {data[0]?.source === "matba" ? "Matba Rofex API (apicem.matbarofex.com.ar)" : "ROFEX DB (cron)"} · Actualización cada 5 min
      </div>
    </div>
  )
}

// ── PLAZO FIJO ────────────────────────────────────────────────────────────────

interface PlazoFijoData {
  tna_promedio?: number
  tea_promedio?: number
}

// Bancos tradicionales — tasas orientativas ARS · abril 2026
const BANCOS_ARS = [
  { nombre: "Banco Nación",        tna: 29.0 },
  { nombre: "Banco Provincia",     tna: 30.0 },
  { nombre: "Banco Galicia",       tna: 31.0 },
  { nombre: "Banco BBVA",          tna: 30.5 },
  { nombre: "Banco Santander",     tna: 30.5 },
  { nombre: "Banco Macro",         tna: 31.5 },
  { nombre: "Banco HSBC",          tna: 30.0 },
  { nombre: "Banco ICBC",          tna: 31.0 },
  { nombre: "Banco Patagonia",     tna: 31.0 },
  { nombre: "Naranja X / Brubank", tna: 36.0 },
  { nombre: "Ualá",                tna: 37.0 },
  { nombre: "Mercado Pago",        tna: 38.0 },
]

// Plazo fijo UVA — referencia: rendimiento CER + spread orientativo
const INFO_UVA = {
  cerMensual: 2.4,      // IPC mensual estimado abril 2026 (orientativo)
  spreadBancos: 1.0,    // spread adicional sobre CER (ptos pct)
  plazo: 90,            // días mínimos por ley
}

// Plazo fijo USD — tasas orientativas (muy bajas, depósitos en USD)
const BANCOS_USD = [
  { nombre: "Banco Nación",    tna: 0.50 },
  { nombre: "Banco Galicia",   tna: 0.75 },
  { nombre: "Banco Macro",     tna: 0.75 },
  { nombre: "Banco BBVA",      tna: 0.50 },
  { nombre: "Banco Santander", tna: 0.60 },
  { nombre: "Banco ICBC",      tna: 1.00 },
  { nombre: "Banco Patagonia", tna: 0.80 },
]

type PFMode = "ars" | "uva" | "usd"

function PlazoFijoView() {
  const [data, setData] = useState<PlazoFijoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<PFMode>("ars")

  useEffect(() => {
    fetch("/api/bcra?variable=35")
      .then(r => r.json())
      .then(j => {
        const rows = j?.data ?? j ?? []
        const last = Array.isArray(rows) ? rows[rows.length - 1] : null
        if (last?.valor) {
          const tna = last.valor
          const tea = (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100
          setData({ tna_promedio: tna, tea_promedio: parseFloat(tea.toFixed(2)) })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tna = data?.tna_promedio ?? 30.0
  const tea = data?.tea_promedio ?? parseFloat(((Math.pow(1 + tna / 100 / 365, 365) - 1) * 100).toFixed(2))
  const tem = parseFloat(((Math.pow(1 + tna / 100 / 365, 30) - 1) * 100).toFixed(2))

  const chartDataARS = BANCOS_ARS.map(b => ({
    nombre: b.nombre.replace("Banco ", ""),
    tna: b.tna,
    tea: parseFloat(((Math.pow(1 + b.tna / 100 / 365, 365) - 1) * 100).toFixed(2)),
  }))

  const chartDataUSD = BANCOS_USD.map(b => ({
    nombre: b.nombre.replace("Banco ", ""),
    tna: b.tna,
    tea: parseFloat(((Math.pow(1 + b.tna / 100 / 365, 365) - 1) * 100).toFixed(4)),
  }))

  // UVA: rendimiento real estimado = CER + spread
  const uvaRendMensual = INFO_UVA.cerMensual + INFO_UVA.spreadBancos
  const uvaTEA = (Math.pow(1 + uvaRendMensual / 100, 12) - 1) * 100
  // Comparación: TF tasa fija vs UVA
  const convieneTasaFija = tem >= uvaRendMensual

  if (loading) return <Loading />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toggle modo */}
      <div style={{ padding: "8px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 8, color: "#555", fontFamily: "monospace", marginRight: 8 }}>TIPO:</span>
        {([["ars", "Pesos (TNA)"], ["uva", "UVA (CER)"], ["usd", "Dólares (TNA)"]] as [PFMode, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            fontSize: 9, fontFamily: "monospace", padding: "3px 12px", borderRadius: 20, cursor: "pointer",
            background: mode === k ? "rgba(255,160,40,0.12)" : "transparent",
            border: mode === k ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
            color: mode === k ? "#FFA028" : "#666",
          }}>{label}</button>
        ))}
        <div style={{ marginLeft: "auto", padding: "4px 10px", background: convieneTasaFija ? "#0d1f14" : "#1f0d0d", border: `1px solid ${convieneTasaFija ? "#4AF6C3" : "#FF433D"}22`, borderRadius: 6 }}>
          <span style={{ fontSize: 8, color: convieneTasaFija ? "#4AF6C3" : "#FF433D", fontFamily: "monospace" }}>
            {convieneTasaFija ? "▲ Conviene Tasa Fija hoy" : "▲ Conviene UVA hoy"}
          </span>
        </div>
      </div>

      {/* KPIs */}
      {mode === "ars" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
          <KPI label="TNA promedio (BCRA)" value={`${fmtNum(tna)}%`} valueColor="#FFA028" unit="30 días · var 35" />
          <KPI label="TEA equivalente"     value={`${fmtNum(tea)}%`} valueColor="#4AF6C3" unit="tasa efectiva anual" />
          <KPI label="TEM equivalente"     value={`${fmtNum(tem)}%`} valueColor="#FFD700" unit="tasa efectiva mensual" />
          <KPI label="Mayor tasa digital"  value="Mercado Pago / Ualá" valueColor="#CE93D8" unit="~37–38% TNA orientativo" />
        </div>
      )}

      {mode === "uva" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
          <KPI label="CER mensual estimado" value={`${fmtNum(INFO_UVA.cerMensual)}%`} valueColor="#FFA028" unit="inflación mensual orientativa" />
          <KPI label="Spread bancario"       value={`+${fmtNum(INFO_UVA.spreadBancos)} ptos`} valueColor="#888" unit="sobre CER (promedio)" />
          <KPI label="Rendimiento UVA total" value={`${fmtNum(uvaRendMensual)}% mensual`} valueColor="#4AF6C3" unit="CER + spread estimado" />
          <KPI label="TEA equivalente UVA"   value={`${fmtNum(uvaTEA)}%`} valueColor="#CE93D8" unit="si la inflación se mantiene constante" />
        </div>
      )}

      {mode === "usd" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
          <KPI label="Mayor TNA USD"  value="ICBC 1.0% TNA" valueColor="#FFA028" unit="depósito a 30 días en USD" />
          <KPI label="Promedio USD"   value="~0.7% TNA" valueColor="#888" unit="sistema bancario AR" />
          <KPI label="Nota"           value="Muy baja rentabilidad" valueColor="#FF433D" unit="tasas en USD casi nulas en AR" />
        </div>
      )}

      {/* Gráficos */}
      {mode === "ars" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
          <div style={{ background: "#050505", padding: 16 }}>
            <SectionTitle title="TNA por entidad (30 días) — orientativo" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartDataARS} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" horizontal={false} />
                <XAxis type="number" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} domain={[25, 42]} />
                <YAxis type="category" dataKey="nombre" stroke="#333" fontSize={8} tick={{ fill: "#aaa" }} width={100} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 1)}%`, "TNA"]} />
                <ReferenceLine x={tna} stroke="#FFA028" strokeDasharray="4 4" label={{ value: "BCRA", fill: "#FFA028", fontSize: 8 }} />
                <Bar dataKey="tna" radius={[0, 2, 2, 0]}>
                  {chartDataARS.map((d, i) => (
                    <Cell key={i} fill={d.tna >= tna ? "#4AF6C3" : "#FF6B6B"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: "#050505", padding: 16 }}>
            <SectionTitle title="TNA vs TEA por entidad — orientativo" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartDataARS} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
                <XAxis dataKey="nombre" stroke="#333" fontSize={7} tick={{ fill: "#888" }} angle={-35} textAnchor="end" interval={0} />
                <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} domain={[25, 42]} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`${fmtNum(v as number, 2)}%`, name === "tna" ? "TNA" : "TEA"]} />
                <Legend wrapperStyle={{ fontSize: 9, color: "#aaa" }} />
                <Bar dataKey="tna" name="TNA" fill="#FFA028" opacity={0.8} />
                <Bar dataKey="tea" name="TEA" fill="#4AF6C3" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {mode === "uva" && (
        <div style={{ padding: 16, background: "#050505" }}>
          <SectionTitle title="Plazo Fijo UVA — Dinámica" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Info panel */}
            <div style={{ background: "#080808", border: "1px solid #111", padding: 16, fontFamily: "monospace" }}>
              <div style={{ fontSize: 9, color: "#aaa", marginBottom: 12 }}>¿Cuándo conviene el PF UVA?</div>
              <div style={{ fontSize: 8, color: "#555", lineHeight: 1.8 }}>
                <div>• <span style={{ color: "#fff" }}>El PF UVA ajusta por CER (inflación)</span></div>
                <div>• Si inflación mensual &gt; {fmtNum(tem)}% (TEM tasa fija) → <span style={{ color: "#4AF6C3" }}>conviene UVA</span></div>
                <div>• Si inflación mensual &lt; {fmtNum(tem)}% → <span style={{ color: "#FF433D" }}>conviene tasa fija</span></div>
                <div style={{ marginTop: 8 }}>• Plazo mínimo legal: <span style={{ color: "#FFA028" }}>90 días</span></div>
                <div>• Los bancos pagan CER + spread (~1%) mensual</div>
                <div>• TEA proyectada si CER={fmtNum(INFO_UVA.cerMensual)}%: <span style={{ color: "#CE93D8" }}>{fmtNum(uvaTEA)}%</span></div>
              </div>
            </div>
            {/* Comparación visual */}
            <div style={{ background: "#080808", border: "1px solid #111", padding: 16 }}>
              <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace", marginBottom: 8 }}>Rendimiento mensual comparado</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 140 }}>
                {[
                  { label: "Tasa Fija (TEM)", value: tem, color: "#FFA028" },
                  { label: "UVA estimado", value: uvaRendMensual, color: "#4AF6C3" },
                ].map(item => {
                  const maxVal = Math.max(tem, uvaRendMensual) * 1.2
                  const h = Math.round((item.value / maxVal) * 120)
                  return (
                    <div key={item.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: item.color, fontFamily: "monospace" }}>{fmtNum(item.value)}%</div>
                      <div style={{ width: "100%", height: h, background: item.color, opacity: 0.7, borderRadius: "2px 2px 0 0" }} />
                      <div style={{ fontSize: 7, color: "#555", fontFamily: "monospace", textAlign: "center" }}>{item.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "usd" && (
        <div style={{ padding: 16, background: "#050505" }}>
          <SectionTitle title="PF en dólares por entidad — TNA orientativa" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartDataUSD} layout="vertical" margin={{ left: 10, right: 50 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" horizontal={false} />
              <XAxis type="number" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="nombre" stroke="#333" fontSize={8} tick={{ fill: "#aaa" }} width={100} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`, "TNA USD"]} />
              <Bar dataKey="tna" fill="#4FC3F7" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, padding: 10, background: "#080808", border: "1px solid #1a1a1a", fontFamily: "monospace", fontSize: 8, color: "#555" }}>
            ⚠️ Las tasas de PF en USD en Argentina son históricamente muy bajas. Alternativas: ON en USD (BYMA), bonos soberanos o FCI Money Market USD.
          </div>
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        {mode === "ars" && "TNA promedio: BCRA API var 35 · Tasas por entidad: orientativas abril 2026 — verificar en cada banco · Reg. A 7095"}
        {mode === "uva" && "CER: BCRA vía datos.gob.ar · PF UVA: Reg. A 7297 (mínimo 90 días) · Proyección asume inflación constante"}
        {mode === "usd" && "Tasas USD: orientativas abril 2026 — extremadamente bajas. Verificar en cada banco"}
      </div>
    </div>
  )
}

// ── AGREGADOS MONETARIOS ───────────────────────────────────────────────────────

interface AgregadoPoint { fecha: string; valor: number }

function AgregadosView() {
  const [m1, setM1] = useState<AgregadoPoint[]>([])
  const [m2, setM2] = useState<AgregadoPoint[]>([])
  const [bm, setBm] = useState<AgregadoPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // BCRA: var 15 = Base Monetaria, var 17 = M1, var 18 = M2
    const from = `${new Date().getUTCFullYear() - 3}-01-01`
    const today = new Date().toISOString().slice(0, 10)
    const fetchVar = (v: number) =>
      fetch(`/api/bcra?variable=${v}&from=${from}&to=${today}`)
        .then(r => r.json())
        .then(j => (j.data ?? j ?? []) as AgregadoPoint[])
        .catch(() => [] as AgregadoPoint[])

    Promise.all([fetchVar(17), fetchVar(18), fetchVar(15)])
      .then(([m1d, m2d, bmd]) => { setM1(m1d); setM2(m2d); setBm(bmd) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const lastM1 = m1[m1.length - 1]?.valor
  const lastM2 = m2[m2.length - 1]?.valor
  const lastBM = bm[bm.length - 1]?.valor

  // Unir series por fecha para el gráfico
  const byDate: Record<string, { fecha: string; m1?: number; m2?: number; bm?: number }> = {}
  for (const p of m1) { byDate[p.fecha] = { ...(byDate[p.fecha] ?? { fecha: p.fecha }), m1: p.valor } }
  for (const p of m2) { byDate[p.fecha] = { ...(byDate[p.fecha] ?? { fecha: p.fecha }), m2: p.valor } }
  for (const p of bm) { byDate[p.fecha] = { ...(byDate[p.fecha] ?? { fecha: p.fecha }), bm: p.valor } }
  const chartData = Object.values(byDate).sort((a, b) => a.fecha.localeCompare(b.fecha))
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 120)) === 0) // decimar

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="Base Monetaria" value={lastBM != null ? `$${fmtNum(lastBM / 1000, 0)}B` : null} valueColor="#FF6B6B" unit="millones ARS" />
        <KPI label="M1" value={lastM1 != null ? `$${fmtNum(lastM1 / 1000, 0)}B` : null} valueColor="#FFA028" unit="billetes + cuentas corrientes" />
        <KPI label="M2" value={lastM2 != null ? `$${fmtNum(lastM2 / 1000, 0)}B` : null} valueColor="#4AF6C3" unit="M1 + cajas de ahorro" />
        {lastM1 && lastM2 && <KPI label="Cuasidinero" value={`$${fmtNum((lastM2 - lastM1) / 1000, 0)}B`} valueColor="#CE93D8" unit="M2 - M1" />}
      </div>

      {/* Chart */}
      <div style={{ padding: 16, background: "#050505" }}>
        <SectionTitle title="Agregados monetarios — últimos 3 años (millones ARS)" />
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
            <XAxis dataKey="fecha" stroke="#333" fontSize={8} tick={{ fill: "#888" }} tickFormatter={d => d?.slice(0, 7) ?? ""} interval={Math.floor(chartData.length / 12)} />
            <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${Math.round(v / 1e6)}T`} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`$${fmtNum((v as number) / 1000, 0)}B`, name === "bm" ? "Base Monetaria" : name === "m1" ? "M1" : "M2"]} />
            <Legend wrapperStyle={{ fontSize: 9, color: "#aaa" }} />
            <Line type="monotone" dataKey="bm" stroke="#FF6B6B" strokeWidth={1.5} dot={false} name="bm" isAnimationActive={false} />
            <Line type="monotone" dataKey="m1" stroke="#FFA028" strokeWidth={1.5} dot={false} name="m1" isAnimationActive={false} />
            <Line type="monotone" dataKey="m2" stroke="#4AF6C3" strokeWidth={1.5} dot={false} name="m2" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: BCRA API v4.0 — Variables 15 (BM), 17 (M1), 18 (M2) · Frecuencia diaria
      </div>
    </div>
  )
}

// ── COMMODITIES ───────────────────────────────────────────────────────────────

const COMM_GROUPS = [
  {
    label: "Agrícolas",
    color: "#4AF6C3",
    items: [
      { key: "soja",     label: "Soja",     unit: "USD/bu",  ticker: "ZS=F",  decimals: 2, flag: "🫘" },
      { key: "maiz",     label: "Maíz",     unit: "USD/bu",  ticker: "ZC=F",  decimals: 2, flag: "🌽" },
      { key: "trigo",    label: "Trigo",    unit: "USD/bu",  ticker: "ZW=F",  decimals: 2, flag: "🌾" },
      { key: "arroz",    label: "Arroz",    unit: "USD/cwt", ticker: "ZR=F",  decimals: 2, flag: "🍚" },
      { key: "azucar",   label: "Azúcar",   unit: "c/lb",    ticker: "SB=F",  decimals: 2, flag: "🧂" },
      { key: "cafe",     label: "Café",     unit: "USD/lb",  ticker: "KC=F",  decimals: 2, flag: "☕" },
      { key: "algodon",  label: "Algodón",  unit: "USD/lb",  ticker: "CT=F",  decimals: 2, flag: "🪡" },
    ],
  },
  {
    label: "Energía",
    color: "#FFA028",
    items: [
      { key: "petroleo",    label: "WTI",         unit: "USD/bbl", ticker: "CL=F", decimals: 2, flag: "🛢️" },
      { key: "brent",       label: "Brent",       unit: "USD/bbl", ticker: "BZ=F", decimals: 2, flag: "🛢️" },
      { key: "gas_natural", label: "Gas Natural", unit: "USD/MMBtu", ticker: "NG=F", decimals: 3, flag: "🔥" },
      { key: "gasoil",      label: "Gasoil",      unit: "USD/gal", ticker: "HO=F", decimals: 3, flag: "⛽" },
    ],
  },
  {
    label: "Metales",
    color: "#FFD700",
    items: [
      { key: "oro",    label: "Oro",   unit: "USD/oz", ticker: "GC=F", decimals: 0, flag: "🥇" },
      { key: "plata",  label: "Plata", unit: "USD/oz", ticker: "SI=F", decimals: 2, flag: "🥈" },
      { key: "cobre",  label: "Cobre", unit: "USD/lb", ticker: "HG=F", decimals: 3, flag: "🔶" },
    ],
  },
  {
    label: "Tierras Raras & Estratégicos",
    color: "#CE93D8",
    items: [
      { key: "remx",        label: "REMX ETF",     unit: "ETF USD",  ticker: "REMX", decimals: 2, flag: "⛏️" },
      { key: "mp_materials",label: "MP Materials",  unit: "USD/acc",  ticker: "MP",   decimals: 2, flag: "🪨" },
      { key: "lithium_etf", label: "Litio ETF",     unit: "ETF USD",  ticker: "LIT",  decimals: 2, flag: "🔋" },
      { key: "albemarle",   label: "Albemarle",     unit: "USD/acc",  ticker: "ALB",  decimals: 2, flag: "⚗️" },
      { key: "uranium",     label: "Uranio ETF",    unit: "ETF USD",  ticker: "URA",  decimals: 2, flag: "☢️" },
      { key: "cobalt_nickel",label: "Vale (Ni/Co)", unit: "USD/acc",  ticker: "VALE", decimals: 2, flag: "🧲" },
    ],
  },
]

const COMM_ALL = COMM_GROUPS.flatMap(g => g.items)

interface AgroGrano { disponible: number | null; fobOficial: number | null; retencion: number; unidad: string }
interface AgroLocalData { soja: AgroGrano; maiz: AgroGrano; trigo: AgroGrano; girasol: AgroGrano; source: string }

function CommoditiesView() {
  const [snap, setSnap] = useState<Record<string, WorldQuote | null>>({})
  const [histMap, setHistMap] = useState<Record<string, [string, number][]>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set(["soja", "maiz", "trigo"]))
  const [selPeriod, setSelPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())
  const [agroLocal, setAgroLocal] = useState<AgroLocalData | null>(null)

  useEffect(() => {
    fetch("/api/mundo")
      .then(r => r.json())
      .then(j => setSnap(j.data ?? {}))
      .finally(() => setLoading(false))

    fetch("/api/agro-local")
      .then(r => r.json())
      .then(j => setAgroLocal(j))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const toFetch = [...selected].filter(k => !histMap[`${k}_${selPeriod}`])
    if (!toFetch.length) return
    setLoadingKeys(prev => new Set([...prev, ...toFetch]))
    Promise.all(
      toFetch.map(k =>
        fetch(`/api/mundo?ticker=${k}&hist=${selPeriod}`)
          .then(r => r.json())
          .then(j => ({ k, data: (j.data ?? []) as [string, number][] }))
          .catch(() => ({ k, data: [] as [string, number][] }))
      )
    ).then(results => {
      setHistMap(prev => {
        const next = { ...prev }
        for (const { k, data } of results) next[`${k}_${selPeriod}`] = data
        return next
      })
      setLoadingKeys(prev => {
        const next = new Set(prev)
        for (const { k } of results) next.delete(k)
        return next
      })
    })
  }, [selected, selPeriod])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  if (loading) return <Loading />

  const isMulti = selected.size > 1
  const allSeries = [...selected].map(k => ({
    item: COMM_ALL.find(c => c.key === k)!,
    group: COMM_GROUPS.find(g => g.items.some(i => i.key === k))!,
    data: histMap[`${k}_${selPeriod}`] ?? [],
  })).filter(s => s.item)

  const seriesMap: Record<string, Record<string, number>> = {}
  for (const s of allSeries) seriesMap[s.item.key] = Object.fromEntries(s.data)

  // Primera fecha común a TODAS las series seleccionadas
  const commonStart = allSeries.reduce<string | null>((acc, s) => {
    const first = s.data[0]?.[0]
    if (!first) return acc
    return acc == null || first > acc ? first : acc
  }, null)

  const dateSet = new Set<string>()
  for (const s of allSeries) for (const [d] of s.data) {
    if (!commonStart || d >= commonStart) dateSet.add(d)
  }
  const dates = [...dateSet].sort()

  const base0: Record<string, number> = {}
  if (isMulti && commonStart) {
    for (const s of allSeries) {
      // Buscar el valor en commonStart o el primer valor disponible desde ahí
      const val = seriesMap[s.item.key]?.[commonStart]
        ?? s.data.find(([d]) => d >= commonStart)?.[1]
      if (val) base0[s.item.key] = val
    }
  }

  const chartData = dates.map(fecha => {
    const row: Record<string, unknown> = { fecha }
    for (const s of allSeries) {
      const raw = seriesMap[s.item.key]?.[fecha]
      if (raw != null) {
        row[s.item.key] = isMulti && base0[s.item.key]
          ? parseFloat((((raw / base0[s.item.key]) - 1) * 100).toFixed(2))
          : raw
      }
    }
    return row
  })

  // Colores únicos por ítem
  const ITEM_COLORS = ["#4AF6C3","#FFA028","#FFD700","#FF6B6B","#CE93D8","#4FC3F7","#F06292","#81C784","#FF8A65","#A5D6A7","#90CAF9"]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Cards por grupo */}
      {COMM_GROUPS.map(g => (
        <div key={g.label}>
          <div style={{ padding: "5px 14px 2px", fontSize: 8, color: g.color, textTransform: "uppercase", letterSpacing: 2, fontFamily: "monospace", background: "#030303", borderBottom: "1px solid #0d0d0d" }}>
            {g.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "4px 14px 6px", background: "#050505", borderBottom: "1px solid #111" }}>
            {g.items.map((item, idx) => {
              const q = snap[item.key]
              const isActive = selected.has(item.key)
              const color = ITEM_COLORS[COMM_ALL.findIndex(c => c.key === item.key) % ITEM_COLORS.length]
              return (
                <button key={item.key} onClick={() => toggle(item.key)} style={{
                  flex: "1 1 120px", padding: "8px 10px", textAlign: "left", cursor: "pointer",
                  background: isActive ? "#0d0d0d" : "#060606",
                  border: isActive ? `1px solid ${color}55` : "1px solid #111",
                  fontFamily: "monospace", transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 8, color: isActive ? color : "#555", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {item.flag} {item.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isActive ? "#fff" : "#444", marginTop: 2, lineHeight: 1 }}>
                    {q ? `$${fmtUSD(q.precio, item.decimals)}` : "—"}
                  </div>
                  <div style={{ fontSize: 8, color: "#555", marginTop: 1 }}>{item.unit}</div>
                  <div style={{ fontSize: 9, color: q ? changeColor(q.variacion_pct) : "#333", marginTop: 2, fontWeight: 700 }}>
                    {q ? `${q.variacion_pct >= 0 ? "+" : ""}${fmtUSD(q.variacion_pct, 2)}%` : "—"}
                  </div>
                  {isActive && <div style={{ width: "100%", height: 2, background: color, marginTop: 3, borderRadius: 1 }} />}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Controles período */}
      <div style={{ padding: "6px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8, color: "#555", fontFamily: "monospace" }}>
          {isMulti ? "% variación desde inicio del período" : `Precio en ${COMM_ALL.find(c => c.key === [...selected][0])?.unit ?? "USD"}`}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
            <button key={p} onClick={() => setSelPeriod(p)} style={{
              fontSize: 8, fontFamily: "monospace", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
              background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
              border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
              color: selPeriod === p ? "#FFA028" : "#555",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ padding: 16, background: "#050505" }}>
        {loadingKeys.size > 0
          ? <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 9, fontFamily: "monospace" }}>Cargando…</div>
          : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
                <XAxis dataKey="fecha" stroke="#333" fontSize={8} tick={{ fill: "#888" }}
                  tickFormatter={d => (d as string)?.slice(0, 7)}
                  interval={Math.max(1, Math.floor(dates.length / 10))} />
                <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} domain={["auto", "auto"]}
                  tickFormatter={v => isMulti
                    ? `${(v as number) >= 0 ? "+" : ""}${Math.round(v as number)}%`
                    : `$${fmtUSD(v as number, allSeries[0]?.item.decimals ?? 2)}`} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, color: "#fff", fontFamily: "monospace" }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#aaa" }}
                  formatter={(v: unknown, name: unknown) => {
                    const item = COMM_ALL.find(c => c.key === name)
                    const val = v as number
                    return isMulti
                      ? [`${val >= 0 ? "+" : ""}${fmtUSD(val, 1)}%`, item?.label ?? String(name)]
                      : [`$${fmtUSD(val, item?.decimals ?? 2)} ${item?.unit ?? ""}`, item?.label ?? String(name)]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9, color: "#aaa" }}
                  formatter={value => COMM_ALL.find(c => c.key === value)?.label ?? value} />
                {isMulti && <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />}
                {allSeries.map((s, idx) => (
                  <Line key={s.item.key} type="monotone" dataKey={s.item.key}
                    stroke={ITEM_COLORS[COMM_ALL.findIndex(c => c.key === s.item.key) % ITEM_COLORS.length]}
                    strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )
        }
        <div style={{ fontSize: 8, color: "#888", marginTop: 4, fontFamily: "monospace" }}>
          {isMulti ? "% variación acumulada desde inicio del período · click en un commodity para agregar/quitar del gráfico" : "Precio de contrato futuro · click en múltiples commodities para comparar rendimientos"}
        </div>
      </div>

      {/* Spread WTI/Brent */}
      {snap.petroleo && snap.brent && (
        <div style={{ padding: "6px 14px", background: "#050505", borderTop: "1px solid #111", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 8, color: "#888", fontFamily: "monospace" }}>SPREAD BRENT – WTI:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#FFA028", fontFamily: "monospace" }}>
            ${fmtUSD(snap.brent.precio - snap.petroleo.precio, 2)} USD/bbl
          </span>
          <span style={{ fontSize: 8, color: "#555", fontFamily: "monospace" }}>
            Brent ${fmtUSD(snap.brent.precio, 2)} · WTI ${fmtUSD(snap.petroleo.precio, 2)}
          </span>
        </div>
      )}

      {/* Precios locales Rosario */}
      {agroLocal && (
        <div style={{ padding: 14, background: "#050505", borderTop: "1px solid #111" }}>
          <SectionTitle title="Precios disponible Rosario (BCR) — USD/tn" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {(["soja", "maiz", "trigo", "girasol"] as const).map(grano => {
              const g = agroLocal[grano]
              return (
                <div key={grano} style={{ flex: "1 1 130px", padding: "8px 10px", background: "#080808", border: "1px solid #111", fontFamily: "monospace" }}>
                  <div style={{ fontSize: 8, color: "#4AF6C3", textTransform: "capitalize", letterSpacing: 1 }}>{grano}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {g.disponible != null ? `$${fmtUSD(g.disponible, 0)}` : "—"}
                  </div>
                  <div style={{ fontSize: 8, color: "#555", marginTop: 1 }}>{g.unidad}</div>
                  {g.fobOficial != null && (
                    <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>
                      FOB: ${fmtUSD(g.fobOficial, 0)} · Ret: {g.retencion}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 7, color: "#444", marginTop: 4, fontFamily: "monospace" }}>
            {agroLocal.source} · FOB teórico = disponible × (1 − retención%) − gastos portuarios ~$15/tn
          </div>
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: Yahoo Finance (futuros) · BCR Rosario (disponible) · ZS=Soja, ZC=Maíz, ZW=Trigo, CL=WTI, GC=Oro · Precios diferidos ~15 min
      </div>
    </div>
  )
}

// ── MERCADOS MUNDO ────────────────────────────────────────────────────────────

interface WorldQuote { precio: number; variacion_pct: number; ticker: string }

const MUNDO_GROUPS: Record<string, string[]> = {
  "Índices": ["sp500", "nasdaq", "dow", "merval", "vix"],
  "Commodities": ["soja", "maiz", "trigo", "petroleo", "brent", "oro"],
  "FX": ["eurusd", "usdbrl", "usdcny", "dxy"],
  "Renta Fija": ["us10y", "us5y", "us2y"],
}

// Puntos de la curva UST — via Treasury.gov CSV (daily)
const UST_CURVE_MATURITIES = [
  { label: "1M",  field: "1 Mo" },
  { label: "3M",  field: "3 Mo" },
  { label: "6M",  field: "6 Mo" },
  { label: "1Y",  field: "1 Yr" },
  { label: "2Y",  field: "2 Yr" },
  { label: "5Y",  field: "5 Yr" },
  { label: "10Y", field: "10 Yr" },
  { label: "30Y", field: "30 Yr" },
]

const MUNDO_LABELS: Record<string, string> = {
  sp500: "S&P 500", nasdaq: "Nasdaq", dow: "Dow Jones", merval: "Merval", vix: "VIX",
  soja: "Soja", maiz: "Maíz", trigo: "Trigo", petroleo: "WTI", brent: "Brent", oro: "Oro",
  eurusd: "EUR/USD", usdbrl: "USD/BRL", usdcny: "USD/CNY", dxy: "DXY",
  us10y: "UST 10Y", us5y: "UST 5Y", us2y: "UST 2Y",
}

const MUNDO_UNITS: Record<string, string> = {
  sp500: "pts", nasdaq: "pts", dow: "pts", merval: "pts", vix: "idx",
  soja: "USD/bu", maiz: "USD/bu", trigo: "USD/bu", petroleo: "USD/bbl", brent: "USD/bbl", oro: "USD/oz",
  eurusd: "EUR/USD", usdbrl: "BRL/USD", usdcny: "CNY/USD", dxy: "idx",
  us10y: "%", us5y: "%", us2y: "%",
}

interface USTPoint { label: string; yield: number }

// Próximos earnings USA — actualizar manualmente cada trimestre
const NEXT_EARNINGS: { ticker: string; empresa: string; fecha: string; afterHours: boolean; sector: string }[] = [
  { ticker: "GOOGL", empresa: "Alphabet",   fecha: "2026-04-24", afterHours: false, sector: "Tech" },
  { ticker: "MSFT",  empresa: "Microsoft",  fecha: "2026-04-23", afterHours: true,  sector: "Tech" },
  { ticker: "META",  empresa: "Meta",       fecha: "2026-04-24", afterHours: true,  sector: "Tech" },
  { ticker: "AAPL",  empresa: "Apple",      fecha: "2026-05-01", afterHours: true,  sector: "Tech" },
  { ticker: "AMZN",  empresa: "Amazon",     fecha: "2026-05-01", afterHours: true,  sector: "Retail/Tech" },
  { ticker: "NVDA",  empresa: "Nvidia",     fecha: "2026-05-22", afterHours: false, sector: "Semiconductores" },
  { ticker: "TSLA",  empresa: "Tesla",      fecha: "2026-07-22", afterHours: false, sector: "EV/Tech" },
  { ticker: "JPM",   empresa: "JPMorgan",   fecha: "2026-07-14", afterHours: false, sector: "Financiero" },
]

function MundoView() {
  const [snap, setSnap] = useState<Record<string, WorldQuote | null>>({})
  const [hist, setHist] = useState<[string, number][]>([])
  const [selTicker, setSelTicker] = useState("sp500")
  const [selPeriod, setSelPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)
  const [ustCurve, setUstCurve] = useState<USTPoint[] | null>(null)

  useEffect(() => {
    fetch("/api/mundo")
      .then(r => r.json())
      .then(j => setSnap(j.data ?? {}))
      .finally(() => setLoading(false))

    // US Treasury yield curve — Treasury.gov CSV
    const year = new Date().getFullYear()
    fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&csv=true`)
      .then(r => r.text())
      .then(csv => {
        const lines = csv.trim().split("\n")
        if (lines.length < 2) return
        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""))
        const lastLine = lines[lines.length - 1].split(",").map(v => v.trim().replace(/"/g, ""))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => { row[h] = lastLine[i] })
        const curve = UST_CURVE_MATURITIES.map(m => {
          const val = parseFloat(row[m.field] ?? "")
          return { label: m.label, yield: isNaN(val) ? 0 : val }
        }).filter(p => p.yield > 0)
        if (curve.length >= 4) setUstCurve(curve)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoadingHist(true)
    fetch(`/api/mundo?ticker=${selTicker}&hist=${selPeriod}`)
      .then(r => r.json())
      .then(j => setHist(j.data ?? []))
      .finally(() => setLoadingHist(false))
  }, [selTicker, selPeriod])

  if (loading) return <Loading />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Grilla de quotes por grupo */}
      {Object.entries(MUNDO_GROUPS).map(([grupo, keys]) => (
        <div key={grupo}>
          <div style={{ padding: "6px 14px 2px", fontSize: 8, color: "#FFA028", textTransform: "uppercase", letterSpacing: 2, fontFamily: "monospace", background: "#030303", borderBottom: "1px solid #0d0d0d" }}>
            {grupo}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "4px 14px 8px", background: "#050505", borderBottom: "1px solid #111" }}>
            {keys.map(k => {
              const q = snap[k]
              return (
                <button key={k} onClick={() => setSelTicker(k)} style={{
                  flex: "1 1 120px", padding: "8px 12px", background: selTicker === k ? "#0d0d0d" : "#060606",
                  border: selTicker === k ? "1px solid rgba(255,160,40,0.4)" : "1px solid #111",
                  cursor: "pointer", textAlign: "left", fontFamily: "monospace",
                }}>
                  <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{MUNDO_LABELS[k]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {q ? fmtNum(q.precio, k === "us10y" ? 3 : 2) : "—"}
                    <span style={{ fontSize: 8, color: "#555", marginLeft: 4 }}>{MUNDO_UNITS[k]}</span>
                  </div>
                  <div style={{ fontSize: 9, color: q ? changeColor(q.variacion_pct) : "#555", marginTop: 1, fontWeight: 700 }}>
                    {q ? `${q.variacion_pct >= 0 ? "+" : ""}${fmtNum(q.variacion_pct, 2)}%` : "—"}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Gráfico histórico */}
      <div style={{ padding: 16, background: "#050505", borderTop: "1px solid #111" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <SectionTitle title={`Histórico — ${MUNDO_LABELS[selTicker] ?? selTicker}`} />
          <div style={{ display: "flex", gap: 4 }}>
            {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
              <button key={p} onClick={() => setSelPeriod(p)} style={{
                fontSize: 8, fontFamily: "monospace", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
                background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
                border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
                color: selPeriod === p ? "#FFA028" : "#555",
              }}>{p}</button>
            ))}
          </div>
        </div>
        {loadingHist ? <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 9, fontFamily: "monospace" }}>Cargando…</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hist.map(([d, v]) => ({ fecha: d, valor: v }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="mundoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFA028" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFA028" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="fecha" stroke="#333" fontSize={8} tick={{ fill: "#888" }} tickFormatter={d => d?.slice(0, 7)} interval={Math.max(1, Math.floor(hist.length / 10))} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [fmtNum(v as number, 2), MUNDO_LABELS[selTicker]]} />
              <Area type="monotone" dataKey="valor" stroke="#FFA028" strokeWidth={2} fill="url(#mundoGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* US Treasury yield curve */}
      {ustCurve && (
        <div style={{ padding: 16, background: "#050505", borderTop: "1px solid #111" }}>
          <SectionTitle title="Curva de rendimientos UST — última fecha disponible" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ustCurve} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="label" stroke="#333" fontSize={9} tick={{ fill: "#888" }} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 3)}%`, "Yield"]} />
              <Line type="monotone" dataKey="yield" stroke="#4AF6C3" strokeWidth={2} dot={{ r: 3, fill: "#4AF6C3" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 7, color: "#555", marginTop: 4, fontFamily: "monospace" }}>
            {ustCurve.map(p => `${p.label}: ${fmtNum(p.yield, 2)}%`).join(" · ")}
          </div>
        </div>
      )}

      {/* Próximos earnings USA */}
      <div style={{ padding: 16, background: "#050505", borderTop: "1px solid #111" }}>
        <SectionTitle title="Próximos earnings USA — estimados Q2/Q3 2026" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {NEXT_EARNINGS.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(e => {
            const daysUntil = Math.round((new Date(e.fecha).getTime() - Date.now()) / 86_400_000)
            const isNear = daysUntil <= 14
            return (
              <div key={e.ticker} style={{
                flex: "1 1 140px", padding: "8px 10px", background: "#080808",
                border: `1px solid ${isNear ? "#FFA02833" : "#111"}`,
                fontFamily: "monospace",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FFA028" }}>{e.ticker}</span>
                  <span style={{ fontSize: 7, color: isNear ? "#FFA028" : "#444" }}>
                    {daysUntil > 0 ? `en ${daysUntil}d` : daysUntil === 0 ? "HOY" : "pasado"}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: "#666", marginTop: 1 }}>{e.empresa}</div>
                <div style={{ fontSize: 8, color: "#444", marginTop: 2 }}>
                  {e.fecha} {e.afterHours ? "· after hours" : "· pre-market"}
                </div>
                <div style={{ fontSize: 7, color: "#333", marginTop: 1 }}>{e.sector}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 7, color: "#444", marginTop: 6, fontFamily: "monospace" }}>
          Fechas orientativas — pueden variar. Verificar en earningswhispers.com
        </div>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: Yahoo Finance (mercados globales) · Treasury.gov (curva UST) · Precios diferidos ~15 min
      </div>
    </div>
  )
}

// ── CRIPTO ────────────────────────────────────────────────────────────────────

const CRYPTOS = [
  { key: "bitcoin",  label: "Bitcoin",  ticker: "BTC-USD",  color: "#FFA028" },
  { key: "ethereum", label: "Ethereum", ticker: "ETH-USD",  color: "#CE93D8" },
  { key: "solana",   label: "Solana",   ticker: "SOL-USD",  color: "#4AF6C3" },
  { key: "cardano",  label: "Cardano",  ticker: "ADA-USD",  color: "#4FC3F7" },
  { key: "xrp",      label: "XRP",      ticker: "XRP-USD",  color: "#FFD700" },
  { key: "bnb",      label: "BNB",      ticker: "BNB-USD",  color: "#F0B90B" },
  { key: "usdt",     label: "USDT",     ticker: "USDT-USD", color: "#26A17B" },
  { key: "usdc",     label: "USDC",     ticker: "USDC-USD", color: "#2775CA" },
]

interface CriptoYaRate { ask: number; bid: number; totalAsk: number; totalBid: number; time: number }
interface CriptoYaData { [exchange: string]: CriptoYaRate }

function CryptoView() {
  const [snap, setSnap] = useState<Record<string, WorldQuote | null>>({})
  const [hist, setHist] = useState<[string, number][]>([])
  const [selKey, setSelKey] = useState("bitcoin")
  const [selPeriod, setSelPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)
  const [dominance, setDominance] = useState<number | null>(null)
  const [usdtArs, setUsdtArs] = useState<CriptoYaData | null>(null)

  useEffect(() => {
    fetch("/api/mundo")
      .then(r => r.json())
      .then(j => setSnap(j.data ?? {}))
      .finally(() => setLoading(false))

    // CoinGecko global — dominancia BTC
    fetch("https://api.coingecko.com/api/v3/global")
      .then(r => r.json())
      .then(j => setDominance(j?.data?.market_cap_percentage?.btc ?? null))
      .catch(() => {})

    // CriptoYa — USDT/ARS por exchange
    fetch("https://criptoya.com/api/USDT/ARS/0.1")
      .then(r => r.json())
      .then(j => setUsdtArs(j))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoadingHist(true)
    fetch(`/api/mundo?ticker=${selKey}&hist=${selPeriod}`)
      .then(r => r.json())
      .then(j => setHist(j.data ?? []))
      .finally(() => setLoadingHist(false))
  }, [selKey, selPeriod])

  if (loading) return <Loading />

  const sel = CRYPTOS.find(c => c.key === selKey)!
  const decimals = (key: string) => ["usdt","usdc"].includes(key) ? 4 : ["cardano","xrp","bnb"].includes(key) ? 3 : 0
  const chartData = hist.map(([fecha, valor]) => ({ fecha, valor }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs — cards clickeables, selección simple */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "8px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        {CRYPTOS.map(c => {
          const q = snap[c.key]
          const isActive = selKey === c.key
          return (
            <button key={c.key} onClick={() => setSelKey(c.key)} style={{
              flex: "1 1 110px", padding: "8px 10px", textAlign: "left", cursor: "pointer",
              background: isActive ? "#0d0d0d" : "#060606",
              border: isActive ? `1px solid ${c.color}55` : "1px solid #111",
              fontFamily: "monospace", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 8, color: isActive ? c.color : "#555", textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: isActive ? "#fff" : "#444", marginTop: 2, lineHeight: 1 }}>
                {q ? `$${fmtUSD(q.precio, decimals(c.key))}` : "—"}
              </div>
              <div style={{
                fontSize: 9, marginTop: 2, fontWeight: 700,
                color: !q ? "#333" : (["usdt","usdc"].includes(c.key) && Math.abs(q.variacion_pct) < 0.1) ? "#666" : changeColor(q.variacion_pct),
              }}>
                {q ? `${q.variacion_pct >= 0 ? "+" : ""}${fmtUSD(q.variacion_pct, 2)}%` : "—"}
                <span style={{ fontSize: 7, color: "#555", marginLeft: 3, fontWeight: 400 }}>1D</span>
              </div>
              {isActive && <div style={{ width: "100%", height: 2, background: c.color, marginTop: 4, borderRadius: 1 }} />}
            </button>
          )
        })}
      </div>

      {/* Controles */}
      <div style={{ padding: "6px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8, color: "#555", fontFamily: "monospace" }}>Precio USD</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
            <button key={p} onClick={() => setSelPeriod(p)} style={{
              fontSize: 8, fontFamily: "monospace", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
              background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
              border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
              color: selPeriod === p ? "#FFA028" : "#555",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ padding: 16, background: "#050505" }}>
        <SectionTitle title={`${sel.label} — precio USD`} />
        {loadingHist
          ? <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 9, fontFamily: "monospace" }}>Cargando…</div>
          : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
                <defs>
                  <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sel.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={sel.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
                <XAxis dataKey="fecha" stroke="#333" fontSize={8} tick={{ fill: "#888" }}
                  tickFormatter={d => (d as string)?.slice(0, 7)}
                  interval={Math.max(1, Math.floor(chartData.length / 10))} />
                <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} domain={["auto", "auto"]}
                  tickFormatter={v => `$${Math.round(v as number).toLocaleString("en-US")}`} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 9, color: "#fff", fontFamily: "monospace" }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#aaa" }}
                  formatter={(v: unknown) => [`$${fmtUSD(v as number, decimals(selKey))}`, sel.label]}
                />
                <Area type="monotone" dataKey="valor" stroke={sel.color} strokeWidth={2}
                  fill="url(#cryptoGrad)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* USDT/ARS por exchange + BTC Dominance */}
      {(usdtArs || dominance != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111", borderTop: "1px solid #111" }}>
          {/* USDT/ARS */}
          {usdtArs && (
            <div style={{ background: "#050505", padding: 14 }}>
              <SectionTitle title="USDT/ARS por exchange (CriptoYa)" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Exchange", "Compra", "Venta"].map(h => (
                      <th key={h} style={{ padding: "3px 6px", color: "#555", fontWeight: 400, textAlign: h === "Exchange" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usdtArs)
                    .filter(([, v]) => v?.ask > 0)
                    .sort((a, b) => a[1].ask - b[1].ask)
                    .slice(0, 8)
                    .map(([ex, v]) => (
                      <tr key={ex} style={{ borderBottom: "1px solid #0d0d0d" }}>
                        <td style={{ padding: "3px 6px", color: "#FFA028" }}>{ex.toUpperCase()}</td>
                        <td style={{ padding: "3px 6px", color: "#4AF6C3", textAlign: "right" }}>${fmtNum(v.bid, 2)}</td>
                        <td style={{ padding: "3px 6px", color: "#FF433D", textAlign: "right" }}>${fmtNum(v.ask, 2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* BTC Dominance */}
          {dominance != null && (
            <div style={{ background: "#050505", padding: 14, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 8, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>BTC Dominance</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#FFA028", fontFamily: "monospace", lineHeight: 1 }}>
                {fmtNum(dominance, 1)}%
              </div>
              <div style={{ fontSize: 8, color: "#555", fontFamily: "monospace" }}>% del market cap total cripto</div>
              <div style={{ fontSize: 7, color: "#444", fontFamily: "monospace" }}>CoinGecko</div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: Yahoo Finance · CoinGecko (dominance) · CriptoYa (USDT/ARS) · Precios en USD · Actualización cada 5 min
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function TabFinanzas({ initialSubtab }: { initialSubtab?: string | null }) {
  const [activeTab, setActiveTab] = useState(initialSubtab ?? "acciones")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <SubTabs active={activeTab} onChange={setActiveTab} />
      {activeTab === "acciones"  && <AccionesView />}
      {activeTab === "bonos"     && <BonosView />}
      {activeTab === "rofex"     && <RofexView />}
      {activeTab === "plazofijo" && <PlazoFijoView />}
      {activeTab === "commodities" && <CommoditiesView />}
      {activeTab === "mundo"      && <MundoView />}
      {activeTab === "crypto"    && <CryptoView />}
    </div>
  )
}
