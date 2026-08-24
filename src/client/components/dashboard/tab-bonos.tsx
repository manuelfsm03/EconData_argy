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
import { useTickerNav } from "@/lib/ticker-nav"
import { WATCHLIST_EVENT, readWatchlist, toggleWatchlistId } from "@/lib/watchlist"
import { construirCashflows, ESQUEMAS } from "@/lib/bond-schedule"
import { metricasDeMercado } from "@/lib/bond-math"
import { fechaUTC, siguienteDiaHabil } from "@/lib/market-calendar"

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
  precioDirty?: number | null      // px dirty MEP (especie D)
  precioMep?: number | null        // px clean MEP
  precioCcl?: number | null        // px clean CCL (especie C)
  precioDirtyCcl?: number | null   // px dirty CCL
  tnaMep?: number | null
  teaMep?: number | null
  tnaCcl?: number | null
  teaCcl?: number | null
  durationModCcl?: number | null
  paridadCcl?: number | null
  canje?: number | null            // px cable / px mep (único)
  precioArs?: number | null
  dataQuality?: string | null
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
  AO27: 1.5, AO28: 2.0, AO29: 2.5,
}

// Orden de display por familia
const GLOBALES_ORDER = ["GD29", "GD30", "GD35", "GD38", "GD41", "GD46"]
const BONARES_ORDER  = ["AO27", "AO28", "AO29", "AL29", "AL30", "AL35", "AE38", "AL41"]

// Prospectos oficiales (MECON / SEC EDGAR)
const PROSPECTO_URLS: Record<string, string> = {
  GD29: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  GD30: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  GD35: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  GD38: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  GD41: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  GD46: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos-internacionales",
  AL29: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos",
  AL30: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos",
  AL35: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos",
  AE38: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos",
  AL41: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/bonos",
  AO27: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/licitaciones",
  AO28: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/licitaciones",
  AO29: "https://www.argentina.gob.ar/economia/finanzas/secretaria-finanzas/licitaciones",
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

// ── Snapshot: screener de bonos soberanos hard dollar ────────────────────────

function weightedAvgTEA(bonds: SovereignBond[]): number | null {
  const valid = bonds.filter((b) => b.teaMep != null)
  if (valid.length === 0) return null
  const totalOut = valid.reduce((s, b) => s + (OUTSTANDING[b.ticker] ?? 0), 0)
  if (totalOut === 0) return null
  return valid.reduce((s, b) => s + (b.teaMep! * (OUTSTANDING[b.ticker] ?? 0)), 0) / totalOut
}

// Canje MEP/CCL = px cable / px mep. Se muestra como ratio (ej. 0.978).
function fmtCanje(v: number | null | undefined): string {
  if (v == null) return "—"
  return v.toFixed(3)
}

// TIR efectiva anual -> TNA semestral (convención soberanos USD). Igual que el backend.
function tnaFromTir(tir: number | null): number | null {
  if (tir == null) return null
  return 2 * (Math.pow(1 + tir / 100, 0.5) - 1) * 100
}

type MetricasRecalc = { tna: number | null; tea: number | null; dur: number | null; paridad: number | null }

// Recalcula las métricas de un bono a un precio DIRTY dado, usando el mismo
// motor verificado del backend pero del lado del cliente. Devuelve null si el
// bono no tiene esquema de flujos cargado (ej. BONTE sin prospecto).
function recomputeAtPrice(ticker: string, precioDirty: number, liquidacion: Date): MetricasRecalc | null {
  const esquema = ESQUEMAS.find((e) => e.ticker === ticker)
  if (!esquema) return null
  const cashflows = construirCashflows(esquema)
  const m = metricasDeMercado(precioDirty, cashflows, liquidacion)
  if (!m) return null
  return { tna: tnaFromTir(m.tir), tea: m.tir, dur: m.durationMod, paridad: m.paridad }
}

// ── Monitor Strip ─────────────────────────────────────────────────────────────
function MonitorStrip({ tickers, bonds, onUnpin }: {
  tickers: string[]
  bonds: SovereignBond[]
  onUnpin: (t: string) => void
}) {
  if (tickers.length === 0) return null
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 8px", background: "var(--bg-elev-2)",
      borderBottom: "2px solid var(--amber)", overflowX: "auto",
    }}>
      <span style={{
        fontSize: 9, color: "var(--amber)", textTransform: "uppercase",
        letterSpacing: 1, marginRight: 4, whiteSpace: "nowrap",
      }}>MONITOR</span>
      {tickers.map((ticker) => {
        const bond = bonds.find((b) => b.ticker === ticker)
        if (!bond) return null
        const px = bond.precioDirty ?? bond.precio
        return (
          <div key={ticker} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-elev)", border: "1px solid var(--border)",
            padding: "3px 8px", whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>{ticker}</span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text)" }}>
              {px != null ? `$${px.toFixed(2)}` : "—"}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              MEP{" "}<span style={{ color: tirColor(bond.tnaMep), fontFamily: "var(--font-data)" }}>{fmtPct(bond.tnaMep)}</span>
            </span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              CCL{" "}<span style={{ color: tirColor(bond.tnaCcl), fontFamily: "var(--font-data)" }}>{fmtPct(bond.tnaCcl)}</span>
            </span>
            <button
              onClick={() => onUnpin(ticker)}
              style={{ background: "none", border: "none", color: "var(--text-mute)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ── Bond Row (con precio dirty editable + recálculo en vivo) ──────────────────
const CELL = { padding: "4px 8px", fontSize: 11, textAlign: "right" as const, fontFamily: "var(--font-data)" }

function BondRow({ bond, liquidacion, isPinned, isMenuOpen, onToggleMenu, onTogglePin, onOpenCalculator }: {
  bond: SovereignBond
  liquidacion: Date
  isPinned: boolean
  isMenuOpen: boolean
  onToggleMenu: (t: string | null) => void
  onTogglePin: (t: string) => void
  onOpenCalculator: (t: string) => void
}) {
  const { navigateToTicker } = useTickerNav()
  const noCashflows = bond.dataQuality === "no_cashflows_pending_prospecto"
  const hasSchema = useMemo(() => ESQUEMAS.some((e) => e.ticker === bond.ticker), [bond.ticker])
  const marketDirty = bond.precioDirty ?? bond.precio ?? null

  // Precio dirty editable a mano (para ejercicios teóricos). "" = precio de mercado.
  const [raw, setRaw] = useState<string>("")
  const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."))
  const editedPrice = parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
  const modified = editedPrice != null && (marketDirty == null || Math.abs(editedPrice - marketDirty) > 0.005)

  // Métricas MEP: recalculadas en vivo si el precio fue editado y hay esquema.
  const mep = useMemo<MetricasRecalc>(() => {
    if (modified && hasSchema && editedPrice != null) {
      const r = recomputeAtPrice(bond.ticker, editedPrice, liquidacion)
      if (r) return r
    }
    return { tna: bond.tnaMep ?? null, tea: bond.teaMep ?? null, dur: bond.durationMod ?? null, paridad: bond.paridad ?? null }
  }, [modified, hasSchema, editedPrice, bond, liquidacion])

  return (
    <tr style={{ borderBottom: "1px solid var(--bg-elev)", background: modified ? "var(--amber-soft, rgba(255,176,32,0.06))" : "transparent" }}>
      {/* ⋮ menu */}
      <td style={{ padding: "4px 2px", position: "relative", width: 20 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(isMenuOpen ? null : bond.ticker) }}
          style={{ background: "none", border: "none", color: "var(--text-mute)", cursor: "pointer", fontSize: 14, padding: "0 3px", lineHeight: 1 }}
          title="Opciones"
        >⋮</button>
        {isMenuOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, background: "var(--bg-elev-2)", border: "1px solid var(--border)", width: 176, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
            <button onClick={() => { onTogglePin(bond.ticker); onToggleMenu(null) }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11, background: "none", border: "none", color: isPinned ? "var(--amber)" : "var(--text)", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
              {isPinned ? "📌 Quitar del monitor" : "📌 Agregar al monitor"}
            </button>
            <button onClick={() => { window.open(PROSPECTO_URLS[bond.ticker] ?? "#", "_blank"); onToggleMenu(null) }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11, background: "none", border: "none", color: "var(--text)", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
              📄 Descargar prospecto
            </button>
            <button onClick={() => { onOpenCalculator(bond.ticker); onToggleMenu(null) }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11, background: "none", border: "none", color: "var(--text)", cursor: "pointer" }}>
              📊 Ver en calculadora
            </button>
          </div>
        )}
      </td>
      {/* Ticker — clickeable abre detalle de empresa/bono */}
      <td
        style={{ padding: "4px 8px", fontSize: 12, fontWeight: 700, color: "var(--amber)", whiteSpace: "nowrap", cursor: "pointer" }}
        onClick={() => navigateToTicker("bono", bond.ticker, "empresa")}
        title={`Ver detalle de ${bond.ticker}`}
      >
        {bond.ticker}
        {noCashflows && (
          <span title="Flujos pendientes de verificación contra prospecto" style={{ marginLeft: 4, fontSize: 10, cursor: "help" }}>⚠️</span>
        )}
      </td>
      {/* Px Dirty (MEP) — editable */}
      <td style={{ padding: "3px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
        <input
          type="text"
          inputMode="decimal"
          value={raw !== "" ? raw : (marketDirty != null ? marketDirty.toFixed(2) : "")}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          title={modified ? "Precio editado a mano — click ↺ para volver al de mercado" : "Editable: escribí un precio para simular"}
          style={{
            width: 62, textAlign: "right", fontFamily: "var(--font-data)", fontSize: 11,
            background: modified ? "var(--bg-elev-2)" : "transparent",
            color: modified ? "var(--amber)" : "var(--text)",
            border: `1px solid ${modified ? "var(--amber)" : "transparent"}`,
            borderRadius: 3, padding: "2px 4px", outline: "none",
          }}
        />
        {modified && (
          <button onClick={() => setRaw("")} title="Volver al precio de mercado" style={{ background: "none", border: "none", color: "var(--text-mute)", cursor: "pointer", fontSize: 10, padding: "0 2px" }}>↺</button>
        )}
      </td>
      {/* Var % */}
      <td style={{ ...CELL, color: changeColor(bond.change1D) }}>{fmtPctChange(bond.change1D)}</td>
      {/* TNA MEP */}
      <td style={{ ...CELL, color: mep.tna == null ? "var(--text-mute)" : tirColor(mep.tna) }}>{fmtPct(mep.tna)}</td>
      {/* TNA CCL */}
      <td style={{ ...CELL, color: bond.tnaCcl == null ? "var(--text-mute)" : tirColor(bond.tnaCcl) }}>{fmtPct(bond.tnaCcl)}</td>
      {/* TEA MEP */}
      <td style={{ ...CELL, color: mep.tea == null ? "var(--text-mute)" : tirColor(mep.tea) }}>{fmtPct(mep.tea)}</td>
      {/* TEA CCL */}
      <td style={{ ...CELL, color: bond.teaCcl == null ? "var(--text-mute)" : tirColor(bond.teaCcl) }}>{fmtPct(bond.teaCcl)}</td>
      {/* Dur. mod. (al precio MEP mostrado) */}
      <td style={{ ...CELL, color: "var(--text-dim)" }}>{fmtNum(mep.dur, 1)}</td>
      {/* Paridad (al precio MEP mostrado) */}
      <td style={{ ...CELL, color: "var(--text)" }}>{fmtPct(mep.paridad)}</td>
      {/* Canje (px cable / px mep) */}
      <td style={{ ...CELL, fontSize: 10, color: "var(--text-dim)" }}>{fmtCanje(bond.canje)}</td>
    </tr>
  )
}

// ── Bond Table ────────────────────────────────────────────────────────────────
function BondTable({ title, color, bonds, order, liquidacion, pinnedTickers, onTogglePin, onOpenCalculator }: {
  title: string
  color: string
  bonds: SovereignBond[]
  order: string[]
  liquidacion: Date
  pinnedTickers: string[]
  onTogglePin: (t: string) => void
  onOpenCalculator: (t: string) => void
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenu) return
    const handler = () => setOpenMenu(null)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [openMenu])

  const sorted = useMemo(() => {
    const idx = new Map(order.map((t, i) => [t, i]))
    return [...bonds].sort((a, b) => (idx.get(a.ticker) ?? 999) - (idx.get(b.ticker) ?? 999))
  }, [bonds, order])

  const totalOut = bonds.reduce((s, b) => s + (OUTSTANDING[b.ticker] ?? 0), 0)
  const wavgTea = weightedAvgTEA(bonds)

  const COL_HEADERS = ["", "Ticker", "Px Dirty", "Var %", "TNA MEP", "TNA CCL", "TEA MEP", "TEA CCL", "Dur.", "Paridad", "Canje"]

  return (
    <div style={{ marginBottom: 1 }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 10,
        padding: "5px 8px", background: "var(--bg-elev-2)",
        borderTop: "1px solid var(--border)", borderBottom: `2px solid ${color}`,
      }}>
        <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
          {title}
        </span>
        {totalOut > 0 && (
          <span style={{ fontSize: 9, color: "var(--text-dim)" }}>${totalOut.toFixed(1)}B outstanding</span>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {COL_HEADERS.map((h, i) => (
                <th key={i} style={{
                  padding: i === 0 ? "3px 2px" : "3px 8px",
                  fontSize: 9, color: "var(--text-dim)", fontWeight: 500,
                  textAlign: i <= 1 ? "left" : "right",
                  textTransform: "uppercase", letterSpacing: 0.5,
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((bond) => (
              <BondRow
                key={bond.ticker}
                bond={bond}
                liquidacion={liquidacion}
                isPinned={pinnedTickers.includes(bond.ticker)}
                isMenuOpen={openMenu === bond.ticker}
                onToggleMenu={setOpenMenu}
                onTogglePin={onTogglePin}
                onOpenCalculator={onOpenCalculator}
              />
            ))}
            {/* W.Avg row — ponderado por outstanding, sobre TEA MEP */}
            <tr style={{ background: "var(--bg-elev)", borderTop: "1px solid var(--border)" }}>
              <td />
              <td style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>W.Avg</td>
              <td colSpan={4} />
              <td style={{ padding: "4px 8px", fontSize: 11, textAlign: "right", fontFamily: "var(--font-data)", color, fontWeight: 700 }}>
                {wavgTea != null ? wavgTea.toFixed(2) + "%" : "—"}
              </td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Snapshot View ─────────────────────────────────────────────────────────────
// Deriva los tickers de bonos que están pineados en la watchlist compartida.
function pinnedFromWatchlist(): string[] {
  return readWatchlist().filter((e) => e.startsWith("bono:")).map((e) => e.slice(5))
}

function SnapshotView({ bonds }: { bonds: SovereignBond[] }) {
  const { navigateToTicker } = useTickerNav()
  const [pinnedTickers, setPinnedTickers] = useState<string[]>([])

  // El "monitor" del screener es la misma watchlist de activos de la app: los
  // bonos pineados acá aparecen en el screener de activos y viceversa.
  useEffect(() => {
    const sync = () => setPinnedTickers(pinnedFromWatchlist())
    sync()
    window.addEventListener(WATCHLIST_EVENT, sync)
    return () => window.removeEventListener(WATCHLIST_EVENT, sync)
  }, [])

  const handleTogglePin = useCallback((ticker: string) => {
    toggleWatchlistId(`bono:${ticker}`)
    setPinnedTickers(pinnedFromWatchlist())
  }, [])

  const handleOpenCalculator = useCallback((ticker: string) => {
    navigateToTicker("bono", ticker, "calculadora")
  }, [navigateToTicker])

  // Fecha de liquidación (T+1 hábil) para el recálculo client-side al editar precios.
  const liquidacion = useMemo(
    () => siguienteDiaHabil(fechaUTC(new Date().toISOString().slice(0, 10))),
    [],
  )

  const globalesBonds = useMemo(
    () => bonds.filter((b) => GLOBALES_ORDER.includes(b.ticker)),
    [bonds],
  )
  const bonaresBonds = useMemo(
    () => bonds.filter((b) => BONARES_ORDER.includes(b.ticker)),
    [bonds],
  )

  return (
    <div>
      <MonitorStrip
        tickers={pinnedTickers}
        bonds={bonds}
        onUnpin={handleTogglePin}
      />
      <BondTable
        title="USD Globales — Ley NY"
        color="#4488ff"
        bonds={globalesBonds}
        order={GLOBALES_ORDER}
        liquidacion={liquidacion}
        pinnedTickers={pinnedTickers}
        onTogglePin={handleTogglePin}
        onOpenCalculator={handleOpenCalculator}
      />
      <BondTable
        title="USD Bonares — Ley ARG"
        color="var(--positive)"
        bonds={bonaresBonds}
        order={BONARES_ORDER}
        liquidacion={liquidacion}
        pinnedTickers={pinnedTickers}
        onTogglePin={handleTogglePin}
        onOpenCalculator={handleOpenCalculator}
      />
      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        Métricas: backend La Pizarra · Precios: BYMA Data / Rava · Flujos: prospectos MECON / SEC · TNA semestral · Px Dirty editable (recalcula MEP en vivo) · Canje = px cable / px mep
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
