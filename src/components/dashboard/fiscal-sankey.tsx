/**
 * FiscalSankeyView — 4 vistas del flujo fiscal
 * Tab 1: FLUJO FISCAL    — Bloomberg dark, stroke-based (d3-sankey style)
 * Tab 2: DISTRIBUCIÓN    — Ribbons, distribución Ley 23548
 * Tab 3: CASHFLOW        — Ribbons, simplificación didáctica
 * Tab 4: AHORRO-INV.     — Ribbons, proporciones estimadas
 */

"use client"

import { useState, useEffect, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Serie = [string, number][]
type FiscalData = Record<string, Serie>

// Stroke engine
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

// Ribbon engine
interface SNode { id: string; label: string; col: 0 | 1 | 2; color: string }
interface SLink { source: string; target: string; value: number }
interface PNode extends SNode { x: number; y: number; w: number; h: number }
interface PLink { path: string; color: string; value: number; srcLabel: string; tgtLabel: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}Bn`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}Mm`
  return `${s}$${Math.round(a)}M`
}

const fmtFull = (v: number) => `$${Math.abs(v).toLocaleString("es-AR")} M`

function fmtMM(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}B`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}MM`
  return `${s}$${Math.round(a)}`
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}
function varSign(v: number | null | undefined): string {
  if (v == null) return ""
  return v >= 0 ? "+" : ""
}
function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Color schemes ─────────────────────────────────────────────────────────────

const INCOME_COLORS: Record<string, string> = {
  "IVA":           "#4AF6C3",
  "Ganancias":     "#36D6B0",
  "Seg. Social":   "#2BB89E",
  "Déb./Créd.":    "#FFA028",
  "Comercio Ext.": "#FF8C42",
  "Otros Imp.":    "#6C9BFF",
  "Otros":         "#6C9BFF",
}

const EXPENSE_COLORS: Record<string, string> = {
  "Jubilaciones y Pensiones":  "#FF6B6B",
  "Transferencias Provincias": "#FF433D",
  "Salarios Públicos":         "#E8425A",
  "Subsidios Energía":         "#FF8888",
  "Educación y Cultura":       "#C77DFF",
  "Salud":                     "#A855F7",
  "Defensa y Seguridad":       "#7C6EAB",
  "Obra Pública":              "#FF6B9D",
  "Intereses Deuda":           "#B91C1C",
  "Otros Gastos":              "#666",
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
    x0: 0, x1: 0, y0: 0, y1: 0, value: 0,
    sourceLinks: [], targetLinks: [],
  }))
  const l: LayoutLink[] = links.map(lk => ({
    source: n[lk.source], target: n[lk.target],
    value: lk.value, width: 0, y0: 0, y1: 0,
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
    const colNodes = cols[col].slice().sort((a, b) => b.value - a.value)
    let y = 0
    colNodes.forEach(nd => { nd.y0 = y; nd.y1 = y + nd.value * scale; y = nd.y1 + nodePadding })
    const offset = (height - (y - nodePadding)) / 2
    if (offset > 0) colNodes.forEach(nd => { nd.y0 += offset; nd.y1 += offset })
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

// ── Ribbon Sankey engine ──────────────────────────────────────────────────────

function ribbonSankeyLayout(
  nodes: SNode[], links: SLink[], svgW: number, svgH: number,
): { pnodes: PNode[]; plinks: PLink[] } {
  const NODE_W = 112, COL_GAP = 10, PAD_V = 20
  const availH = svgH - PAD_V * 2
  const colX = (col: number): number => {
    if (col === 0) return 24
    if (col === 1) return Math.round((svgW - NODE_W) / 2)
    return svgW - NODE_W - 24
  }
  const nodeIn: Record<string, number> = {}
  const nodeOut: Record<string, number> = {}
  for (const nd of nodes) { nodeIn[nd.id] = 0; nodeOut[nd.id] = 0 }
  for (const lk of links) {
    nodeOut[lk.source] = (nodeOut[lk.source] ?? 0) + lk.value
    nodeIn[lk.target]  = (nodeIn[lk.target]  ?? 0) + lk.value
  }
  const nodeVal = (id: string, col: number): number => {
    if (col === 0) return nodeOut[id] ?? 0
    if (col === 2) return nodeIn[id]  ?? 0
    return Math.max(nodeIn[id] ?? 0, nodeOut[id] ?? 0)
  }
  const pnodes: PNode[] = []
  for (const col of [0, 1, 2] as const) {
    const colNodes = nodes.filter(n => n.col === col)
    const total = colNodes.reduce((s, n) => s + nodeVal(n.id, col), 0)
    const gaps  = COL_GAP * Math.max(0, colNodes.length - 1)
    let y = PAD_V
    for (const nd of colNodes) {
      const ratio = total > 0 ? nodeVal(nd.id, col) / total : 1 / colNodes.length
      const h = Math.max(14, ratio * (availH - gaps))
      pnodes.push({ ...nd, x: colX(col), y, w: NODE_W, h })
      y += h + COL_GAP
    }
  }
  const srcOff: Record<string, number> = {}
  const tgtOff: Record<string, number> = {}
  for (const pn of pnodes) { srcOff[pn.id] = pn.y; tgtOff[pn.id] = pn.y }
  const plinks: PLink[] = []
  for (const lk of links) {
    if (lk.value <= 0) continue
    const src = pnodes.find(n => n.id === lk.source)
    const tgt = pnodes.find(n => n.id === lk.target)
    if (!src || !tgt) continue
    const hs = (lk.value / (nodeOut[lk.source] || 1)) * src.h
    const ht = (lk.value / (nodeIn[lk.target]  || 1)) * tgt.h
    const x0 = src.x + src.w, y0 = srcOff[lk.source]
    const x1 = tgt.x,         y1 = tgtOff[lk.target]
    const cx = (x0 + x1) / 2
    const path = [
      `M${x0},${y0}`, `C${cx},${y0} ${cx},${y1} ${x1},${y1}`,
      `L${x1},${y1 + ht}`, `C${cx},${y1 + ht} ${cx},${y0 + hs} ${x0},${y0 + hs}`, `Z`,
    ].join(" ")
    srcOff[lk.source] += hs
    tgtOff[lk.target] += ht
    plinks.push({ path, color: src.color, value: lk.value, srcLabel: src.label, tgtLabel: tgt.label })
  }
  return { pnodes, plinks }
}

// ── RibbonSankeyChart ─────────────────────────────────────────────────────────

function RibbonSankeyChart({ nodes, links, height = 440, formatValue }: {
  nodes: SNode[]; links: SLink[]; height?: number; formatValue: (v: number) => string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(760)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { pnodes, plinks } = ribbonSankeyLayout(nodes, links, width, height)

  return (
    <div ref={containerRef} style={{ width: "100%", overflow: "hidden" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {plinks.map((pl, i) => (
          <g key={i} onMouseEnter={() => setHovered(`l${i}`)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
            <path d={pl.path} fill={pl.color} fillOpacity={hovered === `l${i}` ? 0.55 : 0.22} stroke="none" style={{ transition: "fill-opacity 0.15s" }} />
            <title>{pl.srcLabel} → {pl.tgtLabel}: {formatValue(pl.value)}</title>
          </g>
        ))}
        {pnodes.map(pn => {
          const isHov = hovered === `n${pn.id}`
          return (
            <g key={pn.id} onMouseEnter={() => setHovered(`n${pn.id}`)} onMouseLeave={() => setHovered(null)}>
              <rect x={pn.x} y={pn.y} width={pn.w} height={pn.h} fill={pn.color} fillOpacity={isHov ? 0.95 : 0.8} rx={2} style={{ transition: "fill-opacity 0.15s" }}>
                <title>{pn.label}: {formatValue(
                  links.filter(l => l.source === pn.id).reduce((s, l) => s + l.value, 0) ||
                  links.filter(l => l.target === pn.id).reduce((s, l) => s + l.value, 0)
                )}</title>
              </rect>
              {pn.col === 1 && pn.h >= 18 && (
                <text x={pn.x + pn.w / 2} y={pn.y + pn.h / 2} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: Math.min(10, Math.max(7, pn.h / 2.8)), fill: "#000", fontWeight: 700, fontFamily: "monospace", pointerEvents: "none" }}>
                  {pn.label}
                </text>
              )}
              {pn.col === 0 && pn.h >= 13 && (
                <text x={pn.x - 5} y={pn.y + pn.h / 2} textAnchor="end" dominantBaseline="middle"
                  style={{ fontSize: 8, fill: "#aaa", fontFamily: "monospace", pointerEvents: "none" }}>
                  {pn.label}
                </text>
              )}
              {pn.col === 2 && pn.h >= 13 && (
                <text x={pn.x + pn.w + 5} y={pn.y + pn.h / 2} textAnchor="start" dominantBaseline="middle"
                  style={{ fontSize: 8, fill: "#aaa", fontFamily: "monospace", pointerEvents: "none" }}>
                  {pn.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── BreakdownTable ────────────────────────────────────────────────────────────

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
  const known  = items.reduce((s, it) => s + getValue(it.key), 0)
  const otros  = Math.max(0, total - known)
  const allRows = [...items, { label: "Otros / No asignados", key: "__otros__", color: "#444" }]
  return (
    <div className="bbg-panel" style={{ marginTop: 8 }}>
      <div className="bbg-panel-header">COMPOSICIÓN DE RECAUDACIÓN — {period.slice(0, 7)}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Impuesto / Concepto", "Monto ARS", "% Total", ""].map(h => (
                <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: h === "Impuesto / Concepto" ? "left" : "right", borderBottom: "1px solid #1a1a1a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((it, i) => {
              const val = it.key === "__otros__" ? otros : getValue(it.key)
              const pct = total > 0 ? (val / total) * 100 : 0
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0d0d0d" }}>
                  <td style={{ padding: "4px 8px", fontSize: 10, color: "#ccc" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, background: it.color, borderRadius: 1, marginRight: 6 }} />
                    {it.label}
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
  var1?: number | null; var1Label?: string
  var2?: number | null; var2Label?: string
  valueColor?: string
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
  tabs: { key: string; label: string }[]
  active: string
  onChange: (k: string) => void
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222", marginBottom: 1 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? "#0d0d0d" : "transparent",
          color: active === t.key ? "#FFA028" : "#555",
          border: "none",
          borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
          padding: "6px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── FiscalSankeyView ──────────────────────────────────────────────────────────

export function FiscalSankeyView() {
  const [fiscalData, setFiscalData]   = useState<FiscalData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState<string>("")
  const [mainTab, setMainTab]         = useState<"flujo" | "distribucion" | "cashflow" | "ahorro">("flujo")
  const [hoveredLink, setHoveredLink] = useState<number | null>(null)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [dimensions, setDimensions]   = useState({ width: 900, height: 500 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setDimensions({ width: Math.max(w, 500), height: Math.max(Math.min(w * 0.54, 560), 360) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // ── Entradas Bloomberg (Tab 1) ──────────────────────────────────────────────
  const incomeRaw: [string, number][] = [
    ["IVA",           iva],
    ["Ganancias",     ganancias],
    ["Seg. Social",   segSocial],
    ["Déb./Créd.",    debCred],
    ["Comercio Ext.", derExpo + derImpo],
    ["Otros Imp.",    otrosRec + bsPersonales],
  ]
  const incomeEntries = incomeRaw.filter(([, v]) => v > 0)
  const totalIngresos = incomeEntries.reduce((s, [, v]) => s + v, 0)
  const gastoTotal    = totalIngresos + Math.abs(resPrimario < 0 ? resPrimario : 0)
  const expenseRaw: [string, number][] = [
    ["Jubilaciones y Pensiones",  gastoTotal * 0.42],
    ["Transferencias Provincias", gastoTotal * 0.18],
    ["Salarios Públicos",         gastoTotal * 0.11],
    ["Subsidios Energía",         gastoTotal * 0.06],
    ["Educación y Cultura",       gastoTotal * 0.05],
    ["Salud",                     gastoTotal * 0.04],
    ["Defensa y Seguridad",       gastoTotal * 0.03],
    ["Obra Pública",              gastoTotal * 0.03],
    ["Intereses Deuda",           Math.abs(resFinanciero - resPrimario)],
    ["Otros Gastos",              gastoTotal * 0.05],
  ]
  const expenseEntries = expenseRaw.filter(([, v]) => v > 0)
  const totalGastos    = expenseEntries.reduce((s, [, v]) => s + v, 0)
  const superavit      = resPrimario > 0 ? resPrimario : 0

  // Bloomberg stroke layout
  const rawNodes: RawNode[] = []
  const rawLinks: RawLink[] = []
  incomeEntries.forEach(([name]) => rawNodes.push({ name, column: 0, color: INCOME_COLORS[name] ?? "#6C9BFF" }))
  rawNodes.push({ name: "TESORO NACIONAL", column: 1, color: "#FFA028" })
  expenseEntries.forEach(([name]) => rawNodes.push({ name, column: 2, color: EXPENSE_COLORS[name] ?? "#666" }))
  if (superavit > 0) rawNodes.push({ name: "SUPERÁVIT", column: 2, color: "#4AF6C3" })
  const tesoroIdx = incomeEntries.length
  incomeEntries.forEach(([, value], i) => rawLinks.push({ source: i, target: tesoroIdx, value }))
  expenseEntries.forEach(([, value], i) => rawLinks.push({ source: tesoroIdx, target: tesoroIdx + 1 + i, value }))
  if (superavit > 0) rawLinks.push({ source: tesoroIdx, target: tesoroIdx + 1 + expenseEntries.length, value: superavit })

  const margin = { top: 20, right: 190, bottom: 16, left: 190 }
  const innerW = Math.max(dimensions.width  - margin.left - margin.right, 200)
  const innerH = Math.max(dimensions.height - margin.top  - margin.bottom, 200)
  const strokeLayout = strokeSankeyLayout({ nodes: rawNodes, links: rawLinks, width: innerW, height: innerH, nodePadding: 7, nodeWidth: 14 })

  // ── Datos ribbon (Tabs 2-4) ─────────────────────────────────────────────────
  const LEFT_NODES: SNode[] = [
    { id: "iva",           label: "IVA",         col: 0, color: "#4AF6C3" },
    { id: "ganancias",     label: "Ganancias",   col: 0, color: "#FFA028" },
    { id: "seg_social",    label: "Seg. Social", col: 0, color: "#7C83FD" },
    { id: "deb_cred",      label: "Déb/Créd",    col: 0, color: "#4FC3F7" },
    { id: "der_expo",      label: "Der. Expo.",  col: 0, color: "#FFD54F" },
    { id: "der_impo",      label: "Der. Impo.",  col: 0, color: "#CE93D8" },
    { id: "bs_personales", label: "Bs. Pers.",   col: 0, color: "#F48FB1" },
    { id: "otros",         label: "Otros",       col: 0, color: "#444"    },
  ]

  const buildTaxLinks = (centerId: string): SLink[] => [
    { source: "iva",           target: centerId, value: iva },
    { source: "ganancias",     target: centerId, value: ganancias },
    { source: "seg_social",    target: centerId, value: segSocial },
    { source: "deb_cred",      target: centerId, value: debCred },
    { source: "der_expo",      target: centerId, value: derExpo },
    { source: "der_impo",      target: centerId, value: derImpo },
    { source: "bs_personales", target: centerId, value: bsPersonales },
    { source: "otros",         target: centerId, value: otrosRec },
  ].filter(l => l.value > 0)

  const buildDistribucion = (): { nodes: SNode[]; links: SLink[] } => {
    const copart = Math.max(0, totalRec - segSocial - derExpo)
    return {
      nodes: [
        ...LEFT_NODES,
        { id: "recaudacion", label: "RECAUDACIÓN", col: 1, color: "#FFA028" },
        { id: "tesoro",      label: "Tesoro Nac.", col: 2, color: "#4AF6C3" },
        { id: "provincias",  label: "Provincias",  col: 2, color: "#4FC3F7" },
        { id: "anses",       label: "ANSeS",       col: 2, color: "#7C83FD" },
        { id: "caba_atn",    label: "CABA + ATN",  col: 2, color: "#FFD54F" },
      ],
      links: [
        ...buildTaxLinks("recaudacion"),
        { source: "recaudacion", target: "tesoro",     value: derExpo + copart * 0.4234 },
        { source: "recaudacion", target: "provincias", value: copart * 0.5666 },
        { source: "recaudacion", target: "anses",      value: segSocial },
        { source: "recaudacion", target: "caba_atn",   value: copart * 0.024 },
      ].filter(l => l.value > 0),
    }
  }

  const buildCashflow = (): { nodes: SNode[]; links: SLink[] } => ({
    nodes: [
      ...LEFT_NODES,
      { id: "tesoro_cf",    label: "TESORO",       col: 1, color: "#FFA028" },
      { id: "jubilaciones", label: "Jubilaciones", col: 2, color: "#7C83FD" },
      { id: "trans_prov",   label: "Trans. Prov.", col: 2, color: "#4FC3F7" },
      { id: "salarios",     label: "Salarios",     col: 2, color: "#4AF6C3" },
      { id: "subsidios",    label: "Subsidios",    col: 2, color: "#FFD54F" },
      { id: "deuda",        label: "Deuda",        col: 2, color: "#FF433D" },
      { id: "otros_gasto",  label: "Otros Gastos", col: 2, color: "#444"    },
    ],
    links: [
      ...buildTaxLinks("tesoro_cf"),
      { source: "tesoro_cf", target: "jubilaciones", value: totalRec * 0.38 },
      { source: "tesoro_cf", target: "trans_prov",   value: totalRec * 0.18 },
      { source: "tesoro_cf", target: "salarios",     value: totalRec * 0.12 },
      { source: "tesoro_cf", target: "subsidios",    value: totalRec * 0.08 },
      { source: "tesoro_cf", target: "deuda",        value: totalRec * 0.15 },
      { source: "tesoro_cf", target: "otros_gasto",  value: totalRec * 0.09 },
    ].filter(l => l.value > 0),
  })

  const buildAhorro = (): { nodes: SNode[]; links: SLink[] } => {
    const tributarios   = totalRec * 0.62
    const noTributarios = totalRec * 0.04
    const rentas        = totalRec * 0.03
    const otrosI        = Math.max(0, totalRec - tributarios - segSocial - noTributarios - rentas)
    const gastoA        = totalRec + Math.abs(resPrimario)
    return {
      nodes: [
        { id: "tributarios", label: "Tributarios",    col: 0, color: "#4AF6C3" },
        { id: "seg_soc_ai",  label: "Seg. Social",    col: 0, color: "#7C83FD" },
        { id: "no_trib",     label: "No Tributarios", col: 0, color: "#FFA028" },
        { id: "rentas",      label: "Rentas Prop.",   col: 0, color: "#FFD54F" },
        { id: "otros_ing",   label: "Otros",          col: 0, color: "#444"    },
        { id: "ingresos",    label: "INGRESOS",       col: 1, color: "#4AF6C3" },
        { id: "prest_soc",   label: "Prest. Soc.",    col: 2, color: "#7C83FD" },
        { id: "funcionam",   label: "Funcionam.",     col: 2, color: "#4FC3F7" },
        { id: "transf",      label: "Transferencias", col: 2, color: "#FFA028" },
        { id: "cap_inv",     label: "Cap. Inversión", col: 2, color: "#4AF6C3" },
        { id: "intereses",   label: "Intereses",      col: 2, color: "#FF433D" },
      ],
      links: [
        { source: "tributarios", target: "ingresos", value: tributarios   },
        { source: "seg_soc_ai",  target: "ingresos", value: segSocial     },
        { source: "no_trib",     target: "ingresos", value: noTributarios },
        { source: "rentas",      target: "ingresos", value: rentas        },
        { source: "otros_ing",   target: "ingresos", value: otrosI        },
        { source: "ingresos", target: "prest_soc", value: gastoA * 0.41 },
        { source: "ingresos", target: "funcionam", value: gastoA * 0.18 },
        { source: "ingresos", target: "transf",    value: gastoA * 0.22 },
        { source: "ingresos", target: "cap_inv",   value: gastoA * 0.07 },
        { source: "ingresos", target: "intereses", value: gastoA * 0.12 },
      ].filter(l => l.value > 0),
    }
  }

  const ribbonData =
    mainTab === "distribucion" ? buildDistribucion() :
    mainTab === "cashflow"     ? buildCashflow()     :
    mainTab === "ahorro"       ? buildAhorro()       :
    { nodes: [], links: [] }

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

      {/* KPI Row compartida */}
      <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
        <KPI label="Recaudación Total"    value={fmtM(totalRec)}      unit={`ARS · ${period.slice(0, 7)}`}  valueColor="#FFA028" />
        <KPI label="Resultado Primario"   value={fmtM(resPrimario)}   unit="SPN no financiero · base caja"  valueColor={resPrimario  >= 0 ? "#4AF6C3" : "#FF433D"} />
        <KPI label="Resultado Financiero" value={fmtM(resFinanciero)} unit="Incluyendo intereses de deuda"   valueColor={resFinanciero >= 0 ? "#4AF6C3" : "#FF433D"} />
      </div>

      {/* Navegación de pestañas */}
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

      {/* ══ TAB 1: Bloomberg stroke-based ══ */}
      {mainTab === "flujo" && (
        <div style={{ background: "#0A0A0A", color: "#E0E0E0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1, background: "#1A1A1A" }}>
            {[
              { label: "INGRESOS TOTALES",    value: totalIngresos,  color: "#4AF6C3" },
              { label: "GASTOS TOTALES",      value: totalGastos,    color: "#FF433D" },
              { label: "RESULTADO PRIMARIO",  value: resPrimario,    color: resPrimario  >= 0 ? "#4AF6C3" : "#FF433D" },
              { label: "RESULTADO FINANCIERO",value: resFinanciero,  color: resFinanciero >= 0 ? "#4AF6C3" : "#FF433D" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#0D0D0D", padding: "10px 14px" }}>
                <div style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2, fontFamily: "inherit" }}>{fmtFull(value)}</div>
                <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>$ millones</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 4px" }}>
            <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>← FUENTES DE INGRESO</div>
            <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>TESORO</div>
            <div style={{ fontSize: 9, color: "#FF433D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>DESTINO DEL GASTO →</div>
          </div>

          <div ref={containerRef} style={{ overflow: "hidden" }}>
            <svg width={dimensions.width} height={dimensions.height} style={{ display: "block" }}>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {strokeLayout.links.map((lk, i) => {
                  const isHov  = hoveredLink === i || hoveredNode === lk.source._i || hoveredNode === lk.target._i
                  const anyHov = hoveredLink !== null || hoveredNode !== null
                  const opacity = anyHov ? (isHov ? 0.45 : 0.05) : 0.22
                  return (
                    <path key={i} d={linkPath(lk)} fill="none"
                      stroke={lk.source.color} strokeWidth={Math.max(lk.width, 1)} strokeOpacity={opacity}
                      onMouseEnter={() => setHoveredLink(i)} onMouseLeave={() => setHoveredLink(null)}
                      style={{ cursor: "pointer", transition: "stroke-opacity 0.18s" }} />
                  )
                })}
                {strokeLayout.nodes.map((nd, i) => {
                  const isHov    = hoveredNode === i
                  const nodeH    = Math.max(nd.y1 - nd.y0, 2)
                  const midY     = (nd.y0 + nd.y1) / 2
                  const isLeft   = nd._col === 0
                  const isCenter = nd._col === 1
                  const isRight  = nd._col === 2
                  const pctBase  = isLeft ? totalIngresos : totalGastos
                  const pct      = pctBase > 0 ? ((nd.value / pctBase) * 100).toFixed(1) : null
                  return (
                    <g key={i} onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: "pointer" }}>
                      <rect x={nd.x0} y={nd.y0} width={nd.x1 - nd.x0} height={nodeH}
                        fill={nd.color} fillOpacity={isHov ? 1 : 0.85} rx={2} style={{ transition: "fill-opacity 0.18s" }}>
                        <title>{nd.name}: {fmtFull(nd.value)}</title>
                      </rect>
                      {isCenter && (
                        <>
                          <rect x={nd.x0 - 2} y={nd.y0 - 2} width={nd.x1 - nd.x0 + 4} height={nodeH + 4}
                            fill="none" stroke="#FFA028" strokeWidth={1} strokeOpacity={0.3} rx={3} />
                          <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 12} textAnchor="middle" fill="#FFA028" fontSize={9} fontWeight={700} fontFamily="inherit">{nd.name}</text>
                          <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 2}  textAnchor="middle" fill="#666"    fontSize={8}             fontFamily="inherit">{fmtMM(nd.value)}</text>
                        </>
                      )}
                      {isLeft && nodeH > 8 && (
                        <>
                          <text x={nd.x0 - 8} y={midY - 5} textAnchor="end" fill={nd.color} fontSize={9} fontWeight={600} fontFamily="inherit">{nd.name}</text>
                          <text x={nd.x0 - 8} y={midY + 7} textAnchor="end" fill="#666"     fontSize={8}             fontFamily="inherit">{fmtMM(nd.value)} · {pct}%</text>
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

          {hoveredLink !== null && strokeLayout.links[hoveredLink] && (() => {
            const lk = strokeLayout.links[hoveredLink]
            return (
              <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", border: "1px solid #333", borderRadius: 6, padding: "8px 16px", fontSize: 10, color: "#E0E0E0", pointerEvents: "none", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", fontFamily: "inherit" }}>
                <span style={{ color: lk.source.color, fontWeight: 700 }}>{lk.source.name}</span>
                <span style={{ color: "#555", margin: "0 8px" }}>→</span>
                <span style={{ color: lk.target.color, fontWeight: 700 }}>{lk.target.name}</span>
                <span style={{ color: "#FFA028", marginLeft: 12, fontWeight: 700 }}>{fmtFull(lk.value)}</span>
              </div>
            )
          })()}

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

      {/* ══ TABS 2-4: Ribbon clásico ══ */}
      {(mainTab === "distribucion" || mainTab === "cashflow" || mainTab === "ahorro") && (
        <div>
          {mainTab === "distribucion" && (
            <div style={{ padding: "5px 12px", background: "#001507", borderLeft: "3px solid #4AF6C3", fontSize: 9, color: "#4AF6C3", lineHeight: 1.6 }}>
              Seg. Social → ANSeS 100%. Der. Exportación → Tesoro 100%. Resto según Ley 23548: Tesoro 42.34% · Provincias 56.66% · CABA 1.40% · ATN 1%.{" "}
              <a href="http://www.cfi.gov.ar/Coparticipacion/Indices.aspx" target="_blank" rel="noopener" style={{ color: "#4AF6C3" }}>Ver CFI →</a>
            </div>
          )}
          {mainTab === "cashflow" && (
            <div style={{ padding: "5px 12px", background: "#1a0800", borderLeft: "3px solid #FFA028", fontSize: 9, color: "#FFA028", lineHeight: 1.6 }}>
              ⚠ SIMPLIFICACIÓN DIDÁCTICA — Combina base caja (ARCA) con base devengado (Presupuesto). Gastos son proporciones aproximadas. No cierra contablemente.
            </div>
          )}
          {mainTab === "ahorro" && (
            <div style={{ padding: "5px 12px", background: "#08001a", borderLeft: "3px solid #7C83FD", fontSize: 9, color: "#7C83FD", lineHeight: 1.6 }}>
              ⚠ PROPORCIONES ESTIMADAS — Ingresos por categoría y gastos son aproximaciones. Fuente real: Esquema A-I-F (Sec. de Hacienda, Ministerio de Economía).
            </div>
          )}

          <div className="bbg-panel" style={{ marginTop: 0, borderTop: "none" }}>
            <div className="bbg-panel-header">
              {mainTab === "distribucion" ? "DISTRIBUCIÓN FEDERAL DE LA RECAUDACIÓN" :
               mainTab === "cashflow"     ? "CASHFLOW SIMPLIFICADO — TESORO NACIONAL" :
               "ESQUEMA AHORRO-INVERSIÓN — SPN NO FINANCIERO"}
              <span style={{ fontSize: 8, fontWeight: 400, color: "#555", marginLeft: 8 }}>{period.slice(0, 7)}</span>
            </div>
            <div style={{ padding: "8px 0 4px" }}>
              <RibbonSankeyChart nodes={ribbonData.nodes} links={ribbonData.links} height={440} formatValue={fmtM} />
            </div>
          </div>

          {mainTab === "distribucion" && (
            <BreakdownTable getValue={getValue} total={totalRec} period={period} />
          )}

          <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
            Fuente: apis.datos.gob.ar · ARCA · Informe Mensual SPN (dataset 452) · Seg. Social + Total: dataset 172 · Resultados: datasets 378/379
          </div>
        </div>
      )}
    </div>
  )
}
