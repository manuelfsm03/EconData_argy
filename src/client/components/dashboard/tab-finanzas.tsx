"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell,
} from "recharts"
import { ForoActivo } from "./foro-activo"
import { AssetScreener } from "./screener-activos"
import { TabBonos } from "./tab-bonos"
import { ajustarPolinomio, gradoSugerido, muestrearCurva, residuos } from "@/lib/curve-fit"
import { StockHeatmap } from "./stock-heatmap"

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
  if (v == null) return "var(--text-dim)"
  return v >= 0 ? "var(--positive)" : "var(--negative)"
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
  { key: "screener",   label: "Screener",       icon: "⌕" },
]

function SubTabs({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <div style={{
      background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)",
      display: "flex", alignItems: "center", padding: "18px 14px 14px",
      // rowGap más grande que columnGap: cuando la fila envuelve, los chips de
      // abajo quedaban pegados a los de arriba y se leía como una sola masa.
      columnGap: 8, rowGap: 10, flexWrap: "wrap",
    }}>
      {FIN_TABS.map(t => {
        const isActive = active === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: isActive ? "rgba(255,160,40,0.08)" : "transparent",
            border: isActive ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
            borderRadius: 20, cursor: "pointer", padding: "5px 14px",
            whiteSpace: "nowrap", transition: "all 0.15s", fontFamily: "var(--font-data)",
          }}>
            <span style={{ fontSize: 11, color: isActive ? "var(--amber)" : "var(--text-mute)", fontWeight: 700 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: isActive ? "var(--amber)" : "var(--text-dim)", fontWeight: isActive ? 600 : 400, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KPI({ label, value, unit, valueColor = "var(--text)", sub }: { label: string; value: string | null; unit?: string; valueColor?: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 150px", padding: "10px 14px", background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor, fontFamily: "var(--font-data)", lineHeight: 1 }}>{value ?? "—"}</div>
      {unit && <div style={{ fontSize: 8, color: "#bbb", fontFamily: "var(--font-data)" }}>{unit}</div>}
      {sub && <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, color: "#ccc", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "var(--font-data)" }}>
      {title}
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>Cargando…</div>
}

const tooltipStyle = {
  contentStyle: { background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, color: "var(--text)" },
  itemStyle: { color: "var(--text)" },
  labelStyle: { color: "var(--text-dim)" },
}

// ── ACCIONES ─────────────────────────────────────────────────────────────────

export interface StockQuote {
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

export function AccionesView({ initialTicker = null }: { initialTicker?: string | null } = {}) {
  const [data, setData] = useState<{ byCategory: Record<string, StockQuote[]>; categories: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState("all")
  const [selectedTicker, setSelectedTicker] = useState<string | null>(initialTicker)

  useEffect(() => {
    fetch("/api/acciones?category=all")
      .then(r => r.json())
      .then(j => setData(j.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!data) return <div style={{ padding: 40, color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>Sin datos</div>

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        <KPI label="Acciones con precio" value={String(mervalTotal)} unit="tickers activos" />
        <KPI label="Mejor del día" value={top5Gain[0] ? top5Gain[0].ticker : null} valueColor="var(--positive)"
          unit={top5Gain[0]?.change1D != null ? `+${fmtPct(top5Gain[0].change1D)}` : undefined} />
        <KPI label="Peor del día" value={top5Loss[0] ? top5Loss[0].ticker : null} valueColor="var(--negative)"
          unit={top5Loss[0]?.change1D != null ? fmtPct(top5Loss[0].change1D) : undefined} />
        <KPI label="Suben" value={String(withPrice.filter(s => (s.change1D ?? 0) > 0).length)} valueColor="var(--positive)" unit="acciones" />
        <KPI label="Bajan" value={String(withPrice.filter(s => (s.change1D ?? 0) < 0).length)} valueColor="var(--negative)" unit="acciones" />
      </div>

      {/* Filtro categorías */}
      <div style={{ padding: "8px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {["all", ...data.categories].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            fontSize: 9, fontFamily: "var(--font-data)", padding: "3px 10px",
            background: cat === c ? "rgba(255,160,40,0.12)" : "transparent",
            border: cat === c ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
            color: cat === c ? "var(--amber)" : "#666", borderRadius: 20, cursor: "pointer",
          }}>{c === "all" ? "Todos" : c}</button>
        ))}
      </div>

      {/* Mapa de calor: Panel Líder / Panel General */}
      <div style={{ padding: 16, background: "var(--bg)" }}>
        <StockHeatmap stocks={withPrice} />
      </div>

      {/* Chart variaciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)" }}>
        <div style={{ background: "var(--bg)", padding: 16 }}>
          <SectionTitle title="Top 10 variación diaria" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...top5Gain, ...top5Loss.reverse()].map(s => ({ ticker: s.ticker, pct: s.change1D ?? 0 }))} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" horizontal={false} />
              <XAxis type="number" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${v.toFixed(1)}%`} />
              <YAxis type="category" dataKey="ticker" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} width={60} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`, "Variación"]} />
              <Bar dataKey="pct" radius={[0, 2, 2, 0]}>
                {[...top5Gain, ...top5Loss.reverse()].map((s, i) => (
                  <Cell key={i} fill={(s.change1D ?? 0) >= 0 ? "var(--positive)" : "var(--negative)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mapa de calor simplificado */}
        <div style={{ background: "var(--bg)", padding: 16 }}>
          <SectionTitle title="Screener" />
          <div style={{ overflowY: "auto", maxHeight: 260 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Ticker", "Sector", "Último", "Var. %", "Volumen"].map(h => (
                    <th key={h} style={{ padding: "4px 8px", color: "var(--text-dim)", textAlign: h === "Ticker" || h === "Sector" ? "left" : "right", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withPrice.map((s, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedTicker(prev => prev === s.ticker ? null : s.ticker)}
                    style={{
                      borderBottom: "1px solid var(--bg-elev-2)",
                      cursor: "pointer",
                      background: selectedTicker === s.ticker ? "var(--bg-elev-2)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "3px 8px", color: "var(--amber)", fontWeight: 700 }}>{s.ticker}</td>
                    <td style={{ padding: "3px 8px", color: "var(--text-dim)" }}>{s.category}</td>
                    <td style={{ padding: "3px 8px", color: "var(--text)", textAlign: "right" }}>{fmtNum(s.lastPrice, 2)}</td>
                    <td style={{ padding: "3px 8px", color: changeColor(s.change1D), textAlign: "right", fontWeight: 700 }}>
                      {s.change1D != null ? `${s.change1D >= 0 ? "+" : ""}${fmtNum(s.change1D, 2)}%` : "—"}
                    </td>
                    <td style={{ padding: "3px 8px", color: "var(--text-dim)", textAlign: "right" }}>
                      {s.volume != null ? fmtNum(s.volume / 1e6, 2) + "M" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedTicker && <AccionDetailPanel ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: BYMA Data abierto · Precios con 20 minutos de demora · Especies 24hs
      </div>
    </div>
  )
}

// ── Panel de detalle de acción (Detalle / Gráfico / Foro) ─────────────────────

interface StockDetail {
  ticker: string
  lastPrice: number | null
  closePrice: number | null
  change1D: number | null
  change1DPct: number | null
  high52w: number | null
  low52w: number | null
  volume: number | null
  avgVolume: number | null
  currency: string
  history: { date: string; close: number | null }[]
}

function AccionDetailPanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<"detalle" | "grafico" | "foro">("detalle")
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/acciones/${ticker}?range=3m`)
      .then(r => r.json())
      .then(j => setDetail(j.data ?? null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [ticker])

  const panelTabs = [
    { key: "detalle", label: "Detalle" },
    { key: "grafico", label: "Gráfico" },
    { key: "foro", label: "Foro" },
  ] as const

  return (
    <div style={{ background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {panelTabs.map(t => (
            <button key={t.key} onClick={() => setDetailTab(t.key)} style={{
              background: detailTab === t.key ? "var(--bg-elev-2)" : "transparent",
              color: detailTab === t.key ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: detailTab === t.key ? "2px solid var(--amber)" : "2px solid transparent",
              padding: "6px 16px", fontSize: 10,
              textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div style={{ padding: "0 14px 14px" }}>
          {detailTab === "detalle" && (
            <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev-2)", padding: 1 }}>
              <KPI label="Último" value={detail ? fmtNum(detail.lastPrice, 2) : null} unit={detail?.currency} />
              <KPI label="Var. 1D" value={detail?.change1DPct != null ? fmtPct(detail.change1DPct) : null} valueColor={changeColor(detail?.change1DPct)} />
              <KPI label="Máx 52sem" value={detail ? fmtNum(detail.high52w, 2) : null} />
              <KPI label="Mín 52sem" value={detail ? fmtNum(detail.low52w, 2) : null} />
              <KPI label="Volumen" value={detail?.volume != null ? fmtNum(detail.volume / 1e6, 2) + "M" : null} />
            </div>
          )}
          {detailTab === "grafico" && (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={(detail?.history ?? []).map(h => ({ date: h.date, close: h.close }))} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
                <XAxis dataKey="date" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} />
                <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="close" stroke="var(--amber)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {detailTab === "foro" && <ForoActivo assetType="accion" ticker={ticker} />}
        </div>
      )}
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

/**
 * Duration mínima para que un instrumento entre al ajuste de la curva.
 * Tres meses: abajo de eso el rendimiento anualizado es puro ruido de redondeo.
 */
const DURATION_MINIMA_CURVA = 0.25

/**
 * Nube de bonos con la curva que mejor los describe, y cada punto pintado
 * según de qué lado quedó.
 *
 * Sin la curva, el scatter dice dónde cotiza cada bono pero no si eso está
 * bien o mal. Con la curva, un punto VERDE rinde más de lo que le tocaría por
 * su plazo (barato) y uno ROJO rinde menos (caro). Eso es lo que se busca
 * cuando se mira una curva de rendimientos.
 *
 * El eje X va como número y no como categoría. Antes iba como categoría, que
 * es el default de Recharts, y por eso los bonos salían espaciados en el orden
 * en que venían de la API en vez de por su duration: la "curva" no tenía forma
 * de significar nada, y ninguna línea trazada encima habría tenido sentido.
 */
function CurvaAjustada({ titulo, puntos, unidadTasa, etiquetaExtra }: {
  titulo: string
  puntos: { ticker: string; x: number; y: number; extra?: string }[]
  unidadTasa: string
  etiquetaExtra?: string
}) {
  // Los instrumentos a punto de vencer se DIBUJAN pero no entran al ajuste.
  // A tres semanas del vencimiento, anualizar unos pocos pesos de diferencia
  // da tasas de 30% o 40% que no dicen nada del nivel de la curva; como además
  // están todos amontonados en x ≈ 0, tiran del polinomio con muchísimo peso y
  // deforman la curva entera. Es el error clásico al armar una curva de
  // rendimientos, y se ve enseguida: la curva se dispara en el tramo corto.
  const { paraAjustar, excluidos } = useMemo(() => {
    const dentro = puntos.filter(p => p.x >= DURATION_MINIMA_CURVA)
    return { paraAjustar: dentro, excluidos: puntos.length - dentro.length }
  }, [puntos])

  const ajuste = useMemo(() => {
    const xsUnicos = new Set(paraAjustar.map(p => p.x)).size
    return ajustarPolinomio(paraAjustar, gradoSugerido(xsUnicos))
  }, [paraAjustar])

  const conResiduo = useMemo(
    () => (ajuste ? residuos(puntos, ajuste) : puntos.map(p => ({ ...p, residuo: 0 }))),
    [puntos, ajuste],
  )

  const curva = useMemo(() => {
    if (!ajuste || paraAjustar.length === 0) return []
    // La curva se dibuja sólo donde fue ajustada: extenderla hasta los puntos
    // excluidos sería extrapolar justo en el tramo que se decidió no modelar.
    const xs = paraAjustar.map(p => p.x)
    return muestrearCurva(ajuste, Math.min(...xs), Math.max(...xs)).map(p => ({ x: p.x, y: p.y }))
  }, [ajuste, paraAjustar])

  if (puntos.length === 0) {
    return (
      <div style={{ background: "var(--bg)", padding: 16 }}>
        <SectionTitle title={titulo} />
        <div style={{ fontSize: 10, color: "var(--text-mute)", padding: 24, textAlign: "center" }}>
          Sin datos suficientes para trazar la curva.
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: "var(--bg)", padding: 16 }}>
      <SectionTitle title={titulo} />
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
          <XAxis
            type="number" dataKey="x" name="Duration" domain={["dataMin", "dataMax"]}
            stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }}
            tickFormatter={v => fmtNum(v, 1)}
            label={{ value: "Duration (años)", position: "insideBottom", offset: -10, fill: "#666", fontSize: 8 }}
          />
          <YAxis
            type="number" dataKey="y" name={unidadTasa} domain={["auto", "auto"]}
            stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }}
            tickFormatter={v => `${fmtNum(v, 1)}%`}
          />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--border-hi)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0]?.payload as { ticker?: string; y: number; x: number; extra?: string; residuo?: number }
            if (!d?.ticker) return null
            const res = d.residuo ?? 0
            return (
              <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "6px 10px", fontSize: 9, fontFamily: "var(--font-data)", color: "var(--text)" }}>
                <div style={{ color: "var(--amber)", fontWeight: 700 }}>{d.ticker}</div>
                <div>{unidadTasa}: {fmtPct(d.y)}</div>
                <div>Duration: {fmtNum(d.x, 2)} años</div>
                {etiquetaExtra && d.extra && <div>{etiquetaExtra}: {d.extra}</div>}
                <div style={{ marginTop: 3, color: res >= 0 ? "var(--positive)" : "var(--negative)" }}>
                  {res >= 0 ? "▲" : "▼"} {fmtNum(Math.abs(res), 2)} pp {res >= 0 ? "sobre" : "bajo"} la curva
                </div>
              </div>
            )
          }} />

          {/* La curva primero, para que los puntos queden por encima. */}
          {curva.length > 0 && (
            <Scatter
              data={curva}
              line={{ stroke: "var(--border-hi)", strokeWidth: 1.5 }}
              lineType="joint"
              shape={() => <g />}
              legendType="none"
              isAnimationActive={false}
            />
          )}

          <Scatter
            data={conResiduo}
            isAnimationActive={false}
            shape={(props: { cx?: number; cy?: number; payload?: { residuo?: number } }) => {
              const { cx, cy, payload } = props
              if (cx == null || cy == null) return <g />
              const barato = (payload?.residuo ?? 0) >= 0
              return <circle cx={cx} cy={cy} r={4.5} fill={barato ? "var(--positive)" : "var(--negative)"} />
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 8, color: "var(--text-mute)", fontFamily: "var(--font-data)", lineHeight: 1.7, marginTop: 4 }}>
        {ajuste ? (
          <>
            Curva ajustada por mínimos cuadrados, grado {ajuste.grado} · R² {fmtNum(ajuste.r2, 3)} ·{" "}
            <span style={{ color: "var(--positive)" }}>verde</span> rinde de más para su plazo (barato),{" "}
            <span style={{ color: "var(--negative)" }}>rojo</span> rinde de menos (caro).
            {excluidos > 0 && (
              <> · {excluidos} {excluidos === 1 ? "instrumento queda" : "instrumentos quedan"} fuera del
              ajuste por vencer en menos de {fmtNum(DURATION_MINIMA_CURVA * 12, 0)} meses: anualizados
              distorsionan la curva sin aportar información de nivel.</>
            )}
          </>
        ) : (
          <>Muy pocos puntos distintos para ajustar una curva: se muestran los bonos sin referencia.</>
        )}
      </div>
    </div>
  )
}


// ── Renta fija: familias de instrumento ──────────────────────────────────────

/**
 * Las siete familias en que se divide la renta fija argentina. El orden es el
 * de liquidez: se arranca por lo que más se opera.
 *
 * Tres todavía no tienen fuente conectada. Aparecen igual, y marcadas: que una
 * familia falte es información — decir "esto existe y no lo tenemos" es más
 * honesto que borrarla del menú y que parezca que el universo son cuatro.
 */
type FamiliaRentaFija =
  | "soberanos" | "lecap" | "cer" | "dual" | "dollarlinked" | "ons" | "subsoberanos"

const FAMILIAS: { key: FamiliaRentaFija; label: string }[] = [
  { key: "soberanos",    label: "Soberanos Hard Dollar" },
  { key: "lecap",        label: "LECAP / BONCAP" },
  { key: "cer",          label: "BONCER / LECER" },
  { key: "dual",         label: "Duales TAMAR" },
  { key: "dollarlinked", label: "Dollar-linked" },
  { key: "ons",          label: "ONs" },
  { key: "subsoberanos", label: "Sub-soberanos" },
]

interface PesoRow {
  ticker: string; nombre: string; precio: number | null; tir: number | null
  dm: number | null; paridad: number | null; vencimiento: string | null
}

/** Los duales arrancan con TXM; el resto del universo en pesos es CER. */
function esDual(ticker: string): boolean {
  return ticker.toUpperCase().startsWith("TXM")
}

function cuentaPorFamilia(
  familia: FamiliaRentaFija, bonos: BondRow[], lecaps: unknown[], pesos: PesoRow[],
): number {
  if (familia === "soberanos") return bonos.length
  if (familia === "lecap") return lecaps.length
  if (familia === "cer") return pesos.filter(p => !esDual(p.ticker)).length
  if (familia === "dual") return pesos.filter(p => esDual(p.ticker)).length
  return 0
}

/**
 * Qué significa el número que publica el mercado en cada familia. No es un
 * detalle de wording: en la misma columna, "TIR" quiere decir cosas distintas
 * según la familia, y compararlas de un renglón al otro da cualquier cosa.
 */
const LEYENDA_TASA: Record<FamiliaRentaFija, string> = {
  soberanos: "TIR en dólares (yield to maturity sobre el flujo en USD).",
  lecap: "Tasa fija en pesos: la TEM es directamente el rendimiento mensual.",
  cer: "TASA REAL, sobre CER. Se lee como \u201cCER + X%\u201d. Un bono ajustado por CER no tiene TIR nominal: el flujo futuro depende de la inflación, que nadie conoce.",
  dual: "Pagan el máximo entre CER y TAMAR, así que llevan una opcionalidad adentro. La tasa que se muestra es la que publica la fuente y NO describe del todo al instrumento.",
  dollarlinked: "", ons: "", subsoberanos: "",
}

/** Panel para las familias que existen en el mercado pero no tenemos conectadas. */
function FamiliaSinFuente({ label, detalle }: { label: string; detalle: string }) {
  return (
    <div style={{ padding: 32, background: "var(--bg)", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-data)", marginBottom: 8 }}>
        {label} — sin fuente conectada
      </div>
      <div style={{ fontSize: 10, color: "var(--text-mute)", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>
        {detalle}
      </div>
      <div style={{ fontSize: 9, color: "#4a4a4a", marginTop: 12 }}>
        Preferimos dejar la familia visible y vacía antes que mostrar números que no podemos respaldar.
      </div>
    </div>
  )
}

export function BonosView({ initialTicker = null }: { initialTicker?: string | null } = {}) {
  const [bonos, setBonos] = useState<BondRow[]>([])
  const [lecaps, setLecaps] = useState<{ ticker: string; tipo: string; vencimiento: string; diasVencimiento: number; precio: number | null; tir: number | null; tea: number | null; tem: number | null }[]>([])
  const [tab, setTab] = useState<FamiliaRentaFija>("soberanos")
  const [pesos, setPesos] = useState<PesoRow[]>([])
  const [pesosLoading, setPesosLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ type: "bono" | "cap"; ticker: string } | null>(initialTicker ? { type: "bono", ticker: initialTicker } : null)

  useEffect(() => {
    Promise.all([
      fetch("/api/bonos").then(r => r.json()),
      fetch("/api/bonos?tipo=lecap").then(r => r.json()),
    ]).then(([b, l]) => {
      setBonos(Array.isArray(b.data) ? b.data : [])
      setLecaps(Array.isArray(l.data) ? l.data : [])
    }).finally(() => setLoading(false))

    // El universo en pesos va por separado y NO bloquea la pantalla. Sale de un
    // scrapeo de Rava que tarda bastante más que los otros dos, y meterlo en el
    // Promise.all de arriba hacía que toda la pestaña se quedara en "Cargando…"
    // esperando datos que la familia por defecto ni siquiera usa.
    fetch("/api/bonos?tipo=pesos")
      .then(r => r.json())
      .then(j => setPesos(Array.isArray(j.data) ? j.data : []))
      .catch(() => setPesos([]))
      .finally(() => setPesosLoading(false))
  }, [])

  if (loading) return <Loading />

  const withTir = bonos.filter(b => b.tir != null)
  const avgTir = withTir.length ? withTir.reduce((s, b) => s + (b.tir ?? 0), 0) / withTir.length : null
  const avgPar = bonos.filter(b => b.paridad != null).reduce((s, b, _, a) => s + (b.paridad ?? 0) / a.length, 0) || null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        <KPI label="Bonos soberanos" value={String(bonos.length)} unit="hard dollar" />
        <KPI label="TIR promedio" value={avgTir != null ? fmtPct(avgTir) : null} valueColor="var(--amber)" unit="yield to maturity" />
        <KPI label="Paridad promedio" value={avgPar != null ? fmtPct(avgPar) : null} valueColor="var(--positive)" unit="% del VN residual" />
        <KPI label="LECAPs / BONCAPs" value={String(lecaps.length)} unit="instrumentos locales" />
      </div>

      {/* Selector por familia de instrumento */}
      <div style={{ padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)", display: "flex", columnGap: 6, rowGap: 8, flexWrap: "wrap" }}>
        {FAMILIAS.map(f => {
          const enPesos = f.key === "cer" || f.key === "dual"
          const cargando = enPesos && pesosLoading
          const cuantos = cuentaPorFamilia(f.key, bonos, lecaps, pesos)
          const vacia = !cargando && cuantos === 0
          return (
            <button key={f.key} onClick={() => setTab(f.key)} style={{
              fontSize: 9, fontFamily: "var(--font-data)", padding: "4px 12px", borderRadius: 20, cursor: "pointer",
              background: tab === f.key ? "rgba(255,160,40,0.12)" : "transparent",
              border: tab === f.key ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
              color: tab === f.key ? "var(--amber)" : vacia ? "#4a4a4a" : "#666",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {f.label}
              {/* El contador dice de una si la familia tiene datos o no, sin
                  tener que entrar a la pestaña para descubrir que está vacía. */}
              <span style={{ fontSize: 8, color: vacia ? "#4a4a4a" : "var(--text-mute)" }}>
                {cargando ? "…" : vacia ? "sin fuente" : cuantos}
              </span>
            </button>
          )
        })}
      </div>

      {tab === "soberanos" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)" }}>
          {/* Curva de rendimientos con ajuste */}
          <CurvaAjustada
            titulo="Curva de rendimientos (TIR vs Duration)"
            unidadTasa="TIR"
            puntos={bonos
              .filter(b => b.tir != null && b.durationMod != null)
              .map(b => ({ ticker: b.ticker, y: b.tir as number, x: b.durationMod as number, extra: fmtPct(b.paridad ?? 0) }))}
            etiquetaExtra="Paridad"
          />

          {/* Tabla soberanos */}
          <div style={{ background: "var(--bg)", padding: 16 }}>
            <SectionTitle title="Screener soberanos" />
            <div style={{ overflowY: "auto", maxHeight: 260 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Ticker", "Ley", "Vto.", "Precio", "Paridad", "TIR", "Duration"].map(h => (
                      <th key={h} style={{ padding: "4px 6px", color: "var(--text-dim)", textAlign: h === "Ticker" || h === "Ley" ? "left" : "right", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bonos.map((b, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelected(prev => prev?.type === "bono" && prev.ticker === b.ticker ? null : { type: "bono", ticker: b.ticker })}
                      style={{
                        borderBottom: "1px solid var(--bg-elev-2)",
                        cursor: "pointer",
                        background: selected?.type === "bono" && selected.ticker === b.ticker ? "var(--bg-elev-2)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "3px 6px", color: "var(--amber)", fontWeight: 700 }}>{b.ticker}</td>
                      <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{b.ley}</td>
                      <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{b.vencimiento?.slice(0, 7)}</td>
                      <td style={{ padding: "3px 6px", color: "var(--text)", textAlign: "right" }}>{b.precio != null ? fmtNum(b.precio, 2) : "—"}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", color: b.paridad != null && b.paridad < 50 ? "var(--negative)" : "var(--positive)" }}>
                        {b.paridad != null ? fmtPct(b.paridad) : "—"}
                      </td>
                      <td style={{ padding: "3px 6px", color: "var(--amber)", textAlign: "right", fontWeight: 700 }}>{b.tir != null ? fmtPct(b.tir) : "—"}</td>
                      <td style={{ padding: "3px 6px", color: "var(--text-dim)", textAlign: "right" }}>{b.durationMod != null ? fmtNum(b.durationMod, 2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lo que antes era la pestaña aparte "Renta Fija +". Ya no está duplicada
          arriba: vive acá adentro, que es la familia a la que corresponde. */}
      {tab === "soberanos" && (
        <div style={{ borderTop: "1px solid var(--bg-elev-2)" }}>
          <TabBonos />
        </div>
      )}


      {tab === "lecap" && (
        <div style={{ padding: 16, background: "var(--bg)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)", marginBottom: 1 }}>
            {/* Curva LECAP */}
            <div style={{ background: "var(--bg)", padding: 16 }}>
              <SectionTitle title="Curva LECAP / BONCAP — TEM vs plazo" />
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lecaps.filter(l => l.tem != null).sort((a, b) => a.diasVencimiento - b.diasVencimiento).map(l => ({ label: l.ticker, dias: l.diasVencimiento, tem: l.tem }))} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
                  <XAxis dataKey="dias" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${v}d`} />
                  <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${v}%`} />
                  <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 2)}%`, "TEM"]} />
                  <Line type="monotone" dataKey="tem" stroke="#FFD700" strokeWidth={2} dot={{ r: 3, fill: "#FFD700" }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla LECAP */}
            <div style={{ background: "var(--bg)", padding: 16 }}>
              <SectionTitle title="Detalle instrumentos" />
              <div style={{ overflowY: "auto", maxHeight: 240 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Ticker", "Tipo", "Vto.", "Días", "Precio", "TEM", "TEA"].map(h => (
                        <th key={h} style={{ padding: "4px 6px", color: "var(--text-dim)", fontWeight: 400, textAlign: h === "Ticker" || h === "Tipo" ? "left" : "right" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lecaps.sort((a, b) => a.diasVencimiento - b.diasVencimiento).map((l, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelected(prev => prev?.type === "cap" && prev.ticker === l.ticker ? null : { type: "cap", ticker: l.ticker })}
                        style={{
                          borderBottom: "1px solid var(--bg-elev-2)",
                          cursor: "pointer",
                          background: selected?.type === "cap" && selected.ticker === l.ticker ? "var(--bg-elev-2)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "3px 6px", color: "var(--amber)", fontWeight: 700 }}>{l.ticker}</td>
                        <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{l.tipo}</td>
                        <td style={{ padding: "3px 6px", color: "var(--text-dim)" }}>{l.vencimiento}</td>
                        <td style={{ padding: "3px 6px", color: "var(--text-dim)", textAlign: "right" }}>{l.diasVencimiento}</td>
                        <td style={{ padding: "3px 6px", color: "var(--text)", textAlign: "right" }}>{l.precio != null ? fmtNum(l.precio, 2) : "—"}</td>
                        <td style={{ padding: "3px 6px", color: "#FFD700", textAlign: "right", fontWeight: 700 }}>{l.tem != null ? fmtPct(l.tem) : "—"}</td>
                        <td style={{ padding: "3px 6px", color: "var(--text-dim)", textAlign: "right" }}>{l.tea != null ? fmtPct(l.tea) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === "cer" || tab === "dual") && (() => {
        const filas = pesos.filter(p => (tab === "dual" ? esDual(p.ticker) : !esDual(p.ticker)))
        const conCurva = filas
          .filter(f => f.tir != null && f.dm != null)
          .map(f => ({ ticker: f.ticker, y: f.tir as number, x: f.dm as number, extra: f.vencimiento?.slice(0, 7) ?? "—" }))
        const unidad = tab === "cer" ? "Tasa real" : "Tasa"
        return (
          <div>
            <div style={{ padding: "10px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.7, fontFamily: "var(--font-data)" }}>
              {LEYENDA_TASA[tab]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)" }}>
              <CurvaAjustada
                titulo={`Curva ${tab === "cer" ? "CER" : "dual"} (${unidad.toLowerCase()} vs duration mod.)`}
                unidadTasa={unidad}
                puntos={conCurva}
                etiquetaExtra="Vto."
              />
              <div style={{ background: "var(--bg)", padding: 16 }}>
                <SectionTitle title={tab === "cer" ? "Screener BONCER / LECER" : "Screener duales TAMAR"} />
                <div style={{ overflowY: "auto", maxHeight: 260 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Ticker", "Vto.", "Precio", unidad, "Dur. mod."].map(h => (
                          <th key={h} style={{ padding: "4px 6px", color: "var(--text-dim)", textAlign: h === "Ticker" ? "left" : "right", fontWeight: 400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map(f => (
                        <tr key={f.ticker} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                          <td style={{ padding: "3px 6px", color: "var(--amber)", fontWeight: 700 }}>{f.ticker}</td>
                          <td style={{ padding: "3px 6px", color: "var(--text-dim)", textAlign: "right" }}>{f.vencimiento?.slice(0, 7) ?? "—"}</td>
                          <td style={{ padding: "3px 6px", color: "var(--text)", textAlign: "right" }}>{f.precio != null ? fmtNum(f.precio, 2) : "—"}</td>
                          <td style={{ padding: "3px 6px", color: "var(--amber)", textAlign: "right", fontWeight: 700 }}>{f.tir != null ? fmtPct(f.tir) : "—"}</td>
                          <td style={{ padding: "3px 6px", color: "var(--text-dim)", textAlign: "right" }}>{f.dm != null ? fmtNum(f.dm, 2) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div style={{ padding: "8px 14px", background: "var(--bg)", fontSize: 8, color: "var(--text-mute)", lineHeight: 1.7 }}>
              Precio y tasa vienen de Rava/BYMA tal como los publican: estos instrumentos todavía no pasan por el
              motor propio de cashflows, así que la tasa no está validada contra prospecto.
            </div>
          </div>
        )
      })()}

      {tab === "dollarlinked" && (
        <FamiliaSinFuente
          label="Dollar-linked"
          detalle="Bonos en pesos que siguen al dólar oficial (TV, TZV y la curva corporativa dollar-linked). El universo existe y se opera, pero todavía no hay un listado de tickers cargado ni una fuente de precios conectada para esta familia."
        />
      )}

      {tab === "ons" && (
        <FamiliaSinFuente
          label="Obligaciones negociables"
          detalle="Deuda corporativa argentina (YPF, Pampa, Telecom, Vista y demás). El mercado secundario se opera bastante por MAE, que hoy no está conectado como fuente. Sin precios confiables no se puede armar ni el screener ni la curva."
        />
      )}

      {tab === "subsoberanos" && (
        <FamiliaSinFuente
          label="Sub-soberanos"
          detalle="Deuda provincial: Córdoba, Buenos Aires, Mendoza, Santa Fe, Neuquén. Están excluidos a propósito del universo de peso-bonds.ts, que sólo cubre soberano nacional. Sumarlos es cargar los tickers y verificar que la fuente de precios los cubra."
        />
      )}

      {selected && (
        <BonoDetailPanel
          assetType={selected.type}
          ticker={selected.ticker}
          bono={selected.type === "bono" ? bonos.find(b => b.ticker === selected.ticker) ?? null : null}
          onClose={() => setSelected(null)}
        />
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: base local + Rava Bursátil (precios) · TIR calculada por Newton-Raphson sobre flujos futuros
      </div>
    </div>
  )
}

// ── Panel de detalle de bono/LECAP (Detalle / Gráfico / Foro) ─────────────────

interface BondHistoryPoint { date: string; priceUsd: number | null; priceArs: number | null }
interface BondHistoryResponse { history: BondHistoryPoint[]; nota?: string }

function BonoDetailPanel({ assetType, ticker, bono, onClose }: {
  assetType: "bono" | "cap"; ticker: string; bono: BondRow | null; onClose: () => void
}) {
  const [detailTab, setDetailTab] = useState<"detalle" | "grafico" | "foro">("detalle")
  const [historia, setHistoria] = useState<BondHistoryResponse | null>(null)
  const [historiaLoading, setHistoriaLoading] = useState(false)

  useEffect(() => {
    if (assetType !== "bono" || detailTab !== "grafico") return
    setHistoriaLoading(true)
    fetch(`/api/bonos/${ticker}/historico`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setHistoria(j && Array.isArray(j.history) ? j : null))
      .catch(() => setHistoria(null))
      .finally(() => setHistoriaLoading(false))
  }, [assetType, ticker, detailTab])

  const panelTabs = [
    { key: "detalle", label: "Detalle" },
    { key: "grafico", label: "Gráfico" },
    { key: "foro", label: "Foro" },
  ] as const

  return (
    <div style={{ background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {panelTabs.map(t => (
            <button key={t.key} onClick={() => setDetailTab(t.key)} style={{
              background: detailTab === t.key ? "var(--bg-elev-2)" : "transparent",
              color: detailTab === t.key ? "var(--amber)" : "var(--text-mute)",
              border: "none",
              borderBottom: detailTab === t.key ? "2px solid var(--amber)" : "2px solid transparent",
              padding: "6px 16px", fontSize: 10,
              textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>

      <div style={{ padding: "0 14px 14px" }}>
        {detailTab === "detalle" && (
          bono ? (
            <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev-2)", padding: 1 }}>
              <KPI label="Precio" value={fmtNum(bono.precio, 2)} unit="USD" />
              <KPI label="TIR" value={bono.tir != null ? fmtPct(bono.tir) : null} valueColor="var(--amber)" />
              <KPI label="Paridad" value={bono.paridad != null ? fmtPct(bono.paridad) : null} />
              <KPI label="Curr. Yield" value={bono.currentYield != null ? fmtPct(bono.currentYield) : null} />
              <KPI label="Dur. Mod" value={bono.durationMod != null ? fmtNum(bono.durationMod, 2) : null} unit="años" />
              <KPI label="Cupón" value={fmtPct(bono.cupon)} unit="s.a." />
              <KPI label="Vencimiento" value={bono.vencimiento?.slice(0, 10) ?? null} />
              <KPI label="VN Residual" value={fmtNum(bono.vnResidual, 2)} unit="% orig" />
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
              Sin datos de detalle para {ticker}
            </div>
          )
        )}
        {detailTab === "grafico" && (
          assetType !== "bono" ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
              Histórico todavía no disponible para instrumentos {assetType.toUpperCase()}
            </div>
          ) : historiaLoading ? (
            <Loading />
          ) : (historia?.history?.length ?? 0) === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
              Sin histórico todavía para {ticker} — el snapshot diario de precios recién se conectó, se va a ir completando día a día.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={historia!.history.map((h) => ({ date: h.date, precio: h.priceUsd }))} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
                  <XAxis dataKey="date" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} />
                  <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} domain={["auto", "auto"]} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="precio" stroke="var(--amber)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              {historia?.nota && <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>{historia.nota}</div>}
            </>
          )
        )}
        {detailTab === "foro" && <ForoActivo assetType={assetType} ticker={ticker} />}
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
  source?: "matba" | "rava" | "db"
}

export function RofexView() {
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
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 9 }}>
      Sin datos ROFEX — Matba API no disponible · verificar conectividad
    </div>
  )

  const maxDev = Math.max(...data.map(d => d.devaluation ?? 0))
  const nearFuture = data[0]
  const farFuture = data[data.length - 1]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        <KPI label="Posiciones activas" value={String(data.length)} unit="contratos en el mercado" />
        <KPI label="Posición más cercana" value={nearFuture?.maturityLabel ?? null} valueColor="var(--amber)"
          unit={nearFuture ? `$${fmtNum(nearFuture.price, 2)} · Dev: ${fmtPct(nearFuture.devaluation)}` : undefined} />
        <KPI label="Posición más lejana" value={farFuture?.maturityLabel ?? null} valueColor="var(--positive)"
          unit={farFuture ? `$${fmtNum(farFuture.price, 2)} · Dev: ${fmtPct(farFuture.devaluation)}` : undefined} />
        <KPI label="Devaluación máxima impl." value={fmtPct(maxDev)} valueColor="#FF6B6B" unit="según ROFEX" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)" }}>
        {/* Precios futuros */}
        <div style={{ background: "var(--bg)", padding: 16 }}>
          <SectionTitle title="Precio implícito USD/ARS por posición" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.map(d => ({ label: d.maturityLabel, price: d.price }))} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
              <XAxis dataKey="label" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }} />
              <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `$${Math.round(v)}`} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`$${fmtNum(v as number, 2)}`, "Precio"]} />
              <Bar dataKey="price" fill="var(--amber)" radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Devaluación implícita */}
        <div style={{ background: "var(--bg)", padding: 16 }}>
          <SectionTitle title="Devaluación implícita acumulada (%)" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.map(d => ({ label: d.maturityLabel, dev: d.devaluation, tna: d.tna }))} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
              <XAxis dataKey="label" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }} />
              <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`${fmtNum(v as number, 2)}%`, name === "dev" ? "Devaluación acum." : "TNA"]} />
              <Area type="monotone" dataKey="dev" stroke="#FF6B6B" fill="#FF6B6B22" strokeWidth={2} name="dev" />
              <Line type="monotone" dataKey="tna" stroke="#FFD700" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="tna" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ padding: 16, background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
        <SectionTitle title="Tabla de posiciones" />
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Posición", "Vencimiento", "Precio", "Dev. Acum.", "Dev. Mensual", "TNA", "CFT"].map(h => (
                <th key={h} style={{ padding: "4px 8px", color: "var(--text-dim)", textAlign: h === "Posición" || h === "Vencimiento" ? "left" : "right", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                <td style={{ padding: "3px 8px", color: "var(--amber)", fontWeight: 700 }}>{d.maturityLabel}</td>
                <td style={{ padding: "3px 8px", color: "var(--text-dim)" }}>{d.maturity?.slice(0, 10)}</td>
                <td style={{ padding: "3px 8px", color: "var(--text)", textAlign: "right" }}>${fmtNum(d.price, 2)}</td>
                <td style={{ padding: "3px 8px", color: "#FF6B6B", textAlign: "right" }}>{fmtPct(d.devaluation)}</td>
                <td style={{ padding: "3px 8px", color: "var(--text-dim)", textAlign: "right" }}>{fmtPct(d.monthlyDevaluation)}</td>
                <td style={{ padding: "3px 8px", color: "#FFD700", textAlign: "right" }}>{fmtPct(d.tna)}</td>
                <td style={{ padding: "3px 8px", color: "var(--text-dim)", textAlign: "right" }}>{fmtPct(d.cft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: {data[0]?.source === "matba" ? "Matba Rofex API (apicem.matbarofex.com.ar)" : data[0]?.source === "rava" ? "Rava Bursátil — futuros ROFEX (dólar) · devaluación implícita vs DLR/SPOT" : "ROFEX DB (cron)"} · Actualización cada 5 min
      </div>
    </div>
  )
}

// ── PLAZO FIJO ────────────────────────────────────────────────────────────────

interface BcraRatePoint { fecha: string; valor: number }
interface PlazoFijoOficialData {
  tamar?: BcraRatePoint[]
  badlar?: BcraRatePoint[]
  tm20?: BcraRatePoint[]
  pf30?: BcraRatePoint[]
}

/** Vista pública del MVP: sólo series observadas de la API oficial del BCRA. */
export function PlazoFijoOficialView() {
  const [data, setData] = useState<PlazoFijoOficialData | null>(null)
  const [source, setSource] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bcra?endpoint=plazofijo")
      .then(async response => {
        if (!response.ok) throw new Error(`BCRA ${response.status}`)
        return response.json()
      })
      .then(payload => {
        setData(payload?.data ?? null)
        setSource(payload?.source ?? "BCRA API v4.0")
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const series = [
    { key: "tamar", label: "TAMAR privados", color: "var(--amber)", points: data?.tamar ?? [] },
    { key: "badlar", label: "BADLAR privados", color: "var(--positive)", points: data?.badlar ?? [] },
    { key: "tm20", label: "TM20 privados", color: "var(--sky)", points: data?.tm20 ?? [] },
    { key: "pf30", label: "Depósitos 30 días", color: "#CE93D8", points: data?.pf30 ?? [] },
  ].filter(item => item.points.length > 0)

  if (series.length === 0) {
    return <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 11 }}>Las tasas oficiales del BCRA no están disponibles en este momento.</div>
  }

  const dates = Array.from(new Set(series.flatMap(item => item.points.map(point => point.fecha)))).sort()
  const valueBySeries = new Map(series.map(item => [item.key, new Map(item.points.map(point => [point.fecha, point.valor]))]))
  const chartData = dates.map(fecha => ({
    fecha,
    ...Object.fromEntries(series.map(item => [item.key, valueBySeries.get(item.key)?.get(fecha) ?? null])),
  }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        {series.map(item => {
          const latest = item.points.at(-1)
          return <KPI key={item.key} label={item.label} value={latest ? `${fmtNum(latest.valor)}%` : null} valueColor={item.color} unit={latest ? `TNA · ${latest.fecha}` : "TNA"} />
        })}
      </div>
      <div style={{ padding: 16, background: "var(--bg)" }}>
        <SectionTitle title="Tasas de depósitos y referencias bancarias — BCRA" />
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
            <XAxis dataKey="fecha" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }} minTickGap={48} />
            <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={value => `${value}%`} />
            <Tooltip {...tooltipStyle} formatter={(value: unknown, name: unknown) => [`${fmtNum(value as number, 2)}%`, String(name)]} />
            <Legend wrapperStyle={{ fontSize: 9, color: "var(--text-dim)" }} />
            {series.map(item => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={1.8} dot={false} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ padding: "7px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: {source}. No se muestran tasas por entidad, PF UVA/USD ni recomendaciones cuando no existe una fuente oficial conectada.
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        <KPI label="Base Monetaria" value={lastBM != null ? `$${fmtNum(lastBM / 1000, 0)}B` : null} valueColor="#FF6B6B" unit="millones ARS" />
        <KPI label="M1" value={lastM1 != null ? `$${fmtNum(lastM1 / 1000, 0)}B` : null} valueColor="var(--amber)" unit="billetes + cuentas corrientes" />
        <KPI label="M2" value={lastM2 != null ? `$${fmtNum(lastM2 / 1000, 0)}B` : null} valueColor="var(--positive)" unit="M1 + cajas de ahorro" />
        {lastM1 && lastM2 && <KPI label="Cuasidinero" value={`$${fmtNum((lastM2 - lastM1) / 1000, 0)}B`} valueColor="#CE93D8" unit="M2 - M1" />}
      </div>

      {/* Chart */}
      <div style={{ padding: 16, background: "var(--bg)" }}>
        <SectionTitle title="Agregados monetarios — últimos 3 años (millones ARS)" />
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
            <XAxis dataKey="fecha" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }} tickFormatter={d => d?.slice(0, 7) ?? ""} interval={Math.floor(chartData.length / 12)} />
            <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${Math.round(v / 1e6)}T`} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`$${fmtNum((v as number) / 1000, 0)}B`, name === "bm" ? "Base Monetaria" : name === "m1" ? "M1" : "M2"]} />
            <Legend wrapperStyle={{ fontSize: 9, color: "var(--text-dim)" }} />
            <Line type="monotone" dataKey="bm" stroke="#FF6B6B" strokeWidth={1.5} dot={false} name="bm" isAnimationActive={false} />
            <Line type="monotone" dataKey="m1" stroke="var(--amber)" strokeWidth={1.5} dot={false} name="m1" isAnimationActive={false} />
            <Line type="monotone" dataKey="m2" stroke="var(--positive)" strokeWidth={1.5} dot={false} name="m2" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: BCRA API v4.0 — Variables 15 (BM), 17 (M1), 18 (M2) · Frecuencia diaria
      </div>
    </div>
  )
}

// ── COMMODITIES ───────────────────────────────────────────────────────────────

const COMM_GROUPS = [
  {
    label: "Agrícolas",
    color: "var(--positive)",
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
    color: "var(--amber)",
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

export function CommoditiesView() {
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
  const ITEM_COLORS = ["var(--positive)","var(--amber)","#FFD700","#FF6B6B","#CE93D8","var(--sky)","#F06292","#81C784","#FF8A65","#A5D6A7","#90CAF9"]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Cards por grupo */}
      {COMM_GROUPS.map(g => (
        <div key={g.label}>
          <div style={{ padding: "5px 14px 2px", fontSize: 8, color: g.color, textTransform: "uppercase", letterSpacing: 2, fontFamily: "var(--font-data)", background: "var(--bg-elev-2)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            {g.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "4px 14px 6px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            {g.items.map((item, idx) => {
              const q = snap[item.key]
              const isActive = selected.has(item.key)
              const color = ITEM_COLORS[COMM_ALL.findIndex(c => c.key === item.key) % ITEM_COLORS.length]
              return (
                <button key={item.key} onClick={() => toggle(item.key)} style={{
                  flex: "1 1 120px", padding: "8px 10px", textAlign: "left", cursor: "pointer",
                  background: isActive ? "var(--bg-elev-2)" : "var(--bg)",
                  border: isActive ? `1px solid ${color}55` : "1px solid var(--bg-elev-2)",
                  fontFamily: "var(--font-data)", transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 8, color: isActive ? color : "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {item.flag} {item.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isActive ? "var(--text)" : "var(--text-mute)", marginTop: 2, lineHeight: 1 }}>
                    {q ? `$${fmtUSD(q.precio, item.decimals)}` : "—"}
                  </div>
                  <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 1 }}>{item.unit}</div>
                  <div style={{ fontSize: 9, color: q ? changeColor(q.variacion_pct) : "var(--border-hi)", marginTop: 2, fontWeight: 700 }}>
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
      <div style={{ padding: "6px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>
          {isMulti ? "% variación desde inicio del período" : `Precio en ${COMM_ALL.find(c => c.key === [...selected][0])?.unit ?? "USD"}`}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
            <button key={p} onClick={() => setSelPeriod(p)} style={{
              fontSize: 8, fontFamily: "var(--font-data)", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
              background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
              border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
              color: selPeriod === p ? "var(--amber)" : "var(--text-mute)",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ padding: 16, background: "var(--bg)" }}>
        {loadingKeys.size > 0
          ? <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-data)" }}>Cargando…</div>
          : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
                <XAxis dataKey="fecha" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }}
                  tickFormatter={d => (d as string)?.slice(0, 7)}
                  interval={Math.max(1, Math.floor(dates.length / 10))} />
                <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} domain={["auto", "auto"]}
                  tickFormatter={v => isMulti
                    ? `${(v as number) >= 0 ? "+" : ""}${Math.round(v as number)}%`
                    : `$${fmtUSD(v as number, allSeries[0]?.item.decimals ?? 2)}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 9, color: "var(--text)", fontFamily: "var(--font-data)" }}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--text-dim)" }}
                  formatter={(v: unknown, name: unknown) => {
                    const item = COMM_ALL.find(c => c.key === name)
                    const val = v as number
                    return isMulti
                      ? [`${val >= 0 ? "+" : ""}${fmtUSD(val, 1)}%`, item?.label ?? String(name)]
                      : [`$${fmtUSD(val, item?.decimals ?? 2)} ${item?.unit ?? ""}`, item?.label ?? String(name)]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9, color: "var(--text-dim)" }}
                  formatter={value => COMM_ALL.find(c => c.key === value)?.label ?? value} />
                {isMulti && <ReferenceLine y={0} stroke="var(--text-mute)" strokeDasharray="4 4" />}
                {allSeries.map((s, idx) => (
                  <Line key={s.item.key} type="monotone" dataKey={s.item.key}
                    stroke={ITEM_COLORS[COMM_ALL.findIndex(c => c.key === s.item.key) % ITEM_COLORS.length]}
                    strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )
        }
        <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-data)" }}>
          {isMulti ? "% variación acumulada desde inicio del período · click en un commodity para agregar/quitar del gráfico" : "Precio de contrato futuro · click en múltiples commodities para comparar rendimientos"}
        </div>
      </div>

      {/* Spread WTI/Brent */}
      {snap.petroleo && snap.brent && (
        <div style={{ padding: "6px 14px", background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>SPREAD BRENT – WTI:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--font-data)" }}>
            ${fmtUSD(snap.brent.precio - snap.petroleo.precio, 2)} USD/bbl
          </span>
          <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>
            Brent ${fmtUSD(snap.brent.precio, 2)} · WTI ${fmtUSD(snap.petroleo.precio, 2)}
          </span>
        </div>
      )}

      {/* Precios locales Rosario */}
      {agroLocal && (
        <div style={{ padding: 14, background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
          <SectionTitle title="Precios disponible Rosario (BCR) — USD/tn" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {(["soja", "maiz", "trigo", "girasol"] as const).map(grano => {
              const g = agroLocal[grano]
              return (
                <div key={grano} style={{ flex: "1 1 130px", padding: "8px 10px", background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
                  <div style={{ fontSize: 8, color: "var(--positive)", textTransform: "capitalize", letterSpacing: 1 }}>{grano}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                    {g.disponible != null ? `$${fmtUSD(g.disponible, 0)}` : "—"}
                  </div>
                  <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 1 }}>{g.unidad}</div>
                  {g.fobOficial != null && (
                    <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
                      FOB: ${fmtUSD(g.fobOficial, 0)} · Ret: {g.retencion}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 7, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-data)" }}>
            {agroLocal.source} · FOB teórico = disponible × (1 − retención%) − gastos portuarios ~$15/tn
          </div>
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
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

export function MundoView() {
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

    fetch("/api/ust-curve")
      .then(r => r.json())
      .then(j => {
        const curve = (j.curve ?? []).filter((p: { yield: number | null }) => p.yield != null && p.yield > 0)
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
          <div style={{ padding: "6px 14px 2px", fontSize: 8, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 2, fontFamily: "var(--font-data)", background: "var(--bg-elev-2)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            {grupo}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "4px 14px 8px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            {keys.map(k => {
              const q = snap[k]
              return (
                <button key={k} onClick={() => setSelTicker(k)} style={{
                  flex: "1 1 120px", padding: "8px 12px", background: selTicker === k ? "var(--bg-elev-2)" : "var(--bg)",
                  border: selTicker === k ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--bg-elev-2)",
                  cursor: "pointer", textAlign: "left", fontFamily: "var(--font-data)",
                }}>
                  <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>{MUNDO_LABELS[k]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                    {q ? fmtNum(q.precio, k === "us10y" ? 3 : 2) : "—"}
                    <span style={{ fontSize: 8, color: "var(--text-dim)", marginLeft: 4 }}>{MUNDO_UNITS[k]}</span>
                  </div>
                  <div style={{ fontSize: 9, color: q ? changeColor(q.variacion_pct) : "var(--text-mute)", marginTop: 1, fontWeight: 700 }}>
                    {q ? `${q.variacion_pct >= 0 ? "+" : ""}${fmtNum(q.variacion_pct, 2)}%` : "—"}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Gráfico histórico */}
      <div style={{ padding: 16, background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <SectionTitle title={`Histórico — ${MUNDO_LABELS[selTicker] ?? selTicker}`} />
          <div style={{ display: "flex", gap: 4 }}>
            {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
              <button key={p} onClick={() => setSelPeriod(p)} style={{
                fontSize: 8, fontFamily: "var(--font-data)", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
                background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
                border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
                color: selPeriod === p ? "var(--amber)" : "var(--text-mute)",
              }}>{p}</button>
            ))}
          </div>
        </div>
        {loadingHist ? <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-data)" }}>Cargando…</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hist.map(([d, v]) => ({ fecha: d, valor: v }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="mundoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
              <XAxis dataKey="fecha" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }} tickFormatter={d => d?.slice(0, 7)} interval={Math.max(1, Math.floor(hist.length / 10))} />
              <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [fmtNum(v as number, 2), MUNDO_LABELS[selTicker]]} />
              <Area type="monotone" dataKey="valor" stroke="var(--amber)" strokeWidth={2} fill="url(#mundoGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* US Treasury yield curve */}
      {ustCurve && (
        <div style={{ padding: 16, background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
          <SectionTitle title="Curva de rendimientos UST — última fecha disponible" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={ustCurve} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
              <XAxis dataKey="label" stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} />
              <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${fmtNum(v as number, 3)}%`, "Yield"]} />
              <Line type="monotone" dataKey="yield" stroke="var(--positive)" strokeWidth={2} dot={{ r: 3, fill: "var(--positive)" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 7, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-data)" }}>
            {ustCurve.map(p => `${p.label}: ${fmtNum(p.yield, 2)}%`).join(" · ")}
          </div>
        </div>
      )}

      {/* Próximos earnings USA */}
      <div style={{ padding: 16, background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)" }}>
        <SectionTitle title="Próximos earnings USA — estimados Q2/Q3 2026" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {NEXT_EARNINGS.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(e => {
            const daysUntil = Math.round((new Date(e.fecha).getTime() - Date.now()) / 86_400_000)
            const isNear = daysUntil <= 14
            return (
              <div key={e.ticker} style={{
                flex: "1 1 140px", padding: "8px 10px", background: "var(--bg-row-alt)",
                border: `1px solid ${isNear ? "#FFA02833" : "var(--bg-elev-2)"}`,
                fontFamily: "var(--font-data)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>{e.ticker}</span>
                  <span style={{ fontSize: 7, color: isNear ? "var(--amber)" : "var(--text-mute)" }}>
                    {daysUntil > 0 ? `en ${daysUntil}d` : daysUntil === 0 ? "HOY" : "pasado"}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 1 }}>{e.empresa}</div>
                <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
                  {e.fecha} {e.afterHours ? "· after hours" : "· pre-market"}
                </div>
                <div style={{ fontSize: 7, color: "var(--text-mute)", marginTop: 1 }}>{e.sector}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 7, color: "var(--text-dim)", marginTop: 6, fontFamily: "var(--font-data)" }}>
          Fechas orientativas — pueden variar. Verificar en earningswhispers.com
        </div>
      </div>

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: Yahoo Finance (mercados globales) · Treasury.gov (curva UST) · Precios diferidos ~15 min
      </div>
    </div>
  )
}

// ── CRIPTO ────────────────────────────────────────────────────────────────────

const CRYPTOS = [
  { key: "bitcoin",  label: "Bitcoin",  ticker: "BTC-USD",  color: "var(--amber)" },
  { key: "ethereum", label: "Ethereum", ticker: "ETH-USD",  color: "#CE93D8" },
  { key: "solana",   label: "Solana",   ticker: "SOL-USD",  color: "var(--positive)" },
  { key: "cardano",  label: "Cardano",  ticker: "ADA-USD",  color: "var(--sky)" },
  { key: "xrp",      label: "XRP",      ticker: "XRP-USD",  color: "#FFD700" },
  { key: "bnb",      label: "BNB",      ticker: "BNB-USD",  color: "#F0B90B" },
  { key: "usdt",     label: "USDT",     ticker: "USDT-USD", color: "#26A17B" },
  { key: "usdc",     label: "USDC",     ticker: "USDC-USD", color: "#2775CA" },
]

interface CriptoYaRate { ask: number; bid: number; totalAsk: number; totalBid: number; time: number }
interface CriptoYaData { [exchange: string]: CriptoYaRate }

export function CryptoView() {
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

    fetch("/api/cripto")
      .then(r => r.json())
      .then(j => {
        if (j.btc_dominance != null) setDominance(j.btc_dominance)
        if (j.usdt_ars != null) setUsdtArs(j.usdt_ars)
      })
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "8px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
        {CRYPTOS.map(c => {
          const q = snap[c.key]
          const isActive = selKey === c.key
          return (
            <button key={c.key} onClick={() => setSelKey(c.key)} style={{
              flex: "1 1 110px", padding: "8px 10px", textAlign: "left", cursor: "pointer",
              background: isActive ? "var(--bg-elev-2)" : "var(--bg)",
              border: isActive ? `1px solid ${c.color}55` : "1px solid var(--bg-elev-2)",
              fontFamily: "var(--font-data)", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 8, color: isActive ? c.color : "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: isActive ? "var(--text)" : "var(--text-mute)", marginTop: 2, lineHeight: 1 }}>
                {q ? `$${fmtUSD(q.precio, decimals(c.key))}` : "—"}
              </div>
              <div style={{
                fontSize: 9, marginTop: 2, fontWeight: 700,
                color: !q ? "var(--border-hi)" : (["usdt","usdc"].includes(c.key) && Math.abs(q.variacion_pct) < 0.1) ? "#666" : changeColor(q.variacion_pct),
              }}>
                {q ? `${q.variacion_pct >= 0 ? "+" : ""}${fmtUSD(q.variacion_pct, 2)}%` : "—"}
                <span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 3, fontWeight: 400 }}>1D</span>
              </div>
              {isActive && <div style={{ width: "100%", height: 2, background: c.color, marginTop: 4, borderRadius: 1 }} />}
            </button>
          )
        })}
      </div>

      {/* Controles */}
      <div style={{ padding: "6px 14px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>Precio USD</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["1mo", "3mo", "6mo", "1y", "2y", "5y"].map(p => (
            <button key={p} onClick={() => setSelPeriod(p)} style={{
              fontSize: 8, fontFamily: "var(--font-data)", padding: "2px 8px", borderRadius: 12, cursor: "pointer",
              background: selPeriod === p ? "rgba(255,160,40,0.12)" : "transparent",
              border: selPeriod === p ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
              color: selPeriod === p ? "var(--amber)" : "var(--text-mute)",
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ padding: 16, background: "var(--bg)" }}>
        <SectionTitle title={`${sel.label} — precio USD`} />
        {loadingHist
          ? <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 9, fontFamily: "var(--font-data)" }}>Cargando…</div>
          : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 4 }}>
                <defs>
                  <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sel.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={sel.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--bg-elev-2)" />
                <XAxis dataKey="fecha" stroke="var(--border-hi)" fontSize={8} tick={{ fill: "var(--text-dim)" }}
                  tickFormatter={d => (d as string)?.slice(0, 7)}
                  interval={Math.max(1, Math.floor(chartData.length / 10))} />
                <YAxis stroke="var(--border-hi)" fontSize={9} tick={{ fill: "var(--text-dim)" }} domain={["auto", "auto"]}
                  tickFormatter={v => `$${Math.round(v as number).toLocaleString("en-US")}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 9, color: "var(--text)", fontFamily: "var(--font-data)" }}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--text-dim)" }}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bg-elev-2)", borderTop: "1px solid var(--bg-elev-2)" }}>
          {/* USDT/ARS */}
          {usdtArs && (
            <div style={{ background: "var(--bg)", padding: 14 }}>
              <SectionTitle title="USDT/ARS por exchange (CriptoYa)" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Exchange", "Compra", "Venta"].map(h => (
                      <th key={h} style={{ padding: "3px 6px", color: "var(--text-dim)", fontWeight: 400, textAlign: h === "Exchange" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usdtArs)
                    .filter(([, v]) => v?.ask > 0)
                    .sort((a, b) => a[1].ask - b[1].ask)
                    .slice(0, 8)
                    .map(([ex, v]) => (
                      <tr key={ex} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                        <td style={{ padding: "3px 6px", color: "var(--amber)" }}>{ex.toUpperCase()}</td>
                        <td style={{ padding: "3px 6px", color: "var(--positive)", textAlign: "right" }}>${fmtNum(v.bid, 2)}</td>
                        <td style={{ padding: "3px 6px", color: "var(--negative)", textAlign: "right" }}>${fmtNum(v.ask, 2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* BTC Dominance */}
          {dominance != null && (
            <div style={{ background: "var(--bg)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>BTC Dominance</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--font-data)", lineHeight: 1 }}>
                {fmtNum(dominance, 1)}%
              </div>
              <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>% del market cap total cripto</div>
              <div style={{ fontSize: 7, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>CoinGecko</div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: Yahoo Finance · CoinGecko (dominance) · CriptoYa (USDT/ARS) · Precios en USD · Actualización cada 5 min
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function TabFinanzas({ initialSubtab, initialTicker = null }: { initialSubtab?: string | null; initialTicker?: string | null }) {
  const [activeTab, setActiveTab] = useState(initialSubtab ?? "acciones")

  useEffect(() => {
    if (initialSubtab) setActiveTab(initialSubtab)
  }, [initialSubtab])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <SubTabs active={activeTab} onChange={setActiveTab} />
      {activeTab === "acciones"  && <AccionesView key={initialTicker ?? "acciones"} initialTicker={activeTab === "acciones" ? initialTicker : null} />}
      {activeTab === "bonos"     && <BonosView key={initialTicker ?? "bonos"} initialTicker={activeTab === "bonos" ? initialTicker : null} />}
      {activeTab === "rofex"     && <RofexView />}
      {activeTab === "plazofijo" && <PlazoFijoOficialView />}
      {activeTab === "commodities" && <CommoditiesView />}
      {activeTab === "mundo"      && <MundoView />}
      {activeTab === "crypto"    && <CryptoView />}
      {activeTab === "screener" && <AssetScreener />}
    </div>
  )
}
