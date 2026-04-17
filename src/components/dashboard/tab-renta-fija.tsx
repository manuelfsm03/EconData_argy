"use client"

/**
 * TabRentaFija — Módulo de Renta Fija v1.0
 * Fase 1: estructura completa con datos ilustrativos
 *
 * Tabs: Soberanos ARS | Hard Dollar | Internacionales | Gráficos
 */

import { useState, useMemo } from "react"
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab = "ars" | "hd" | "intl" | "graficos"
type ARSTab  = "blcap" | "botes" | "tamar" | "cer" | "usdl" | "duales"
type HDTab   = "gd" | "al" | "bpr"
type DualToggle = "fija" | "tamar"

interface BoncapRow   { ticker: string; tipo: "LECAP"|"BONCAP"; pxDirty: number; pagoFinal: number; dias: number; vto: string; varPct: number; tna: number; tea: number; tem: number; tir: number; volVar: number }
interface BoteRow     { ticker: string; vto: string; pxDirty: number; tnaDesc: string; tea: number; tem: number; volVar: number }
interface TamarRow    { ticker: string; vto: string; pxDirty: number; paridad: number; tea: number; tem: number }
interface CERRow      { ticker: string; vto: string; pxDirty: number; tnaDesc: string; tea: number; cerInicial: number }
interface USDLRow     { ticker: string; vto: string; pxDirty: number; tna: number; tea: number; durMod: number; paridad: number }
interface DualRow     { ticker: string; dias: number; vto: string; pxDirty: number; tnaFija: number; teaFija: number; temFija: number; tnaTamar: number; teaTamar: number; temTamar: number }
interface HardDolRow  { ticker: string; vto: string; pxClean: number; pxDirty: number; varPct: number; ytm: number; durMod: number; paridad: number; volVar: number; rp: number }
interface IntlRow     { ticker: string; pais: string; flag: string; vto: string; ytm: number; ustRef: string; spreadBps: number; rating: string; pxClean: number }
interface USTRow      { plazo: string; ytm: number; dias: number }

// ─── Sample data ──────────────────────────────────────────────────────────────
// Todos los datos son ilustrativos — fecha de referencia: 11/04/2026

const BONCAP_DATA: BoncapRow[] = [
  { ticker: "S30A6", tipo: "LECAP",  pxDirty: 100.22, pagoFinal: 100.44, dias:  19, vto: "30/04/26", varPct:  0.03, tna: 23.10, tea: 25.73, tem: 1.94, tir: 23.10, volVar:  -5.2 },
  { ticker: "S30J6", tipo: "LECAP",  pxDirty: 102.48, pagoFinal: 107.38, dias:  80, vto: "30/06/26", varPct:  0.12, tna: 22.38, tea: 24.85, tem: 1.88, tir: 22.38, volVar:   8.1 },
  { ticker: "S31A6", tipo: "BONCAP", pxDirty: 105.82, pagoFinal: 115.65, dias: 142, vto: "31/08/26", varPct: -0.08, tna: 21.75, tea: 24.10, tem: 1.82, tir: 21.95, volVar:  -2.3 },
  { ticker: "S31O6", tipo: "BONCAP", pxDirty: 109.18, pagoFinal: 122.78, dias: 203, vto: "31/10/26", varPct:  0.22, tna: 21.20, tea: 23.50, tem: 1.78, tir: 21.40, volVar:  12.5 },
  { ticker: "S31D6", tipo: "BONCAP", pxDirty: 112.52, pagoFinal: 130.63, dias: 264, vto: "31/12/26", varPct:  0.05, tna: 20.60, tea: 22.85, tem: 1.73, tir: 20.80, volVar:  -1.8 },
  { ticker: "S28F7", tipo: "BONCAP", pxDirty: 115.78, pagoFinal: 138.22, dias: 324, vto: "28/02/27", varPct:  0.18, tna: 20.10, tea: 22.25, tem: 1.69, tir: 20.30, volVar:   5.4 },
  { ticker: "S30A7", tipo: "BONCAP", pxDirty: 119.22, pagoFinal: 146.12, dias: 385, vto: "30/04/27", varPct: -0.15, tna: 19.55, tea: 21.60, tem: 1.64, tir: 19.80, volVar:  -8.7 },
  { ticker: "S30J7", tipo: "BONCAP", pxDirty: 122.48, pagoFinal: 154.25, dias: 446, vto: "30/06/27", varPct:  0.08, tna: 19.05, tea: 21.00, tem: 1.60, tir: 19.25, volVar:   3.2 },
]

const BOTE_DATA: BoteRow[] = [
  { ticker: "TB26D", vto: "31/12/26", pxDirty: 1050.30, tnaDesc: "BADLAR+200",  tea: 28.50, tem: 2.14, volVar:  3.2 },
  { ticker: "TB27J", vto: "30/06/27", pxDirty: 1082.50, tnaDesc: "BADLAR+300",  tea: 29.80, tem: 2.24, volVar: -1.8 },
  { ticker: "TB28F", vto: "28/02/28", pxDirty: 1115.80, tnaDesc: "BADLAR+400",  tea: 31.20, tem: 2.35, volVar:  7.5 },
]

const TAMAR_DATA: TamarRow[] = [
  { ticker: "TZ26",  vto: "30/09/26", pxDirty: 1015.50, paridad: 89.2, tea: 24.50, tem: 1.85 },
  { ticker: "TZ27",  vto: "31/03/27", pxDirty: 1048.20, paridad: 91.5, tea: 23.80, tem: 1.80 },
  { ticker: "TZ28",  vto: "30/09/28", pxDirty: 1095.40, paridad: 94.2, tea: 22.50, tem: 1.70 },
]

const CER_DATA: CERRow[] = [
  { ticker: "DICP",  vto: "31/12/33", pxDirty: 5842.30, tnaDesc: "CER+8.5%",  tea: 28.50, cerInicial: 72850.42 },
  { ticker: "CUAP",  vto: "30/09/45", pxDirty: 3125.60, tnaDesc: "CER+5.5%",  tea: 24.20, cerInicial: 58640.80 },
  { ticker: "PARP",  vto: "31/12/38", pxDirty: 4218.70, tnaDesc: "CER+6.0%",  tea: 25.80, cerInicial: 64220.15 },
]

const USDL_DATA: USDLRow[] = [
  { ticker: "TV26",  vto: "30/04/26", pxDirty:  98.50, tna:  9.80, tea: 10.30, durMod: 0.05, paridad:  96.2 },
  { ticker: "TV27",  vto: "30/04/27", pxDirty:  97.20, tna: 11.20, tea: 11.80, durMod: 0.97, paridad:  94.5 },
  { ticker: "TZVD",  vto: "30/09/27", pxDirty:  96.80, tna: 12.50, tea: 13.20, durMod: 1.38, paridad:  93.8 },
  { ticker: "TZD28", vto: "31/03/28", pxDirty:  94.50, tna: 14.10, tea: 15.00, durMod: 1.82, paridad:  91.2 },
]

const DUAL_DATA: DualRow[] = [
  { ticker: "TDJ26", dias:  79, vto: "30/06/26", pxDirty:  98.50, tnaFija: 22.10, teaFija: 24.50, temFija: 1.85, tnaTamar: 28.50, teaTamar: 30.20, temTamar: 2.27 },
  { ticker: "TDS26", dias: 172, vto: "30/09/26", pxDirty:  97.20, tnaFija: 21.50, teaFija: 23.80, temFija: 1.80, tnaTamar: 28.20, teaTamar: 29.80, temTamar: 2.24 },
  { ticker: "TTD26", dias: 264, vto: "31/12/26", pxDirty:  96.80, tnaFija: 20.80, teaFija: 23.10, temFija: 1.75, tnaTamar: 27.80, teaTamar: 29.40, temTamar: 2.21 },
  { ticker: "TDF27", dias: 324, vto: "28/02/27", pxDirty:  96.20, tnaFija: 20.20, teaFija: 22.50, temFija: 1.70, tnaTamar: 27.50, teaTamar: 29.00, temTamar: 2.18 },
]

const GD_DATA: HardDolRow[] = [
  { ticker: "GD29",  vto: "09/01/29", pxClean: 62.40, pxDirty: 64.80, varPct:  0.85, ytm:  9.45, durMod: 2.40, paridad: 64.8,  volVar:  22.3, rp: 498 },
  { ticker: "GD30",  vto: "09/07/30", pxClean: 66.80, pxDirty: 68.90, varPct:  0.95, ytm:  9.10, durMod: 2.82, paridad: 68.9,  volVar:  18.7, rp: 463 },
  { ticker: "GD35",  vto: "09/07/35", pxClean: 63.50, pxDirty: 65.40, varPct:  1.20, ytm: 10.48, durMod: 4.85, paridad: 65.4,  volVar:  -8.5, rp: 801 },
  { ticker: "GD38",  vto: "12/01/38", pxClean: 57.80, pxDirty: 59.60, varPct:  0.75, ytm: 11.82, durMod: 5.92, paridad: 59.6,  volVar:   5.2, rp: 1035 },
  { ticker: "GD41",  vto: "09/07/41", pxClean: 58.90, pxDirty: 60.75, varPct:  1.10, ytm: 11.15, durMod: 6.80, paridad: 60.75, volVar:  12.8, rp: 968 },
  { ticker: "GD46",  vto: "09/07/46", pxClean: 54.20, pxDirty: 55.90, varPct:  0.60, ytm: 12.05, durMod: 7.95, paridad: 55.9,  volVar:  -3.4, rp: 1258 },
]

const AL_DATA: HardDolRow[] = [
  { ticker: "AL29",  vto: "09/07/29", pxClean: 60.80, pxDirty: 62.50, varPct:  0.90, ytm:  9.82, durMod: 2.68, paridad: 62.5,  volVar:   8.4, rp: 635 },
  { ticker: "AL30",  vto: "09/07/30", pxClean: 64.20, pxDirty: 66.10, varPct:  1.05, ytm:  9.72, durMod: 2.95, paridad: 66.1,  volVar:   6.2, rp: 525 },
  { ticker: "AL35",  vto: "09/07/35", pxClean: 60.80, pxDirty: 62.40, varPct:  1.35, ytm: 11.18, durMod: 5.12, paridad: 62.4,  volVar:   4.8, rp: 871 },
  { ticker: "AE38",  vto: "12/01/38", pxClean: 54.20, pxDirty: 55.80, varPct:  0.85, ytm: 12.54, durMod: 6.15, paridad: 55.8,  volVar:   1.2, rp: 1207 },
]

const BPR_DATA: HardDolRow[] = [
  { ticker: "BPR2C", vto: "31/10/26", pxClean: 98.50, pxDirty: 99.10, varPct:  0.15, ytm:  7.82, durMod: 0.52, paridad: 98.5,  volVar:   5.5, rp: 385 },
  { ticker: "BPR2D", vto: "31/01/27", pxClean: 97.80, pxDirty: 98.60, varPct:  0.10, ytm:  8.45, durMod: 0.80, paridad: 97.8,  volVar:   3.8, rp: 448 },
  { ticker: "BPR3C", vto: "31/05/28", pxClean: 95.20, pxDirty: 96.80, varPct:  0.25, ytm:  9.18, durMod: 1.48, paridad: 95.2,  volVar:   1.5, rp: 571 },
  { ticker: "BPR3D", vto: "31/05/29", pxClean: 91.50, pxDirty: 93.40, varPct:  0.30, ytm: 10.08, durMod: 1.92, paridad: 91.5,  volVar:  -2.1, rp: 661 },
  { ticker: "BPR4",  vto: "28/06/30", pxClean: 88.20, pxDirty: 90.40, varPct:  0.45, ytm: 10.85, durMod: 2.30, paridad: 88.2,  volVar:  -5.8, rp: 738 },
]

const UST_DATA: USTRow[] = [
  { plazo: "UST 3M",  ytm: 4.85, dias:   91 },
  { plazo: "UST 6M",  ytm: 4.72, dias:  182 },
  { plazo: "UST 1Y",  ytm: 4.68, dias:  365 },
  { plazo: "UST 2Y",  ytm: 4.42, dias:  730 },
  { plazo: "UST 5Y",  ytm: 4.38, dias: 1825 },
  { plazo: "UST 10Y", ytm: 4.51, dias: 3650 },
  { plazo: "UST 30Y", ytm: 4.72, dias: 10950 },
]

const INTL_DATA: IntlRow[] = [
  { ticker: "ECU 2030",  pais: "Ecuador",    flag: "🇪🇨", vto: "2030", ytm:  9.82, ustRef: "UST 5Y",  spreadBps:  544, rating: "B-",  pxClean:  60.40 },
  { ticker: "BRA 2034",  pais: "Brasil",     flag: "🇧🇷", vto: "2034", ytm:  6.82, ustRef: "UST 10Y", spreadBps:  231, rating: "BB+", pxClean:  88.20 },
  { ticker: "COL 2033",  pais: "Colombia",   flag: "🇨🇴", vto: "2033", ytm:  7.15, ustRef: "UST 10Y", spreadBps:  264, rating: "BB+", pxClean:  85.80 },
  { ticker: "TUR 2034",  pais: "Turquía",    flag: "🇹🇷", vto: "2034", ytm:  8.24, ustRef: "UST 10Y", spreadBps:  373, rating: "B+",  pxClean:  82.50 },
  { ticker: "URY 2031",  pais: "Uruguay",    flag: "🇺🇾", vto: "2031", ytm:  5.85, ustRef: "UST 5Y",  spreadBps:  147, rating: "BBB", pxClean:  95.20 },
  { ticker: "CHL 2031",  pais: "Chile",      flag: "🇨🇱", vto: "2031", ytm:  5.22, ustRef: "UST 5Y",  spreadBps:   84, rating: "A",   pxClean:  98.40 },
  { ticker: "PRY 2033",  pais: "Paraguay",   flag: "🇵🇾", vto: "2033", ytm:  6.38, ustRef: "UST 10Y", spreadBps:  187, rating: "BB",  pxClean:  86.50 },
  { ticker: "BOL 2028",  pais: "Bolivia",    flag: "🇧🇴", vto: "2028", ytm: 15.42, ustRef: "UST 2Y",  spreadBps: 1100, rating: "CCC", pxClean:  28.40 },
  { ticker: "PER 2032",  pais: "Perú",       flag: "🇵🇪", vto: "2032", ytm:  5.62, ustRef: "UST 10Y", spreadBps:  111, rating: "BBB", pxClean:  93.60 },
  { ticker: "MEX 2031",  pais: "México",     flag: "🇲🇽", vto: "2031", ytm:  6.18, ustRef: "UST 5Y",  spreadBps:  180, rating: "BB+", pxClean:  90.20 },
]

// ─── Chart curve definitions ──────────────────────────────────────────────────

const CURVE_DEFS: Record<string, { label: string; color: string }> = {
  blcap: { label: "Boncaps/Lecaps", color: "#f59e0b" },
  cer:   { label: "CER",            color: "#38bdf8" },
  gd:    { label: "Globales",       color: "#818cf8" },
  al:    { label: "Bonares",        color: "#f87171" },
  bpr:   { label: "Bopreales",      color: "#2dd4bf" },
  ust:   { label: "UST",            color: "#e2e8f0" },
}

// ─── Badge colors ─────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  LECAP:  { bg: "#1e3a5f", color: "#60a5fa" },
  BONCAP: { bg: "#1a3a2a", color: "#4ade80" },
  BOTE:   { bg: "#3a2a1a", color: "#fb923c" },
  TAMAR:  { bg: "#2a1a3a", color: "#c084fc" },
  CER:    { bg: "#1a2a3a", color: "#38bdf8" },
  USDL:   { bg: "#3a2a1a", color: "#fbbf24" },
  DUAL:   { bg: "#2a1a2a", color: "#f472b6" },
  GD:     { bg: "#1a1a3a", color: "#818cf8" },
  AL:     { bg: "#3a1a1a", color: "#f87171" },
  BPR:    { bg: "#1a3a3a", color: "#2dd4bf" },
  EM:     { bg: "#2a2a1a", color: "#d9f99d" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fp  = (v: number, d = 2) => v.toFixed(d)
const fpc = (v: number)        => (v >= 0 ? "+" : "") + v.toFixed(2) + "%"
const vc  = (v: number)        => v > 0 ? "#4AF6C3" : v < 0 ? "#FF433D" : "#888"

// Polynomial regression degree 3 (normal equations + Gaussian elimination)
function polyRegress(pts: {x: number; y: number}[], deg: number): (x: number) => number {
  const n = pts.length
  if (n < deg + 1) return () => 0
  const d = deg + 1
  const ATA = Array.from({length: d}, () => Array(d).fill(0))
  const ATy = Array(d).fill(0)
  for (const {x, y} of pts) {
    const xp = Array.from({length: d}, (_, i) => Math.pow(x, i))
    for (let i = 0; i < d; i++) {
      ATy[i] += xp[i] * y
      for (let j = 0; j < d; j++) ATA[i][j] += xp[i] * xp[j]
    }
  }
  // Gaussian elimination with partial pivot
  const M = ATA.map((row, i) => [...row, ATy[i]])
  for (let col = 0; col < d; col++) {
    let maxR = col
    for (let r = col + 1; r < d; r++) if (Math.abs(M[r][col]) > Math.abs(M[maxR][col])) maxR = r
    ;[M[col], M[maxR]] = [M[maxR], M[col]]
    for (let r = col + 1; r < d; r++) {
      if (Math.abs(M[col][col]) < 1e-12) continue
      const f = M[r][col] / M[col][col]
      for (let j = col; j <= d; j++) M[r][j] -= f * M[col][j]
    }
  }
  const beta = Array(d).fill(0)
  for (let i = d - 1; i >= 0; i--) {
    beta[i] = M[i][d]
    for (let j = i + 1; j < d; j++) beta[i] -= M[i][j] * beta[j]
    beta[i] /= M[i][i]
  }
  return (x: number) => beta.reduce((s, b, i) => s + b * Math.pow(x, i), 0)
}

// Sort hook — sin constraint Record para preservar tipos específicos
function useSortable<T>(data: T[], defaultCol: keyof T, defaultDir: "asc"|"desc" = "asc") {
  const [col, setCol] = useState<keyof T>(defaultCol)
  const [dir, setDir] = useState<"asc"|"desc">(defaultDir)

  const toggle = (c: keyof T) => {
    if (c === col) setDir(d => d === "asc" ? "desc" : "asc")
    else { setCol(c); setDir("asc") }
  }

  const sorted = useMemo(() => [...data].sort((a, b) => {
    const av = a[col] as unknown
    const bv = b[col] as unknown
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  }), [data, col, dir])

  return { sorted, col, dir, toggle }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ tipo }: { tipo: string }) {
  const s = BADGE_STYLES[tipo] ?? { bg: "#222", color: "#888" }
  return (
    <span style={{ background: s.bg, color: s.color, padding: "1px 5px", fontSize: 8, marginLeft: 5, verticalAlign: "middle", letterSpacing: "0.04em" }}>
      {tipo}
    </span>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc"|"desc" }) {
  return <span style={{ color: active ? "#FFA028" : "#333", fontSize: 8 }}>{active ? (dir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
}

function MainTabs({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  const tabs: { key: MainTab; label: string }[] = [
    { key: "ars",      label: "Soberanos ARS" },
    { key: "hd",       label: "Hard Dollar" },
    { key: "intl",     label: "Internacionales" },
    { key: "graficos", label: "Gráficos" },
  ]
  return (
    <div style={{ display: "flex", borderBottom: "2px solid #1a1a1a" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? "#111" : "transparent",
          color: active === t.key ? "#FFA028" : "#555",
          border: "none",
          borderBottom: `2px solid ${active === t.key ? "#FFA028" : "transparent"}`,
          padding: "7px 18px", fontSize: 10,
          textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
          marginBottom: -2,
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function SubTabs<T extends string>({ tabs, active, onChange }: {
  tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void
}) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", background: "#060606" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: "transparent",
          color: active === t.key ? "#fff" : "#444",
          border: "none",
          borderBottom: `1px solid ${active === t.key ? "#fff" : "transparent"}`,
          padding: "5px 14px", fontSize: 9,
          textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer",
          marginBottom: -1,
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "3px 12px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>{children}</div>
}

// ─── Th helper ────────────────────────────────────────────────────────────────

function Th({ children, num, sortKey, sortCol, sortDir, onSort }: {
  children: React.ReactNode; num?: boolean
  sortKey: string; sortCol: string; sortDir: "asc"|"desc"
  onSort: (k: string) => void
}) {
  return (
    <th className={num ? "num" : ""} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => onSort(sortKey)}>
      {children}<SortIcon active={sortCol === sortKey} dir={sortDir} />
    </th>
  )
}

// ─── Boncaps/Lecaps ───────────────────────────────────────────────────────────

function BoncapSection() {
  const { sorted, col, dir, toggle } = useSortable(BONCAP_DATA, "dias")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ padding: "4px 12px", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <span style={{ fontSize: 9, color: "#555" }}>Capitalización al vencimiento · Liquidación T+1 · Precios ilustrativos</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("pxDirty", "Px Dirty", true)}
              {th("pagoFinal", "Pago Final", true)}
              {th("dias", "Días", true)}
              {th("vto", "Vto")}
              {th("varPct", "Var %", true)}
              {th("tna", "TNA", true)}
              {th("tea", "TEA", true)}
              {th("tem", "TEM", true)}
              {th("tir", "TIR", true)}
              {th("volVar", "Vol Var%", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo={r.tipo} /></td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.pagoFinal)}</td>
                <td className="num" style={{ color: "#666" }}>{r.dias}</td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: vc(r.varPct) }}>{fpc(r.varPct)}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tna)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tea)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tem)}%</td>
                <td className="num" style={{ color: "#FFA028", fontWeight: 700 }}>{fp(r.tir)}%</td>
                <td className="num" style={{ color: vc(r.volVar) }}>{fpc(r.volVar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>Liquidación T+1 hábil · TIR = (Pago Final / Px Dirty)^(365/días) − 1 · TEA compuesta · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── Botes ────────────────────────────────────────────────────────────────────

function BoteSection() {
  const { sorted, col, dir, toggle } = useSortable(BOTE_DATA, "vto")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("pxDirty", "Px Dirty", true)}
              {th("tnaDesc", "TNA (ref.)")}
              {th("tea", "TEA", true)}
              {th("tem", "TEM", true)}
              {th("volVar", "Vol Var%", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo="BOTE" /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                <td style={{ color: "#FFA028" }}>{r.tnaDesc}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tea)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tem)}%</td>
                <td className="num" style={{ color: vc(r.volVar) }}>{fpc(r.volVar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>Tasa variable: BADLAR + spread · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── Tamar ────────────────────────────────────────────────────────────────────

function TamarSection() {
  const { sorted, col, dir, toggle } = useSortable(TAMAR_DATA, "vto")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("pxDirty", "Px Dirty", true)}
              {th("paridad", "Paridad %", true)}
              {th("tea", "TEA", true)}
              {th("tem", "TEM", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo="TAMAR" /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                <td className="num" style={{ color: r.paridad < 90 ? "#FF433D" : r.paridad < 100 ? "#FFA028" : "#4AF6C3" }}>{fp(r.paridad, 1)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tea)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tem)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>Paridad = Px Dirty / VR técnico × 100 · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── CER ─────────────────────────────────────────────────────────────────────

function CERSection() {
  const { sorted, col, dir, toggle } = useSortable(CER_DATA, "vto")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("pxDirty", "Px Dirty", true)}
              {th("tnaDesc", "Spread CER")}
              {th("tea", "TEA impl.", true)}
              {th("cerInicial", "Coef. CER", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo="CER" /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                <td style={{ color: "#38bdf8" }}>{r.tnaDesc}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tea)}%</td>
                <td className="num" style={{ color: "#555" }}>{fp(r.cerInicial)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>TEA implícita asume inflación forward de mercado · Coef. CER según BCRA · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── USD Linked ───────────────────────────────────────────────────────────────

function USDLSection() {
  const { sorted, col, dir, toggle } = useSortable(USDL_DATA, "vto")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("pxDirty", "Px Dirty", true)}
              {th("tna", "TNA", true)}
              {th("tea", "TEA", true)}
              {th("durMod", "Dur Mod", true)}
              {th("paridad", "Paridad %", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo="USDL" /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tna)}%</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.tea)}%</td>
                <td className="num" style={{ color: "#666" }}>{fp(r.durMod)}</td>
                <td className="num" style={{ color: r.paridad < 90 ? "#FF433D" : r.paridad < 100 ? "#FFA028" : "#4AF6C3" }}>{fp(r.paridad, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>Ajuste por TC oficial · Paridad = Px / VR ajustado por TC · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── Duales ───────────────────────────────────────────────────────────────────

function DualesSection() {
  const [tramo, setTramo] = useState<DualToggle>("fija")
  const { sorted, col, dir, toggle } = useSortable(DUAL_DATA, "dias")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderBottom: "1px solid #1a1a1a", background: "#060606" }}>
        <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tramo:</span>
        {(["fija", "tamar"] as DualToggle[]).map(t => (
          <button key={t} onClick={() => setTramo(t)} style={{
            fontSize: 9, padding: "2px 10px", cursor: "pointer",
            background: tramo === t ? (t === "fija" ? "#f472b6" : "#c084fc") + "22" : "transparent",
            border: `1px solid ${tramo === t ? (t === "fija" ? "#f472b6" : "#c084fc") : "#2a2a2a"}`,
            color: tramo === t ? (t === "fija" ? "#f472b6" : "#c084fc") : "#555",
          }}>
            {t === "fija" ? "Tasa Fija" : "TAMAR"}
          </button>
        ))}
        <span style={{ fontSize: 8, color: "#333", marginLeft: 8 }}>El inversor cobra siempre el tramo dominante al vencimiento</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("dias", "Días", true)}
              {th("vto", "Vto")}
              {th("pxDirty", "Px Dirty", true)}
              {th(tramo === "fija" ? "tnaFija" : "tnaTamar", "TNA", true)}
              {th(tramo === "fija" ? "teaFija" : "teaTamar", "TEA", true)}
              {th(tramo === "fija" ? "temFija" : "temTamar", "TEM", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const tna = tramo === "fija" ? r.tnaFija : r.tnaTamar
              const tea = tramo === "fija" ? r.teaFija : r.teaTamar
              const tem = tramo === "fija" ? r.temFija : r.temTamar
              return (
                <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                  <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo="DUAL" /></td>
                  <td className="num" style={{ color: "#666" }}>{r.dias}</td>
                  <td style={{ color: "#888" }}>{r.vto}</td>
                  <td className="num" style={{ color: "#fff" }}>{fp(r.pxDirty)}</td>
                  <td className="num" style={{ color: "#aaa" }}>{fp(tna)}%</td>
                  <td className="num" style={{ color: "#aaa" }}>{fp(tea)}%</td>
                  <td className="num" style={{ color: "#aaa" }}>{fp(tem)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <SectionNote>Paga al vencimiento la mejor alternativa entre Tasa Fija y TAMAR — no se suman · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── Hard Dollar tables (GD / AL / BPR same structure) ───────────────────────

function HardDolTable({ data, badge }: { data: HardDolRow[]; badge: string }) {
  const { sorted, col, dir, toggle } = useSortable(data, "ytm")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("pxClean", "Px Clean", true)}
              {th("pxDirty", "Px Dirty", true)}
              {th("varPct", "Var % 1d", true)}
              {th("ytm", "YTM", true)}
              {th("durMod", "Dur Mod", true)}
              {th("paridad", "Paridad %", true)}
              {th("volVar", "Vol Var%", true)}
              {th("rp", "RP impl. (bps)", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ fontWeight: 700 }}>{r.ticker}<Badge tipo={badge} /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxClean)}</td>
                <td className="num" style={{ color: "#aaa" }}>{fp(r.pxDirty)}</td>
                <td className="num" style={{ color: vc(r.varPct) }}>{fpc(r.varPct)}</td>
                <td className="num" style={{ color: "#FFA028", fontWeight: 700 }}>{fp(r.ytm)}%</td>
                <td className="num" style={{ color: "#666" }}>{fp(r.durMod)}</td>
                <td className="num" style={{ color: r.paridad < 60 ? "#FF433D" : r.paridad < 80 ? "#FFA028" : "#4AF6C3" }}>{fp(r.paridad, 1)}%</td>
                <td className="num" style={{ color: vc(r.volVar) }}>{fpc(r.volVar)}</td>
                <td className="num" style={{ color: "#14b8a6", fontWeight: 700 }}>{r.rp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>RP impl. = (YTM − UST ref.) × 10000 bps · Liquidación T+2 hábil USD · datos ilustrativos</SectionNote>
    </>
  )
}

// ─── Internacionales ──────────────────────────────────────────────────────────

function IntlSection() {
  const { sorted, col, dir, toggle } = useSortable(INTL_DATA, "spreadBps")
  const th = (key: string, label: string, num?: boolean) => (
    <Th num={num} sortKey={key} sortCol={col as string} sortDir={dir} onSort={toggle as (k: string) => void}>{label}</Th>
  )

  const ratingColor = (r: string) => {
    if (r.startsWith("A")) return "#4AF6C3"
    if (r.startsWith("BB")) return "#FFA028"
    if (r.startsWith("B-") || r.startsWith("B+")) return "#FB7185"
    if (r.startsWith("CCC") || r.startsWith("CC") || r.startsWith("C")) return "#FF433D"
    return "#888"
  }

  return (
    <>
      {/* UST Benchmark */}
      <div style={{ padding: "4px 12px", background: "#0a0a0a", borderBottom: "1px solid #111" }}>
        <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>Curva UST benchmark</span>
      </div>
      <div style={{ display: "flex", gap: 1, padding: 1 }}>
        {UST_DATA.map(u => (
          <div key={u.plazo} style={{ flex: "1 1 80px", background: "#040404", border: "1px solid #111", padding: "6px 10px" }}>
            <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", marginBottom: 2 }}>{u.plazo}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{fp(u.ytm)}%</div>
          </div>
        ))}
      </div>

      {/* EM / LATAM */}
      <div style={{ padding: "4px 12px", background: "#0a0a0a", borderBottom: "1px solid #111", marginTop: 1 }}>
        <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>Comparables EM · América Latina</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              {th("pais", "País")}
              {th("ticker", "Ticker")}
              {th("vto", "Vto")}
              {th("ytm", "YTM", true)}
              {th("ustRef", "UST Ref.")}
              {th("spreadBps", "Spread (bps)", true)}
              {th("rating", "Rating")}
              {th("pxClean", "Px Clean", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#000" : "#060606" }}>
                <td style={{ color: "#aaa" }}>{r.flag} {r.pais}</td>
                <td style={{ fontWeight: 700, color: "#d9f99d" }}>{r.ticker}<Badge tipo="EM" /></td>
                <td style={{ color: "#888" }}>{r.vto}</td>
                <td className="num" style={{ color: "#FFA028", fontWeight: 700 }}>{fp(r.ytm)}%</td>
                <td style={{ color: "#555" }}>{r.ustRef}</td>
                <td className="num" style={{ color: "#14b8a6", fontWeight: 700 }}>{r.spreadBps}</td>
                <td style={{ color: ratingColor(r.rating), fontWeight: 600 }}>{r.rating}</td>
                <td className="num" style={{ color: "#fff" }}>{fp(r.pxClean)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>Spread = YTM bono − YTM UST referencia × 10000 bps · datos ilustrativos · fuente: Refinitiv/Bloomberg</SectionNote>
    </>
  )
}

// ─── Gráficos — curvas de rendimiento ─────────────────────────────────────────

const CURVE_CHART_DATA: Record<string, {x: number; y: number; t: string}[]> = {
  blcap: BONCAP_DATA.map(d => ({ x: d.dias, y: d.tir, t: d.ticker })),
  gd:    GD_DATA.map(d => ({ x: Math.round((new Date(d.vto.split("/").reverse().join("-")).getTime() - Date.now()) / 86400000), y: d.ytm, t: d.ticker })),
  al:    AL_DATA.map(d => ({ x: Math.round((new Date(d.vto.split("/").reverse().join("-")).getTime() - Date.now()) / 86400000), y: d.ytm, t: d.ticker })),
  bpr:   BPR_DATA.map(d => ({ x: Math.round((new Date(d.vto.split("/").reverse().join("-")).getTime() - Date.now()) / 86400000), y: d.ytm, t: d.ticker })),
  ust:   UST_DATA.map(d => ({ x: d.dias, y: d.ytm, t: d.plazo })),
}

function GraficosSection() {
  const [activeCurves, setActiveCurves] = useState<string[]>(["gd", "al", "ust"])
  const [showNS, setShowNS] = useState(false)
  const [logScale, setLogScale] = useState(false)

  const toggleCurve = (id: string) => setActiveCurves(prev =>
    prev.includes(id) ? (prev.length > 1 ? prev.filter(c => c !== id) : prev) : [...prev, id]
  )

  // Compute NS proxy (poly deg 3) for each active curve
  const nsCurves = useMemo(() => {
    if (!showNS) return {}
    const result: Record<string, {x: number; y: number}[]> = {}
    for (const id of activeCurves) {
      const pts = CURVE_CHART_DATA[id]
      if (!pts || pts.length < 4) continue
      const fit = polyRegress(pts, 3)
      const xMin = Math.min(...pts.map(p => p.x))
      const xMax = Math.max(...pts.map(p => p.x))
      const steps = 60
      result[id] = Array.from({length: steps}, (_, i) => {
        const x = xMin + (i / (steps - 1)) * (xMax - xMin)
        return { x: Math.round(x), y: Math.max(0, parseFloat(fit(x).toFixed(4))) }
      })
    }
    return result
  }, [activeCurves, showNS])

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    if (!d) return null
    return (
      <div style={{ background: "#0a0a0a", border: "1px solid #333", padding: "6px 10px", fontSize: 10 }}>
        <div style={{ color: "#555", fontSize: 9 }}>{d.t ?? ""}</div>
        <div style={{ color: "#fff" }}>{d.x} días · {fp(d.y)}%</div>
      </div>
    )
  }

  return (
    <div style={{ padding: "0" }}>
      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "6px 12px", borderBottom: "1px solid #1a1a1a", alignItems: "center" }}>
        <span style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Curvas:</span>
        {Object.entries(CURVE_DEFS).map(([id, { label, color }]) => (
          <button key={id} onClick={() => toggleCurve(id)} style={{
            fontSize: 9, padding: "2px 8px", cursor: "pointer",
            background: activeCurves.includes(id) ? color + "20" : "transparent",
            border: `1px solid ${activeCurves.includes(id) ? color : "#2a2a2a"}`,
            color: activeCurves.includes(id) ? color : "#444",
          }}>{label}</button>
        ))}
        <div style={{ width: 1, height: 14, background: "#222", marginLeft: 4 }} />
        <button onClick={() => setShowNS(v => !v)} style={{
          fontSize: 9, padding: "2px 8px", cursor: "pointer",
          background: showNS ? "#A78BFA20" : "transparent",
          border: `1px solid ${showNS ? "#A78BFA" : "#2a2a2a"}`,
          color: showNS ? "#A78BFA" : "#444",
        }}>NS Proxy</button>
        <button onClick={() => setLogScale(v => !v)} style={{
          fontSize: 9, padding: "2px 8px", cursor: "pointer",
          background: logScale ? "#FFA02820" : "transparent",
          border: `1px solid ${logScale ? "#FFA028" : "#2a2a2a"}`,
          color: logScale ? "#FFA028" : "#444",
        }}>Log X</button>
        <span style={{ fontSize: 8, color: "#2a2a2a", marginLeft: "auto" }}>NS Proxy = regresión polinómica grado 3 (proxy Nelson-Siegel)</span>
      </div>

      {/* Chart */}
      <div style={{ padding: "8px 4px 0 0" }}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#111" strokeDasharray="3 3" />
            <XAxis
              type="number" dataKey="x"
              scale={logScale ? "log" : "linear"}
              domain={["auto", "auto"]}
              tick={{ fill: "#444", fontSize: 9 }} axisLine={{ stroke: "#222" }} tickLine={false}
              tickFormatter={(v: number) => v >= 365 ? `${(v/365).toFixed(1)}a` : `${v}d`}
              label={{ value: "Días al vencimiento (T+1)", position: "insideBottom", fill: "#333", fontSize: 8, offset: -2 }}
            />
            <YAxis
              type="number" dataKey="y"
              tick={{ fill: "#444", fontSize: 9 }} axisLine={{ stroke: "#222" }} tickLine={false}
              tickFormatter={(v: number) => `${v}%`} width={40}
              label={{ value: "Rendimiento %", angle: -90, position: "insideLeft", fill: "#333", fontSize: 8 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 9, color: "#555", paddingTop: 8 }}
              formatter={(value: string) => <span style={{ color: "#555" }}>{value}</span>}
            />

            {activeCurves.map(id => {
              const pts = CURVE_CHART_DATA[id]
              const { color, label } = CURVE_DEFS[id]
              return pts ? (
                <Scatter
                  key={id} name={label} data={pts}
                  fill={color} r={5}
                  line={false}
                />
              ) : null
            })}

            {showNS && activeCurves.map(id => {
              const pts = nsCurves[id]
              const { color } = CURVE_DEFS[id]
              return pts ? (
                <Line
                  key={`ns_${id}`} name={`${CURVE_DEFS[id].label} (NS)`}
                  data={pts} dataKey="y" dot={false}
                  stroke={color} strokeWidth={1.5} strokeDasharray="4 2"
                  type="monotone" connectNulls
                />
              ) : null
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <SectionNote>
        X: días al vencimiento desde T+1 de liquidación · Y: rendimiento (TIR/YTM) % ·
        NS Proxy = regresión polinómica grado 3 · Fase 3: implementar modelo NSS completo (6 parámetros) ·
        datos ilustrativos — conectar feed BYMA/Primary para datos reales
      </SectionNote>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TabRentaFija() {
  const [mainTab, setMainTab] = useState<MainTab>("ars")
  const [arsTab,  setArsTab]  = useState<ARSTab>("blcap")
  const [hdTab,   setHdTab]   = useState<HDTab>("gd")

  const arsTabs: { key: ARSTab; label: string }[] = [
    { key: "blcap",  label: "Boncaps / Lecaps" },
    { key: "botes",  label: "Botes" },
    { key: "tamar",  label: "Tamar" },
    { key: "cer",    label: "CER" },
    { key: "usdl",   label: "USD Linked" },
    { key: "duales", label: "Duales" },
  ]

  const hdTabs: { key: HDTab; label: string }[] = [
    { key: "gd",  label: "Globales (GD)" },
    { key: "al",  label: "Bonares (AL)" },
    { key: "bpr", label: "Bopreales (BPR)" },
  ]

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header">
        RENTA FIJA
        <span style={{ marginLeft: 12, fontSize: 9, color: "#555", fontWeight: 400 }}>
          datos ilustrativos — fase 1 · integración feed BYMA pendiente
        </span>
      </div>

      <MainTabs active={mainTab} onChange={setMainTab} />

      {/* ── SOBERANOS ARS ── */}
      {mainTab === "ars" && (
        <>
          <SubTabs tabs={arsTabs} active={arsTab} onChange={setArsTab} />
          {arsTab === "blcap"  && <BoncapSection />}
          {arsTab === "botes"  && <BoteSection />}
          {arsTab === "tamar"  && <TamarSection />}
          {arsTab === "cer"    && <CERSection />}
          {arsTab === "usdl"   && <USDLSection />}
          {arsTab === "duales" && <DualesSection />}
        </>
      )}

      {/* ── HARD DOLLAR ── */}
      {mainTab === "hd" && (
        <>
          <SubTabs tabs={hdTabs} active={hdTab} onChange={setHdTab} />
          {hdTab === "gd"  && <HardDolTable data={GD_DATA}  badge="GD" />}
          {hdTab === "al"  && <HardDolTable data={AL_DATA}  badge="AL" />}
          {hdTab === "bpr" && <HardDolTable data={BPR_DATA} badge="BPR" />}
        </>
      )}

      {/* ── INTERNACIONALES ── */}
      {mainTab === "intl" && <IntlSection />}

      {/* ── GRÁFICOS ── */}
      {mainTab === "graficos" && <GraficosSection />}
    </div>
  )
}
