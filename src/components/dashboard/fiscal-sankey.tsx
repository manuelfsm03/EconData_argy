/**
 * FiscalSankeyView — Diagrama Sankey fiscal (Cashflow · Distribución Federal)
 * Diseño: Bloomberg dark + Sankey estilo d3 (stroke-based, no filled ribbons)
 * Datos: APIs datos.gob.ar — series ARCA desagregadas (dataset 452) + resultados fiscales
 */

"use client"

import { useState, useEffect, useRef } from "react"

// ── Types ──────────────────────────────────────────────────────────────────────

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

const fmtFull = (v: number) => `$${Math.abs(v).toLocaleString("es-AR")} M`

function fmtMM(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}B`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}MM`
  return `${s}$${Math.round(a)}`
}

// ── Color schemes ─────────────────────────────────────────────────────────────

const INCOME_COLORS: Record<string, string> = {
  "IVA":            "#4AF6C3",
  "Ganancias":      "#36D6B0",
  "Seg. Social":    "#2BB89E",
  "Déb./Créd.":     "#FFA028",
  "Comercio Ext.":  "#FF8C42",
  "Combustibles":   "#FFD166",
  "Otros Imp.":     "#6C9BFF",
  "Otros":          "#6C9BFF",
}

const EXPENSE_COLORS: Record<string, string> = {
  "Jubilaciones y Pensiones":   "#FF6B6B",
  "Transferencias Provincias":  "#FF433D",
  "Salarios Públicos":          "#E8425A",
  "Subsidios Energía":          "#FF8888",
  "Educación y Cultura":        "#C77DFF",
  "Salud":                      "#A855F7",
  "Defensa y Seguridad":        "#7C6EAB",
  "Obra Pública":               "#FF6B9D",
  "Intereses Deuda":            "#B91C1C",
  "Otros Gastos":               "#666",
}

// ── Sankey Layout Engine ───────────────────────────────────────────────────────
// Stroke-based (estilo d3-sankey): links son líneas con strokeWidth, no ribbons

function sankeyLayout({
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

  // Wire up
  n.forEach(nd => { nd.sourceLinks = []; nd.targetLinks = [] })
  l.forEach(lk => {
    lk.source.sourceLinks.push(lk)
    lk.target.targetLinks.push(lk)
  })
  n.forEach(nd => {
    nd.value = Math.max(
      nd.sourceLinks.reduce((s, lk) => s + lk.value, 0),
      nd.targetLinks.reduce((s, lk) => s + lk.value, 0),
    )
  })

  // Column x positions
  const colKeys = [...new Set(n.map(nd => nd._col))].sort((a, b) => a - b)
  const numCols = colKeys.length
  const cols: Record<number, LayoutNode[]> = {}
  colKeys.forEach(c => { cols[c] = n.filter(nd => nd._col === c) })

  colKeys.forEach((col, ci) => {
    const x0 = ci * ((width - nodeWidth) / Math.max(numCols - 1, 1))
    cols[col].forEach(nd => { nd.x0 = x0; nd.x1 = x0 + nodeWidth })
  })

  // Vertical scale
  const maxColVal = Math.max(...colKeys.map(c => cols[c].reduce((s, nd) => s + nd.value, 0)))
  const maxNodes  = Math.max(...colKeys.map(c => cols[c].length))
  const scale = (height - (maxNodes - 1) * nodePadding) / maxColVal

  colKeys.forEach(col => {
    const colNodes = cols[col].slice().sort((a, b) => b.value - a.value)
    let y = 0
    colNodes.forEach(nd => {
      nd.y0 = y
      nd.y1 = y + nd.value * scale
      y = nd.y1 + nodePadding
    })
    const offset = (height - (y - nodePadding)) / 2
    if (offset > 0) colNodes.forEach(nd => { nd.y0 += offset; nd.y1 += offset })
  })

  // Link y-offsets (center of stroke)
  colKeys.forEach(col => {
    cols[col].forEach(nd => {
      let sy = nd.y0
      nd.sourceLinks
        .slice().sort((a, b) => a.target.y0 - b.target.y0)
        .forEach(lk => {
          lk.width = lk.value * scale
          lk.y0 = sy + lk.width / 2
          sy += lk.width
        })
      let ty = nd.y0
      nd.targetLinks
        .slice().sort((a, b) => a.source.y0 - b.source.y0)
        .forEach(lk => {
          lk.y1 = ty + lk.width / 2
          ty += lk.width
        })
    })
  })

  return { nodes: n, links: l }
}

function linkPath(lk: LayoutLink): string {
  const sx = lk.source.x1, tx = lk.target.x0
  const mx = (sx + tx) / 2
  return `M${sx},${lk.y0} C${mx},${lk.y0} ${mx},${lk.y1} ${tx},${lk.y1}`
}

// ── FiscalSankeyView ──────────────────────────────────────────────────────────

export function FiscalSankeyView() {
  const [fiscalData, setFiscalData]   = useState<FiscalData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState<string>("")
  const [hoveredLink, setHoveredLink] = useState<number | null>(null)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [dimensions, setDimensions]   = useState({ width: 900, height: 500 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setDimensions({
        width:  Math.max(w - 0, 500),
        height: Math.max(Math.min(w * 0.54, 560), 360),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fetch API
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

  // ── Valores del período ─────────────────────────────────────────────────────
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

  const otrosIng = Math.max(0, totalRec - iva - ganancias - segSocial - debCred - derExpo - derImpo - bsPersonales)

  // Ingresos
  const incomeRaw: [string, number][] = [
    ["IVA",           iva],
    ["Ganancias",     ganancias],
    ["Seg. Social",   segSocial],
    ["Déb./Créd.",    debCred],
    ["Comercio Ext.", derExpo + derImpo],
    ["Otros Imp.",    otrosIng + bsPersonales],
  ]
  const incomeEntries = incomeRaw.filter(([, v]) => v > 0)

  const totalIngresos = incomeEntries.reduce((s, [, v]) => s + v, 0)

  // Gastos aproximados (proporciones presupuesto vigente)
  const gastoTotal = totalIngresos + Math.abs(resPrimario < 0 ? resPrimario : 0)
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

  const totalGastos = expenseEntries.reduce((s, [, v]) => s + v, 0)
  const superavit   = resPrimario > 0 ? resPrimario : 0

  // ── Construir nodos y links ─────────────────────────────────────────────────
  const rawNodes: RawNode[] = []
  const rawLinks: RawLink[] = []

  incomeEntries.forEach(([name]) =>
    rawNodes.push({ name, column: 0, color: INCOME_COLORS[name] ?? "#6C9BFF" })
  )
  rawNodes.push({ name: "TESORO NACIONAL", column: 1, color: "#FFA028" })
  expenseEntries.forEach(([name]) =>
    rawNodes.push({ name, column: 2, color: EXPENSE_COLORS[name] ?? "#666" })
  )
  if (superavit > 0)
    rawNodes.push({ name: "SUPERÁVIT", column: 2, color: "#4AF6C3" })

  const tesoroIdx = incomeEntries.length
  incomeEntries.forEach(([, value], i) =>
    rawLinks.push({ source: i, target: tesoroIdx, value })
  )
  expenseEntries.forEach(([, value], i) =>
    rawLinks.push({ source: tesoroIdx, target: tesoroIdx + 1 + i, value })
  )
  if (superavit > 0)
    rawLinks.push({ source: tesoroIdx, target: tesoroIdx + 1 + expenseEntries.length, value: superavit })

  // ── Layout ─────────────────────────────────────────────────────────────────
  const margin   = { top: 20, right: 190, bottom: 16, left: 190 }
  const innerW   = Math.max(dimensions.width  - margin.left - margin.right, 200)
  const innerH   = Math.max(dimensions.height - margin.top  - margin.bottom, 200)

  const layout = sankeyLayout({
    nodes: rawNodes, links: rawLinks,
    width: innerW, height: innerH,
    nodePadding: 7, nodeWidth: 14,
  })

  const getNodeColor = (nd: LayoutNode) => nd.color
  const getLinkColor = (lk: LayoutLink) => getNodeColor(lk.source)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0A0A0A", fontFamily: "'JetBrains Mono','SF Mono','Fira Code',monospace", color: "#E0E0E0" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#111 0%,#0A0A0A 100%)", borderBottom: "1px solid #1A1A1A", padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>
              Sector Público Nacional · Flujo Fiscal
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#FFA028", marginTop: 2 }}>
              CASHFLOW FISCAL — {period.slice(0, 7).toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* Period selector */}
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{ background: "#111", color: "#E0E0E0", border: "1px solid #222", padding: "5px 8px", fontSize: 10, fontFamily: "inherit", borderRadius: 4, cursor: "pointer" }}
            >
              {periods.map(p => <option key={p} value={p}>{p.slice(0, 7)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1, background: "#1A1A1A" }}>
        {[
          { label: "INGRESOS TOTALES",    value: totalIngresos,   color: "#4AF6C3" },
          { label: "GASTOS TOTALES",      value: totalGastos,     color: "#FF433D" },
          { label: "RESULTADO PRIMARIO",  value: resPrimario,     color: resPrimario >= 0 ? "#4AF6C3" : "#FF433D" },
          { label: "RESULTADO FINANCIERO",value: resFinanciero,   color: resFinanciero >= 0 ? "#4AF6C3" : "#FF433D" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#0D0D0D", padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2, fontFamily: "inherit" }}>
              {fmtFull(value)}
            </div>
            <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>$ millones</div>
          </div>
        ))}
      </div>

      {/* Section labels */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 4px", marginBottom: 0 }}>
        <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>← FUENTES DE INGRESO</div>
        <div style={{ fontSize: 9, color: "#FFA028", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>TESORO</div>
        <div style={{ fontSize: 9, color: "#FF433D", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>DESTINO DEL GASTO →</div>
      </div>

      {/* Sankey SVG */}
      <div ref={containerRef} style={{ overflow: "hidden", padding: "0" }}>
        <svg width={dimensions.width} height={dimensions.height} style={{ display: "block" }}>
          <g transform={`translate(${margin.left},${margin.top})`}>

            {/* Links */}
            {layout.links.map((lk, i) => {
              const isHov = hoveredLink === i || hoveredNode === lk.source._i || hoveredNode === lk.target._i
              const anyHov = hoveredLink !== null || hoveredNode !== null
              const opacity = anyHov ? (isHov ? 0.45 : 0.05) : 0.22
              return (
                <path
                  key={i}
                  d={linkPath(lk)}
                  fill="none"
                  stroke={getLinkColor(lk)}
                  strokeWidth={Math.max(lk.width, 1)}
                  strokeOpacity={opacity}
                  onMouseEnter={() => setHoveredLink(i)}
                  onMouseLeave={() => setHoveredLink(null)}
                  style={{ cursor: "pointer", transition: "stroke-opacity 0.18s" }}
                />
              )
            })}

            {/* Nodes */}
            {layout.nodes.map((nd, i) => {
              const isHov    = hoveredNode === i
              const color    = getNodeColor(nd)
              const nodeH    = Math.max(nd.y1 - nd.y0, 2)
              const midY     = (nd.y0 + nd.y1) / 2
              const isLeft   = nd._col === 0
              const isCenter = nd._col === 1
              const isRight  = nd._col === 2
              const pctBase  = isLeft ? totalIngresos : totalGastos
              const pct      = pctBase > 0 ? ((nd.value / pctBase) * 100).toFixed(1) : null

              return (
                <g key={i}
                  onMouseEnter={() => setHoveredNode(i)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={nd.x0} y={nd.y0}
                    width={nd.x1 - nd.x0} height={nodeH}
                    fill={color} fillOpacity={isHov ? 1 : 0.85} rx={2}
                    style={{ transition: "fill-opacity 0.18s" }}
                  >
                    <title>{nd.name}: {fmtFull(nd.value)}</title>
                  </rect>

                  {/* Center node: glow border + label above */}
                  {isCenter && (
                    <>
                      <rect
                        x={nd.x0 - 2} y={nd.y0 - 2}
                        width={nd.x1 - nd.x0 + 4} height={nodeH + 4}
                        fill="none" stroke="#FFA028" strokeWidth={1} strokeOpacity={0.3} rx={3}
                      />
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 12}
                        textAnchor="middle" fill="#FFA028" fontSize={9} fontWeight={700} fontFamily="inherit">
                        {nd.name}
                      </text>
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 2}
                        textAnchor="middle" fill="#666" fontSize={8} fontFamily="inherit">
                        {fmtMM(nd.value)}
                      </text>
                    </>
                  )}

                  {/* Left nodes: label right-aligned */}
                  {isLeft && nodeH > 8 && (
                    <>
                      <text x={nd.x0 - 8} y={midY - 5}
                        textAnchor="end" fill={color} fontSize={9} fontWeight={600} fontFamily="inherit">
                        {nd.name}
                      </text>
                      <text x={nd.x0 - 8} y={midY + 7}
                        textAnchor="end" fill="#666" fontSize={8} fontFamily="inherit">
                        {fmtMM(nd.value)} · {pct}%
                      </text>
                    </>
                  )}

                  {/* Right nodes: label left-aligned */}
                  {isRight && nodeH > 8 && (
                    <>
                      <text x={nd.x1 + 8} y={midY - 5}
                        textAnchor="start" fill={color} fontSize={9} fontWeight={600} fontFamily="inherit">
                        {nd.name}
                      </text>
                      <text x={nd.x1 + 8} y={midY + 7}
                        textAnchor="start" fill="#666" fontSize={8} fontFamily="inherit">
                        {fmtMM(nd.value)}{pct ? ` · ${pct}%` : ""}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredLink !== null && layout.links[hoveredLink] && (() => {
        const lk = layout.links[hoveredLink]
        return (
          <div style={{
            position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
            background: "#1A1A1A", border: "1px solid #333", borderRadius: 6,
            padding: "8px 16px", fontSize: 10, color: "#E0E0E0",
            pointerEvents: "none", zIndex: 100, whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)", fontFamily: "inherit",
          }}>
            <span style={{ color: getNodeColor(lk.source), fontWeight: 700 }}>{lk.source.name}</span>
            <span style={{ color: "#555", margin: "0 8px" }}>→</span>
            <span style={{ color: getNodeColor(lk.target), fontWeight: 700 }}>{lk.target.name}</span>
            <span style={{ color: "#FFA028", marginLeft: 12, fontWeight: 700 }}>{fmtFull(lk.value)}</span>
          </div>
        )
      })()}

      {/* Breakdown tables: ingresos + gastos side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1A1A1A", borderTop: "1px solid #1A1A1A" }}>

        {/* Ingresos */}
        <div style={{ background: "#0D0D0D", padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#4AF6C3", letterSpacing: 1.5, marginBottom: 6, fontWeight: 700 }}>
            COMPOSICIÓN DE INGRESOS
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[...incomeEntries].sort((a, b) => b[1] - a[1]).map(([name, value]) => (
                <tr key={name} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={{ padding: "3px 0", fontSize: 10, color: INCOME_COLORS[name] ?? "#888" }}>{name}</td>
                  <td style={{ padding: "3px 0", fontSize: 10, color: "#E0E0E0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFull(value)}</td>
                  <td style={{ padding: "3px 0 3px 8px", fontSize: 9, color: "#555", textAlign: "right", width: 44 }}>
                    {((value / totalIngresos) * 100).toFixed(1)}%
                  </td>
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

        {/* Gastos */}
        <div style={{ background: "#0D0D0D", padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#FF433D", letterSpacing: 1.5, marginBottom: 6, fontWeight: 700 }}>
            COMPOSICIÓN DE GASTOS
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[...expenseEntries].sort((a, b) => b[1] - a[1]).map(([name, value]) => (
                <tr key={name} style={{ borderBottom: "1px solid #151515" }}>
                  <td style={{ padding: "3px 0", fontSize: 10, color: EXPENSE_COLORS[name] ?? "#888" }}>{name}</td>
                  <td style={{ padding: "3px 0", fontSize: 10, color: "#E0E0E0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtFull(value)}</td>
                  <td style={{ padding: "3px 0 3px 8px", fontSize: 9, color: "#555", textAlign: "right", width: 44 }}>
                    {((value / totalGastos) * 100).toFixed(1)}%
                  </td>
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

      {/* Footer */}
      <div style={{ padding: "7px 14px", borderTop: "1px solid #1A1A1A", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
        <div style={{ fontSize: 8, color: "#333" }}>
          FUENTE: ARCA · Subsec. Programación Macroeconómica · apis.datos.gob.ar · datasets 172 / 378 / 379 / 452
        </div>
        <div style={{ fontSize: 8, color: "#333" }}>
          ⚠ Gastos: proporciones estimadas (Presupuesto Abierto). Ingresos: datos reales ARCA.
        </div>
      </div>
    </div>
  )
}
