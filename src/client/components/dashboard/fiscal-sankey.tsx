/**
 * FiscalView — flujo fiscal del Sector Público Nacional
 *
 * Ingresos → gastos, todo desde columnas publicadas del IMIG (dataset 452.3
 * de la Secretaría de Hacienda). El motor de Sankey en SVG viene de la versión
 * previa de esta vista; lo que NO vuelve es la distribución del gasto por
 * porcentajes fijos que tenía antes — ahora las 31 líneas de gasto son el dato
 * oficial y el cierre contable se verifica en el server (`desvioCierre`).
 *
 * Límite honesto: el IMIG clasifica el gasto por tipo de erogación
 * (clasificación económica). No publica gasto mensual por finalidad
 * (educación/salud/defensa) ni por jurisdicción, así que esta vista no lo muestra.
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Monto = { clave: string; etiqueta: string; monto: number }
type MontoGasto = Monto & { bloque: string }

type Periodo = {
  periodo: string
  meses: number
  ingresos: Monto[]
  gastos: MontoGasto[]
  totalIngresos: number
  totalGastoPrimario: number
  resultadoPrimario: number
  interesesNetos: number
  resultadoFinanciero: number
  desvioCierre: number
}

type SankeyLink = { source: string; target: string; value: number }

type ImigResponse = {
  data: {
    periodo: Periodo
    sankey: SankeyLink[]
    serie_resultados: {
      periodo: string
      resultado_primario: number
      intereses_netos: number
      resultado_financiero: number
    }[]
    periodos_disponibles: string[]
    cierra: boolean
  }
  source: string
  updated_at: string
}

interface RawNode { name: string; column: number; color: string }
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

const CENTRO = "Ingresos totales"

/**
 * La fuente viene en millones de pesos. Las escalas se escriben completas
 * ("mil M", "bill.") en vez de abreviarse a M/Mm/MM: en una tabla fiscal
 * conviven montos que difieren 1000× y las siglas cortas se confunden.
 */
function fmtM(v: number): string {
  const a = Math.abs(v), s = v < 0 ? "-" : ""
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2).replace(".", ",")} bill.`
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1).replace(".", ",")} mil M`
  return `${s}$${Math.round(a).toLocaleString("es-AR")} M`
}
const fmtFull = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 1 })} millones`

// ── Colores ───────────────────────────────────────────────────────────────────

const COLOR_INGRESO: Record<string, string> = {
  iva_neto_reintegros: "var(--positive)",
  ganancias: "#36D6B0",
  aportes_contribuciones_seguridad_social: "#2BB89E",
  debitos_creditos: "var(--amber)",
  derechos_exportacion: "#FFD166",
  derechos_importacion: "#FF8C42",
  bienes_personales: "#F48FB1",
  combustibles: "#6C9BFF",
  impuestos_internos: "#7C83FD",
  resto_tributarios: "#A78BFA",
}
const COLOR_INGRESO_DEFAULT = "#5A7FA8"

const COLOR_BLOQUE: Record<string, string> = {
  "Prestaciones sociales": "#FF6B6B",
  "Subsidios económicos": "#FF8888",
  "Funcionamiento del Estado": "#E8425A",
  "Transferencias a provincias": "var(--negative)",
  "Otros gastos corrientes": "#C77DFF",
  "Gastos de capital": "#FF6B9D",
  "Intereses de deuda": "#B91C1C",
  "Superávit financiero": "var(--positive)",
}

// ── Motor de Sankey en SVG (stroke-based) ─────────────────────────────────────

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
  const maxNodes = Math.max(...colKeys.map(c => cols[c].length))
  const scale = maxColVal > 0 ? (height - (maxNodes - 1) * nodePadding) / maxColVal : 0
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

function buildGraph(
  nodeSpecs: RawNode[],
  linkSpecs: SankeyLink[],
): { nodes: RawNode[]; links: RawLink[] } {
  const filtered = linkSpecs.filter(l => l.value > 0)
  const used = new Set(filtered.flatMap(l => [l.source, l.target]))
  const nodes = nodeSpecs.filter(n => used.has(n.name))
  const idx: Record<string, number> = {}
  nodes.forEach((n, i) => { idx[n.name] = i })
  return {
    nodes,
    links: filtered
      .filter(l => idx[l.source] != null && idx[l.target] != null)
      .map(l => ({ source: idx[l.source], target: idx[l.target], value: l.value })),
  }
}

function StrokeSankeyChart({ nodes, links }: { nodes: RawNode[]; links: RawLink[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ width: 900, height: 480 })
  const [hovL, setHovL] = useState<number | null>(null)
  const [hovN, setHovN] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setDim({ width: Math.max(w, 500), height: Math.max(Math.min(w * 0.55, 560), 380) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const margin = { top: 26, right: 210, bottom: 12, left: 210 }
  const iW = Math.max(dim.width - margin.left - margin.right, 160)
  const iH = Math.max(dim.height - margin.top - margin.bottom, 160)
  const layout = strokeSankeyLayout({ nodes, links, width: iW, height: iH, nodePadding: 7, nodeWidth: 14 })
  const leftTotal = layout.nodes.filter(nd => nd._col === 0).reduce((s, nd) => s + nd.value, 0)
  const rightTotal = layout.nodes.filter(nd => nd._col === 2).reduce((s, nd) => s + nd.value, 0)

  return (
    <div style={{ background: "var(--bg-elev)", color: "#E0E0E0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 4px" }}>
        <div style={{ fontSize: 9, color: "var(--positive)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>← de dónde sale</div>
        <div style={{ fontSize: 9, color: "var(--amber)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>SPN</div>
        <div style={{ fontSize: 9, color: "var(--negative)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>en qué se gasta →</div>
      </div>
      <div ref={containerRef} style={{ overflow: "hidden" }}>
        <svg width={dim.width} height={dim.height} style={{ display: "block" }}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {layout.links.map((lk, i) => {
              const isHov = hovL === i || hovN === lk.source._i || hovN === lk.target._i
              const anyHov = hovL !== null || hovN !== null
              return (
                <path key={i} d={linkPath(lk)} fill="none"
                  stroke={lk.target._col === 2 ? lk.target.color : lk.source.color}
                  strokeWidth={Math.max(lk.width, 1)}
                  strokeOpacity={anyHov ? (isHov ? 0.5 : 0.05) : 0.24}
                  onMouseEnter={() => setHovL(i)} onMouseLeave={() => setHovL(null)}
                  style={{ cursor: "pointer", transition: "stroke-opacity 0.18s" }} />
              )
            })}
            {layout.nodes.map((nd, i) => {
              const nodeH = Math.max(nd.y1 - nd.y0, 2)
              const midY = (nd.y0 + nd.y1) / 2
              const isLeft = nd._col === 0
              const isCenter = nd._col === 1
              const isRight = nd._col === 2
              const pctBase = isLeft ? leftTotal : rightTotal
              const pct = pctBase > 0 ? ((nd.value / pctBase) * 100).toFixed(1) : null
              return (
                <g key={i} onMouseEnter={() => setHovN(i)} onMouseLeave={() => setHovN(null)} style={{ cursor: "pointer" }}>
                  <rect x={nd.x0} y={nd.y0} width={nd.x1 - nd.x0} height={nodeH}
                    fill={nd.color} fillOpacity={hovN === i ? 1 : 0.85} rx={2}
                    style={{ transition: "fill-opacity 0.18s" }}>
                    <title>{nd.name}: {fmtFull(nd.value)}</title>
                  </rect>
                  {isCenter && (
                    <>
                      <rect x={nd.x0 - 2} y={nd.y0 - 2} width={nd.x1 - nd.x0 + 4} height={nodeH + 4}
                        fill="none" stroke="var(--amber)" strokeWidth={1} strokeOpacity={0.35} rx={3} />
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 12} textAnchor="middle"
                        fill="var(--amber)" fontSize={9} fontWeight={700} fontFamily="inherit">{nd.name}</text>
                      <text x={(nd.x0 + nd.x1) / 2} y={nd.y0 - 2} textAnchor="middle"
                        fill="#666" fontSize={8} fontFamily="inherit">{fmtM(nd.value)}</text>
                    </>
                  )}
                  {isLeft && nodeH > 8 && (
                    <>
                      <text x={nd.x0 - 8} y={midY - 5} textAnchor="end" fill={nd.color} fontSize={9} fontWeight={600} fontFamily="inherit">{nd.name}</text>
                      <text x={nd.x0 - 8} y={midY + 7} textAnchor="end" fill="#666" fontSize={8} fontFamily="inherit">{fmtM(nd.value)}{pct ? ` · ${pct}%` : ""}</text>
                    </>
                  )}
                  {isRight && nodeH > 8 && (
                    <>
                      <text x={nd.x1 + 8} y={midY - 5} textAnchor="start" fill={nd.color} fontSize={9} fontWeight={600} fontFamily="inherit">{nd.name}</text>
                      <text x={nd.x1 + 8} y={midY + 7} textAnchor="start" fill="#666" fontSize={8} fontFamily="inherit">{fmtM(nd.value)}{pct ? ` · ${pct}%` : ""}</text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      {hovL !== null && layout.links[hovL] && (() => {
        const lk = layout.links[hovL]
        return (
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "var(--border)", border: "1px solid var(--border-hi)", borderRadius: 6, padding: "8px 16px", fontSize: 10, color: "#E0E0E0", pointerEvents: "none", zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
            <span style={{ color: lk.source.color, fontWeight: 700 }}>{lk.source.name}</span>
            <span style={{ color: "var(--text-dim)", margin: "0 8px" }}>→</span>
            <span style={{ color: lk.target.color, fontWeight: 700 }}>{lk.target.name}</span>
            <span style={{ color: "var(--amber)", marginLeft: 12, fontWeight: 700 }}>{fmtFull(lk.value)}</span>
          </div>
        )
      })()}
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────

function KPI({ label, value, unit, color }: {
  label: string; value: string; unit: string; color?: string
}) {
  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "10px 14px", flex: "1 1 160px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--amber)", fontFamily: "var(--font-data)" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{unit}</div>
    </div>
  )
}

// ── Tabla de gasto por bloque ─────────────────────────────────────────────────

function GastoPorBloque({ gastos, total }: { gastos: MontoGasto[]; total: number }) {
  const bloques = new Map<string, MontoGasto[]>()
  for (const g of gastos) {
    if (g.monto === 0) continue
    const etiqueta = ETIQUETA_BLOQUE[g.bloque] ?? g.bloque
    bloques.set(etiqueta, [...(bloques.get(etiqueta) ?? []), g])
  }
  const ordenadas = [...bloques.entries()]
    .map(([nombre, lineas]) => ({
      nombre,
      lineas: lineas.slice().sort((a, b) => b.monto - a.monto),
      subtotal: lineas.reduce((a, l) => a + l.monto, 0),
    }))
    .sort((a, b) => b.subtotal - a.subtotal)

  return (
    <div className="bbg-panel" style={{ marginTop: 8 }}>
      <div className="bbg-panel-header">GASTO PRIMARIO — 31 LÍNEAS PUBLICADAS</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Concepto", "Monto", "% del gasto", ""].map(h => (
              <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-dim)", textAlign: h === "Concepto" ? "left" : "right", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {ordenadas.map(bloque => {
              const color = COLOR_BLOQUE[bloque.nombre] ?? "var(--text-dim)"
              const pctBloque = total > 0 ? (bloque.subtotal / total) * 100 : 0
              return [
                <tr key={bloque.nombre} style={{ background: "var(--bg-elev-2)" }}>
                  <td style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, color }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, background: color, borderRadius: 1, marginRight: 6 }} />
                    {bloque.nombre}
                  </td>
                  <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", fontWeight: 700, color }}>{fmtM(bloque.subtotal)}</td>
                  <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", color: "var(--text-dim)" }}>{pctBloque.toFixed(1)}%</td>
                  <td style={{ padding: "5px 12px 5px 4px", width: 80 }}>
                    <div style={{ background: "var(--bg-elev)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, pctBloque)}%`, height: "100%", background: color, borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>,
                ...bloque.lineas.map(l => (
                  <tr key={l.clave} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                    <td style={{ padding: "3px 8px 3px 24px", fontSize: 10, color: "#ccc" }}>{l.etiqueta}</td>
                    <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", color: l.monto < 0 ? "var(--negative)" : "#ccc" }}>{fmtM(l.monto)}</td>
                    <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", color: "var(--text-dim)" }}>
                      {total > 0 ? `${((l.monto / total) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td />
                  </tr>
                )),
              ]
            })}
            <tr style={{ borderTop: "1px solid var(--border-hi)" }}>
              <td style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, color: "var(--amber)" }}>TOTAL GASTO PRIMARIO</td>
              <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", fontFamily: "var(--font-data)", color: "var(--amber)", fontWeight: 700 }}>{fmtM(total)}</td>
              <td style={{ padding: "5px 8px", fontSize: 10, textAlign: "right", color: "var(--text-dim)" }}>100.0%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ETIQUETA_BLOQUE: Record<string, string> = {
  prestaciones: "Prestaciones sociales",
  subsidios: "Subsidios económicos",
  funcionamiento: "Funcionamiento del Estado",
  provincias: "Transferencias a provincias",
  otros_corrientes: "Otros gastos corrientes",
  capital: "Gastos de capital",
}

// ── Vista principal ───────────────────────────────────────────────────────────

type Modo = "mes" | "ytd" | "anio"

const MODOS: { key: Modo; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "ytd", label: "Acumulado del año" },
  { key: "anio", label: "Año completo" },
]

export function FiscalSankeyView() {
  const [modo, setModo] = useState<Modo>("mes")
  const [periodoSel, setPeriodoSel] = useState<string>("")
  const [resp, setResp] = useState<ImigResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async (m: Modo, p: string) => {
    setCargando(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ endpoint: "fiscal_imig", modo: m })
      if (p) qs.set("periodo", p)
      const r = await fetch(`/api/macro?${qs}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setResp(await r.json())
    } catch {
      setError("No se pudo cargar el IMIG")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar(modo, periodoSel) }, [cargar, modo, periodoSel])

  if (cargando && !resp) {
    return <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>Cargando flujo fiscal...</div>
  }
  if (error || !resp) {
    return <div style={{ padding: 16, color: "var(--negative)", fontSize: 11 }}>{error ?? "Sin datos"}</div>
  }

  const { periodo, sankey, periodos_disponibles } = resp.data
  const anios = [...new Set(periodos_disponibles.map(p => p.slice(0, 4)))].sort().reverse()
  const meses = periodos_disponibles.slice().reverse()

  // Sólo los dos primeros niveles: impuesto → total → bloque de gasto.
  // El detalle de las 31 líneas va en la tabla de abajo.
  const nodeSpecs: RawNode[] = [
    ...periodo.ingresos.map(i => ({
      name: i.etiqueta, column: 0, color: COLOR_INGRESO[i.clave] ?? COLOR_INGRESO_DEFAULT,
    })),
    { name: CENTRO, column: 1, color: "var(--amber)" },
    ...Object.values(ETIQUETA_BLOQUE).map(b => ({ name: b, column: 2, color: COLOR_BLOQUE[b] ?? "var(--negative)" })),
    { name: "Intereses de deuda", column: 2, color: COLOR_BLOQUE["Intereses de deuda"] },
    { name: "Superávit financiero", column: 2, color: COLOR_BLOQUE["Superávit financiero"] },
  ]
  const linksNivel12 = sankey.filter(l => l.target === CENTRO || l.source === CENTRO)
  const graph = buildGraph(nodeSpecs, linksNivel12)

  const deficit = periodo.resultadoFinanciero < 0

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {MODOS.map(m => (
            <button key={m.key} onClick={() => { setModo(m.key); setPeriodoSel("") }} style={{
              background: modo === m.key ? "var(--bg-elev-2)" : "transparent",
              color: modo === m.key ? "var(--amber)" : "var(--text-mute)",
              border: "none", borderBottom: modo === m.key ? "2px solid var(--amber)" : "2px solid transparent",
              padding: "6px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
            }}>{m.label}</button>
          ))}
        </div>
        <select
          value={periodoSel}
          onChange={e => setPeriodoSel(e.target.value)}
          style={{ background: "var(--bg-elev)", color: "#ccc", border: "1px solid var(--border)", padding: "4px 8px", fontSize: 10 }}
        >
          <option value="">Último disponible</option>
          {(modo === "mes" ? meses : anios).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          {periodo.periodo}{periodo.meses > 1 ? ` · ${periodo.meses} meses` : ""}
        </div>
      </div>

      {periodo.desvioCierre !== 0 && (
        <div style={{ borderLeft: "3px solid var(--negative)", background: "var(--bg-elev)", padding: "8px 12px", marginBottom: 8, fontSize: 10, color: "var(--negative)" }}>
          La fuente dejó de cuadrar: ingresos − gastos difiere del resultado primario publicado en {fmtFull(periodo.desvioCierre)}.
          El gráfico se dibuja igual, pero el dato está en revisión.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <KPI label="Ingresos totales" value={fmtM(periodo.totalIngresos)} unit="millones de $ corrientes" color="var(--positive)" />
        <KPI label="Gasto primario" value={fmtM(periodo.totalGastoPrimario)} unit="sin intereses de deuda" color="var(--negative)" />
        <KPI label="Resultado primario" value={fmtM(periodo.resultadoPrimario)} unit="ingresos − gasto primario"
          color={periodo.resultadoPrimario < 0 ? "var(--negative)" : "var(--positive)"} />
        <KPI label="Intereses de deuda" value={fmtM(periodo.interesesNetos)} unit="netos" color="#B91C1C" />
        <KPI label={deficit ? "Déficit financiero" : "Superávit financiero"} value={fmtM(periodo.resultadoFinanciero)}
          unit="primario − intereses" color={deficit ? "var(--negative)" : "var(--positive)"} />
      </div>

      <div className="bbg-panel">
        <div className="bbg-panel-header">FLUJO FISCAL — {periodo.periodo}</div>
        <StrokeSankeyChart nodes={graph.nodes} links={graph.links} />
      </div>

      <GastoPorBloque gastos={periodo.gastos} total={periodo.totalGastoPrimario} />

      <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--bg-elev)", borderLeft: "3px solid var(--amber)", fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--amber)" }}>Sobre estos datos.</strong>{" "}
        Base caja, millones de pesos corrientes (sin ajustar por inflación: no compares meses distantes en valor nominal).
        Las 16 líneas de ingreso y las 31 de gasto son las que publica la fuente — ninguna se estima ni se prorratea, y el
        cierre <em>ingresos − gasto = resultado primario</em> se verifica en cada período.
        El IMIG clasifica el gasto por <strong>tipo de erogación</strong>, no por finalidad: por eso no vas a ver acá
        &quot;educación&quot; o &quot;salud&quot; como totales nacionales, sólo las transferencias a provincias y la inversión de capital
        que sí vienen abiertas por función. El último mes puede revisarse en publicaciones posteriores.
        <div style={{ marginTop: 4, color: "var(--text-mute)" }}>Fuente: {resp.source}</div>
      </div>
    </div>
  )
}
