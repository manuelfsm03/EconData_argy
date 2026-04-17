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
  { key: "mundo",      label: "Mercados Mundo", icon: "⬡" },
  { key: "crypto",     label: "Cripto",       icon: "₿" },
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
      Sin datos ROFEX — verificar cron de scraping
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
        Fuente: ROFEX (Rosario Futures Exchange) vía cron scraping · Actualización diaria
      </div>
    </div>
  )
}

// ── PLAZO FIJO ────────────────────────────────────────────────────────────────

interface PlazoFijoData {
  tasa_promedio?: number
  tasa_banco_nacion?: number
  tasa_banco_provincia?: number
  tasa_max?: number
  tna_promedio?: number
  tea_promedio?: number
  updated_at?: string
  bancos?: { nombre: string; tna: number; tea?: number }[]
}

function PlazoFijoView() {
  const [data, setData] = useState<PlazoFijoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Intentar desde BCRA API variable 35 (tasa promedio pf 30 días)
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

  // Datos de referencia BCRA (fijos hasta nueva actualización)
  const bancos = [
    { nombre: "Banco Nación", tna: 36.0 },
    { nombre: "Banco Provincia", tna: 37.0 },
    { nombre: "Banco Galicia", tna: 38.5 },
    { nombre: "Banco BBVA", tna: 37.5 },
    { nombre: "Banco Santander", tna: 38.0 },
    { nombre: "Banco Macro", tna: 39.0 },
    { nombre: "Banco HSBC", tna: 37.0 },
    { nombre: "Banco ICBC", tna: 38.0 },
    { nombre: "Banco Patagonia", tna: 38.5 },
    { nombre: "Naranja X / Brubank", tna: 42.0 },
    { nombre: "Ualá", tna: 43.0 },
    { nombre: "Mercado Pago", tna: 43.5 },
  ]

  const tna = data?.tna_promedio ?? 36.0
  const tea = data?.tea_promedio ?? parseFloat(((Math.pow(1 + tna / 100 / 365, 365) - 1) * 100).toFixed(2))
  const tem = parseFloat(((Math.pow(1 + tna / 100 / 365, 30) - 1) * 100).toFixed(2))

  const chartData = bancos.map(b => ({
    nombre: b.nombre.replace("Banco ", ""),
    tna: b.tna,
    tea: parseFloat(((Math.pow(1 + b.tna / 100 / 365, 365) - 1) * 100).toFixed(2)),
    real: b.tna - (data?.tna_promedio ?? 36),
  }))

  if (loading) return <Loading />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="TNA promedio (BCRA)" value={fmtPct(tna)} valueColor="#FFA028" unit="30 días" />
        <KPI label="TEA equivalente" value={fmtPct(tea)} valueColor="#4AF6C3" unit="tasa efectiva anual" />
        <KPI label="TEM equivalente" value={fmtPct(tem)} valueColor="#FFD700" unit="tasa efectiva mensual" />
        <KPI label="Mayor tasa digital" value="Mercado Pago / Ualá" valueColor="#CE93D8" unit="43–43.5% TNA" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#111" }}>
        {/* Comparativa bancos */}
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="TNA por entidad (30 días)" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" horizontal={false} />
              <XAxis type="number" stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} domain={[30, 50]} />
              <YAxis type="category" dataKey="nombre" stroke="#333" fontSize={8} tick={{ fill: "#aaa" }} width={100} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 1)}%`, "TNA"]} />
              <ReferenceLine x={tna} stroke="#FFA028" strokeDasharray="4 4" label={{ value: "BCRA", fill: "#FFA028", fontSize: 8 }} />
              <Bar dataKey="tna" radius={[0, 2, 2, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.tna >= tna ? "#4AF6C3" : "#FF6B6B"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* TNA vs TEA */}
        <div style={{ background: "#050505", padding: 16 }}>
          <SectionTitle title="TNA vs TEA por entidad" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="nombre" stroke="#333" fontSize={7} tick={{ fill: "#888" }} angle={-35} textAnchor="end" interval={0} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} tickFormatter={v => `${v}%`} domain={[30, 50]} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`${fmtNum(v as number, 2)}%`, name === "tna" ? "TNA" : "TEA"]} />
              <Legend wrapperStyle={{ fontSize: 9, color: "#aaa" }} />
              <Bar dataKey="tna" name="TNA" fill="#FFA028" opacity={0.8} />
              <Bar dataKey="tea" name="TEA" fill="#4AF6C3" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: BCRA API variable 35 (tasa pf 30 días) · Tasas de bancos privados: referencia indicativa · Fin Reg. A 7095
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

// ── MERCADOS MUNDO ────────────────────────────────────────────────────────────

interface WorldQuote { precio: number; variacion_pct: number; ticker: string }

const MUNDO_GROUPS: Record<string, string[]> = {
  "Índices": ["sp500", "nasdaq", "dow", "merval", "vix"],
  "Commodities": ["soja", "maiz", "trigo", "petroleo", "brent", "oro"],
  "FX": ["eurusd", "usdbrl", "usdcny", "dxy"],
  "Renta Fija": ["us10y"],
}

const MUNDO_LABELS: Record<string, string> = {
  sp500: "S&P 500", nasdaq: "Nasdaq", dow: "Dow Jones", merval: "Merval", vix: "VIX",
  soja: "Soja", maiz: "Maíz", trigo: "Trigo", petroleo: "WTI", brent: "Brent", oro: "Oro",
  eurusd: "EUR/USD", usdbrl: "USD/BRL", usdcny: "USD/CNY", dxy: "DXY",
  us10y: "UST 10Y",
}

const MUNDO_UNITS: Record<string, string> = {
  sp500: "pts", nasdaq: "pts", dow: "pts", merval: "pts", vix: "idx",
  soja: "USD/bu", maiz: "USD/bu", trigo: "USD/bu", petroleo: "USD/bbl", brent: "USD/bbl", oro: "USD/oz",
  eurusd: "EUR/USD", usdbrl: "BRL/USD", usdcny: "CNY/USD", dxy: "idx",
  us10y: "%",
}

function MundoView() {
  const [snap, setSnap] = useState<Record<string, WorldQuote | null>>({})
  const [hist, setHist] = useState<[string, number][]>([])
  const [selTicker, setSelTicker] = useState("sp500")
  const [selPeriod, setSelPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)

  useEffect(() => {
    fetch("/api/mundo")
      .then(r => r.json())
      .then(j => setSnap(j.data ?? {}))
      .finally(() => setLoading(false))
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

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: Yahoo Finance (mercados globales) · Precios diferidos ~15 min
      </div>
    </div>
  )
}

// ── CRIPTO ────────────────────────────────────────────────────────────────────

const CRYPTOS = [
  { key: "bitcoin", label: "Bitcoin", ticker: "BTC-USD", color: "#FFA028" },
  { key: "ethereum", label: "Ethereum", ticker: "ETH-USD", color: "#CE93D8" },
]

function CryptoView() {
  const [snap, setSnap] = useState<Record<string, WorldQuote | null>>({})
  const [hist, setHist] = useState<[string, number][]>([])
  const [selCrypto, setSelCrypto] = useState("bitcoin")
  const [selPeriod, setSelPeriod] = useState("1y")
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)

  useEffect(() => {
    fetch("/api/mundo")
      .then(r => r.json())
      .then(j => setSnap(j.data ?? {}))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setLoadingHist(true)
    fetch(`/api/mundo?ticker=${selCrypto}&hist=${selPeriod}`)
      .then(r => r.json())
      .then(j => setHist(j.data ?? []))
      .finally(() => setLoadingHist(false))
  }, [selCrypto, selPeriod])

  if (loading) return <Loading />

  const btc = snap["bitcoin"]
  const eth = snap["ethereum"]
  const sel = CRYPTOS.find(c => c.key === selCrypto)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "#050505", borderBottom: "1px solid #111" }}>
        <KPI label="Bitcoin (BTC)" value={btc ? `$${fmtNum(btc.precio, 0)}` : null} valueColor="#FFA028"
          unit={btc ? `${btc.variacion_pct >= 0 ? "+" : ""}${fmtNum(btc.variacion_pct, 2)}% hoy` : undefined} />
        <KPI label="Ethereum (ETH)" value={eth ? `$${fmtNum(eth.precio, 0)}` : null} valueColor="#CE93D8"
          unit={eth ? `${eth.variacion_pct >= 0 ? "+" : ""}${fmtNum(eth.variacion_pct, 2)}% hoy` : undefined} />
        {btc && eth && <KPI label="Ratio BTC/ETH" value={fmtNum(btc.precio / eth.precio, 2)} unit="unidades ETH por 1 BTC" />}
      </div>

      {/* Selector */}
      <div style={{ padding: "8px 14px", background: "#050505", borderBottom: "1px solid #111", display: "flex", gap: 4, alignItems: "center" }}>
        {CRYPTOS.map(c => (
          <button key={c.key} onClick={() => setSelCrypto(c.key)} style={{
            fontSize: 9, fontFamily: "monospace", padding: "3px 12px", borderRadius: 20, cursor: "pointer",
            background: selCrypto === c.key ? "rgba(255,160,40,0.12)" : "transparent",
            border: selCrypto === c.key ? "1px solid rgba(255,160,40,0.4)" : "1px solid #1a1a1a",
            color: selCrypto === c.key ? "#FFA028" : "#666",
          }}>{c.label}</button>
        ))}
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
        <SectionTitle title={`${sel?.label ?? selCrypto} — precio USD`} />
        {loadingHist ? <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 9, fontFamily: "monospace" }}>Cargando…</div> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={hist.map(([d, v]) => ({ fecha: d, valor: v }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sel?.color ?? "#FFA028"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sel?.color ?? "#FFA028"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#0d0d0d" />
              <XAxis dataKey="fecha" stroke="#333" fontSize={8} tick={{ fill: "#888" }} tickFormatter={d => d?.slice(0, 7)} interval={Math.max(1, Math.floor(hist.length / 10))} />
              <YAxis stroke="#333" fontSize={9} tick={{ fill: "#888" }} domain={["auto", "auto"]} tickFormatter={v => `$${Math.round(v).toLocaleString("en-US")}`} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`$${fmtNum(v as number, 0)}`, sel?.label ?? selCrypto]} />
              <Area type="monotone" dataKey="valor" stroke={sel?.color ?? "#FFA028"} strokeWidth={2} fill="url(#cryptoGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "#888", borderTop: "1px solid #111", fontFamily: "monospace" }}>
        Fuente: Yahoo Finance (BTC-USD, ETH-USD) · Precios en USD · Actualización cada 5 min
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
      {activeTab === "mundo"     && <MundoView />}
      {activeTab === "crypto"    && <CryptoView />}
    </div>
  )
}
