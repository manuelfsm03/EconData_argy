/**
 * FiscalSankeyView — 4 vistas del flujo fiscal
 * Todos los tabs usan el mismo engine stroke-based (estilo Bloomberg / d3-sankey)
 */

"use client"

import { useState, useEffect, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Serie = [string, number][]
type FiscalData = Record<string, Serie>

interface RawNode { name: string; column: 0 | 1 | 2; color: string }
interface RawLink { source: number; target: number; value: number }
interface LayoutNode extends RawNode {
  _i: number; _col: number
  x0: number; x1: number; y0: number; y1: number; value: number
  sourceLinks: LayoutLink[]; targetLinks: LayoutLink[]
}
interface LayoutLink {
  source: LayoutNode; target: LayoutNode
  value: number; width: number; y0: number; y1: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  const a = Math.abs(v), s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}Bn`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}Mm`
  return `${s}$${Math.round(a)}M`
}
const fmtFull = (v: number) => `$${Math.abs(v).toLocaleString("es-AR")} M`
function fmtMM(v: number): string {
  const a = Math.abs(v), s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}B`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}MM`
  return `${s}$${Math.round(a)}`
}
const varColor = (v: number | null | undefined) => v == null ? "#555" : v >= 0 ? "#4AF6C3" : "#FF433D"
const varSign  = (v: number | null | undefined) => v == null ? "" : v >= 0 ? "+" : ""
function fmtNum(v: number | null | undefined, dec = 1) {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Color schemes ─────────────────────────────────────────────────────────────

const INCOME_COLORS: Record<string, string> = {
  "IVA":           "#4AF6C3", "Ganancias":     "#36D6B0",
  "Seg. Social":   "#2BB89E", "Déb./Créd.":    "#FFA028",
  "Comercio Ext.": "#FF8C42", "Otros Imp.":    "#6C9BFF", "Otros": "#6C9BFF",
}
const EXPENSE_COLORS: Record<string, string> = {
  "Jubilaciones y Pensiones":  "#FF6B6B", "Transferencias Provincias": "#FF433D",
  "Salarios Públicos":         "#E8425A", "Subsidios Energía":         "#FF8888",
  "Educación y Cultura":       "#C77DFF", "Salud":                     "#A855F7",
  "Defensa y Seguridad":       "#7C6EAB", "Obra Pública":              "#FF6B9D",
  "Intereses Deuda":           "#B91C1C", "Otros Gastos":              "#666",
}

// ── Stroke-based Sankey engine ────────────────────────────────────────────────

function strokeSankeyLayout({
  nodes, links, width, height, nodePadding = 8, nodeWidth = 14,
}: {
  nodes: RawNode[]; links: RawLink[]
  width: number; height: number; nodePadding?: number; nodeWidth?: number
}): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const n: LayoutNode[] = nodes.map((nd, i) => ({
    ...nd, _i: i, _col: nd.column,
    x0: 0, x1: 0, y0: 0, y1: 0, value: 0, sourceLinks: [], targetLinks: [],
  }))
  const l: LayoutLink[] = links.map(lk => ({
    source: n[lk.source], target: n[lk.target], value: lk.value, width: 0, y0: 0, y1: 0,
  }))
  n.forEach(nd => { nd.sourceLinks = []; nd.targetLinks = [] })
  l.forEach(lk => { lk.source.sourceLinks.push(lk); lk.target.targetLinks.push(lk) })
  n.forEach(nd => {
    nd.value = Math.max(
      nd.sourceLinks.reduce((s, lk) => s + lk.value, 0),
      nd.targetLinks.reduce((s, lk) => s + lk.value, 0),
    )
  })
  const colKeys = [...new Set(n.map(nd => nd._col))].sort((a, b) => a - b)
  const numCols = colKeys.length
  const cols: Record<number, LayoutNode[]> = {}
  colKeys.forEach(c => { cols[c] = n.filter(nd => nd._col === c) })
  colKeys.forEach((col, ci) => {
    const x0 = ci * ((width - nodeWidth) / Math.max(numCols - 1, 1))
    cols[col].forEach(nd => { nd.x0 = x0; nd.x1 = x0 + nodeWidth })
  })
  const maxColVal = Math.max(...colKeys.map(c => cols[c].reduce((s, nd) => s + nd.value, 0)))
  const maxNodes  = Math.max(...colKeys.map(c => cols[c].length))
  const scale = (height - (maxNodes - 1) * nodePadding) / maxColVal
  colKeys.forEach(col => {
    const sorted = cols[col].slice().sort((a, b) => b.value - a.value)
    let y = 0
    sorted.forEach(nd => { nd.y0 = y; nd.y1 = y + nd.value * scale; y = nd.y1 + nodePadding })
    const offset = (height - (y - nodePadding)) / 2
    if (offset > 0) sorted.forEach(nd => { nd.y0 += offset; nd.y1 += offset })
  })
  colKeys.forEach(col => {
    cols[col].forEach(nd => {
      let sy = nd.y0
      nd.sourceLinks.slice().sort((a, b) => a.target.y0 - b.target.y0).forEach(lk => {
        lk.width = lk.value * scale; lk.y0 = sy + lk.width / 2; sy += lk.width
      })
      let ty = nd.y0
      nd.targetLinks.slice().sort((a, b) => a.source.y0 - b.source.y0).forEach(lk => {
        lk.y1 = ty + lk.width / 2; ty += lk.width
      })
    })
  })
  return { nodes: n, links: l }
}

function linkPath(lk: LayoutLink): string {
  const sx = lk.source.x1, tx = lk.target.x0, mx = (sx + tx) / 2
  return `M${sx},${lk.y0} C${mx},${lk.y0} ${mx},${lk.y1} ${tx},${lk.y1}`
}

// Helper: construye RawNode/RawLink desde listas con nombres ──────────────────

function buildGraph(
  nodeSpecs: { name: string; column: 0 | 1 | 2; color: string }[],
  linkSpecs: { source: string; target: string; value: number }[],
): { nodes: RawNode[]; links: RawLink[] } {
  const filtered = linkSpecs.filter(l => l.value > 0)
  const used = new Set(filtered.flatMap(l => [l.source, l.target]))
  const nodes = nodeSpecs.filter(n => used.has(n.name))
  const idx: Record<string, number> = {}
  nodes.forEach((n, i) => { idx[n.name] = i })
  return {
    nodes,
    links: filtered.map(l => ({ source: idx[l.source], target: idx[l.target], value: l.value })),
  }
}

// ── StrokeSankeyChart — componente reutilizable ───────────────────────────────

function StrokeSankeyChart({
  nodes, links,
  leftLabel  = "← FUENTES", centerLabel = "CENTRO", rightLabel = "DESTINO →",
  leftColor  = "#4AF6C3",   centerColor = "#FFA028", rightColor = "#FF433D",
  formatValue = fmtFull,
}: {
  nodes: RawNode[]; links: RawLink[]
  leftLabel?: string; centerLabel?: string; rightLabel?: string
  leftColor?: string; centerColor?: string; rightColor?: string
  formatValue?: (v: number) => string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ width: 900, height: 480 })
  const [hovL, setHovL] = useState<number | null>(null)
  const [hovN, setHovN] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setDim({ width: Math.max(w, 500), height: Math.max(Math.min(w * 0.5, 520), 340) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const margin = { top: 24, right: 200, bottom: 12, left: 200 }
  const iW = Math.max(dim.width  - margin.left - margin.right, 160)
  const iH = Math.max(dim.height - margin.top  - margin.bottom, 160)
  const layout = strokeSankeyLayout({ nodes, links, width: iW, height: iH, nodePadding: 7, nodeWidth: 14 })

  const leftTotal  = layout.nodes.filter(nd => nd._col === 0).reduce((s, nd) => s + nd.value, 0)
  const rightTotal = layout.nodes.filter(nd => nd._col === 2).reduce((s, nd) => s + nd.value, 0)

  return (
    <div style={{ background: "#0A0A0A", color: "#E0E0E0" }}>
      {/* Section labels */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 4px" }}>
        <div style={{ fontSize: 9, color: leftColor,   letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>{leftLabel}</div>
        <div style={{ fontSize: 9, color: centerColor, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>{centerLabel}</div>
        <div style={{ fontSize: 9, color: rightColor,  letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>{rightLabel}</div>
      </div>

      {/* SVG */}
      <div ref={containerRef} style={{ overflow: "hidden" }}>
        <svg width={dim.width} height={dim.height} style={{ display: "block" }}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {layout.links.map((lk, i) => {
              const isHov  = hovL === i || hovN === lk.source._i || hovN === lk.target._i
              const anyHov = hovL !== null || hovN !== null
              return (
                <path key={i} d={linkPath(lk)} fill="none"
                  stroke={lk.source.color} strokeWidth={Math.max(lk.width, 1)}
                  strokeOpacity={anyHov ? (isHov ? 0.45 : 0.05) : 0.22}
                  onMouseEnter={() => setHovL(i)} onMouseLeave={() => setHovL(null)}
                  style={{ cursor: "pointer", transition: "stroke-opacity 0.18s" }} />
              )
            })}
            {layout.nodes.map((nd, i) => {
              const nodeH    = Math.max(nd.y1 - nd.y0, 2)
              const midY     = (nd.y0 + nd.y1) / 2
              const isLeft   = nd._col === 0
              const isCenter = nd._col === 1
              const isRight  = nd._col === 2
              const pctBase  = isLeft ? leftTotal : rightTotal
              const pct      = pctBase > 0 ? ((nd.value / pctBase) * 100).toFixed(1) : null
              return (
                <g key={i} onMouseEnter={() => setHovN(i)} onMouseLeave={() => setHovN(null)} style={{ cursor: "pointer" }}>
                  <rect x={nd.x0} y={nd.y0} width={nd.x1 - nd.x0} height={nodeH}
                    fill={nd.color} fillOpacity={hovN === i ? 1 : 0.85} rx={2}
                    style={{ transition: "fill-opacity 0.18s" }}>
                    <title>{nd.name}: {formatValue(nd.value)}</title>
                  </rect>
                  {isCenter && (
                    <>
                      <rect x={nd.x0 - 2} y={nd.y0 - 2} width={nd.x1 - nd.x0 + 4} height={nodeH + 4}
                        fill="none" stroke={centerColor} strokeWidth={1} strokeOpacity={0.35} rx={3} />
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 12}
                        textAnchor="middle" fill={centerColor} fontSize={9} fontWeight={700} fontFamily="inherit">{nd.name}</text>
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 2}
                        textAnchor="middle" fill="#666" fontSize={8} fontFamily="inherit">{fmtMM(nd.value)}</text>
                    </>
                  )}
                  {isLeft && nodeH > 8 && (
                    <>
                      <text x={nd.x0 - 8} y={midY - 5} textAnchor="end" fill={nd.color} fontSize={9} fontWeight={600} fontFamily="inherit">{nd.name}</text>
                      <text x={nd.x0 - 8} y={midY + 7} textAnchor="end" fill="#666"     fontSize={8}             fontFamily="inherit">{fmtMM(nd.value)}{pct ? ` · ${pct}%` : ""}</text>
                    </>
                  )}
                  {isRight && nodeH > 8 && (
                    <>
                      <text x={nd.x1 + 8} y={midY - 5} textAnchor="start" fill={nd.color} fontSize={9} fontWeight={600} fontFamily="inherit">{nd.name}</text>
                      <text x={nd.x1 + 8} y={midY + 7} textAnchor="start" fill="#666"     fontSize={8}             fontFamily="inherit">{fmtMM(nd.value)}{pct ? ` · ${pct}%` : ""}</text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Hover tooltip */}
      {hovL !== null && layout.links[hovL] && (() => {
        const lk = layout.links[hovL]
        return (
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "8px 16px", fontSize: 10, color: "#E0E0E0", pointerEvents: "none", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", fontFamily: "inherit" }}>
            <span style={{ color: lk.source.color, fontWeight: 700 }}>{lk.source.name}</span>
            <span style={{ color: "#555", margin: "0 8px" }}>→</span>
            <span style={{ color: lk.target.color, fontWeight: 700 }}>{lk.target.name}</span>
            <span style={{ color: "#FFA028", marginLeft: 12, fontWeight: 700 }}>{formatValue(lk.value)}</span>
          </div>
        )
      })()}
    </div>
  )
}

// ── BreakdownTable (para Distribución Federal) ────────────────────────────────

function BreakdownTable({ getValue, total, period }: {
  getValue: (key: string) => number; total: number; period: string
}) {
  const items = [
    { label: "IVA Neto",         key: "rec_iva",           color: "#4AF6C3" },
    { label: "Ganancias",        key: "rec_ganancias",     color: "#FFA028" },
    { label: "Seg. Social",      key: "rec_seg_social",    color: "#7C83FD" },
    { label: "Déb/Créditos",     key: "rec_deb_cred",      color: "#4FC3F7" },
    { label: "Der. Exportación", key: "rec_der_expo",      color: "#FFD54F" },
    { label: "Der. Importación", key: "rec_der_impo",      color: "#CE93D8" },
    { label: "Bs. Personales",   key: "rec_bs_personales", color: "#F48FB1" },
  ]
  const known = items.reduce((s, it) => s + getValue(it.key), 0)
  const otros = Math.max(0, total - known)
  const allRows = [...items, { label: "Otros / No asignados", key: "__otros__", color: "#444" }]
  return (
    <div className="bbg-panel" style={{ marginTop: 8 }}>
      <div className="bbg-panel-header">COMPOSICIÓN DE RECAUDACIÓN — {period.slice(0, 7)}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Impuesto / Concepto", "Monto ARS", "% Total", ""].map(h => (
              <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: h === "Impuesto / Concepto" ? "left" : "right", borderBottom: "1px solid #1a1a1a" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {allRows.map((it, i) => {
              const val = it.key === "__otros__" ? otros : getValue(it.key)
              const pct = total > 0 ? (val / total) * 100 : 0
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                  <td style={{ padding: "4px 8px", fontSize: 10, color: "#ccc" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, background: it.color, borderRadius: 1, marginRight: 6 }} />{it.label}
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 10, textAlign: "right", fontFamily: "monospace", color: "#ccc" }}>{fmtM(val)}</td>
                  <td style={{ padding: "4px 8px", fontSize: 10, textAlign: "right", fontFamily: "monospace", color: "#888" }}>{pct.toFixed(1)}%</td>
                  <td style={{ padding: "4px 12px 4px 4px", width: 80 }}>
                    <div style={{ background: "#0d0d0d", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: it.color, borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr style={{ borderTop: "1px solid #333" }}>
              <td style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, color: "#FFA028" }}>TOTAL RECAUDACIÓN</td>
              <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", fontFamily: "monospace", color: "#FFA028", fontWeight: 700 }}>{fmtM(total)}</td>
              <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", color: "#555" }}>100.0%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KPI({ label, value, unit, var1, var1Label, var2, var2Label, valueColor }: {
  label: string; value: string | null; unit: string
  var1?: number | null; var1Label?: string; var2?: number | null; var2Label?: string; valueColor?: string
}) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", flex: "1 1 160px" }}>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#FFA028", fontFamily: "monospace" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{unit}</div>
      {var1 != null && <div style={{ fontSize: 10, color: varColor(var1), marginTop: 4 }}>{varSign(var1)}{fmtNum(var1)}% {var1Label}</div>}
      {var2 != null && <div style={{ fontSize: 10, color: varColor(var2) }}>{varSign(var2)}{fmtNum(var2)}% {var2Label}</div>}
    </div>
  )
}

// ── SubTabs ───────────────────────────────────────────────────────────────────

function SubTabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222", marginBottom: 1 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? "#0d0d0d" : "transparent",
          color: active === t.key ? "#FFA028" : "#555",
          border: "none", borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
          padding: "6px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ── FiscalSankeyView ──────────────────────────────────────────────────────────

export function FiscalSankeyView() {
  const [fiscalData, setFiscalData] = useState<FiscalData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [period, setPeriod]         = useState<string>("")
  const [mainTab, setMainTab]       = useState<"flujo" | "distribucion" | "cashflow" | "ahorro">("flujo")

  useEffect(() => {
    fetch("/api/macro?endpoint=fiscal_sankey")
      .then(r => r.json())
      .then(j => {
        setFiscalData(j.data)
        const dates = (j.data?.recaudacion ?? []).map(([d]: [string, number]) => d)
        if (dates.length > 0) setPeriod(dates[0])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getValue = (key: string, p = period): number => {
    if (!fiscalData) return 0
    const entry = (fiscalData[key] ?? []).find(([d]) => d === p)
    return entry ? entry[1] : 0
  }
  const periods = (fiscalData?.recaudacion ?? []).map(([d]) => d).slice(0, 36)

  if (loading)     return <div style={{ padding: 48, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando datos fiscales...</div>
  if (!fiscalData) return <div style={{ padding: 24, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>

  // ── Valores comunes ─────────────────────────────────────────────────────────
  const iva          = getValue("rec_iva")
  const ganancias    = getValue("rec_ganancias")
  const segSocial    = getValue("rec_seg_social")
  const debCred      = getValue("rec_deb_cred")
  const derExpo      = getValue("rec_der_expo")
  const derImpo      = getValue("rec_der_impo")
  const bsPersonales = getValue("rec_bs_personales")
  const totalRec     = getValue("recaudacion")
  const resPrimario  = getValue("resultado_primario")
  const resFinanciero = getValue("resultado_financiero")
  const otrosRec     = Math.max(0, totalRec - iva - ganancias - segSocial - debCred - derExpo - derImpo - bsPersonales)

  // ── Tab 1: Flujo Fiscal ─────────────────────────────────────────────────────
  const gastoTotal    = totalRec + Math.abs(resPrimario < 0 ? resPrimario : 0)
  const incomeRaw: [string, number][] = [
    ["IVA",           iva],           ["Ganancias",     ganancias],
    ["Seg. Social",   segSocial],     ["Déb./Créd.",    debCred],
    ["Comercio Ext.", derExpo + derImpo], ["Otros Imp.", otrosRec + bsPersonales],
  ]
  const incomeEntries = incomeRaw.filter(([, v]) => v > 0)
  const totalIngresos = incomeEntries.reduce((s, [, v]) => s + v, 0)
  const expenseRaw: [string, number][] = [
    ["Jubilaciones y Pensiones",  gastoTotal * 0.42], ["Transferencias Provincias", gastoTotal * 0.18],
    ["Salarios Públicos",         gastoTotal * 0.11], ["Subsidios Energía",         gastoTotal * 0.06],
    ["Educación y Cultura",       gastoTotal * 0.05], ["Salud",                     gastoTotal * 0.04],
    ["Defensa y Seguridad",       gastoTotal * 0.03], ["Obra Pública",              gastoTotal * 0.03],
    ["Intereses Deuda",           Math.abs(resFinanciero - resPrimario)],
    ["Otros Gastos",              gastoTotal * 0.05],
  ]
  const expenseEntries = expenseRaw.filter(([, v]) => v > 0)
  const totalGastos    = expenseEntries.reduce((s, [, v]) => s + v, 0)
  const superavit      = resPrimario > 0 ? resPrimario : 0

  const flujoGraph = buildGraph(
    [
      ...incomeEntries.map(([name]) => ({ name, column: 0 as const, color: INCOME_COLORS[name] ?? "#6C9BFF" })),
      { name: "TESORO NACIONAL", column: 1 as const, color: "#FFA028" },
      ...expenseEntries.map(([name]) => ({ name, column: 2 as const, color: EXPENSE_COLORS[name] ?? "#666" })),
      ...(superavit > 0 ? [{ name: "SUPERÁVIT", column: 2 as const, color: "#4AF6C3" }] : []),
    ],
    [
      ...incomeEntries.map(([name, value]) => ({ source: name, target: "TESORO NACIONAL", value })),
      ...expenseEntries.map(([name, value]) => ({ source: "TESORO NACIONAL", target: name, value })),
      ...(superavit > 0 ? [{ source: "TESORO NACIONAL", target: "SUPERÁVIT", value: superavit }] : []),
    ],
  )

  // ── Tab 2: Distribución Federal ─────────────────────────────────────────────
  const copart = Math.max(0, totalRec - segSocial - derExpo)
  const distribGraph = buildGraph(
    [
      { name: "IVA",           column: 0, color: "#4AF6C3" },
      { name: "Ganancias",     column: 0, color: "#FFA028" },
      { name: "Seg. Social",   column: 0, color: "#7C83FD" },
      { name: "Déb/Créd",      column: 0, color: "#4FC3F7" },
      { name: "Der. Expo.",    column: 0, color: "#FFD54F" },
      { name: "Der. Impo.",    column: 0, color: "#CE93D8" },
      { name: "Bs. Pers.",     column: 0, color: "#F48FB1" },
      { name: "Otros",         column: 0, color: "#555"    },
      { name: "RECAUDACIÓN",   column: 1, color: "#FFA028" },
      { name: "Tesoro Nac.",   column: 2, color: "#4AF6C3" },
      { name: "Provincias",    column: 2, color: "#4FC3F7" },
      { name: "ANSeS",         column: 2, color: "#7C83FD" },
      { name: "CABA + ATN",    column: 2, color: "#FFD54F" },
    ],
    [
      { source: "IVA",         target: "RECAUDACIÓN", value: iva },
      { source: "Ganancias",   target: "RECAUDACIÓN", value: ganancias },
      { source: "Seg. Social", target: "RECAUDACIÓN", value: segSocial },
      { source: "Déb/Créd",    target: "RECAUDACIÓN", value: debCred },
      { source: "Der. Expo.",  target: "RECAUDACIÓN", value: derExpo },
      { source: "Der. Impo.",  target: "RECAUDACIÓN", value: derImpo },
      { source: "Bs. Pers.",   target: "RECAUDACIÓN", value: bsPersonales },
      { source: "Otros",       target: "RECAUDACIÓN", value: otrosRec },
      { source: "RECAUDACIÓN", target: "Tesoro Nac.", value: derExpo + copart * 0.4234 },
      { source: "RECAUDACIÓN", target: "Provincias",  value: copart * 0.5666 },
      { source: "RECAUDACIÓN", target: "ANSeS",       value: segSocial },
      { source: "RECAUDACIÓN", target: "CABA + ATN",  value: copart * 0.024 },
    ],
  )

  // ── Tab 3: Cashflow Didáctico ───────────────────────────────────────────────
  const cashflowGraph = buildGraph(
    [
      { name: "IVA",           column: 0, color: "#4AF6C3" },
      { name: "Ganancias",     column: 0, color: "#FFA028" },
      { name: "Seg. Social",   column: 0, color: "#7C83FD" },
      { name: "Déb/Créd",      column: 0, color: "#4FC3F7" },
      { name: "Der. Expo.",    column: 0, color: "#FFD54F" },
      { name: "Der. Impo.",    column: 0, color: "#CE93D8" },
      { name: "Bs. Pers.",     column: 0, color: "#F48FB1" },
      { name: "Otros",         column: 0, color: "#555"    },
      { name: "TESORO",        column: 1, color: "#FFA028" },
      { name: "Jubilaciones",  column: 2, color: "#7C83FD" },
      { name: "Trans. Prov.",  column: 2, color: "#4FC3F7" },
      { name: "Salarios",      column: 2, color: "#4AF6C3" },
      { name: "Subsidios",     column: 2, color: "#FFD54F" },
      { name: "Deuda",         column: 2, color: "#FF433D" },
      { name: "Otros Gastos",  column: 2, color: "#666"    },
    ],
    [
      { source: "IVA",         target: "TESORO", value: iva },
      { source: "Ganancias",   target: "TESORO", value: ganancias },
      { source: "Seg. Social", target: "TESORO", value: segSocial },
      { source: "Déb/Créd",    target: "TESORO", value: debCred },
      { source: "Der. Expo.",  target: "TESORO", value: derExpo },
      { source: "Der. Impo.",  target: "TESORO", value: derImpo },
      { source: "Bs. Pers.",   target: "TESORO", value: bsPersonales },
      { source: "Otros",       target: "TESORO", value: otrosRec },
      { source: "TESORO", target: "Jubilaciones", value: totalRec * 0.38 },
      { source: "TESORO", target: "Trans. Prov.", value: totalRec * 0.18 },
      { source: "TESORO", target: "Salarios",     value: totalRec * 0.12 },
      { source: "TESORO", target: "Subsidios",    value: totalRec * 0.08 },
      { source: "TESORO", target: "Deuda",        value: totalRec * 0.15 },
      { source: "TESORO", target: "Otros Gastos", value: totalRec * 0.09 },
    ],
  )

  // ── Tab 4: Ahorro-Inversión ─────────────────────────────────────────────────
  const tributarios   = totalRec * 0.62
  const noTributarios = totalRec * 0.04
  const rentas        = totalRec * 0.03
  const otrosI        = Math.max(0, totalRec - tributarios - segSocial - noTributarios - rentas)
  const gastoA        = totalRec + Math.abs(resPrimario)
  const ahorroGraph = buildGraph(
    [
      { name: "Tributarios",    column: 0, color: "#4AF6C3" },
      { name: "Seg. Social",    column: 0, color: "#7C83FD" },
      { name: "No Tributarios", column: 0, color: "#FFA028" },
      { name: "Rentas Prop.",   column: 0, color: "#FFD54F" },
      { name: "Otros Ing.",     column: 0, color: "#555"    },
      { name: "INGRESOS SPN",   column: 1, color: "#4AF6C3" },
      { name: "Prest. Soc.",    column: 2, color: "#7C83FD" },
      { name: "Funcionam.",     column: 2, color: "#4FC3F7" },
      { name: "Transferencias", column: 2, color: "#FFA028" },
      { name: "Cap. Inversión", column: 2, color: "#4AF6C3" },
      { name: "Intereses",      column: 2, color: "#FF433D" },
    ],
    [
      { source: "Tributarios",    target: "INGRESOS SPN", value: tributarios   },
      { source: "Seg. Social",    target: "INGRESOS SPN", value: segSocial     },
      { source: "No Tributarios", target: "INGRESOS SPN", value: noTributarios },
      { source: "Rentas Prop.",   target: "INGRESOS SPN", value: rentas        },
      { source: "Otros Ing.",     target: "INGRESOS SPN", value: otrosI        },
      { source: "INGRESOS SPN", target: "Prest. Soc.",    value: gastoA * 0.41 },
      { source: "INGRESOS SPN", target: "Funcionam.",     value: gastoA * 0.18 },
      { source: "INGRESOS SPN", target: "Transferencias", value: gastoA * 0.22 },
      { source: "INGRESOS SPN", target: "Cap. Inversión", value: gastoA * 0.07 },
      { source: "INGRESOS SPN", target: "Intereses",      value: gastoA * 0.12 },
    ],
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'JetBrains Mono','SF Mono','Fira Code',monospace" }}>

      {/* Header compartido */}
      <div style={{ background: "linear-gradient(180deg,#111 0%,#0A0A0A 100%)", borderBottom: "1px solid #1A1A1A", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>Sector Público Nacional · Flujo Fiscal</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#FFA028", marginTop: 2 }}>ANÁLISIS FISCAL — {period.slice(0, 7).toUpperCase()}</div>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ background: "#111", color: "#E0E0E0", border: "1px solid #222", padding: "5px 8px", fontSize: 10, fontFamily: "inherit", borderRadius: 4, cursor: "pointer" }}>
          {periods.map(p => <option key={p} value={p}>{p.slice(0, 7)}</option>)}
        </select>
      </div>

      {/* KPIs compartidos */}
      <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
        <KPI label="Recaudación Total"    value={fmtM(totalRec)}      unit={`ARS · ${period.slice(0, 7)}`}  valueColor="#FFA028" />
        <KPI label="Resultado Primario"   value={fmtM(resPrimario)}   unit="SPN no financiero · base caja"  valueColor={resPrimario  >= 0 ? "#4AF6C3" : "#FF433D"} />
        <KPI label="Resultado Financiero" value={fmtM(resFinanciero)} unit="Incluyendo intereses de deuda"   valueColor={resFinanciero >= 0 ? "#4AF6C3" : "#FF433D"} />
      </div>

      {/* Tabs */}
      <SubTabs
        tabs={[
          { key: "flujo",        label: "Flujo Fiscal" },
          { key: "distribucion", label: "Distribución Federal" },
          { key: "cashflow",     label: "Cashflow Didáctico" },
          { key: "ahorro",       label: "Ahorro-Inversión" },
        ]}
        active={mainTab}
        onChange={v => setMainTab(v as typeof mainTab)}
      />

      {/* ══ TAB 1: Flujo Fiscal ══ */}
      {mainTab === "flujo" && (
        <div style={{ background: "#0A0A0A" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1, background: "#1A1A1A" }}>
            {[
              { label: "INGRESOS TOTALES",     value: totalIngresos,  color: "#4AF6C3" },
              { label: "GASTOS TOTALES",        value: totalGastos,    color: "#FF433D" },
              { label: "RESULTADO PRIMARIO",    value: resPrimario,    color: resPrimario  >= 0 ? "#4AF6C3" : "#FF433D" },
              { label: "RESULTADO FINANCIERO",  value: resFinanciero,  color: resFinanciero >= 0 ? "#4AF6C3" : "#FF433D" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#0D0D0D", padding: "10px 14px" }}>
                <div style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2, fontFamily: "inherit" }}>{fmtFull(value)}</div>
                <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>$ millones</div>
              </div>
            ))}
          </div>

          <StrokeSankeyChart
            nodes={flujoGraph.nodes} links={flujoGraph.links}
            leftLabel="← FUENTES DE INGRESO" centerLabel="TESORO" rightLabel="DESTINO DEL GASTO →"
            leftColor="#4AF6C3" centerColor="#FFA028" rightColor="#FF433D"
          />

          {/* Tablas desglose */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1A1A1A", borderTop: "1px solid #1A1A1A" }}>
            <div style={{ background: "#0D0D0D", padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, marginBottom: 6, fontWeight: 700 }}>COMPOSICIÓN DE INGRESOS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[...incomeEntries].sort((a, b) => b[1] - a[1]).map(([name, value]) => (
                    <tr key={name} style={{ borderBottom: "1px solid #151515" }}>
                      <td style={{ padding: "3px 0", fontSize: 10, color: INCOME_COLORS[name] ?? "#888" }}>{name}</td>
                      <td style={{ padding: "3px 0", fontSize: 10, color: "#E0E0E0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFull(value)}</td>
                      <td style={{ padding: "3px 0 3px 8px", fontSize: 9, color: "#555", textAlign: "right", width: 44 }}>{((value / totalIngresos) * 100).toFixed(1)}%</td>
                      <td style={{ padding: "3px 0 3px 6px", width: 60 }}>
                        <div style={{ height: 4, borderRadius: 2, background: "#1A1A1A" }}>
                          <div style={{ height: 4, borderRadius: 2, background: INCOME_COLORS[name] ?? "#888", width: `${(value / totalIngresos) * 100}%`, opacity: 0.7 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background: "#0D0D0D", padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "#FF433D", letterSpacing: 1.5, marginBottom: 6, fontWeight: 700 }}>COMPOSICIÓN DE GASTOS</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[...expenseEntries].sort((a, b) => b[1] - a[1]).map(([name, value]) => (
                    <tr key={name} style={{ borderBottom: "1px solid #151515" }}>
                      <td style={{ padding: "3px 0", fontSize: 10, color: EXPENSE_COLORS[name] ?? "#888" }}>{name}</td>
                      <td style={{ padding: "3px 0", fontSize: 10, color: "#E0E0E0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFull(value)}</td>
                      <td style={{ padding: "3px 0 3px 8px", fontSize: 9, color: "#555", textAlign: "right", width: 44 }}>{((value / totalGastos) * 100).toFixed(1)}%</td>
                      <td style={{ padding: "3px 0 3px 6px", width: 60 }}>
                        <div style={{ height: 4, borderRadius: 2, background: "#1A1A1A" }}>
                          <div style={{ height: 4, borderRadius: 2, background: EXPENSE_COLORS[name] ?? "#888", width: `${(value / totalGastos) * 100}%`, opacity: 0.7 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: "7px 14px", borderTop: "1px solid #1A1A1A", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <div style={{ fontSize: 8, color: "#333" }}>FUENTE: ARCA · apis.datos.gob.ar · datasets 172 / 378 / 379 / 452</div>
            <div style={{ fontSize: 8, color: "#333" }}>⚠ Gastos: proporciones estimadas (Presupuesto Abierto). Ingresos: datos reales ARCA.</div>
          </div>
        </div>
      )}

      {/* ══ TAB 2: Distribución Federal ══ */}
      {mainTab === "distribucion" && (
        <div>
          <div style={{ padding: "5px 12px", background: "#001507", borderLeft: "3px solid #4AF6C3", fontSize: 9, color: "#4AF6C3", lineHeight: 1.6 }}>
            Seg. Social → ANSeS 100%. Der. Exportación → Tesoro 100%. Resto según Ley 23548: Tesoro 42.34% · Provincias 56.66% · CABA 1.40% · ATN 1%.{" "}
            <a href="http://www.cfi.gov.ar/Coparticipacion/Indices.aspx" target="_blank" rel="noopener" style={{ color: "#4AF6C3" }}>Ver CFI →</a>
          </div>
          <StrokeSankeyChart
            nodes={distribGraph.nodes} links={distribGraph.links}
            leftLabel="← FUENTES DE RECAUDACIÓN" centerLabel="RECAUDACIÓN" rightLabel="DISTRIBUCIÓN →"
            leftColor="#4AF6C3" centerColor="#FFA028" rightColor="#4FC3F7"
          />
          <BreakdownTable getValue={getValue} total={totalRec} period={period} />
          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
            Fuente: ARCA · apis.datos.gob.ar · datasets 172 / 452 · Distribución federal: Ley 23548 (simplificada)
          </div>
        </div>
      )}

      {/* ══ TAB 3: Cashflow Didáctico ══ */}
      {mainTab === "cashflow" && (
        <div>
          <div style={{ padding: "5px 12px", background: "#1a0800", borderLeft: "3px solid #FFA028", fontSize: 9, color: "#FFA028", lineHeight: 1.6 }}>
            ⚠ SIMPLIFICACIÓN DIDÁCTICA — Combina base caja (ARCA) con base devengado (Presupuesto). Gastos son proporciones aproximadas. No cierra contablemente.
          </div>
          <StrokeSankeyChart
            nodes={cashflowGraph.nodes} links={cashflowGraph.links}
            leftLabel="← FUENTES" centerLabel="TESORO" rightLabel="GASTOS →"
            leftColor="#4AF6C3" centerColor="#FFA028" rightColor="#FF433D"
          />
          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
            Fuente: ARCA · apis.datos.gob.ar · datasets 172 / 452 · Gastos: proporciones aproximadas del Presupuesto vigente
          </div>
        </div>
      )}

      {/* ══ TAB 4: Ahorro-Inversión ══ */}
      {mainTab === "ahorro" && (
        <div>
          <div style={{ padding: "5px 12px", background: "#08001a", borderLeft: "3px solid #7C83FD", fontSize: 9, color: "#7C83FD", lineHeight: 1.6 }}>
            ⚠ PROPORCIONES ESTIMADAS — Ingresos por categoría y gastos son aproximaciones. Fuente real: Esquema A-I-F (Sec. de Hacienda, Ministerio de Economía).
          </div>
          <StrokeSankeyChart
            nodes={ahorroGraph.nodes} links={ahorroGraph.links}
            leftLabel="← INGRESOS" centerLabel="SPN" rightLabel="USOS →"
            leftColor="#4AF6C3" centerColor="#4AF6C3" rightColor="#FF433D"
          />
          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
            Fuente: ARCA · apis.datos.gob.ar · Esquema Ahorro-Inversión-Financiamiento (Sec. de Hacienda)
          </div>
        </div>
      )}
    </div>
  )
}
