/**
 * FiscalSankeyView — Diagrama Sankey fiscal con 3 sub-vistas
 *
 * Tab 1: Distribución Federal (datos reales API)
 * Tab 2: Cashflow Didáctico  (simplificación con disclaimer)
 * Tab 3: Ahorro-Inversión    (proporciones estimadas con disclaimer)
 *
 * Nota: KPI y SubTabs son re-implementaciones locales (idénticas a tab-macro.tsx)
 * para evitar dependencia circular. Ver prompt para contexto.
 */

"use client"

import { useState, useEffect, useRef } from "react"

// ── Types ──────────────────────────────────────────────────────────────────────

type Serie = [string, number][]
type FiscalData = Record<string, Serie>

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}Bn`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}Mm`
  return `${s}$${Math.round(a)}M`
}

function fmtNum(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}

function varSign(v: number | null | undefined): string {
  if (v == null) return ""
  return v >= 0 ? "+" : ""
}

// ── KPI (local, idéntico a tab-macro.tsx) ─────────────────────────────────────

function KPI({
  label, value, unit, var1, var1Label, var2, var2Label, valueColor,
}: {
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

// ── SubTabs (local, idéntico a tab-macro.tsx) ─────────────────────────────────

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

// ── Sankey engine ─────────────────────────────────────────────────────────────

interface SNode { id: string; label: string; col: 0 | 1 | 2; color: string }
interface SLink { source: string; target: string; value: number }
interface PNode extends SNode { x: number; y: number; w: number; h: number }
interface PLink { path: string; color: string; value: number; srcLabel: string; tgtLabel: string }

function sankeyLayout(
  nodes: SNode[],
  links: SLink[],
  svgW: number,
  svgH: number,
): { pnodes: PNode[]; plinks: PLink[] } {
  const NODE_W = 112
  const COL_GAP = 10
  const PAD_V = 20
  const availH = svgH - PAD_V * 2

  const colX = (col: number): number => {
    if (col === 0) return 24
    if (col === 1) return Math.round((svgW - NODE_W) / 2)
    return svgW - NODE_W - 24
  }

  // Compute per-node in/out totals
  const nodeIn: Record<string, number> = {}
  const nodeOut: Record<string, number> = {}
  for (const n of nodes) { nodeIn[n.id] = 0; nodeOut[n.id] = 0 }
  for (const l of links) {
    nodeOut[l.source] = (nodeOut[l.source] ?? 0) + l.value
    nodeIn[l.target]  = (nodeIn[l.target]  ?? 0) + l.value
  }
  const nodeVal = (id: string, col: number): number => {
    if (col === 0) return nodeOut[id] ?? 0
    if (col === 2) return nodeIn[id]  ?? 0
    return Math.max(nodeIn[id] ?? 0, nodeOut[id] ?? 0) // center: max of in/out
  }

  // Position nodes within each column
  const pnodes: PNode[] = []
  for (const col of [0, 1, 2] as const) {
    const colNodes = nodes.filter(n => n.col === col)
    const total = colNodes.reduce((s, n) => s + nodeVal(n.id, col), 0)
    const gaps   = COL_GAP * Math.max(0, colNodes.length - 1)
    let y = PAD_V
    for (const n of colNodes) {
      const ratio = total > 0 ? nodeVal(n.id, col) / total : 1 / colNodes.length
      const h = Math.max(14, ratio * (availH - gaps))
      pnodes.push({ ...n, x: colX(col), y, w: NODE_W, h })
      y += h + COL_GAP
    }
  }

  // Draw ribbons, tracking vertical offsets per node
  const srcOff: Record<string, number> = {}
  const tgtOff: Record<string, number> = {}
  for (const pn of pnodes) { srcOff[pn.id] = pn.y; tgtOff[pn.id] = pn.y }

  const plinks: PLink[] = []
  for (const l of links) {
    if (l.value <= 0) continue
    const src = pnodes.find(n => n.id === l.source)
    const tgt = pnodes.find(n => n.id === l.target)
    if (!src || !tgt) continue

    const hs = (l.value / (nodeOut[l.source] || 1)) * src.h
    const ht = (l.value / (nodeIn[l.target]  || 1)) * tgt.h
    const x0 = src.x + src.w, y0 = srcOff[l.source]
    const x1 = tgt.x,         y1 = tgtOff[l.target]
    const cx = (x0 + x1) / 2
    const path = [
      `M${x0},${y0}`,
      `C${cx},${y0} ${cx},${y1} ${x1},${y1}`,
      `L${x1},${y1 + ht}`,
      `C${cx},${y1 + ht} ${cx},${y0 + hs} ${x0},${y0 + hs}`,
      `Z`,
    ].join(" ")

    srcOff[l.source] += hs
    tgtOff[l.target] += ht
    plinks.push({ path, color: src.color, value: l.value, srcLabel: src.label, tgtLabel: tgt.label })
  }

  return { pnodes, plinks }
}

// ── SankeyChart SVG ───────────────────────────────────────────────────────────

function SankeyChart({
  nodes, links, height = 440, formatValue,
}: {
  nodes: SNode[]
  links: SLink[]
  height?: number
  formatValue: (v: number) => string
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

  const { pnodes, plinks } = sankeyLayout(nodes, links, width, height)

  return (
    <div ref={containerRef} style={{ width: "100%", overflow: "hidden" }}>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Ribbons */}
        {plinks.map((pl, i) => (
          <g key={i}
            onMouseEnter={() => setHovered(`l${i}`)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <path
              d={pl.path}
              fill={pl.color}
              fillOpacity={hovered === `l${i}` ? 0.55 : 0.22}
              stroke="none"
              style={{ transition: "fill-opacity 0.15s" }}
            />
            <title>{pl.srcLabel} → {pl.tgtLabel}: {formatValue(pl.value)}</title>
          </g>
        ))}

        {/* Nodes */}
        {pnodes.map(pn => {
          const isHov = hovered === `n${pn.id}`
          return (
            <g key={pn.id}
              onMouseEnter={() => setHovered(`n${pn.id}`)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={pn.x} y={pn.y} width={pn.w} height={pn.h}
                fill={pn.color} fillOpacity={isHov ? 0.95 : 0.8} rx={2}
                style={{ transition: "fill-opacity 0.15s" }}
              >
                <title>{pn.label}: {formatValue(
                  links.filter(l => l.source === pn.id).reduce((s, l) => s + l.value, 0) ||
                  links.filter(l => l.target === pn.id).reduce((s, l) => s + l.value, 0)
                )}</title>
              </rect>

              {/* Label inside center nodes */}
              {pn.col === 1 && pn.h >= 18 && (
                <text
                  x={pn.x + pn.w / 2} y={pn.y + pn.h / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: Math.min(10, Math.max(7, pn.h / 2.8)), fill: "#000", fontWeight: 700, fontFamily: "monospace", pointerEvents: "none" }}
                >
                  {pn.label}
                </text>
              )}

              {/* Label to the left of left nodes */}
              {pn.col === 0 && pn.h >= 13 && (
                <text
                  x={pn.x - 5} y={pn.y + pn.h / 2}
                  textAnchor="end" dominantBaseline="middle"
                  style={{ fontSize: 8, fill: "#aaa", fontFamily: "monospace", pointerEvents: "none" }}
                >
                  {pn.label}
                </text>
              )}

              {/* Label to the right of right nodes */}
              {pn.col === 2 && pn.h >= 13 && (
                <text
                  x={pn.x + pn.w + 5} y={pn.y + pn.h / 2}
                  textAnchor="start" dominantBaseline="middle"
                  style={{ fontSize: 8, fill: "#aaa", fontFamily: "monospace", pointerEvents: "none" }}
                >
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

// ── Breakdown table ───────────────────────────────────────────────────────────

function BreakdownTable({ getValue, total, period }: {
  getValue: (key: string) => number
  total: number
  period: string
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

// ── FiscalSankeyView ──────────────────────────────────────────────────────────

export function FiscalSankeyView() {
  const [fiscalData, setFiscalData] = useState<FiscalData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [sankeyTab, setSankeyTab]   = useState<"distribucion" | "cashflow" | "ahorro">("distribucion")
  const [period, setPeriod]         = useState<string>("")

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

  const getValue = (key: string): number => {
    if (!fiscalData) return 0
    const entry = (fiscalData[key] ?? []).find(([d]) => d === period)
    return entry ? entry[1] : 0
  }

  const periods = (fiscalData?.recaudacion ?? []).map(([d]) => d).slice(0, 36)

  if (loading)     return <div style={{ padding: 40, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando datos fiscales...</div>
  if (!fiscalData) return <div style={{ padding: 24, color: "#444", fontSize: 11 }}>Sin datos disponibles</div>

  const total         = getValue("recaudacion")
  const resPrimario   = getValue("resultado_primario")
  const resFinanciero = getValue("resultado_financiero")

  // Nodos izquierdos comunes a los tres tabs
  const LEFT_NODES: SNode[] = [
    { id: "iva",           label: "IVA",           col: 0, color: "#4AF6C3" },
    { id: "ganancias",     label: "Ganancias",     col: 0, color: "#FFA028" },
    { id: "seg_social",    label: "Seg. Social",   col: 0, color: "#7C83FD" },
    { id: "deb_cred",      label: "Déb/Créd",      col: 0, color: "#4FC3F7" },
    { id: "der_expo",      label: "Der. Expo.",    col: 0, color: "#FFD54F" },
    { id: "der_impo",      label: "Der. Impo.",    col: 0, color: "#CE93D8" },
    { id: "bs_personales", label: "Bs. Pers.",     col: 0, color: "#F48FB1" },
    { id: "otros",         label: "Otros",         col: 0, color: "#444"    },
  ]

  const getTaxValues = () => {
    const iva          = getValue("rec_iva")
    const ganancias    = getValue("rec_ganancias")
    const segSocial    = getValue("rec_seg_social")
    const debCred      = getValue("rec_deb_cred")
    const derExpo      = getValue("rec_der_expo")
    const derImpo      = getValue("rec_der_impo")
    const bsPersonales = getValue("rec_bs_personales")
    const otros        = Math.max(0, total - iva - ganancias - segSocial - debCred - derExpo - derImpo - bsPersonales)
    return { iva, ganancias, segSocial, debCred, derExpo, derImpo, bsPersonales, otros }
  }

  const buildTaxLinks = (centerId: string): SLink[] => {
    const { iva, ganancias, segSocial, debCred, derExpo, derImpo, bsPersonales, otros } = getTaxValues()
    return [
      { source: "iva",           target: centerId, value: iva },
      { source: "ganancias",     target: centerId, value: ganancias },
      { source: "seg_social",    target: centerId, value: segSocial },
      { source: "deb_cred",      target: centerId, value: debCred },
      { source: "der_expo",      target: centerId, value: derExpo },
      { source: "der_impo",      target: centerId, value: derImpo },
      { source: "bs_personales", target: centerId, value: bsPersonales },
      { source: "otros",         target: centerId, value: otros },
    ].filter(l => l.value > 0)
  }

  // ── Tab 1: Distribución Federal ───────────────────────────────────────────
  const buildDistribucion = (): { nodes: SNode[]; links: SLink[] } => {
    const { segSocial, derExpo } = getTaxValues()
    // Masa coparticipable = total - seg.social (→ ANSeS) - der.expo (→ Tesoro directo)
    const copart = Math.max(0, total - segSocial - derExpo)
    const nodes: SNode[] = [
      ...LEFT_NODES,
      { id: "recaudacion", label: "RECAUDACIÓN",  col: 1, color: "#FFA028" },
      { id: "tesoro",      label: "Tesoro Nac.",  col: 2, color: "#4AF6C3" },
      { id: "provincias",  label: "Provincias",   col: 2, color: "#4FC3F7" },
      { id: "anses",       label: "ANSeS",        col: 2, color: "#7C83FD" },
      { id: "caba_atn",    label: "CABA + ATN",   col: 2, color: "#FFD54F" },
    ]
    const links: SLink[] = [
      ...buildTaxLinks("recaudacion"),
      // Distribución: Ley 23548 sobre masa coparticipable + afectaciones directas
      { source: "recaudacion", target: "tesoro",     value: derExpo + copart * 0.4234 },
      { source: "recaudacion", target: "provincias", value: copart * 0.5666 },
      { source: "recaudacion", target: "anses",      value: segSocial },
      { source: "recaudacion", target: "caba_atn",   value: copart * (0.014 + 0.01) },
    ].filter(l => l.value > 0)
    return { nodes, links }
  }

  // ── Tab 2: Cashflow Didáctico ─────────────────────────────────────────────
  const buildCashflow = (): { nodes: SNode[]; links: SLink[] } => {
    // Gastos: proporciones aproximadas del presupuesto vigente
    const nodes: SNode[] = [
      ...LEFT_NODES,
      { id: "tesoro_cf",    label: "TESORO",        col: 1, color: "#FFA028" },
      { id: "jubilaciones", label: "Jubilaciones",  col: 2, color: "#7C83FD" },
      { id: "trans_prov",   label: "Trans. Prov.",  col: 2, color: "#4FC3F7" },
      { id: "salarios",     label: "Salarios",      col: 2, color: "#4AF6C3" },
      { id: "subsidios",    label: "Subsidios",     col: 2, color: "#FFD54F" },
      { id: "deuda",        label: "Deuda",         col: 2, color: "#FF433D" },
      { id: "otros_gasto",  label: "Otros Gastos",  col: 2, color: "#444"    },
    ]
    const links: SLink[] = [
      ...buildTaxLinks("tesoro_cf"),
      { source: "tesoro_cf", target: "jubilaciones", value: total * 0.38 },
      { source: "tesoro_cf", target: "trans_prov",   value: total * 0.18 },
      { source: "tesoro_cf", target: "salarios",     value: total * 0.12 },
      { source: "tesoro_cf", target: "subsidios",    value: total * 0.08 },
      { source: "tesoro_cf", target: "deuda",        value: total * 0.15 },
      { source: "tesoro_cf", target: "otros_gasto",  value: total * 0.09 },
    ].filter(l => l.value > 0)
    return { nodes, links }
  }

  // ── Tab 3: Ahorro-Inversión ───────────────────────────────────────────────
  // TODO: series por categoría de ingreso/gasto no disponibles en datos.gob.ar.
  // Usar Esquema A-I-F de Sec. de Hacienda (Ministerio de Economía) cuando se publiquen.
  const buildAhorro = (): { nodes: SNode[]; links: SLink[] } => {
    const { segSocial } = getTaxValues()
    const tributarios   = total * 0.62
    const noTributarios = total * 0.04
    const rentas        = total * 0.03
    const otrosIng      = Math.max(0, total - tributarios - segSocial - noTributarios - rentas)
    const gastoTotal    = total + Math.abs(resPrimario)
    const nodes: SNode[] = [
      { id: "tributarios",    label: "Tributarios",    col: 0, color: "#4AF6C3" },
      { id: "seg_soc_ai",     label: "Seg. Social",    col: 0, color: "#7C83FD" },
      { id: "no_trib",        label: "No Tributarios", col: 0, color: "#FFA028" },
      { id: "rentas",         label: "Rentas Prop.",   col: 0, color: "#FFD54F" },
      { id: "otros_ing",      label: "Otros",          col: 0, color: "#444"    },
      { id: "ingresos",       label: "INGRESOS",       col: 1, color: "#4AF6C3" },
      { id: "prest_soc",      label: "Prest. Soc.",    col: 2, color: "#7C83FD" },
      { id: "funcionam",      label: "Funcionam.",     col: 2, color: "#4FC3F7" },
      { id: "transf",         label: "Transferencias", col: 2, color: "#FFA028" },
      { id: "cap_inv",        label: "Cap. Inversión", col: 2, color: "#4AF6C3" },
      { id: "intereses",      label: "Intereses",      col: 2, color: "#FF433D" },
    ]
    const links: SLink[] = [
      { source: "tributarios", target: "ingresos", value: tributarios   },
      { source: "seg_soc_ai",  target: "ingresos", value: segSocial     },
      { source: "no_trib",     target: "ingresos", value: noTributarios },
      { source: "rentas",      target: "ingresos", value: rentas        },
      { source: "otros_ing",   target: "ingresos", value: otrosIng      },
      { source: "ingresos", target: "prest_soc", value: gastoTotal * 0.41 },
      { source: "ingresos", target: "funcionam", value: gastoTotal * 0.18 },
      { source: "ingresos", target: "transf",    value: gastoTotal * 0.22 },
      { source: "ingresos", target: "cap_inv",   value: gastoTotal * 0.07 },
      { source: "ingresos", target: "intereses", value: gastoTotal * 0.12 },
    ].filter(l => l.value > 0)
    return { nodes, links }
  }

  const { nodes: sNodes, links: sLinks } =
    sankeyTab === "distribucion" ? buildDistribucion() :
    sankeyTab === "cashflow"     ? buildCashflow()     :
    buildAhorro()

  return (
    <div>
      {/* KPIs + Período */}
      <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap", alignItems: "stretch" }}>
        <KPI
          label="Recaudación Total"
          value={total ? fmtM(total) : null}
          unit={`Miles de millones ARS · ${period.slice(0, 7)}`}
          valueColor="#FFA028"
        />
        <KPI
          label="Resultado Primario"
          value={resPrimario ? fmtM(resPrimario) : null}
          unit="SPN no financiero · base caja"
          valueColor={resPrimario == null ? "#555" : resPrimario >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        <KPI
          label="Resultado Financiero"
          value={resFinanciero ? fmtM(resFinanciero) : null}
          unit="Incluyendo intereses de deuda"
          valueColor={resFinanciero == null ? "#555" : resFinanciero >= 0 ? "#4AF6C3" : "#FF433D"}
        />
        {/* Selector de período */}
        <div style={{ flex: "1 1 180px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Período</div>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ background: "#111", color: "#ccc", border: "1px solid #333", padding: "4px 8px", fontSize: 11, borderRadius: 2, width: "100%", cursor: "pointer" }}
          >
            {periods.map(p => <option key={p} value={p}>{p.slice(0, 7)}</option>)}
          </select>
        </div>
      </div>

      {/* SubTabs */}
      <SubTabs
        tabs={[
          { key: "distribucion", label: "Distribución Federal" },
          { key: "cashflow",     label: "Cashflow Didáctico" },
          { key: "ahorro",       label: "Ahorro-Inversión" },
        ]}
        active={sankeyTab}
        onChange={v => setSankeyTab(v as typeof sankeyTab)}
      />

      {/* Info banners */}
      {sankeyTab === "distribucion" && (
        <div style={{ padding: "5px 12px", background: "#001507", borderLeft: "3px solid #4AF6C3", fontSize: 9, color: "#4AF6C3", lineHeight: 1.6 }}>
          Seg. Social → ANSeS 100%. Der. Exportación → Tesoro 100%. Resto según Ley 23548: Tesoro 42.34% · Provincias 56.66% · CABA 1.40% · ATN 1%.{" "}
          <a href="http://www.cfi.gov.ar/Coparticipacion/Indices.aspx" target="_blank" rel="noopener" style={{ color: "#4AF6C3" }}>Ver CFI →</a>
        </div>
      )}
      {sankeyTab === "cashflow" && (
        <div style={{ padding: "5px 12px", background: "#1a0800", borderLeft: "3px solid #FFA028", fontSize: 9, color: "#FFA028", lineHeight: 1.6 }}>
          ⚠ SIMPLIFICACIÓN DIDÁCTICA — Combina base caja (ARCA) con base devengado (Presupuesto). Los gastos son proporciones aproximadas del presupuesto vigente. No cierra contablemente.
        </div>
      )}
      {sankeyTab === "ahorro" && (
        <div style={{ padding: "5px 12px", background: "#08001a", borderLeft: "3px solid #7C83FD", fontSize: 9, color: "#7C83FD", lineHeight: 1.6 }}>
          {/* TODO: integrar series directas del Esquema A-I-F de Sec. de Hacienda cuando estén en datos.gob.ar */}
          ⚠ PROPORCIONES ESTIMADAS — Ingresos por categoría y estructura de gastos son aproximaciones. Fuente real: Esquema Ahorro-Inversión-Financiamiento del SPN No Financiero (Secretaría de Hacienda, Ministerio de Economía).
        </div>
      )}

      {/* Sankey */}
      <div className="bbg-panel" style={{ marginTop: 0, borderTop: "none" }}>
        <div className="bbg-panel-header">
          {sankeyTab === "distribucion" ? "DISTRIBUCIÓN FEDERAL DE LA RECAUDACIÓN" :
           sankeyTab === "cashflow"     ? "CASHFLOW SIMPLIFICADO — TESORO NACIONAL" :
           "ESQUEMA AHORRO-INVERSIÓN — SPN NO FINANCIERO"}
          <span style={{ fontSize: 8, fontWeight: 400, color: "#555", marginLeft: 8 }}>{period.slice(0, 7)}</span>
        </div>
        <div style={{ padding: "8px 0 4px" }}>
          <SankeyChart nodes={sNodes} links={sLinks} height={440} formatValue={fmtM} />
        </div>
      </div>

      {/* Tabla de composición */}
      <BreakdownTable getValue={getValue} total={total} period={period} />

      {/* Nota de fuente */}
      <div style={{ padding: "6px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111", lineHeight: 1.6 }}>
        Fuente: apis.datos.gob.ar · ARCA (Agencia de Recaudación y Control Aduanero) ·
        IVA, Ganancias, Bs.Personales, Déb/Créd, Der.Export., Der.Import.: Informe Mensual SPN (dataset 452) ·
        Seg. Social + Total recaudación: dataset 172 · Resultado Primario/Financiero: datasets 379/378 ·
        Distribución federal: Ley 23548 y modificatorias (simplificada)
      </div>
    </div>
  )
}
