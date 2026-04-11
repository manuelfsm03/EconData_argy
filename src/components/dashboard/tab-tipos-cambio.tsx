"use client"

/**
 * TabTiposCambio — Rediseño completo (rama Pista)
 *
 * Sub-tabs: Precios | Gráficos
 *
 * Precios:
 *   - Cards locales (DolarAPI)
 *   - Bloque internacional (Yahoo Finance vía /api/internacional)
 *   - Tabla futuros ROFEX (/api/rofex)
 *   - Tabla breakevens LECAPs (/api/bonos?tipo=lecap)
 *
 * Gráficos:
 *   - Serie histórica multi-TC (/api/tc-historico)
 *   - Bandas cambiarias (3 fases, calculadas localmente)
 *   - Forecast de bandas (REM / manual, bull/neutral/bear)
 *   - Overlay: futuros ROFEX + breakevens LECAPs (puntos)
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DolarRate {
  compra: number
  venta: number
  nombre: string
  actualizacion: string
  variacion: number | null
}

interface DolarResponse {
  rates: Record<string, DolarRate>
  spreads: {
    brechaBlueOficial: number | null
    brechaMepOficial: number | null
    brechaCclOficial: number | null
    brechaCclMep: number | null
  }
}

interface InternacionalData {
  dxy: number | null; eurUsd: number | null; jpyUsd: number | null; brlUsd: number | null
  dxyChg: number | null; eurChg: number | null; jpyChg: number | null; brlChg: number | null
}

interface RofexFuture {
  id: string
  position: string
  maturity: string
  maturityLabel: string | null
  price: number | null
  devaluation: number | null
  monthlyDevaluation: number | null
  tna: number | null
}

interface CapInstrument {
  ticker: string
  tipo: string
  vencimiento: string
  diasVencimiento: number
  precio: number | null
  tem: number | null
  tir: number | null
  tea: number | null
  tcImplicito: number | null
}

interface TCEntry {
  date: string
  blue?: number
  mep?: number
  ccl?: number
  oficial?: number
  mayorista?: number
}

type Period = "1m" | "3m" | "6m" | "1y" | "2y" | "max"
type ForecastMode = "neutral" | "rem_top10" | "manual"

interface BandasData {
  ipcHistorico: Record<string, number>
  remMediana: number[]
  remTop10: number[]
  bandaInicial: { date: string; inferior: number; superior: number }
  fuentes: Record<string, string>
}

// ─── Constants (fallback si la API falla) ─────────────────────────────────────

const IPC_HISTORICO_FALLBACK: Record<string, number> = {
  "2025-01": 2.4, "2025-02": 2.4, "2025-03": 3.7,
}
const BANDA_INICIAL_FALLBACK = { date: "2025-04-14", inferior: 1000, superior: 1400 }
const REM_MEDIANA_FALLBACK = [2.4, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 2.0, 1.9, 1.9, 1.8]
const REM_TOP10_FALLBACK   = [2.1, 2.1, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.5, 1.4]
const BULL_OFFSET  = 1.0  // +100bps sobre REM mediana
const BEAR_OFFSET  = -1.0 // -100bps sobre REM mediana

const PERIODS: { value: Period; label: string }[] = [
  { value: "1m", label: "1M" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" },
  { value: "1y", label: "1A" }, { value: "2y", label: "2A" }, { value: "max", label: "MAX" },
]

const TC_LINES: { key: string; name: string; color: string }[] = [
  { key: "blue",      name: "Blue",      color: "#4AF6C3" },
  { key: "ccl",       name: "CCL",       color: "#FFA028" },
  { key: "mep",       name: "MEP",       color: "#FFD700" },
  { key: "oficial",   name: "Oficial",   color: "#aaaaaa" },
  { key: "mayorista", name: "Mayorista", color: "#777777" },
  { key: "tarjeta",   name: "Tarjeta",   color: "#FB7185" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtARS(v: number | null | undefined, decimals = 0): string {
  if (v == null) return "—"
  return "$" + v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—"
  return (v >= 0 ? "+" : "") + v.toFixed(decimals) + "%"
}

function fmtDateShort(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }) }
  catch { return d }
}

function fmtDateFull(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) }
  catch { return d }
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#888"
  return v > 0 ? "#4AF6C3" : v < 0 ? "#FF433D" : "#888"
}

// ─── Band computation ─────────────────────────────────────────────────────────

// Devuelve el IPC del mes "YYYY-MM" usando datos históricos o REM como fallback
function getIPC(monthStr: string, ipcHistorico: Record<string, number>, remData: number[]): number {
  if (ipcHistorico[monthStr] != null) return ipcHistorico[monthStr]
  const [year, mon] = monthStr.split("-").map(Number)
  // Offset desde feb 2025 (índice 0 del REM)
  const offset = (year - 2025) * 12 + (mon - 2)
  if (offset >= 0 && offset < remData.length) return remData[offset]
  return remData[remData.length - 1]
}

interface BandPoint { date: string; bandaInf: number; bandaSup: number }

// Calcula las bandas desde la fecha inicial hasta N meses adelante
function computeBandPoints(
  monthsAhead: number,
  remData: number[],
  ipcHistorico: Record<string, number>,
  bandaInicial: { date: string; inferior: number; superior: number }
): BandPoint[] {
  const points: BandPoint[] = []
  let inf = bandaInicial.inferior
  let sup = bandaInicial.superior

  points.push({ date: bandaInicial.date, bandaInf: inf, bandaSup: sup })

  for (let i = 0; i < monthsAhead; i++) {
    const year  = 2025 + Math.floor((3 + i) / 12)
    const month = ((3 + i) % 12) + 1
    const ipcYear  = year + Math.floor((month - 3) / 12)
    const ipcMonth = ((month - 3 + 12) % 12) + 1
    const ipcStr   = `${ipcYear}-${String(ipcMonth).padStart(2, "0")}`
    const ipc = getIPC(ipcStr, ipcHistorico, remData)

    inf = inf * (1 + ipc / 100)
    sup = sup * (1 + ipc / 100)

    const lastDay = new Date(year, month, 0).getDate()
    points.push({
      date: `${year}-${String(month).padStart(2, "0")}-${lastDay}`,
      bandaInf: parseFloat(inf.toFixed(2)),
      bandaSup: parseFloat(sup.toFixed(2)),
    })
  }

  return points
}

interface ForecastPoint {
  date: string
  fcastNeutralInf: number; fcastNeutralSup: number
  fcastBullInf: number;    fcastBullSup: number
  fcastBearInf: number;    fcastBearSup: number
  fcastTop10Inf: number;   fcastTop10Sup: number
  fcastManualInf: number;  fcastManualSup: number
}

function computeForecast(
  monthsAhead: number,
  manualRate: number,
  remMediana: number[],
  remTop10: number[],
  ipcHistorico: Record<string, number>,
  bandaInicial: { date: string; inferior: number; superior: number }
): ForecastPoint[] {
  const scenarios = [
    { key: "neutral", data: remMediana },
    { key: "bull",    data: remMediana.map((v) => v + BULL_OFFSET) },
    { key: "bear",    data: remMediana.map((v) => Math.max(0, v + BEAR_OFFSET)) },
    { key: "top10",   data: remTop10 },
    { key: "manual",  data: Array(36).fill(manualRate) },
  ] as const

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  const monthsElapsed = Math.max(0,
    (today.getFullYear() - 2025) * 12 + (today.getMonth() - 3)
  )
  const historicoBands = computeBandPoints(monthsElapsed + 1, remMediana, ipcHistorico, bandaInicial)
  const lastHistoric = historicoBands[historicoBands.length - 1]

  const points: ForecastPoint[] = []
  const starts = { neutral: lastHistoric.bandaInf, bull: lastHistoric.bandaInf, bear: lastHistoric.bandaInf, top10: lastHistoric.bandaInf, manual: lastHistoric.bandaInf }
  const startsSup = { neutral: lastHistoric.bandaSup, bull: lastHistoric.bandaSup, bear: lastHistoric.bandaSup, top10: lastHistoric.bandaSup, manual: lastHistoric.bandaSup }

  const infLevels = { ...starts }
  const supLevels = { ...startsSup }

  // Punto de arranque = hoy
  points.push({
    date: todayStr,
    fcastNeutralInf: infLevels.neutral, fcastNeutralSup: supLevels.neutral,
    fcastBullInf: infLevels.bull,       fcastBullSup: supLevels.bull,
    fcastBearInf: infLevels.bear,       fcastBearSup: supLevels.bear,
    fcastTop10Inf: infLevels.top10,     fcastTop10Sup: supLevels.top10,
    fcastManualInf: infLevels.manual,   fcastManualSup: supLevels.manual,
  })

  for (let i = 0; i < monthsAhead; i++) {
    const futureDate = new Date(today)
    futureDate.setMonth(today.getMonth() + i + 1, 1)
    const year  = futureDate.getFullYear()
    const month = futureDate.getMonth() + 1
    const lastDay = new Date(year, month, 0).getDate()
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${lastDay}`

    for (const sc of scenarios) {
      const ipcYear  = year + Math.floor((month - 3) / 12)
      const ipcMonth = ((month - 3 + 12) % 12) + 1
      const ipcStr   = `${ipcYear}-${String(ipcMonth).padStart(2, "0")}`
      // Use scenario-specific data (no historical override for forecast)
      const ipc = IPC_HISTORICO[ipcStr] ?? (sc.data[i] ?? sc.data[sc.data.length - 1])
      infLevels[sc.key as keyof typeof infLevels] *= (1 + ipc / 100)
      supLevels[sc.key as keyof typeof supLevels] *= (1 + ipc / 100)
    }

    points.push({
      date: dateStr,
      fcastNeutralInf: parseFloat(infLevels.neutral.toFixed(2)), fcastNeutralSup: parseFloat(supLevels.neutral.toFixed(2)),
      fcastBullInf:    parseFloat(infLevels.bull.toFixed(2)),    fcastBullSup:    parseFloat(supLevels.bull.toFixed(2)),
      fcastBearInf:    parseFloat(infLevels.bear.toFixed(2)),    fcastBearSup:    parseFloat(supLevels.bear.toFixed(2)),
      fcastTop10Inf:   parseFloat(infLevels.top10.toFixed(2)),   fcastTop10Sup:   parseFloat(supLevels.top10.toFixed(2)),
      fcastManualInf:  parseFloat(infLevels.manual.toFixed(2)),  fcastManualSup:  parseFloat(supLevels.manual.toFixed(2)),
    })
  }

  return points
}

// ─── Sub-components: Precios ──────────────────────────────────────────────────

function RateCard({
  label, venta, compra, variacion, brecha, color, badge,
}: {
  label: string; venta: number | null; compra?: number | null
  variacion?: number | null; brecha?: number | null; color: string; badge?: string
}) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 14px", minWidth: 130 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        {badge && (
          <span style={{ fontSize: 8, padding: "1px 5px", background: "#FFA02822", color: "#FFA028", border: "1px solid #FFA02844", borderRadius: 2 }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1 }}>
        {fmtARS(venta)}
      </div>
      {compra != null && (
        <div style={{ fontSize: 10, color: "#555", marginTop: 3, fontFamily: "monospace" }}>
          C: {fmtARS(compra)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {variacion != null && (
          <span style={{ fontSize: 9, color: varColor(variacion) }}>{fmtPct(variacion)} 1D</span>
        )}
        {brecha != null && (
          <span style={{ fontSize: 9, color: "#888" }}>brecha {fmtPct(brecha)}</span>
        )}
      </div>
    </div>
  )
}

function InternacionalBlock({ data }: { data: InternacionalData | null }) {
  if (!data) return (
    <div style={{ padding: "10px 14px", fontSize: 10, color: "#555" }}>Cargando mercados internacionales...</div>
  )

  const items = [
    { label: "DXY", value: data.dxy?.toFixed(2) ?? "—", chg: data.dxyChg, note: "Índice dólar" },
    { label: "EUR/USD", value: data.eurUsd?.toFixed(4) ?? "—", chg: data.eurChg, note: "Euro" },
    { label: "JPY/USD", value: data.jpyUsd != null ? data.jpyUsd.toFixed(6) : "—", chg: data.jpyChg, note: "Yen" },
    { label: "USD/BRL", value: data.brlUsd?.toFixed(4) ?? "—", chg: data.brlChg, note: "Real" },
  ]

  return (
    <div style={{ display: "flex", gap: 1 }}>
      {items.map((item) => (
        <div key={item.label} style={{ flex: "1 1 100px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            {item.label} <span style={{ color: "#333" }}>· {item.note}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#4FC3F7", fontFamily: "monospace" }}>{item.value}</div>
          {item.chg != null && (
            <div style={{ fontSize: 9, color: varColor(item.chg), marginTop: 3 }}>{fmtPct(item.chg)}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function RofexTable({ futures }: { futures: RofexFuture[] }) {
  if (futures.length === 0) return (
    <div style={{ padding: "10px 14px", fontSize: 10, color: "#555" }}>
      Sin datos ROFEX. Los futuros se cargan vía cron o POST /api/rofex.
    </div>
  )

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Posición", "Precio", "Devalución acum.", "Dev. mensual", "TNA impl."].map((h, i) => (
              <th key={h} style={{ padding: "4px 10px", fontSize: 9, color: "#555", textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid #1a1a1a", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {futures.map((f, i) => (
            <tr key={f.id} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
              <td style={{ padding: "4px 10px", fontSize: 10, color: "#FFA028" }}>
                {f.maturityLabel ?? f.position}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                {fmtARS(f.price)}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: varColor(f.devaluation), textAlign: "right", fontFamily: "monospace" }}>
                {fmtPct(f.devaluation)}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#aaa", textAlign: "right", fontFamily: "monospace" }}>
                {fmtPct(f.monthlyDevaluation)}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#4FC3F7", textAlign: "right", fontFamily: "monospace" }}>
                {f.tna != null ? f.tna.toFixed(1) + "%" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LecapTable({ instruments }: { instruments: CapInstrument[] }) {
  if (instruments.length === 0) return (
    <div style={{ padding: "10px 14px", fontSize: 10, color: "#555" }}>
      Sin datos de LECAPs. Ejecutar seed de instrumentos.
    </div>
  )

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Ticker", "Tipo", "Vto.", "Días", "Precio", "TEM", "TEA", "TC implícito"].map((h, i) => (
              <th key={h} style={{ padding: "4px 10px", fontSize: 9, color: "#555", textAlign: i < 4 ? "left" : "right", borderBottom: "1px solid #1a1a1a", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instruments.map((inst, i) => (
            <tr key={inst.ticker} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
              <td style={{ padding: "4px 10px", fontSize: 10, color: "#FFD700", fontWeight: 700 }}>{inst.ticker}</td>
              <td style={{ padding: "4px 10px", fontSize: 9, color: "#555" }}>{inst.tipo}</td>
              <td style={{ padding: "4px 10px", fontSize: 10, color: "#888" }}>{fmtDateFull(inst.vencimiento)}</td>
              <td style={{ padding: "4px 10px", fontSize: 10, color: "#666" }}>{inst.diasVencimiento}d</td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                {inst.precio != null ? inst.precio.toFixed(2) : "—"}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                {inst.tem != null ? inst.tem.toFixed(2) + "%" : "—"}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#aaa", textAlign: "right", fontFamily: "monospace" }}>
                {inst.tea != null ? inst.tea.toFixed(1) + "%" : "—"}
              </td>
              <td style={{ padding: "4px 10px", fontSize: 11, color: "#A78BFA", textAlign: "right", fontFamily: "monospace" }}>
                {fmtARS(inst.tcImplicito)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Sub-component: Gráficos ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #333", padding: "8px 12px", fontSize: 10, minWidth: 180, maxWidth: 260 }}>
      <div style={{ color: "#555", marginBottom: 4, fontSize: 9 }}>{fmtDateFull(label)}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        p.value != null && (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: p.color, fontSize: 9 }}>{p.name}</span>
            <span style={{ color: "#fff", fontFamily: "monospace" }}>{fmtARS(p.value)}</span>
          </div>
        )
      ))}
    </div>
  )
}

function GraficosSection({
  tcData, rofexData, lecapData, bandasData,
}: {
  tcData: TCEntry[]
  rofexData: RofexFuture[]
  lecapData: CapInstrument[]
  bandasData: BandasData | null
}) {
  const ipcHistorico = bandasData?.ipcHistorico ?? IPC_HISTORICO_FALLBACK
  const remMediana   = bandasData?.remMediana   ?? REM_MEDIANA_FALLBACK
  const remTop10     = bandasData?.remTop10     ?? REM_TOP10_FALLBACK
  const bandaInicial = bandasData?.bandaInicial ?? BANDA_INICIAL_FALLBACK
  const [visibles, setVisibles] = useState<Set<string>>(new Set(["blue", "ccl", "mep", "oficial"]))
  const [showBandas, setShowBandas] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const [forecastMode, setForecastMode] = useState<ForecastMode>("neutral")
  const [manualRate, setManualRate] = useState(2.5)
  const [showRofex, setShowRofex] = useState(false)
  const [showLecap, setShowLecap] = useState(false)

  const toggleLine = (key: string) => {
    setVisibles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
      return next
    })
  }

  // Compute band and forecast data (con datos dinámicos o fallback)
  const bandPoints = useMemo(
    () => computeBandPoints(18, remMediana, ipcHistorico, bandaInicial),
    [remMediana, ipcHistorico, bandaInicial]
  )

  const forecastPoints = useMemo(
    () => computeForecast(12, manualRate, remMediana, remTop10, ipcHistorico, bandaInicial),
    [manualRate, remMediana, remTop10, ipcHistorico, bandaInicial]
  )

  // Merge all chart data by date
  const chartData = useMemo(() => {
    const map: Record<string, Record<string, number | undefined>> = {}

    // TC histórico (agrega tarjeta derivada)
    for (const row of tcData) {
      if (!map[row.date]) map[row.date] = {}
      if (row.blue)      map[row.date].blue      = row.blue
      if (row.mep)       map[row.date].mep        = row.mep
      if (row.ccl)       map[row.date].ccl        = row.ccl
      if (row.oficial)   map[row.date].oficial    = row.oficial
      if (row.mayorista) map[row.date].mayorista  = row.mayorista
      if (row.oficial)   map[row.date].tarjeta    = parseFloat((row.oficial * 1.60).toFixed(2))
    }

    // Bandas históricas (desde apr 14, 2025)
    for (const bp of bandPoints) {
      if (!map[bp.date]) map[bp.date] = {}
      map[bp.date].bandaInf = bp.bandaInf
      map[bp.date].bandaSup = bp.bandaSup
    }

    // Forecast (fechas futuras)
    for (const fp of forecastPoints) {
      if (!map[fp.date]) map[fp.date] = {}
      map[fp.date].fcastNeutralInf = fp.fcastNeutralInf
      map[fp.date].fcastNeutralSup = fp.fcastNeutralSup
      map[fp.date].fcastBullInf    = fp.fcastBullInf
      map[fp.date].fcastBullSup    = fp.fcastBullSup
      map[fp.date].fcastBearInf    = fp.fcastBearInf
      map[fp.date].fcastBearSup    = fp.fcastBearSup
      map[fp.date].fcastTop10Inf   = fp.fcastTop10Inf
      map[fp.date].fcastTop10Sup   = fp.fcastTop10Sup
      map[fp.date].fcastManualInf  = fp.fcastManualInf
      map[fp.date].fcastManualSup  = fp.fcastManualSup
    }

    // ROFEX overlay dots — se agregan como key en chartData (Line strokeWidth=0)
    for (const f of rofexData) {
      if (!f.price) continue
      const date = (f.maturity ?? "").split("T")[0]
      if (!date) continue
      if (!map[date]) map[date] = {}
      map[date].rofexDot = f.price
    }

    // LECAP breakeven dots
    for (const l of lecapData) {
      if (!l.tcImplicito) continue
      if (!map[l.vencimiento]) map[l.vencimiento] = {}
      map[l.vencimiento].lecapDot = l.tcImplicito
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }, [tcData, bandPoints, forecastPoints])

  // Forecast keys to show based on mode
  const fcastKeys = useMemo(() => {
    switch (forecastMode) {
      case "neutral":   return { inf: "fcastNeutralInf", sup: "fcastNeutralSup" }
      case "rem_top10": return { inf: "fcastTop10Inf",   sup: "fcastTop10Sup" }
      case "manual":    return { inf: "fcastManualInf",  sup: "fcastManualSup" }
    }
  }, [forecastMode])

  const todayStr = new Date().toISOString().split("T")[0]

  return (
    <div>
      {/* Controls row 1: TC line toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 10px", borderBottom: "1px solid #111", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Series TC</span>
        {TC_LINES.map((l) => (
          <button key={l.key} onClick={() => toggleLine(l.key)} style={{
            fontSize: 9, padding: "2px 7px",
            background: visibles.has(l.key) ? l.color + "22" : "transparent",
            border: `1px solid ${visibles.has(l.key) ? l.color : "#2a2a2a"}`,
            color: visibles.has(l.key) ? l.color : "#444",
            cursor: "pointer", borderRadius: 2,
          }}>
            {l.name}
          </button>
        ))}
      </div>

      {/* Controls row 2: Bandas + Forecast + Overlays */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 10px", borderBottom: "1px solid #111", alignItems: "center" }}>
        {/* Bandas toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, color: showBandas ? "#FFA028" : "#444" }}>
          <input type="checkbox" checked={showBandas} onChange={(e) => setShowBandas(e.target.checked)}
            style={{ accentColor: "#FFA028", width: 11, height: 11 }} />
          BANDAS CAMBIARIAS
        </label>

        <div style={{ width: 1, height: 12, background: "#222" }} />

        {/* Forecast toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, color: showForecast ? "#A78BFA" : "#444" }}>
          <input type="checkbox" checked={showForecast} onChange={(e) => setShowForecast(e.target.checked)}
            style={{ accentColor: "#A78BFA", width: 11, height: 11 }} />
          FORECAST BANDAS
        </label>

        {showForecast && (
          <>
            {(["neutral", "rem_top10", "manual"] as ForecastMode[]).map((m) => (
              <button key={m} onClick={() => setForecastMode(m)} style={{
                fontSize: 9, padding: "2px 7px",
                background: forecastMode === m ? "#A78BFA22" : "transparent",
                border: `1px solid ${forecastMode === m ? "#A78BFA" : "#2a2a2a"}`,
                color: forecastMode === m ? "#A78BFA" : "#444",
                cursor: "pointer", borderRadius: 2,
              }}>
                {m === "neutral" ? "REM Mediana" : m === "rem_top10" ? "REM Top10" : "Manual"}
              </button>
            ))}
            {forecastMode === "manual" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number" min={0} max={30} step={0.1}
                  value={manualRate}
                  onChange={(e) => setManualRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: 52, padding: "2px 4px", fontSize: 9,
                    background: "#111", border: "1px solid #333", color: "#fff",
                    borderRadius: 2, fontFamily: "monospace",
                  }}
                />
                <span style={{ fontSize: 9, color: "#555" }}>% mensual</span>
              </div>
            )}
          </>
        )}

        <div style={{ width: 1, height: 12, background: "#222" }} />

        {/* Overlays */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, color: showRofex ? "#FFA028" : "#444" }}>
          <input type="checkbox" checked={showRofex} onChange={(e) => setShowRofex(e.target.checked)}
            style={{ accentColor: "#FFA028", width: 11, height: 11 }} />
          ROFEX
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, color: showLecap ? "#A78BFA" : "#444" }}>
          <input type="checkbox" checked={showLecap} onChange={(e) => setShowLecap(e.target.checked)}
            style={{ accentColor: "#A78BFA", width: 11, height: 11 }} />
          LECAP breakevens
        </label>

        {showForecast && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, fontSize: 9, color: "#444", alignItems: "center" }}>
            <span style={{ color: "#4AF6C3" }}>— Bull (+100bps)</span>
            <span style={{ color: "#A78BFA" }}>— Neutral</span>
            <span style={{ color: "#FF433D" }}>— Bear (−100bps)</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ padding: "8px 4px 4px 0", background: "#040404" }}>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#111" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDateShort}
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={{ stroke: "#222" }} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={{ stroke: "#222" }} tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
              width={46}
            />
            <Tooltip content={<ChartTooltip />} />

            {/* Área de referencia: separación entre histórico y forecast */}
            <ReferenceArea x1={todayStr} fill="#4FC3F722" fillOpacity={0.04} />

            {/* TC histórico */}
            {TC_LINES.filter((l) => visibles.has(l.key)).map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color} dot={false} strokeWidth={1.5} connectNulls />
            ))}

            {/* Bandas cambiarias (inferior y superior) */}
            {showBandas && (
              <>
                <Line dataKey="bandaInf" name="Banda inf." stroke="#FFA028" dot={false}
                  strokeWidth={1.5} connectNulls strokeDasharray="none" />
                <Line dataKey="bandaSup" name="Banda sup." stroke="#FF433D" dot={false}
                  strokeWidth={1.5} connectNulls strokeDasharray="none" />
              </>
            )}

            {/* Forecast scenarios (líneas punteadas) */}
            {showForecast && (
              <>
                {/* Neutral / REM Top10 / Manual */}
                <Line dataKey={fcastKeys.inf} name={`Fcst ${forecastMode} inf`}
                  stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="5 3" connectNulls />
                <Line dataKey={fcastKeys.sup} name={`Fcst ${forecastMode} sup`}
                  stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="5 3" connectNulls />

                {/* Bull (+100bps) */}
                <Line dataKey="fcastBullInf" name="Bull inf" stroke="#4AF6C3"
                  dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
                <Line dataKey="fcastBullSup" name="Bull sup" stroke="#4AF6C3"
                  dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />

                {/* Bear (−100bps) */}
                <Line dataKey="fcastBearInf" name="Bear inf" stroke="#FF433D"
                  dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
                <Line dataKey="fcastBearSup" name="Bear sup" stroke="#FF433D"
                  dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
              </>
            )}

            {/* Overlay: ROFEX dots — Line con strokeWidth=0, solo puntos */}
            {showRofex && (
              <Line dataKey="rofexDot" name="ROFEX" stroke="#FFA028" strokeWidth={0}
                dot={{ fill: "#FFA028", r: 5, stroke: "#000", strokeWidth: 1 }}
                activeDot={{ r: 6 }} connectNulls={false} />
            )}

            {/* Overlay: LECAP breakeven dots */}
            {showLecap && (
              <Line dataKey="lecapDot" name="LECAP breakeven" stroke="#A78BFA" strokeWidth={0}
                dot={{ fill: "#A78BFA", r: 5, stroke: "#000", strokeWidth: 1 }}
                activeDot={{ r: 6 }} connectNulls={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: "4px 10px", fontSize: 8, color: "#2a2a2a", borderTop: "1px solid #111" }}>
        Bandas Fase 3: vigentes desde 14/04/2025 · Inf $1.000 / Sup $1.400 · actualización mensual por IPC[t-2]
        · Forecast: {forecastMode === "manual" ? `manual ${manualRate}%/mes` : forecastMode === "rem_top10" ? "REM Top 10 analistas" : "REM mediana"} · Bull +100bps / Bear −100bps
      </div>
    </div>
  )
}

// ─── Precios Section ──────────────────────────────────────────────────────────

function PreciosSection({
  dolares, internacional, rofex, lecaps,
}: {
  dolares: DolarResponse | null
  internacional: InternacionalData | null
  rofex: RofexFuture[]
  lecaps: CapInstrument[]
}) {
  const r = dolares?.rates
  const s = dolares?.spreads

  const oficial = r?.oficial?.venta ?? null
  const cclVenta = r?.contadoconliqui?.venta ?? null
  const mepVenta = r?.bolsa?.venta ?? null

  const canje    = mepVenta != null ? parseFloat((mepVenta * 0.998).toFixed(2)) : null
  const tarjeta  = oficial   != null ? parseFloat((oficial * 1.60).toFixed(2)) : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>

      {/* Cards TC locales */}
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
        Tipos de cambio locales — ARS/USD
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <RateCard label="Blue" venta={r?.blue?.venta} compra={r?.blue?.compra}
          variacion={r?.blue?.variacion} brecha={s?.brechaBlueOficial} color="#4AF6C3" />
        <RateCard label="CCL" venta={cclVenta} compra={r?.contadoconliqui?.compra}
          variacion={r?.contadoconliqui?.variacion} brecha={s?.brechaCclOficial} color="#FFA028" />
        <RateCard label="MEP / Bolsa" venta={mepVenta} compra={r?.bolsa?.compra}
          variacion={r?.bolsa?.variacion} brecha={s?.brechaMepOficial} color="#FFD700" />
        <RateCard label="Oficial BNA" venta={oficial}
          variacion={r?.oficial?.variacion} color="#aaaaaa" />
        <RateCard label="Mayorista A3500" venta={r?.mayorista?.venta} color="#777777" />
        <RateCard label="Crypto USDT" venta={r?.cripto?.venta} compra={r?.cripto?.compra}
          variacion={r?.cripto?.variacion} color="#F97316" />
        <RateCard label="Canje" venta={canje} color="#A78BFA"
          badge="~MEP × 0.998" />
        <RateCard label="Tarjeta" venta={tarjeta} color="#FB7185"
          badge="+60%" />
      </div>

      {/* Internacional */}
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
        Mercados internacionales
      </div>
      <InternacionalBlock data={internacional} />

      {/* ROFEX */}
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
        Futuros ROFEX — Dólar implícito
      </div>
      <RofexTable futures={rofex} />

      {/* LECAPs */}
      <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
        Breakevens LECAPs — TC implícito vs CCL
      </div>
      <LecapTable instruments={lecaps} />

      <div style={{ padding: "4px 8px", fontSize: 8, color: "#2a2a2a", borderTop: "1px solid #111" }}>
        Fuentes: DolarAPI (TC locales) · Yahoo Finance (internacional) · ROFEX · ByMA (LECAPs)
        · Tarjeta = Oficial × 1.60 (PAIS 30% + IVA 30%) · Canje ≈ MEP × 0.998
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabTiposCambio() {
  const [activeTab, setActiveTab] = useState<"precios" | "graficos">("precios")
  const [period, setPeriod] = useState<Period>("1y")

  const [dolares,       setDolares]       = useState<DolarResponse | null>(null)
  const [internacional, setInternacional] = useState<InternacionalData | null>(null)
  const [rofexData,     setRofexData]     = useState<RofexFuture[]>([])
  const [lecapData,     setLecapData]     = useState<CapInstrument[]>([])
  const [tcData,        setTcData]        = useState<TCEntry[]>([])
  const [bandasData,    setBandasData]    = useState<BandasData | null>(null)

  const [loadingPrecios,  setLoadingPrecios]  = useState(true)
  const [loadingGraficos, setLoadingGraficos] = useState(false)
  const [errorPrecios,    setErrorPrecios]    = useState<string | null>(null)
  const [errorGraficos,   setErrorGraficos]   = useState<string | null>(null)

  // Fetch precios + bandas al montar
  useEffect(() => {
    setLoadingPrecios(true)
    setErrorPrecios(null)
    Promise.all([
      fetch("/api/dolares").then((r) => r.json()),
      fetch("/api/internacional").then((r) => r.json()),
      fetch("/api/rofex").then((r) => r.json()),
      fetch("/api/bonos?tipo=lecap").then((r) => r.json()),
      fetch("/api/bandas-cambiarias").then((r) => r.json()),
    ])
      .then(([dol, intl, rof, lec, bandas]) => {
        setDolares(dol)
        setInternacional(intl.data ?? null)
        setRofexData(Array.isArray(rof) ? rof : [])
        setLecapData(lec.data ?? [])
        setBandasData(bandas.ipcHistorico ? bandas : null)
        setLoadingPrecios(false)
      })
      .catch((e) => { setErrorPrecios(String(e)); setLoadingPrecios(false) })
  }, [])

  // Fetch tc-historico cuando cambia período o se activa el tab gráficos
  const fetchGraficos = useCallback(() => {
    setLoadingGraficos(true)
    setErrorGraficos(null)
    fetch(`/api/tc-historico?period=${period}`)
      .then((r) => r.json())
      .then((j) => { setTcData(j.data ?? []); setLoadingGraficos(false) })
      .catch((e) => { setErrorGraficos(String(e)); setLoadingGraficos(false) })
  }, [period])

  useEffect(() => {
    if (activeTab === "graficos") fetchGraficos()
  }, [activeTab, fetchGraficos])

  return (
    <div>
      {/* Header con sub-tabs */}
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>TIPOS DE CAMBIO</span>
        <div style={{ display: "flex", gap: 2 }}>
          {(["precios", "graficos"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              fontSize: 9, padding: "2px 10px",
              background: activeTab === t ? "#FFA028" : "transparent",
              color: activeTab === t ? "#000" : "#666",
              border: `1px solid ${activeTab === t ? "#FFA028" : "#333"}`,
              cursor: "pointer", borderRadius: 2, textTransform: "uppercase", letterSpacing: 1,
            }}>
              {t === "precios" ? "Precios" : "Gráficos"}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab: Precios */}
      {activeTab === "precios" && (
        <>
          {loadingPrecios && (
            <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>
              Cargando datos de tipos de cambio...
            </div>
          )}
          {errorPrecios && (
            <div style={{ padding: 16, color: "#FF433D", fontSize: 11 }}>Error: {errorPrecios}</div>
          )}
          {!loadingPrecios && !errorPrecios && (
            <PreciosSection dolares={dolares} internacional={internacional} rofex={rofexData} lecaps={lecapData} />
          )}
        </>
      )}

      {/* Sub-tab: Gráficos */}
      {activeTab === "graficos" && (
        <>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 2, padding: "6px 8px", borderBottom: "1px solid #111" }}>
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} style={{
                fontSize: 9, padding: "2px 8px",
                background: period === p.value ? "#FFA028" : "transparent",
                color: period === p.value ? "#000" : "#666",
                border: `1px solid ${period === p.value ? "#FFA028" : "#333"}`,
                cursor: "pointer", borderRadius: 2,
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {loadingGraficos && (
            <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>
              Cargando histórico de tipos de cambio...
            </div>
          )}
          {errorGraficos && (
            <div style={{ padding: 16, color: "#FF433D", fontSize: 11 }}>Error: {errorGraficos}</div>
          )}
          {!loadingGraficos && (
            <GraficosSection tcData={tcData} rofexData={rofexData} lecapData={lecapData} bandasData={bandasData} />
          )}
        </>
      )}
    </div>
  )
}
