"use client"

/**
 * TabBonos v2 — Renta Fija Argentina (inspirado en bondterminal.com)
 *
 * Sub-tabs:
 *   - Snapshot: tabla NY Law + AR Law, YTM, variaciones, curva integrada
 *   - Curva: scatter YTM vs Duration por ley
 *   - Heatmap: mapa de calor por bono (outstanding × variación)
 *   - LECAPs: tabla LECAPs/BONCAPs
 *   - Riesgo País: KPI + histórico EMBI+ con SMA
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Legend,
  BarChart, Bar, Cell,
} from "recharts"
import { InfoTooltip } from "@/client/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"
import { buildSovereignCurve, type SovereignCurveInput } from "@/lib/sovereign-curve"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SovereignBond {
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
  fuente: string
  change1D?: number | null
  outstanding?: number   // en billones USD
}

interface CapInstrument {
  ticker: string
  tipo: string
  vencimiento: string
  diasVencimiento: number
  precio: number | null
  tir: number | null
  tea: number | null
  tem: number | null
}

interface RiesgoPaisData {
  actual: {
    riesgoPaisBps: number | null
    var1w: number | null
    var1m: number | null
    spreadAr: number | null
    us10y: number | null
    arTir: number | null
    metodologia: string
  }
  regionales: Record<string, { bps: number | null; moneda: string; nota?: string; ticker?: string }>
  historicoConSMA: Array<{ date: string; valor: number; sma30: number; sma90: number }>
  ponderacionBonos: Array<{ ticker: string; outstanding: number; pct: number }>
  alertas: { nivel: string; mensaje: string }[]
}

// Outstanding estimado en billones USD
const OUTSTANDING: Record<string, number> = {
  GD35: 14.79, GD30: 12.65, AL30: 12.15, GD41: 11.15,
  AL35: 10.27, GD46: 8.04, AL29: 7.61, AE38: 4.57, GD38: 6.0,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—"
  return v.toFixed(dec) + "%"
}
function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—"
  return v.toFixed(dec)
}
function fmtPctChange(v: number | null | undefined): string {
  if (v == null) return "—"
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"
}
function changeColor(v: number | null | undefined): string {
  if (v == null) return "var(--text-mute)"
  return v > 0 ? "var(--positive)" : v < 0 ? "var(--negative)" : "var(--text-dim)"
}
function tirColor(tir: number | null | undefined): string {
  if (tir == null) return "var(--text-mute)"
  if (tir > 15) return "var(--positive)"
  if (tir > 10) return "var(--amber)"
  return "var(--negative)"
}

// ── SubTabs ───────────────────────────────────────────────────────────────────

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? "var(--bg-elev-2)" : "transparent",
          color: active === t.key ? "var(--amber)" : "var(--text-mute)",
          border: "none",
          borderBottom: active === t.key ? "2px solid var(--amber)" : "2px solid transparent",
          padding: "6px 16px", fontSize: 10,
          textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ── Snapshot: tabla de bonos soberanos agrupada por ley ───────────────────────

function weightedAvgTIR(bonds: SovereignBond[]): number | null {
  const valid = bonds.filter((b) => b.tir != null && b.precio != null)
  if (valid.length === 0) return null
  const totalOut = valid.reduce((s, b) => s + (OUTSTANDING[b.ticker] ?? 0), 0)
  if (totalOut === 0) return null
  const wavg = valid.reduce((s, b) => s + (b.tir! * (OUTSTANDING[b.ticker] ?? 0)), 0) / totalOut
  return wavg
}

function BondRow({ bond, onClick, selected }: { bond: SovereignBond; onClick: () => void; selected: boolean }) {
  return (
    <tr
      onClick={onClick}
      style={{
        background: selected ? "var(--bg-elev-2)" : "transparent",
        cursor: "pointer",
        borderLeft: selected ? "2px solid var(--amber)" : "2px solid transparent",
      }}
    >
      <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>{bond.ticker}</td>
      <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--text)", textAlign: "right", fontFamily: "var(--font-data)", fontWeight: 600 }}>
        {fmtNum(bond.precio)}
      </td>
      <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: tirColor(bond.tir), textAlign: "right", fontFamily: "var(--font-data)" }}>
        {fmtPct(bond.tir)}
      </td>
      <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--text-dim)", textAlign: "right", fontFamily: "var(--font-data)" }}>
        {fmtNum(bond.durationMod, 1)}
      </td>
      <td style={{ padding: "5px 8px", fontSize: 11, color: changeColor(bond.change1D), textAlign: "right", fontFamily: "var(--font-data)" }}>
        {fmtPctChange(bond.change1D)}
      </td>
      <td style={{ padding: "5px 8px", fontSize: 10, color: "var(--text-dim)", textAlign: "right" }}>
        {bond.vencimiento.slice(0, 7)}
      </td>
    </tr>
  )
}

function BondGroup({ title, bonds, color, selectedTicker, onSelect }: {
  title: string; bonds: SovereignBond[]; color: string;
  selectedTicker: string | null; onSelect: (t: string) => void
}) {
  const wavgTir = weightedAvgTIR(bonds)
  const totalOut = bonds.reduce((s, b) => s + (OUTSTANDING[b.ticker] ?? 0), 0)

  return (
    <div style={{ flex: "1 1 340px", minWidth: 320 }}>
      <div style={{ padding: "4px 8px", background: "var(--bg-elev-2)", borderBottom: `2px solid ${color}`, borderTop: "1px solid var(--border)" }}>
        <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        {totalOut > 0 && (
          <span style={{ fontSize: 9, color: "var(--text-dim)", marginLeft: 8 }}>
            ${totalOut.toFixed(1)}B outstanding
          </span>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Ticker", "Precio", "YTM", "Dur", "1D%", "Vto"].map((h, i) => (
              <th key={h} style={{
                padding: "3px 8px", fontSize: 9, color: "var(--text-dim)",
                textAlign: i === 0 ? "left" : "right",
                borderBottom: "1px solid var(--border)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bonds.map((bond) => (
            <BondRow
              key={bond.ticker}
              bond={bond}
              onClick={() => onSelect(bond.ticker)}
              selected={selectedTicker === bond.ticker}
            />
          ))}
          {/* Weighted average row */}
          <tr style={{ background: "var(--bg-elev)", borderTop: "1px solid var(--border)" }}>
            <td style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>W.Avg</td>
            <td colSpan={2} style={{ padding: "4px 8px", fontSize: 11, color: color, textAlign: "right", fontFamily: "var(--font-data)", fontWeight: 700 }}>
              {wavgTir != null ? wavgTir.toFixed(2) + "%" : "—"}
            </td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ bond, onClose }: { bond: SovereignBond; onClose: () => void }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)" }}>{bond.ticker}</span>
          <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 8 }}>{bond.nombre}</span>
          <span style={{ fontSize: 9, color: bond.ley === "NY" ? "#4488ff" : "var(--text-dim)", marginLeft: 8,
            background: "var(--bg-elev-2)", padding: "1px 6px", borderRadius: 2 }}>{bond.ley} LAW</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev-2)", padding: 1 }}>
        {[
          { label: "Precio", value: fmtNum(bond.precio), unit: "USD", color: "var(--text)" },
          { label: "YTM", value: fmtPct(bond.tir), unit: "anual", color: tirColor(bond.tir) },
          { label: "Paridad", value: fmtPct(bond.paridad), unit: "% VN res." },
          { label: "Curr. Yield", value: fmtPct(bond.currentYield), unit: "anual" },
          { label: "Dur. Mod.", value: fmtNum(bond.durationMod), unit: "años" },
          { label: "Var. 1D", value: fmtPctChange(bond.change1D), unit: "", color: changeColor(bond.change1D) },
          { label: "Cupón", value: fmtPct(bond.cupon), unit: "s.a." },
          { label: "VN Residual", value: fmtPct(bond.vnResidual), unit: "% orig" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ flex: "1 1 120px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{kpi.label}</div>
            <div style={{ fontSize: 18, fontFamily: "var(--font-data)", fontWeight: 700, color: kpi.color ?? "var(--amber)" }}>{kpi.value}</div>
            {kpi.unit && <div style={{ fontSize: 9, color: "var(--text-dim)" }}>{kpi.unit}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Snapshot View ─────────────────────────────────────────────────────────────
function SnapshotView({ bonds }: { bonds: SovereignBond[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedBond = bonds.find((b) => b.ticker === selected) ?? null

  const nyBonds = useMemo(() => bonds.filter((b) => b.ley === "NY"), [bonds])
  const arBonds = useMemo(() => bonds.filter((b) => b.ley === "local"), [bonds])

  const handleSelect = (t: string) => setSelected((prev) => (prev === t ? null : t))

  return (
    <div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev)" }}>
        <BondGroup title="NY Law" bonds={nyBonds} color="#4488ff" selectedTicker={selected} onSelect={handleSelect} />
        <BondGroup title="AR Law" bonds={arBonds} color="var(--positive)" selectedTicker={selected} onSelect={handleSelect} />
      </div>

      {selectedBond && (
        <div style={{ marginTop: 1 }}>
          <DetailPanel bond={selectedBond} onClose={() => setSelected(null)} />
        </div>
      )}

      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Métricas: backend de La Pizarra · Precios: API Merval / Rava · Flujos: prospectos MECON
      </div>
    </div>
  )
}

// ── Sovereign Yield Curve ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurveTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: "var(--amber)", fontWeight: 700, marginBottom: 4 }}>{d.ticker}</div>
      <div style={{ color: "#ccc" }}>YTM: <span style={{ color: "var(--positive)" }}>{d.ytm?.toFixed(2)}%</span></div>
      <div style={{ color: "#ccc" }}>Duration: <span style={{ color: "var(--amber)" }}>{d.dur?.toFixed(2)} años</span></div>
      <div style={{ color: "var(--text-dim)" }}>Ley: {d.law === "NY" ? "Nueva York" : "Local"}</div>
      {d.fittedYtm != null && (
        <>
          <div style={{ color: "var(--text-dim)" }}>YTM curva: {d.fittedYtm.toFixed(2)}%</div>
          <div style={{ color: d.residualBps! > 5 ? "var(--positive)" : d.residualBps! < -5 ? "var(--negative)" : "var(--text-dim)" }}>
            Residual: {d.residualBps! > 0 ? "+" : ""}{d.residualBps!.toFixed(0)} bp · {d.valuation === "en_curva" ? "en curva" : d.valuation}
          </div>
        </>
      )}
      {d.fittedYtm == null && <div style={{ color: "var(--text-mute)" }}>Residual: muestra insuficiente para esta ley</div>}
      {d.precio != null && <div style={{ color: "var(--text-dim)" }}>Precio: ${d.precio?.toFixed(2)}</div>}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurveLabel(props: any) {
  const { x, y, value } = props
  return (
    <text x={x + 8} y={y + 4} fill="var(--text-dim)" fontSize={9} textAnchor="start">
      {value}
    </text>
  )
}

function SovereignCurve({ bonds }: { bonds: SovereignBond[] }) {
  const curveData = useMemo(() => {
    const inputs: SovereignCurveInput[] = []
    const prices = new Map<string, number | null>()

    for (const bond of bonds) {
      if ((bond.ley !== "NY" && bond.ley !== "local") || bond.tir == null || bond.durationMod == null) continue
      inputs.push({
        ticker: bond.ticker,
        law: bond.ley,
        duration: bond.durationMod,
        ytm: bond.tir,
      })
      prices.set(bond.ticker, bond.precio)
    }

    return buildSovereignCurve(inputs).map((point) => ({
      ...point,
      dur: point.duration,
      precio: prices.get(point.ticker) ?? null,
      label: point.ticker,
    }))
  }, [bonds])

  const nyData = curveData.filter((point) => point.law === "NY")
  const arData = curveData.filter((point) => point.law === "local")

  const allData = [...nyData, ...arData]
  if (allData.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 11 }}>
        No hay datos de YTM + Duration disponibles. Ejecutar seed de bonos y esperar que se calculen las TIRs.
      </div>
    )
  }

  const minDur = Math.floor(Math.min(...allData.map((d) => d.dur)) - 0.5)
  const maxDur = Math.ceil(Math.max(...allData.map((d) => d.dur)) + 0.5)
  const minYtm = Math.floor(Math.min(...allData.map((d) => d.ytm)) - 1)
  const maxYtm = Math.ceil(Math.max(...allData.map((d) => d.ytm)) + 1)

  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 4px 8px 0" }}>
      <div style={{ padding: "0 12px 8px", fontSize: 9, color: "var(--text-dim)" }}>
        Curvas soberanas separadas por ley — YTM (%) vs Duration Modificada (años). La recta es el ajuste de cada ley; el residual compara sólo bonos de esa ley: YTM por encima = barato; por debajo = caro.
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 8, right: 48, left: 0, bottom: 16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number" dataKey="dur" name="Duration (años)"
            domain={[minDur, maxDur]}
            tick={{ fill: "var(--text-mute)", fontSize: 9 }}
            axisLine={{ stroke: "var(--border-hi)" }} tickLine={false}
            label={{ value: "Modified Duration (años)", position: "insideBottom", offset: -8, fill: "var(--text-mute)", fontSize: 9 }}
          />
          <YAxis
            type="number" dataKey="ytm" name="YTM (%)"
            domain={[minYtm, maxYtm]}
            tick={{ fill: "var(--text-mute)", fontSize: 9 }}
            axisLine={{ stroke: "var(--border-hi)" }} tickLine={false}
            tickFormatter={(v) => v.toFixed(0) + "%"}
            width={36}
            label={{ value: "YTM %", angle: -90, position: "insideLeft", fill: "var(--text-mute)", fontSize: 9 }}
          />
          <Tooltip content={<CurveTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border-hi)" }} />
          <Legend
            wrapperStyle={{ fontSize: 9, color: "var(--text-dim)", paddingTop: 4 }}
            iconType="circle" iconSize={8}
          />
          {nyData.length > 0 && (
            <Scatter
              name="NY Law" data={nyData} fill="#4488ff"
              line={nyData.some((point) => point.fittedYtm != null) ? { stroke: "#4488ff", strokeWidth: 1.25 } : false}
              lineType="fitting"
              label={<CurveLabel />}
            />
          )}
          {arData.length > 0 && (
            <Scatter
              name="AR Law" data={arData} fill="var(--positive)"
              line={arData.some((point) => point.fittedYtm != null) ? { stroke: "var(--positive)", strokeWidth: 1.25 } : false}
              lineType="fitting"
              label={<CurveLabel />}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 8, padding: "8px 12px 4px" }}>
        {(["NY", "local"] as const).map((law) => {
          const points = curveData
            .filter((point) => point.law === law && point.residualBps != null)
            .sort((a, b) => Math.abs(b.residualBps ?? 0) - Math.abs(a.residualBps ?? 0))
          const hasReference = points.length > 0
          return (
            <div key={law} style={{ border: "1px solid var(--border)", padding: "7px 8px" }}>
              <div style={{ color: law === "NY" ? "#4488ff" : "var(--positive)", fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
                Ley {law === "NY" ? "Nueva York" : "Local"}
              </div>
              {hasReference ? points.map((point) => {
                const residual = point.residualBps ?? 0
                const color = residual > 5 ? "var(--positive)" : residual < -5 ? "var(--negative)" : "var(--text-dim)"
                const label = point.valuation === "en_curva" ? "en curva" : point.valuation
                return (
                  <div key={point.ticker} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, lineHeight: "18px" }}>
                    <span style={{ color: "var(--text)" }}>{point.ticker}</span>
                    <span style={{ color, fontFamily: "var(--font-data)" }}>{residual > 0 ? "+" : ""}{residual.toFixed(0)} bp · {label}</span>
                  </div>
                )
              }) : (
                <div style={{ color: "var(--text-mute)", fontSize: 10 }}>
                  Se requieren al menos tres durations distintas para estimar residual.
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ padding: "4px 12px 0", color: "var(--text-mute)", fontSize: 9 }}>
        Referencia estadística cross-sectional, no recomendación de inversión. Residual positivo = mayor YTM versus la curva de esa ley.
      </div>
    </div>
  )
}

// ── Bond Heatmap ──────────────────────────────────────────────────────────────
function BondHeatmap({ bonds }: { bonds: SovereignBond[] }) {
  const totalOut = bonds.reduce((s, b) => s + (OUTSTANDING[b.ticker] ?? 0), 0)

  const blocks = bonds
    .filter((b) => (OUTSTANDING[b.ticker] ?? 0) > 0)
    .sort((a, b) => (OUTSTANDING[b.ticker] ?? 0) - (OUTSTANDING[a.ticker] ?? 0))

  function blockColor(change: number | null | undefined): string {
    if (change == null) return "var(--border)"
    if (change > 2) return "#0a3a1a"
    if (change > 0.5) return "#0a2a14"
    if (change > 0) return "#0a1e0e"
    if (change > -0.5) return "#2a0a0a"
    if (change > -2) return "#3a0a0a"
    return "#4a0a0a"
  }

  function textColor(change: number | null | undefined): string {
    if (change == null) return "var(--text-mute)"
    if (change >= 0) return "var(--positive)"
    return "var(--negative)"
  }

  return (
    <div>
      <div style={{ padding: "6px 12px", fontSize: 9, color: "var(--text-dim)" }}>
        Tamaño proporcional al outstanding · Verde = suba · Rojo = baja
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "0 1px 1px" }}>
        {blocks.map((bond) => {
          const out = OUTSTANDING[bond.ticker] ?? 0
          const pct = totalOut > 0 ? (out / totalOut) : 0
          const minWidth = Math.max(80, Math.floor(pct * 600))

          return (
            <div key={bond.ticker} style={{
              background: blockColor(bond.change1D),
              border: "1px solid var(--border-hi)",
              borderLeft: `3px solid ${textColor(bond.change1D)}`,
              width: minWidth, minHeight: 80,
              padding: "8px 10px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              flexGrow: pct * 10,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>{bond.ticker}</div>
              <div>
                <div style={{ fontSize: 16, fontFamily: "var(--font-data)", color: "var(--text)", fontWeight: 600 }}>
                  {bond.precio != null ? `$${bond.precio.toFixed(2)}` : "—"}
                </div>
                <div style={{ fontSize: 11, color: textColor(bond.change1D), fontFamily: "var(--font-data)" }}>
                  {fmtPctChange(bond.change1D)}
                </div>
                <div style={{ fontSize: 9, color: tirColor(bond.tir), marginTop: 2 }}>
                  YTM: {fmtPct(bond.tir)}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 1 }}>
                  {out > 0 ? `$${out.toFixed(1)}B` : ""}
                  {bond.ley === "NY" ? " · NY" : " · AR"}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Outstanding: fuentes MECON · Variaciones: cierre anterior vs último precio
      </div>
    </div>
  )
}

// ── LECAPs Screener ────────────────────────────────────────────────────────────
function LecapsScreener() {
  const [instrumentos, setInstrumentos] = useState<CapInstrument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bonos?tipo=lecap")
      .then((r) => r.json())
      .then((j) => { setInstrumentos(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando LECAPs...</div>

  const lecaps = instrumentos.filter((i) => i.tipo === "LECAP")
  const boncaps = instrumentos.filter((i) => i.tipo === "BONCAP")

  const Section = ({ title, items }: { title: string; items: CapInstrument[] }) => (
    <div style={{ marginBottom: 1 }}>
      <div style={{ padding: "3px 8px", background: "var(--bg-elev-2)", fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--bg-elev-2)" }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Ticker", "Vencimiento", "Días", "Precio", "TEM", "TEA", "TIR anual"].map((h, i) => (
              <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid var(--border)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((inst, i) => (
            <tr key={inst.ticker} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-row-alt)" }}>
              <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>{inst.ticker}</td>
              <td style={{ padding: "5px 8px", fontSize: 10, color: "var(--text-mute)", textAlign: "right" }}>{inst.vencimiento}</td>
              <td style={{ padding: "5px 8px", fontSize: 11, color: inst.diasVencimiento < 30 ? "var(--negative)" : inst.diasVencimiento < 90 ? "var(--amber)" : "#ccc", textAlign: "right", fontFamily: "var(--font-data)" }}>
                {inst.diasVencimiento}
              </td>
              <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--text)", textAlign: "right", fontFamily: "var(--font-data)" }}>
                {inst.precio != null ? inst.precio.toFixed(2) : "—"}
              </td>
              <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--positive)", textAlign: "right", fontFamily: "var(--font-data)" }}>
                {inst.tem != null ? inst.tem.toFixed(2) + "%" : "—"}
              </td>
              <td style={{ padding: "5px 8px", fontSize: 11, color: "#FFD700", textAlign: "right", fontFamily: "var(--font-data)" }}>
                {inst.tea != null ? inst.tea.toFixed(2) + "%" : "—"}
              </td>
              <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: tirColor(inst.tir), textAlign: "right", fontFamily: "var(--font-data)" }}>
                {inst.tir != null ? inst.tir.toFixed(2) + "%" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <Section title="LECAPs — Letras del Tesoro Capitalizables" items={lecaps} />
      <Section title="BONCAPs — Bonos del Tesoro Capitalizables" items={boncaps} />
      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Precios: actualización diaria via ByMA · Ordenados por vencimiento · TIR: compuesto continuo vs VN
      </div>
    </div>
  )
}

// ── Riesgo País (enhanced) ────────────────────────────────────────────────────
function fmtBps(v: number | null | undefined): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR") + " bps"
}

function bpsColor(bps: number | null): string {
  if (bps == null) return "var(--text-dim)"
  if (bps > 2000) return "var(--negative)"
  if (bps > 1000) return "var(--amber)"
  if (bps > 500) return "#FFD700"
  return "var(--positive)"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RegionalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div style={{ background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: "var(--amber)", fontWeight: 700, marginBottom: 2 }}>{p.pais}</div>
      <div style={{ fontFamily: "var(--font-data)", color: "var(--text)" }}>{p.bps.toLocaleString("es-AR")} bps · {p.moneda}</div>
      {p.estimado && <div style={{ color: "var(--text-mute)", fontSize: 9, marginTop: 3 }}>estimación histórica, no fuente en vivo</div>}
    </div>
  )
}

function RpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: "var(--text-dim)", fontSize: 9, marginBottom: 4 }}>{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontFamily: "var(--font-data)", color: "var(--text)" }}>{p.value?.toFixed(0)}</span>
        </div>
      ))}
    </div>
  )
}

function RiesgoPaisView() {
  const [data, setData] = useState<RiesgoPaisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<"6m" | "1y" | "2y" | "5y" | "max">("2y")

  useEffect(() => {
    fetch("/api/riesgo-pais")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Calculando riesgo país...</div>

  const bps = data?.actual?.riesgoPaisBps
  const color = bpsColor(bps ?? null)

  // Filter historico by period
  const now = new Date()
  const cutoff = new Date(now)
  switch (period) {
    case "6m": cutoff.setMonth(now.getMonth() - 6); break
    case "1y": cutoff.setFullYear(now.getFullYear() - 1); break
    case "2y": cutoff.setFullYear(now.getFullYear() - 2); break
    case "5y": cutoff.setFullYear(now.getFullYear() - 5); break
    case "max": cutoff.setFullYear(1999); break
  }
  const histFiltered = (data?.historicoConSMA ?? []).filter((e) => new Date(e.date) >= cutoff)

  const regionalChartData = Object.entries(data?.regionales ?? {}).map(([pais, r]) => ({
    pais: pais.charAt(0).toUpperCase() + pais.slice(1),
    bps: r.bps ?? 0,
    moneda: r.moneda,
    estimado: !!r.nota,
  }))

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 2 }}>Riesgo País EMBI+<InfoTooltip text={GLOSSARY["RIESGO PAÍS"].text} source={GLOSSARY["RIESGO PAÍS"].source} url={GLOSSARY["RIESGO PAÍS"].url} position="bottom" /></div>
          <div style={{ fontSize: 36, fontWeight: 700, color, fontFamily: "var(--font-data)" }}>
            {bps != null ? bps.toLocaleString("es-AR") : "—"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>basis points</div>
        </div>
        <div style={{ flex: "1 1 120px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Var. 1 semana</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-data)", color: changeColor(data?.actual?.var1w ? -data.actual.var1w : null) }}>
            {data?.actual?.var1w != null ? (data.actual.var1w >= 0 ? "+" : "") + data.actual.var1w.toFixed(0) + " bps" : "—"}
          </div>
        </div>
        <div style={{ flex: "1 1 120px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Var. 1 mes</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-data)", color: changeColor(data?.actual?.var1m ? -data.actual.var1m : null) }}>
            {data?.actual?.var1m != null ? (data.actual.var1m >= 0 ? "+" : "") + data.actual.var1m.toFixed(0) + " bps" : "—"}
          </div>
        </div>
        <div style={{ flex: "1 1 120px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 2 }}>US 10Y<InfoTooltip text={GLOSSARY["US 10Y"].text} source={GLOSSARY["US 10Y"].source} url={GLOSSARY["US 10Y"].url} position="bottom" /></div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--text-dim)" }}>
            {data?.actual?.us10y != null ? data.actual.us10y.toFixed(2) + "%" : "—"}
          </div>
        </div>
        <div style={{ flex: "1 1 120px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 2 }}>TIR GD30<InfoTooltip text={GLOSSARY["TIR"].text} source={GLOSSARY["TIR"].source} url={GLOSSARY["TIR"].url} position="bottom" /></div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--amber)" }}>
            {data?.actual?.arTir != null ? data.actual.arTir.toFixed(2) + "%" : "—"}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {data?.alertas?.map((a, i) => {
        const c = a.nivel === "crítico" ? "var(--negative)" : a.nivel === "alto" ? "var(--amber)" : a.nivel === "moderado" ? "#FFD700" : "var(--positive)"
        return (
          <div key={i} style={{ background: "var(--bg)", borderLeft: `3px solid ${c}`, padding: "5px 12px", fontSize: 11, color: "#ccc" }}>
            <span style={{ color: c, fontWeight: 700, textTransform: "uppercase", fontSize: 9 }}>{a.nivel} </span>
            {a.mensaje}
          </div>
        )
      })}

      {/* Histórico chart */}
      <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", marginTop: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>EMBI+ Histórico</span>
          <div style={{ display: "flex", gap: 2 }}>
            {(["6m", "1y", "2y", "5y", "max"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                fontSize: 9, padding: "1px 6px",
                background: period === p ? "var(--amber)" : "transparent",
                color: period === p ? "var(--bg)" : "#666",
                border: "none", cursor: "pointer", borderRadius: 2,
              }}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: "4px 4px 4px 0" }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={histFiltered} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "var(--text-mute)", fontSize: 8 }} axisLine={{ stroke: "var(--border-hi)" }} tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={(d) => {
                  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }) } catch { return d }
                }}
              />
              <YAxis tick={{ fill: "var(--text-mute)", fontSize: 8 }} axisLine={{ stroke: "var(--border-hi)" }} tickLine={false} width={36}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip content={<RpTooltip />} />
              <Legend wrapperStyle={{ fontSize: 9, color: "var(--text-dim)" }} iconType="line" iconSize={10} />
              <ReferenceLine y={1000} stroke="var(--border-hi)" strokeDasharray="4 2" label={{ value: "1000", fill: "var(--text-mute)", fontSize: 8 }} />
              <ReferenceLine y={500} stroke="var(--border-hi)" strokeDasharray="4 2" label={{ value: "500", fill: "var(--text-mute)", fontSize: 8 }} />
              <Line type="monotone" dataKey="valor" name="EMBI+" stroke={color} dot={false} strokeWidth={1.5} connectNulls />
              <Line type="monotone" dataKey="sma30" name="SMA 30D" stroke="var(--text-mute)" dot={false} strokeWidth={1} strokeDasharray="4 2" connectNulls />
              <Line type="monotone" dataKey="sma90" name="SMA 90D" stroke="var(--text-mute)" dot={false} strokeWidth={1} strokeDasharray="8 3" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ponderación por bono */}
      <div style={{ marginTop: 1 }}>
        <div className="bbg-panel-header">DETALLE POR BONO (PONDERACIÓN ESTIMADA)</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Bono", "Outstanding", "Ponderación"].map((h, i) => (
                <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.ponderacionBonos ?? []).map((b, i) => (
              <tr key={b.ticker} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg-row-alt)" }}>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>{b.ticker}</td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#ccc", textAlign: "right", fontFamily: "var(--font-data)" }}>
                  ${b.outstanding.toFixed(2)}B
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "var(--positive)", textAlign: "right", fontFamily: "var(--font-data)" }}>
                  {b.pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comparativo regional */}
      <div style={{ marginTop: 1, background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
        <div className="bbg-panel-header">COMPARATIVO REGIONAL (EMBI+)</div>
        <div style={{ padding: "8px 4px 8px 0" }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regionalChartData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="pais" tick={{ fill: "var(--text-dim)", fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: "var(--border-hi)" }} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-mute)", fontSize: 9 }} axisLine={{ stroke: "var(--border-hi)" }} tickLine={false} width={36} />
              <Tooltip content={<RegionalTooltip />} cursor={{ fill: "var(--bg-elev-2)" }} />
              <Bar dataKey="bps" radius={[3, 3, 0, 0]}>
                {regionalChartData.map((entry) => (
                  <Cell key={entry.pais} fill={bpsColor(entry.bps)} fillOpacity={entry.estimado ? 0.45 : 1} stroke={entry.estimado ? bpsColor(entry.bps) : "none"} strokeDasharray={entry.estimado ? "3 2" : undefined} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ padding: "0 8px 8px", fontSize: 9, color: "var(--text-mute)" }}>
          Barras con borde punteado = estimación histórica, no fuente en vivo (ver nota abajo).
        </div>
      </div>

      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Fuente EMBI+ Argentina: argentinadatos.com (en vivo) · US 10Y: Yahoo Finance (en vivo) · Resto de los países: estimaciones históricas, no conectadas a una fuente en vivo todavía.
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TabBonos() {
  const [activeTab, setActiveTab] = useState("snapshot")
  const [bonds, setBonds] = useState<SovereignBond[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchBondsMerval = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const bonosRes = await fetch("/api/bonos")

      const bonosJson = bonosRes.ok ? await bonosRes.json() : { data: [], error: `bonos http ${bonosRes.status}` }
      const rawBonds: SovereignBond[] = bonosJson.data ?? []

      if (!bonosRes.ok && rawBonds.length === 0) {
        setLoadError(bonosJson.error ?? "no se pudieron cargar bonos")
      }

      setBonds(rawBonds.map((b) => ({
        ...b,
        outstanding: OUTSTANDING[b.ticker],
      })))
    } catch {
      const j = await fetch("/api/bonos").then((r) => r.json()).catch(() => ({ data: [] }))
      setBonds((j.data ?? []).map((b: SovereignBond) => ({ ...b, outstanding: OUTSTANDING[b.ticker] })))
      if (!(j.data ?? []).length) setLoadError("no se pudieron cargar bonos desde el backend")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBondsMerval()
  }, [fetchBondsMerval])

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 11 }}>
        Cargando datos de bonos soberanos...
        <div style={{ fontSize: 9, color: "var(--text-mute)", marginTop: 8 }}>
          Si es la primera vez: <code style={{ color: "var(--amber)" }}>npx ts-node prisma/seed-bonds.ts</code>
        </div>
      </div>
    )
  }

  if (bonds.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--negative)", fontSize: 12, marginBottom: 8 }}>no se pudo armar el panel de bonos.</div>
        <div style={{ color: "var(--text-mute)", fontSize: 11 }}>
          {loadError ?? "faltan datos suficientes para renderizar la curva"}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bbg-panel-header">RENTA FIJA ARGENTINA</div>
      <SubTabs
        tabs={[
          { key: "snapshot", label: "Snapshot" },
          { key: "curva", label: "Curva Soberana" },
          { key: "heatmap", label: "Heatmap" },
          { key: "lecaps", label: "LECAPs / BONCAPs" },
          { key: "riesgo", label: "Riesgo País" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === "snapshot" && <SnapshotView bonds={bonds} />}
      {activeTab === "curva" && <SovereignCurve bonds={bonds} />}
      {activeTab === "heatmap" && <BondHeatmap bonds={bonds} />}
      {activeTab === "lecaps" && <LecapsScreener />}
      {activeTab === "riesgo" && <RiesgoPaisView />}
    </div>
  )
}
