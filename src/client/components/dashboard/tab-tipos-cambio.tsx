"use client"

/**
 * TabTiposCambio — rama Pista
 * Layout: Precios arriba → Gráficos abajo (single page)
 *
 * Bandas cambiarias — 3 fases:
 *   Fase 1: crawl 2% mensual  (14/02/2024 – 31/01/2025)
 *   Fase 2: crawl 1% mensual  (01/02/2025 – 13/04/2025)
 *   Fase 3: ajuste por IPC[t-2] desde 14/04/2025 (inf $1.000, sup $1.400)
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { InfoTooltip } from "@/client/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DolarRate {
  compra: number; venta: number; nombre: string
  actualizacion: string; variacion: number | null
}
interface DolarResponse {
  rates: Record<string, DolarRate>
  spreads: {
    brechaBlueOficial: number | null; brechaMepOficial: number | null
    brechaCclOficial: number | null;  brechaCclMep: number | null
  }
}
interface InternacionalData {
  dxy: number | null; eurUsd: number | null; jpyUsd: number | null; brlUsd: number | null
  dxyChg: number | null; eurChg: number | null; jpyChg: number | null; brlChg: number | null
}
interface RofexFuture {
  id: string; position: string; maturity: string; maturityLabel: string | null
  price: number | null; devaluation: number | null; monthlyDevaluation: number | null; tna: number | null
}
interface CapInstrument {
  ticker: string; tipo: string; vencimiento: string; diasVencimiento: number
  precio: number | null; tem: number | null; tir: number | null; tea: number | null; tcImplicito: number | null
}
interface TCEntry {
  date: string; blue?: number; mep?: number; ccl?: number; oficial?: number; mayorista?: number
}
interface BandasData {
  ipcHistorico: Record<string, number>; remMediana: number[]; remTop10: number[]
  bandaInicial: { date: string; inferior: number; superior: number }
  fuentes: Record<string, string>
}

type Period = "1m" | "3m" | "6m" | "1y" | "2y" | "max"
type ForecastMode = "neutral" | "rem_top10" | "manual"

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const IPC_FB: Record<string, number> = { "2025-01": 2.4, "2025-02": 2.4, "2025-03": 3.7 }
const BANDA_FB = { date: "2025-04-14", inferior: 1000, superior: 1400 }
const REM_MED_FB = [2.4, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 2.0, 1.9, 1.9, 1.8]
const REM_T10_FB = [2.1, 2.1, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.5, 1.4]

// ─── Fases de crawling peg ────────────────────────────────────────────────────
// Fase 1: 2% mensual, 14-feb-2024 → 31-ene-2025
// startRate ~ 833 ARS/USD (tasa mayorista post-devaluación dic 2023)
const FASE1_CFG = { startDate: "2024-02-14", startRate: 833, monthlyPct: 2, endDate: "2025-01-31" } as const
// Fase 2: 1% mensual, 01-feb-2025 → 13-abr-2025
// startRate ~ fin Fase 1: 833 × 1.02^12 ≈ 1056
const FASE2_CFG = { startDate: "2025-02-01", startRate: 1056, monthlyPct: 1, endDate: "2025-04-13" } as const

// ─── Períodos y series ────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "1m", label: "1M" }, { value: "3m", label: "3M" }, { value: "6m", label: "6M" },
  { value: "1y", label: "1A" }, { value: "2y", label: "2A" }, { value: "max", label: "MAX" },
]

const TC_LINES: { key: string; name: string; color: string }[] = [
  { key: "blue",      name: "Blue",      color: "var(--positive)" },
  { key: "ccl",       name: "CCL",       color: "var(--amber)" },
  { key: "mep",       name: "MEP",       color: "#FFD700" },
  { key: "oficial",   name: "Oficial",   color: "#aaaaaa" },
  { key: "mayorista", name: "Mayorista", color: "#666666" },
  { key: "tarjeta",   name: "Tarjeta",   color: "#FB7185" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtARS = (v: number | null | undefined, dec = 0) =>
  v == null ? "—" : "$" + v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })

const fmtPct = (v: number | null | undefined, dec = 1) =>
  v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(dec) + "%"

const fmtDateShort = (d: string) => {
  try { return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { month: "short", year: "2-digit" }) }
  catch { return d }
}

const fmtDateFull = (d: string) => {
  try { return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) }
  catch { return d }
}

const varColor = (v: number | null | undefined) =>
  v == null ? "var(--text-dim)" : v > 0 ? "var(--positive)" : v < 0 ? "var(--negative)" : "var(--text-dim)"

// ─── Crawling peg (fases 1 y 2) ──────────────────────────────────────────────

function computeCrawlPhase(
  cfg: { startDate: string; startRate: number; monthlyPct: number; endDate: string }
): { date: string; rate: number }[] {
  const pts: { date: string; rate: number }[] = []
  const [y0, m0] = cfg.startDate.split("-").map(Number)
  const endMs = new Date(cfg.endDate + "T23:59:59").getTime()

  pts.push({ date: cfg.startDate, rate: cfg.startRate })

  let rate = cfg.startRate
  for (let month = 1; month <= 30; month++) {
    const totalM = (m0 - 1) + month
    const yr = y0 + Math.floor(totalM / 12)
    const mo = (totalM % 12) + 1
    rate = +(rate * (1 + cfg.monthlyPct / 100)).toFixed(2)
    const lastDay = new Date(yr, mo, 0).getDate()
    const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`
    const dateMs = new Date(dateStr + "T00:00:00").getTime()

    if (dateMs <= endMs) {
      pts.push({ date: dateStr, rate })
    } else {
      // añadir punto en fecha de fin de fase
      pts.push({ date: cfg.endDate, rate })
      break
    }
  }

  return pts
}

// ─── Banda fase 3 ─────────────────────────────────────────────────────────────

function getIPC(monthStr: string, ipc: Record<string, number>, rem: number[]): number {
  if (ipc[monthStr] != null) return ipc[monthStr]
  const [y, m] = monthStr.split("-").map(Number)
  const offset = (y - 2025) * 12 + (m - 2)
  if (offset >= 0 && offset < rem.length) return rem[offset]
  return rem[rem.length - 1]
}

interface BandPoint { date: string; bandaInf: number; bandaSup: number }

function computeBandPoints(
  monthsAhead: number, rem: number[],
  ipc: Record<string, number>,
  banda: { date: string; inferior: number; superior: number }
): BandPoint[] {
  const pts: BandPoint[] = [{ date: banda.date, bandaInf: banda.inferior, bandaSup: banda.superior }]
  let inf = banda.inferior, sup = banda.superior
  for (let i = 0; i < monthsAhead; i++) {
    // mes t = Abril + i (Fase 3 arranca en abril 2025 = índice 0)
    const totalM = 3 + i // 3 = índice de Abril (0-indexed desde Enero=0)
    const yr = 2025 + Math.floor(totalM / 12)
    const mo = (totalM % 12) + 1
    // IPC[t-2]: dos meses antes del mes t
    const ipcMoRaw = mo - 2
    const ipcMo = ipcMoRaw <= 0 ? ipcMoRaw + 12 : ipcMoRaw
    const ipcYr  = ipcMoRaw <= 0 ? yr - 1 : yr
    const ipcStr = `${ipcYr}-${String(ipcMo).padStart(2, "0")}`
    const rate = getIPC(ipcStr, ipc, rem)
    inf = +(inf * (1 + rate / 100)).toFixed(2)
    sup = +(sup * (1 + rate / 100)).toFixed(2)
    const lastDay = new Date(yr, mo, 0).getDate()
    pts.push({ date: `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`, bandaInf: inf, bandaSup: sup })
  }
  return pts
}

// ─── Forecast fase 3 ─────────────────────────────────────────────────────────

interface FcastPoint {
  date: string
  fNeutralInf: number; fNeutralSup: number
  fBullInf: number;    fBullSup: number
  fBearInf: number;    fBearSup: number
  fTop10Inf: number;   fTop10Sup: number
  fManualInf: number;  fManualSup: number
}

function computeForecast(
  monthsAhead: number, manualRate: number,
  remMed: number[], remTop10: number[],
  ipc: Record<string, number>,
  banda: { date: string; inferior: number; superior: number }
): FcastPoint[] {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const elapsed = Math.max(0, (today.getFullYear() - 2025) * 12 + (today.getMonth() - 3))
  const hist = computeBandPoints(elapsed + 1, remMed, ipc, banda)
  const last = hist[hist.length - 1]

  const SCENARIOS = [
    { k: "neutral", rem: remMed },
    { k: "bull",    rem: remMed.map(v => v + 1) },
    { k: "bear",    rem: remMed.map(v => Math.max(0, v - 1)) },
    { k: "top10",   rem: remTop10 },
    { k: "manual",  rem: Array(36).fill(manualRate) },
  ] as const

  type SK = typeof SCENARIOS[number]["k"]
  const inf: Record<SK, number> = { neutral: last.bandaInf, bull: last.bandaInf, bear: last.bandaInf, top10: last.bandaInf, manual: last.bandaInf }
  const sup: Record<SK, number> = { neutral: last.bandaSup, bull: last.bandaSup, bear: last.bandaSup, top10: last.bandaSup, manual: last.bandaSup }

  const pts: FcastPoint[] = [{
    date: todayStr,
    fNeutralInf: inf.neutral, fNeutralSup: sup.neutral,
    fBullInf: inf.bull, fBullSup: sup.bull,
    fBearInf: inf.bear, fBearSup: sup.bear,
    fTop10Inf: inf.top10, fTop10Sup: sup.top10,
    fManualInf: inf.manual, fManualSup: sup.manual,
  }]

  for (let i = 0; i < monthsAhead; i++) {
    const fd = new Date(today); fd.setMonth(today.getMonth() + i + 1, 1)
    const yr = fd.getFullYear(), mo = fd.getMonth() + 1
    const ipcMoRaw = mo - 2
    const ipcMo = ipcMoRaw <= 0 ? ipcMoRaw + 12 : ipcMoRaw
    const ipcYr  = ipcMoRaw <= 0 ? yr - 1 : yr
    const ipcStr = `${ipcYr}-${String(ipcMo).padStart(2, "0")}`
    const lastDay = new Date(yr, mo, 0).getDate()
    const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`

    for (const sc of SCENARIOS) {
      const rate = ipc[ipcStr] ?? (sc.rem[i] ?? sc.rem[sc.rem.length - 1])
      inf[sc.k as SK] = +(inf[sc.k as SK] * (1 + rate / 100)).toFixed(2)
      sup[sc.k as SK] = +(sup[sc.k as SK] * (1 + rate / 100)).toFixed(2)
    }

    pts.push({
      date: dateStr,
      fNeutralInf: inf.neutral, fNeutralSup: sup.neutral,
      fBullInf: inf.bull, fBullSup: sup.bull,
      fBearInf: inf.bear, fBearSup: sup.bear,
      fTop10Inf: inf.top10, fTop10Sup: sup.top10,
      fManualInf: inf.manual, fManualSup: sup.manual,
    })
  }
  return pts
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-elev-2)", borderBottom: "1px solid var(--border)", borderTop: "1px solid var(--border)",
      padding: "3px 12px", fontSize: 9, color: "var(--text-dim)",
      textTransform: "uppercase", letterSpacing: "0.12em",
    }}>
      {children}
    </div>
  )
}

// ─── Tabla tipos de cambio locales ────────────────────────────────────────────

function TCRatesTable({ dolares }: { dolares: DolarResponse | null }) {
  const r = dolares?.rates
  const s = dolares?.spreads
  const oficial  = r?.oficial?.venta ?? null
  const mepVenta = r?.bolsa?.venta   ?? null
  const canje    = mepVenta ? +(mepVenta * 0.998).toFixed(2) : null
  const tarjeta  = oficial  ? +(oficial  * 1.60 ).toFixed(2) : null

  const rows: {
    key: string; label: string; color: string; badge?: string
    venta: number | null; compra: number | null
    variacion: number | null; brecha: number | null
  }[] = [
    { key: "blue",      label: "Blue",          color: "var(--positive)", venta: r?.blue?.venta ?? null,              compra: r?.blue?.compra ?? null,              variacion: r?.blue?.variacion           ?? null, brecha: s?.brechaBlueOficial ?? null },
    { key: "ccl",       label: "CCL",           color: "var(--amber)", venta: r?.contadoconliqui?.venta ?? null,   compra: r?.contadoconliqui?.compra ?? null,   variacion: r?.contadoconliqui?.variacion ?? null, brecha: s?.brechaCclOficial  ?? null },
    { key: "mep",       label: "MEP / Bolsa",   color: "#FFD700", venta: mepVenta,                            compra: r?.bolsa?.compra ?? null,              variacion: r?.bolsa?.variacion          ?? null, brecha: s?.brechaMepOficial  ?? null },
    { key: "oficial",   label: "Oficial BNA",   color: "#aaaaaa", venta: oficial,                             compra: r?.oficial?.compra ?? null,            variacion: r?.oficial?.variacion        ?? null, brecha: null },
    { key: "mayorista", label: "Mayorista",     color: "#777777", venta: r?.mayorista?.venta ?? null,         compra: null,                                  variacion: null,                                  brecha: null },
    { key: "cripto",    label: "Crypto USDT",   color: "#F97316", venta: r?.cripto?.venta ?? null,            compra: r?.cripto?.compra ?? null,             variacion: r?.cripto?.variacion         ?? null, brecha: null },
    { key: "canje",     label: "Canje",         color: "#A78BFA", badge: "≈MEP×0.998", venta: canje,         compra: null,                                  variacion: null,                                  brecha: null },
    { key: "tarjeta",   label: "Tarjeta",       color: "#FB7185", badge: "+60%",       venta: tarjeta,        compra: null,                                  variacion: null,                                  brecha: null },
  ]

  return (
    <table>
      <thead>
        <tr>
          <th>Mercado</th>
          <th className="num">Venta</th>
          <th className="num">Compra</th>
          <th className="num">1D %</th>
          <th className="num">Brecha</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.key} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
            <td style={{ color: row.color, fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                {row.label}
                {GLOSSARY[row.key.toUpperCase()] && (
                  <InfoTooltip text={GLOSSARY[row.key.toUpperCase()].text} source={GLOSSARY[row.key.toUpperCase()].source} url={GLOSSARY[row.key.toUpperCase()].url} position="bottom" />
                )}
              </span>
              {row.badge && <span style={{ fontSize: 8, color: "var(--amber)", marginLeft: 6, border: "1px solid #FFA02833", padding: "0 3px" }}>{row.badge}</span>}
            </td>
            <td className="num" style={{ color: "var(--text)", fontWeight: 600 }}>{fmtARS(row.venta)}</td>
            <td className="num" style={{ color: "var(--text-dim)" }}>{fmtARS(row.compra)}</td>
            <td className="num" style={{ color: varColor(row.variacion) }}>{fmtPct(row.variacion)}</td>
            <td className="num" style={{ color: "var(--text-dim)" }}>{row.brecha != null ? fmtPct(row.brecha) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tabla internacional ──────────────────────────────────────────────────────

function InternacionalTable({ data }: { data: InternacionalData | null }) {
  const rows = [
    { label: "DXY",     desc: "Índice dólar",   val: data?.dxy,    chg: data?.dxyChg, dec: 2 },
    { label: "EUR/USD", desc: "Euro",            val: data?.eurUsd, chg: data?.eurChg, dec: 4 },
    { label: "JPY/USD", desc: "Yen",             val: data?.jpyUsd, chg: data?.jpyChg, dec: 4 },
    { label: "USD/BRL", desc: "Real brasileño",  val: data?.brlUsd, chg: data?.brlChg, dec: 4 },
  ]
  return (
    <table>
      <thead>
        <tr>
          <th>Par</th>
          <th style={{ color: "var(--text-dim)" }}>Descripción</th>
          <th className="num">Último</th>
          <th className="num">1D %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.label} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
            <td style={{ color: "var(--sky)", fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                {row.label}
                {GLOSSARY[row.label] && (
                  <InfoTooltip text={GLOSSARY[row.label].text} source={GLOSSARY[row.label].source} url={GLOSSARY[row.label].url} position="bottom" />
                )}
              </span>
            </td>
            <td style={{ color: "var(--text-dim)" }}>{row.desc}</td>
            <td className="num" style={{ color: "var(--text)", fontWeight: 600 }}>
              {row.val != null ? row.val.toFixed(row.dec) : "—"}
            </td>
            <td className="num" style={{ color: varColor(row.chg) }}>
              {fmtPct(row.chg)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tabla ROFEX ──────────────────────────────────────────────────────────────

function RofexTable({ futures }: { futures: RofexFuture[] }) {
  if (!futures.length) return (
    <div style={{ padding: "10px 12px", fontSize: 10, color: "var(--text-dim)" }}>
      Sin datos ROFEX — los futuros se cargan vía cron o POST /api/rofex
    </div>
  )
  return (
    <table>
      <thead>
        <tr>
          <th>Posición</th>
          <th className="num">Precio</th>
          <th className="num">Dev. acum.</th>
          <th className="num">Dev. mensual</th>
          <th className="num">TNA impl.</th>
        </tr>
      </thead>
      <tbody>
        {futures.map((f, i) => (
          <tr key={f.id} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
            <td style={{ color: "var(--amber)", fontWeight: 700 }}>{f.maturityLabel ?? f.position}</td>
            <td className="num bbg-white">{fmtARS(f.price)}</td>
            <td className="num" style={{ color: varColor(f.devaluation) }}>{fmtPct(f.devaluation)}</td>
            <td className="num" style={{ color: "var(--text-dim)" }}>{fmtPct(f.monthlyDevaluation)}</td>
            <td className="num" style={{ color: "var(--sky)" }}>{f.tna != null ? f.tna.toFixed(1) + "%" : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tabla LECAPs ─────────────────────────────────────────────────────────────

function LecapTable({ instruments }: { instruments: CapInstrument[] }) {
  if (!instruments.length) return (
    <div style={{ padding: "10px 12px", fontSize: 10, color: "var(--text-dim)" }}>
      Sin datos LECAPs — ejecutar seed de instrumentos
    </div>
  )
  return (
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Tipo</th>
          <th>Vencimiento</th>
          <th className="num">Días</th>
          <th className="num">Precio</th>
          <th className="num">TEM</th>
          <th className="num">TEA</th>
          <th className="num">TC implícito</th>
        </tr>
      </thead>
      <tbody>
        {instruments.map((inst, i) => (
          <tr key={inst.ticker} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
            <td style={{ color: "#FFD700", fontWeight: 700 }}>{inst.ticker}</td>
            <td style={{ color: "var(--text-dim)" }}>{inst.tipo}</td>
            <td style={{ color: "var(--text-dim)" }}>{fmtDateFull(inst.vencimiento)}</td>
            <td className="num" style={{ color: "var(--text-dim)" }}>{inst.diasVencimiento}</td>
            <td className="num bbg-white">{inst.precio?.toFixed(2) ?? "—"}</td>
            <td className="num bbg-positive">{inst.tem != null ? inst.tem.toFixed(2) + "%" : "—"}</td>
            <td className="num" style={{ color: "var(--text-dim)" }}>{inst.tea != null ? inst.tea.toFixed(1) + "%" : "—"}</td>
            <td className="num" style={{ color: "#A78BFA", fontWeight: 600 }}>{fmtARS(inst.tcImplicito)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Tooltip del gráfico ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const entries = payload.filter((p: { value: number }) => p.value != null)
  if (!entries.length) return null
  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border-hi)", padding: "8px 12px", fontSize: 10 }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 4, fontSize: 9 }}>{fmtDateFull(label)}</div>
      {entries.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)" }}>{fmtARS(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Toggle button ─────────────────────────────────────────────────────────────

function ToggleBtn({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      fontSize: 9, padding: "2px 8px", cursor: "pointer",
      background: active ? color + "18" : "transparent",
      border: `1px solid ${active ? color : "var(--border)"}`,
      color: active ? color : "var(--text-mute)",
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {children}
    </button>
  )
}

// ─── Gráfico principal ────────────────────────────────────────────────────────

function ChartSection({
  tcData, rofexData, lecapData, bandasData,
  period, setPeriod, loading,
}: {
  tcData: TCEntry[]; rofexData: RofexFuture[]; lecapData: CapInstrument[]
  bandasData: BandasData | null; period: Period
  setPeriod: (p: Period) => void; loading: boolean
}) {
  const ipc    = bandasData?.ipcHistorico ?? IPC_FB
  const remMed = bandasData?.remMediana   ?? REM_MED_FB
  const remT10 = bandasData?.remTop10     ?? REM_T10_FB
  const banda  = bandasData?.bandaInicial ?? BANDA_FB

  const [visibles,     setVisibles]     = useState<Set<string>>(new Set(["blue", "ccl", "mep", "oficial"]))
  const [showFase1,    setShowFase1]    = useState(true)
  const [showFase2,    setShowFase2]    = useState(true)
  const [showBandas,   setShowBandas]   = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const [fcastMode,    setFcastMode]    = useState<ForecastMode>("neutral")
  const [manualRate,   setManualRate]   = useState(2.5)
  const [showRofex,    setShowRofex]    = useState(false)
  const [showLecap,    setShowLecap]    = useState(false)

  const toggleLine = (key: string) => setVisibles(prev => {
    const next = new Set(prev)
    if (next.has(key)) { if (next.size > 1) next.delete(key) } else next.add(key)
    return next
  })

  // Fases históricas (no cambian salvo por las props que no cambian)
  const fase1Pts = useMemo(() => computeCrawlPhase(FASE1_CFG), [])
  const fase2Pts = useMemo(() => computeCrawlPhase(FASE2_CFG), [])
  const bandPoints  = useMemo(() => computeBandPoints(24, remMed, ipc, banda), [remMed, ipc, banda])
  const fcastPoints = useMemo(() => computeForecast(12, manualRate, remMed, remT10, ipc, banda), [manualRate, remMed, remT10, ipc, banda])

  const chartData = useMemo(() => {
    const map: Record<string, Record<string, number | undefined>> = {}

    for (const row of tcData) {
      if (!map[row.date]) map[row.date] = {}
      if (row.blue)      map[row.date].blue      = row.blue
      if (row.mep)       map[row.date].mep        = row.mep
      if (row.ccl)       map[row.date].ccl        = row.ccl
      if (row.oficial)   map[row.date].oficial    = row.oficial
      if (row.mayorista) map[row.date].mayorista  = row.mayorista
      if (row.oficial)   map[row.date].tarjeta    = +(row.oficial * 1.60).toFixed(2)
    }

    // Fase 1: crawl 2% (línea histórica)
    for (const pt of fase1Pts) {
      if (!map[pt.date]) map[pt.date] = {}
      map[pt.date].fase1 = pt.rate
    }

    // Fase 2: crawl 1% (línea histórica)
    for (const pt of fase2Pts) {
      if (!map[pt.date]) map[pt.date] = {}
      map[pt.date].fase2 = pt.rate
    }

    // Fase 3: banda inferior/superior
    for (const bp of bandPoints) {
      if (!map[bp.date]) map[bp.date] = {}
      map[bp.date].bandaInf = bp.bandaInf
      map[bp.date].bandaSup = bp.bandaSup
    }

    // Forecast
    for (const fp of fcastPoints) {
      if (!map[fp.date]) map[fp.date] = {}
      Object.assign(map[fp.date], {
        fNeutralInf: fp.fNeutralInf, fNeutralSup: fp.fNeutralSup,
        fBullInf:    fp.fBullInf,    fBullSup:    fp.fBullSup,
        fBearInf:    fp.fBearInf,    fBearSup:    fp.fBearSup,
        fTop10Inf:   fp.fTop10Inf,   fTop10Sup:   fp.fTop10Sup,
        fManualInf:  fp.fManualInf,  fManualSup:  fp.fManualSup,
      })
    }

    // Overlay ROFEX
    for (const f of rofexData) {
      if (!f.price) continue
      const d = (f.maturity ?? "").split("T")[0]; if (!d) continue
      if (!map[d]) map[d] = {}
      map[d].rofexDot = f.price
    }

    // Overlay LECAPs
    for (const l of lecapData) {
      if (!l.tcImplicito) continue
      if (!map[l.vencimiento]) map[l.vencimiento] = {}
      map[l.vencimiento].lecapDot = l.tcImplicito
    }

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }))
  }, [tcData, fase1Pts, fase2Pts, bandPoints, fcastPoints, rofexData, lecapData])

  const fcastKeys = useMemo(() => ({
    neutral:   { inf: "fNeutralInf",  sup: "fNeutralSup" },
    rem_top10: { inf: "fTop10Inf",    sup: "fTop10Sup" },
    manual:    { inf: "fManualInf",   sup: "fManualSup" },
  }[fcastMode]), [fcastMode])

  const todayStr = new Date().toISOString().split("T")[0]

  const fuente = bandasData?.fuentes?.ipc?.includes("datos.gob.ar")
    ? "IPC: INDEC (api automática)"
    : "IPC: fallback hardcodeado"

  return (
    <div>
      {/* Controles período */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "5px 12px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 1 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{
              fontSize: 9, padding: "2px 8px", cursor: "pointer",
              background: period === p.value ? "var(--amber)" : "transparent",
              color: period === p.value ? "var(--bg)" : "var(--text-mute)",
              border: `1px solid ${period === p.value ? "var(--amber)" : "var(--border)"}`,
              fontWeight: period === p.value ? 700 : 400,
            }}>{p.label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 14, background: "var(--border)" }} />

        {TC_LINES.map(l => (
          <ToggleBtn key={l.key} active={visibles.has(l.key)} color={l.color} onClick={() => toggleLine(l.key)}>
            {l.name}
          </ToggleBtn>
        ))}
      </div>

      {/* Controles bandas */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 12px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
        {/* Fases históricas */}
        <span style={{ fontSize: 8, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Bandas:</span>
        <ToggleBtn active={showFase1} color="#818CF8" onClick={() => setShowFase1(v => !v)}>F1 2%</ToggleBtn>
        <ToggleBtn active={showFase2} color="#06B6D4" onClick={() => setShowFase2(v => !v)}>F2 1%</ToggleBtn>
        <ToggleBtn active={showBandas} color="#22C55E" onClick={() => setShowBandas(v => !v)}>F3 IPC</ToggleBtn>

        <div style={{ width: 1, height: 14, background: "var(--border)" }} />

        {/* Forecast */}
        <ToggleBtn active={showForecast} color="#A78BFA" onClick={() => setShowForecast(v => !v)}>Forecast</ToggleBtn>

        {showForecast && (
          <>
            <div style={{ display: "flex", gap: 1 }}>
              {(["neutral", "rem_top10", "manual"] as ForecastMode[]).map(m => (
                <button key={m} onClick={() => setFcastMode(m)} style={{
                  fontSize: 9, padding: "2px 7px", cursor: "pointer",
                  background: fcastMode === m ? "#A78BFA22" : "transparent",
                  border: `1px solid ${fcastMode === m ? "#A78BFA" : "var(--border)"}`,
                  color: fcastMode === m ? "#A78BFA" : "var(--text-mute)",
                }}>
                  {m === "neutral" ? "REM med." : m === "rem_top10" ? "REM top10" : "Manual"}
                </button>
              ))}
              {fcastMode === "manual" && (
                <input type="number" min={0} max={20} step={0.1} value={manualRate}
                  onChange={e => setManualRate(parseFloat(e.target.value) || 0)}
                  style={{ width: 46, padding: "2px 4px", fontSize: 9, background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", color: "var(--text)", marginLeft: 4 }}
                />
              )}
            </div>
            <div style={{ fontSize: 8, color: "var(--text-mute)", display: "flex", gap: 8 }}>
              <span style={{ color: "#4AF6C388" }}>· bull +1pp</span>
              <span style={{ color: "#A78BFA88" }}>· neutral</span>
              <span style={{ color: "#FF433D88" }}>· bear −1pp</span>
            </div>
          </>
        )}

        <div style={{ width: 1, height: 14, background: "var(--border)", marginLeft: "auto" }} />
        <ToggleBtn active={showRofex} color="var(--amber)" onClick={() => setShowRofex(v => !v)}>ROFEX</ToggleBtn>
        <ToggleBtn active={showLecap} color="#A78BFA" onClick={() => setShowLecap(v => !v)}>LECAP breaks</ToggleBtn>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 10 }}>Cargando histórico...</div>
      ) : (
        <div style={{ padding: "6px 4px 0 0" }}>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--bg-elev-2)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort}
                tick={{ fill: "var(--text-mute)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false}
                interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--text-mute)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} width={44} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine x={todayStr} stroke="var(--border-hi)" strokeDasharray="4 2" label={{ value: "hoy", fill: "var(--border-hi)", fontSize: 8, position: "top" }} />

              {/* Series TC históricas */}
              {TC_LINES.filter(l => visibles.has(l.key)).map(l => (
                <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                  stroke={l.color} dot={false} strokeWidth={1.5} connectNulls />
              ))}

              {/* Fase 1: crawl 2% — índigo, no solapa con ningún TC */}
              {showFase1 && (
                <Line dataKey="fase1" name="Crawl 2% (F1)" stroke="#818CF8"
                  dot={false} strokeWidth={1.2} connectNulls strokeDasharray="6 2" />
              )}

              {/* Fase 2: crawl 1% — cyan, distinto al amarillo de MEP */}
              {showFase2 && (
                <Line dataKey="fase2" name="Crawl 1% (F2)" stroke="#06B6D4"
                  dot={false} strokeWidth={1.2} connectNulls strokeDasharray="6 2" />
              )}

              {/* Fase 3: verde = piso / rojo = techo  (semántica soporte/resistencia) */}
              {showBandas && <>
                <Line dataKey="bandaInf" name="Piso F3" stroke="#22C55E" dot={false} strokeWidth={1.5} connectNulls />
                <Line dataKey="bandaSup" name="Techo F3" stroke="#EF4444" dot={false} strokeWidth={1.5} connectNulls />
              </>}

              {/* Forecast punteado */}
              {showForecast && <>
                <Line dataKey={fcastKeys!.inf} name="Fcst inf" stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="5 3" connectNulls />
                <Line dataKey={fcastKeys!.sup} name="Fcst sup" stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="5 3" connectNulls />
                <Line dataKey="fBullInf" name="Bull inf" stroke="var(--positive)" dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
                <Line dataKey="fBullSup" name="Bull sup" stroke="var(--positive)" dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
                <Line dataKey="fBearInf" name="Bear inf" stroke="var(--negative)" dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
                <Line dataKey="fBearSup" name="Bear sup" stroke="var(--negative)" dot={false} strokeWidth={1} strokeDasharray="3 4" connectNulls />
              </>}

              {/* Overlay puntos ROFEX */}
              {showRofex && (
                <Line dataKey="rofexDot" name="ROFEX" stroke="var(--amber)" strokeWidth={0}
                  dot={{ fill: "var(--amber)", r: 5, stroke: "var(--bg)", strokeWidth: 1 }} connectNulls={false} />
              )}

              {/* Overlay puntos LECAPs */}
              {showLecap && (
                <Line dataKey="lecapDot" name="LECAP" stroke="#A78BFA" strokeWidth={0}
                  dot={{ fill: "#A78BFA", r: 5, stroke: "var(--bg)", strokeWidth: 1 }} connectNulls={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda fases */}
      <div style={{ padding: "4px 12px", fontSize: 8, color: "var(--border)", borderTop: "1px solid var(--bg-elev-2)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ color: "#818CF855" }}>━ F1 crawl 2% (feb 2024 – ene 2025)</span>
        <span style={{ color: "#06B6D455" }}>━ F2 crawl 1% (feb – abr 2025)</span>
        <span style={{ color: "#22C55E55" }}>━ piso F3 · </span><span style={{ color: "#EF444455" }}>━ techo F3 (IPC[t-2], desde 14/abr/2025)</span>
        <span style={{ color: "#33333388" }}>· {fuente} · REM: {bandasData?.fuentes?.rem ?? "fallback"}</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabTiposCambio() {
  const [period,       setPeriod]       = useState<Period>("1y")
  const [dolares,      setDolares]      = useState<DolarResponse | null>(null)
  const [intl,         setIntl]         = useState<InternacionalData | null>(null)
  const [rofex,        setRofex]        = useState<RofexFuture[]>([])
  const [lecaps,       setLecaps]       = useState<CapInstrument[]>([])
  const [tcData,       setTcData]       = useState<TCEntry[]>([])
  const [bandasData,   setBandasData]   = useState<BandasData | null>(null)
  const [loadingTC,    setLoadingTC]    = useState(false)
  const [loadingMain,  setLoadingMain]  = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/dolares").then(r => r.json()),
      fetch("/api/internacional").then(r => r.json()),
      fetch("/api/rofex").then(r => r.json()),
      fetch("/api/bonos?tipo=lecap").then(r => r.json()),
      fetch("/api/bandas-cambiarias").then(r => r.json()),
    ]).then(([dol, i, rof, lec, bandas]) => {
      setDolares(dol)
      setIntl(i?.data ?? null)
      setRofex(Array.isArray(rof) ? rof : [])
      setLecaps(lec?.data ?? [])
      setBandasData(bandas?.ipcHistorico ? bandas : null)
      setLoadingMain(false)
    }).catch(() => setLoadingMain(false))
  }, [])

  const fetchTC = useCallback(() => {
    setLoadingTC(true)
    fetch(`/api/tc-historico?period=${period}`)
      .then(r => r.json())
      .then(j => { setTcData(j.data ?? []); setLoadingTC(false) })
      .catch(() => setLoadingTC(false))
  }, [period])

  useEffect(() => { fetchTC() }, [fetchTC])

  if (loadingMain) {
    return (
      <div className="bbg-panel">
        <div className="bbg-panel-header">TIPOS DE CAMBIO</div>
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 10 }}>Cargando datos...</div>
      </div>
    )
  }

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header">TIPOS DE CAMBIO</div>

      {/* ── Layout principal: gráfico izquierda / datos derecha ── */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%", borderBottom: "1px solid var(--border)" }}>

        {/* ── COLUMNA IZQUIERDA: Gráfico histórico + bandas ── */}
        <div style={{ borderRight: "1px solid var(--border)" }}>
          <SectionLabel>Evolución histórica · Bandas (3 fases) · Forecast</SectionLabel>
          <ChartSection
            tcData={tcData} rofexData={rofex} lecapData={lecaps}
            bandasData={bandasData} period={period} setPeriod={setPeriod} loading={loadingTC}
          />
        </div>

        {/* ── COLUMNA DERECHA: TC locales + Internacional ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionLabel>Tipos de cambio locales — ARS/USD venta</SectionLabel>
          <TCRatesTable dolares={dolares} />
          <SectionLabel>Mercados internacionales</SectionLabel>
          <InternacionalTable data={intl} />
        </div>
      </div>

      {/* ── ROFEX y LECAPs: ancho completo debajo ── */}
      <SectionLabel>Futuros ROFEX — dólar implícito</SectionLabel>
      <RofexTable futures={rofex} />

      <SectionLabel>Breakevens LECAPs — TC implícito vs CCL</SectionLabel>
      <LecapTable instruments={lecaps} />

      <div style={{ padding: "3px 12px", fontSize: 8, color: "var(--border)", borderTop: "1px solid var(--bg-elev-2)" }}>
        TC locales: DolarAPI · Histórico: ArgentinaDatos · Internacional: Yahoo Finance · ROFEX: MatbaRofex · LECAPs: ByMA
      </div>
    </div>
  )
}
