"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Brush,
} from "recharts"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SerieMetadata {
  id: string; label: string; unidad: string; categoria: string; frecuencia: string
}
interface DataPoint { date: string; value: number }
interface SerieData  { id: string; data: DataPoint[]; error?: string }

type ChartType    = "linea" | "area" | "barra" | "scatter" | "densidad"
type Transform    = "ninguna" | "base100" | "var_pct" | "ma3" | "ma12" | "acum12" | "yoy"
type ActiveView   = "grafico" | "tabla" | "estadisticas"
type PivotMode    = "simple" | "ejes"

interface SerieConfig {
  id:          string
  color:       string
  transform:   Transform
  axis:        "left" | "right"
  strokeWidth: number
  dotted:      boolean
  hidden:      boolean
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DEFAULT_COLORS = ["#4AF6C3","#FFA028","#4FC3F7","#ce93d8","#FFD54F","#FF433D","#81c784"]

const CHART_TYPES: { id: ChartType; label: string; icon: string; desc: string }[] = [
  { id:"linea",   label:"Línea",   icon:"╱", desc:"Serie temporal" },
  { id:"area",    label:"Área",    icon:"◿", desc:"Acumulado visual" },
  { id:"barra",   label:"Barra",   icon:"▐", desc:"Comparativa" },
  { id:"scatter", label:"Scatter", icon:"⠿", desc:"Correlación X vs Y" },
  { id:"densidad",label:"Densidad",icon:"∿", desc:"Distribución" },
]

const TRANSFORMS: { id: Transform; label: string; desc: string }[] = [
  { id:"ninguna", label:"Original",    desc:"Valor bruto" },
  { id:"base100", label:"Base 100",    desc:"Indexado al primer punto=100" },
  { id:"var_pct", label:"Var %",       desc:"Variación porcentual período a período" },
  { id:"yoy",     label:"YoY %",       desc:"Variación vs mismo período año anterior" },
  { id:"ma3",     label:"MA 3p",       desc:"Media móvil 3 períodos" },
  { id:"ma12",    label:"MA 12p",      desc:"Media móvil 12 períodos" },
  { id:"acum12",  label:"Acum 12m",    desc:"Suma acumulada 12 meses" },
]

const PERIODS = [
  { id:"3m",label:"3M"},{ id:"6m",label:"6M"},
  { id:"1y",label:"1A"},{ id:"2y",label:"2A"},{ id:"max",label:"MAX"},
]

const CATEGORIAS = ["Actividad","Precios","Comercio","Fiscal","Cambiario","Mercados","BCRA"]

const QUICK_COMBOS = [
  { label:"Dólar vs Inflación",       x:["tc_blue"],             y:["ipc_var_mensual"],                  mode:"ejes" as PivotMode },
  { label:"Actividad vs Comercio",    x:["emae_var_interanual"], y:["saldo_comercial"],                  mode:"ejes" as PivotMode },
  { label:"Riesgo vs S&P500",         x:["riesgo_pais"],         y:["sp500"],                            mode:"ejes" as PivotMode },
  { label:"Dólares comparados",       x:[],                      y:["tc_blue","tc_mep","tc_ccl","tc_oficial"], mode:"simple" as PivotMode },
  { label:"Inflación por componente", x:[],                      y:["ipc_var_mensual","ipc_nucleo","ipc_alimentos","ipc_regulados"], mode:"simple" as PivotMode },
  { label:"Macro completa",           x:[],                      y:["emae_var_interanual","ipc_var_mensual","saldo_comercial","resultado_primario"], mode:"simple" as PivotMode },
]

// ── Transformaciones ──────────────────────────────────────────────────────────

function applyTransform(data: DataPoint[], t: Transform): DataPoint[] {
  if (!data.length) return []
  if (t === "ninguna") return data
  if (t === "base100") {
    const base = data[0].value
    return base ? data.map(p => ({ ...p, value: (p.value / base) * 100 })) : data
  }
  if (t === "var_pct") {
    return data.slice(1).map((p, i) => {
      const prev = data[i].value
      return { ...p, value: prev ? ((p.value - prev) / Math.abs(prev)) * 100 : 0 }
    })
  }
  if (t === "yoy") {
    return data.slice(12).map((p, i) => {
      const prev = data[i].value
      return { ...p, value: prev ? ((p.value - prev) / Math.abs(prev)) * 100 : 0 }
    })
  }
  if (t === "ma3" || t === "ma12") {
    const w = t === "ma3" ? 3 : 12
    return data.slice(w - 1).map((p, i) => {
      const window = data.slice(i, i + w)
      const avg = window.reduce((s, d) => s + d.value, 0) / w
      return { ...p, value: avg }
    })
  }
  if (t === "acum12") {
    return data.slice(11).map((p, i) => {
      const window = data.slice(i, i + 12)
      const sum = window.reduce((s, d) => s + d.value, 0)
      return { ...p, value: sum }
    })
  }
  return data
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

function calcStats(data: DataPoint[]) {
  if (!data.length) return null
  const vals = data.map(d => d.value).filter(v => !isNaN(v))
  const n    = vals.length
  const mean = vals.reduce((s, v) => s + v, 0) / n
  const sorted = [...vals].sort((a, b) => a - b)
  const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  return {
    n, min: sorted[0], max: sorted[n - 1], mean,
    median: sorted[Math.floor(n / 2)],
    std, last: data.at(-1)?.value, first: data[0]?.value,
  }
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n
  const num = xs.slice(0, n).reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const dx  = Math.sqrt(xs.slice(0, n).reduce((s, x) => s + (x - mx) ** 2, 0))
  const dy  = Math.sqrt(ys.slice(0, n).reduce((s, y) => s + (y - my) ** 2, 0))
  return dx && dy ? num / (dx * dy) : null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return ""
  const [y, m, day] = d.split("-")
  return day ? `${day}/${m}/${y?.slice(2)}` : `${m}/${y?.slice(2)}`
}

function fmtN(v: number | null | undefined, decimals = 2) {
  if (v == null || isNaN(v)) return "—"
  if (Math.abs(v) > 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) > 1e3) return `${(v / 1e3).toFixed(1)}k`
  return v.toFixed(decimals)
}

function mergeSeries(series: { id: string; transformed: DataPoint[] }[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  series.forEach(s => s.transformed.forEach(({ date, value }) => {
    if (!map.has(date)) map.set(date, { date })
    map.get(date)![s.id] = value
  }))
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}

function buildScatter(xData: DataPoint[], yData: DataPoint[]) {
  const mx = new Map(xData.map(p => [p.date, p.value]))
  return yData.filter(p => mx.has(p.date)).map(p => ({ x: mx.get(p.date)!, y: p.value, date: p.date }))
}

function buildDensity(data: DataPoint[]) {
  if (!data.length) return []
  const vals = data.map(d => d.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const bins = 20, step = (max - min) / bins || 1
  const counts = Array(bins).fill(0)
  vals.forEach(v => counts[Math.min(Math.floor((v - min) / step), bins - 1)]++)
  return counts.map((count, i) => ({ bin: (min + i * step).toFixed(1), count }))
}

function downloadCSV(rows: Record<string,unknown>[], ids: string[], labels: string[]) {
  const hdrs = ["fecha",...ids]
  const lines = rows.slice().reverse().map(r => hdrs.map(h => r[h] ?? "").join(","))
  const csv   = [["Fecha",...labels].join(","), ...lines].join("\n")
  const url   = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}))
  Object.assign(document.createElement("a"),{href:url,download:"pivot.csv"}).click()
  URL.revokeObjectURL(url)
}

const TOOLTIP_STYLE = {
  background:"#0a0a0a", border:"1px solid #1a1a1a",
  fontSize:9, fontFamily:"monospace", color:"#ccc",
}

// ── Componente SerieItem (draggable) ──────────────────────────────────────────

function SerieItem({ s, usedIds }: { s: SerieMetadata; usedIds: string[] }) {
  const used = usedIds.includes(s.id)
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData("serie_id",s.id); e.dataTransfer.effectAllowed="copy" }}
      style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 8px",
        background: used ? "#0a0a0a" : "transparent",
        border:`1px solid ${used?"#222":"#111"}`, borderRadius:3,
        cursor:"grab", opacity: used ? 0.5 : 1, userSelect:"none" }}>
      <span style={{fontSize:8, color:"#333"}}>⠿</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10, color: used?"#555":"#aaa"}}>{s.label}</div>
        <div style={{fontSize:7, color:"#2a2a2a"}}>{s.unidad} · {s.frecuencia}</div>
      </div>
    </div>
  )
}

// ── DropZone ──────────────────────────────────────────────────────────────────

function DropZone({ label, color, ids, meta, onDrop, onRemove, maxItems }:{
  label:string; color:string; ids:string[]; meta:SerieMetadata[]
  onDrop:(id:string)=>void; onRemove:(id:string)=>void; maxItems:number
}) {
  const [over, setOver] = useState(false)
  return (
    <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)}
      onDrop={e=>{e.preventDefault();setOver(false);const id=e.dataTransfer.getData("serie_id");if(id)onDrop(id)}}
      style={{ flex:1, minHeight:52, border:`1px dashed ${over?color:"#222"}`,
        borderRadius:4, padding:"5px 8px", background: over?color+"08":"#050505", transition:"all 0.15s" }}>
      <div style={{fontSize:8, color: over?color:"#444", letterSpacing:1.5, marginBottom:4, textTransform:"uppercase"}}>
        {label} ({ids.length}/{maxItems})
      </div>
      {ids.length === 0
        ? <div style={{fontSize:9, color:"#2a2a2a", fontStyle:"italic"}}>arrastrá aquí</div>
        : <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
            {ids.map((id,i)=>{
              const m = meta.find(m=>m.id===id)
              return (
                <span key={id} style={{ fontSize:8, padding:"2px 6px", borderRadius:2,
                  background: DEFAULT_COLORS[i%DEFAULT_COLORS.length]+"22",
                  color: DEFAULT_COLORS[i%DEFAULT_COLORS.length],
                  border:`1px solid ${DEFAULT_COLORS[i%DEFAULT_COLORS.length]}44`,
                  display:"flex", alignItems:"center", gap:4 }}>
                  {m?.label ?? id}
                  <span onClick={()=>onRemove(id)} style={{cursor:"pointer",opacity:0.6,fontSize:10}}>×</span>
                </span>
              )
            })}
          </div>
      }
    </div>
  )
}

// ── Panel de configuración por serie ─────────────────────────────────────────

function SerieConfigPanel({ configs, meta, onChange }: {
  configs:  SerieConfig[]
  meta:     SerieMetadata[]
  onChange: (id: string, patch: Partial<SerieConfig>) => void
}) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:6}}>
      <div style={{fontSize:8, color:"#444", letterSpacing:1.5, marginBottom:2}}>SERIES ACTIVAS</div>
      {configs.map((cfg, i) => {
        const m = meta.find(m => m.id === cfg.id)
        return (
          <div key={cfg.id} style={{
            background:"#080808", border:`1px solid ${cfg.color}33`,
            borderLeft:`3px solid ${cfg.color}`, borderRadius:3, padding:"8px 10px",
          }}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6}}>
              <span style={{fontSize:10, color:"#ccc", fontWeight:600}}>{m?.label ?? cfg.id}</span>
              <div style={{display:"flex", gap:4}}>
                {/* Color */}
                <input type="color" value={cfg.color}
                  onChange={e => onChange(cfg.id, {color: e.target.value})}
                  style={{width:18, height:18, border:"none", borderRadius:2, cursor:"pointer", background:"none", padding:0}} />
                {/* Ocultar */}
                <button onClick={() => onChange(cfg.id, {hidden: !cfg.hidden})} style={{
                  fontSize:8, padding:"1px 5px", background: cfg.hidden?"#222":"transparent",
                  color: cfg.hidden?"#888":"#555", border:"1px solid #222", borderRadius:2, cursor:"pointer", fontFamily:"monospace"
                }}>{cfg.hidden ? "show" : "hide"}</button>
              </div>
            </div>
            {/* Transformación */}
            <div style={{marginBottom:5}}>
              <div style={{fontSize:7, color:"#333", marginBottom:3}}>TRANSFORMACIÓN</div>
              <div style={{display:"flex", gap:2, flexWrap:"wrap"}}>
                {TRANSFORMS.map(t => (
                  <button key={t.id} onClick={() => onChange(cfg.id,{transform:t.id})} title={t.desc}
                    style={{
                      fontSize:7, padding:"2px 5px", borderRadius:2, cursor:"pointer", fontFamily:"monospace",
                      background: cfg.transform===t.id ? cfg.color+"33" : "transparent",
                      color: cfg.transform===t.id ? cfg.color : "#333",
                      border:`1px solid ${cfg.transform===t.id ? cfg.color+"44":"#111"}`,
                    }}>{t.label}</button>
                ))}
              </div>
            </div>
            {/* Eje + grosor */}
            <div style={{display:"flex", gap:6, alignItems:"center"}}>
              <div>
                <div style={{fontSize:7, color:"#333", marginBottom:2}}>EJE</div>
                <div style={{display:"flex", gap:2}}>
                  {(["left","right"] as const).map(ax => (
                    <button key={ax} onClick={() => onChange(cfg.id,{axis:ax})} style={{
                      fontSize:7, padding:"2px 5px", borderRadius:2, cursor:"pointer", fontFamily:"monospace",
                      background: cfg.axis===ax ? "#1a1a1a" : "transparent",
                      color: cfg.axis===ax ? "#ccc" : "#333",
                      border:`1px solid ${cfg.axis===ax?"#333":"#111"}`,
                    }}>{ax === "left" ? "← Izq" : "Der →"}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:7, color:"#333", marginBottom:2}}>GROSOR</div>
                <input type="range" min={1} max={4} step={0.5} value={cfg.strokeWidth}
                  onChange={e => onChange(cfg.id,{strokeWidth:+e.target.value})}
                  style={{width:50}} />
              </div>
              <div>
                <div style={{fontSize:7, color:"#333", marginBottom:2}}>PUNTOS</div>
                <button onClick={() => onChange(cfg.id,{dotted:!cfg.dotted})} style={{
                  fontSize:7, padding:"2px 5px", borderRadius:2, cursor:"pointer", fontFamily:"monospace",
                  background: cfg.dotted ? "#1a1a1a" : "transparent",
                  color: cfg.dotted ? "#ccc" : "#333", border:"1px solid #1a1a1a",
                }}>{cfg.dotted ? "sí" : "no"}</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Panel estadístico ─────────────────────────────────────────────────────────

function StatsPanel({ configs, seriesData, meta }: {
  configs:    SerieConfig[]
  seriesData: SerieData[]
  meta:       SerieMetadata[]
}) {
  const active = configs.filter(c => !c.hidden)
  const corr: number | null = useMemo(() => {
    if (active.length !== 2) return null
    const d0 = seriesData.find(s => s.id === active[0].id)?.data.map(p => p.value) ?? []
    const d1 = seriesData.find(s => s.id === active[1].id)?.data.map(p => p.value) ?? []
    return pearson(d0, d1)
  }, [active, seriesData])

  return (
    <div style={{display:"flex", flexDirection:"column", gap:10}}>
      {corr !== null && (
        <div style={{background:"#0a0e14", border:"1px solid #1a2a3a", borderRadius:4, padding:"10px 12px"}}>
          <div style={{fontSize:8, color:"#4FC3F7", letterSpacing:1.5, marginBottom:4}}>CORRELACIÓN DE PEARSON</div>
          <div style={{fontSize:24, fontWeight:700, color: Math.abs(corr)>0.7?"#4AF6C3": Math.abs(corr)>0.4?"#FFA028":"#FF433D"}}>
            {corr.toFixed(3)}
          </div>
          <div style={{fontSize:9, color:"#444", marginTop:2}}>
            {Math.abs(corr)>0.7 ? "Correlación fuerte" : Math.abs(corr)>0.4 ? "Correlación moderada" : "Correlación débil"}
            {corr < 0 ? " (inversa)" : " (directa)"}
          </div>
        </div>
      )}

      {active.map(cfg => {
        const raw  = seriesData.find(s => s.id === cfg.id)?.data ?? []
        const data = applyTransform(raw, cfg.transform)
        const st   = calcStats(data)
        const m    = meta.find(m => m.id === cfg.id)
        if (!st) return null
        return (
          <div key={cfg.id} style={{background:"#080808", border:`1px solid ${cfg.color}33`, borderLeft:`3px solid ${cfg.color}`, borderRadius:3, padding:"10px 12px"}}>
            <div style={{fontSize:10, color:"#ccc", fontWeight:600, marginBottom:8}}>{m?.label ?? cfg.id}</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 12px"}}>
              {[
                ["Último",   fmtN(st.last)],
                ["Primero",  fmtN(st.first)],
                ["Máximo",   fmtN(st.max)],
                ["Mínimo",   fmtN(st.min)],
                ["Promedio", fmtN(st.mean)],
                ["Mediana",  fmtN(st.median)],
                ["Desv. Est",fmtN(st.std)],
                ["N pts",    String(st.n)],
              ].map(([k,v]) => (
                <div key={k}>
                  <div style={{fontSize:7, color:"#444"}}>{k}</div>
                  <div style={{fontSize:10, color: cfg.color, fontWeight:600}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function PivotChart({ chartType, xIds, configs, seriesData, seriesMeta, showBrush }: {
  chartType:  ChartType
  xIds:       string[]
  configs:    SerieConfig[]
  seriesData: SerieData[]
  seriesMeta: SerieMetadata[]
  showBrush:  boolean
}) {
  const visibleCfgs = configs.filter(c => !c.hidden)

  const transformed = useMemo(() => visibleCfgs.map(cfg => {
    const raw = seriesData.find(s => s.id === cfg.id)?.data ?? []
    return { id: cfg.id, transformed: applyTransform(raw, cfg.transform) }
  }), [visibleCfgs, seriesData])

  // Scatter
  if (chartType === "scatter" && xIds[0]) {
    const xRaw   = seriesData.find(s => s.id === xIds[0])?.data ?? []
    const xCfg   = configs.find(c => c.id === xIds[0])
    const xTrans = applyTransform(xRaw, xCfg?.transform ?? "ninguna")
    const yId    = visibleCfgs.find(c => c.id !== xIds[0])?.id
    const yRaw   = yId ? (seriesData.find(s => s.id === yId)?.data ?? []) : []
    const yCfg   = configs.find(c => c.id === yId)
    const yTrans = applyTransform(yRaw, yCfg?.transform ?? "ninguna")
    const pts    = buildScatter(xTrans, yTrans)
    const xMeta  = seriesMeta.find(m => m.id === xIds[0])
    const yMeta  = yId ? seriesMeta.find(m => m.id === yId) : null

    // Línea de tendencia (regresión lineal)
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const n  = xs.length
    const mx = xs.reduce((s,v)=>s+v,0)/n, my = ys.reduce((s,v)=>s+v,0)/n
    const b  = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0) / (xs.reduce((s,x)=>s+(x-mx)**2,0)||1)
    const a  = my - b * mx
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const trendData = [{x:minX, trend:a+b*minX},{x:maxX, trend:a+b*maxX}]

    return (
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart margin={{top:10,right:20,bottom:30,left:10}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#111" />
          <XAxis dataKey="x" type="number" domain={["auto","auto"]}
            name={xMeta?.label} tick={{fontSize:8,fill:"#444"}}
            label={{value:xMeta?.label??"X",position:"bottom",fontSize:9,fill:"#555"}} />
          <YAxis dataKey="y" type="number" tick={{fontSize:8,fill:"#444"}}
            label={{value:yMeta?.label??"Y",angle:-90,position:"insideLeft",fontSize:9,fill:"#555"}} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{strokeDasharray:"3 3"}} />
          <Scatter data={pts} fill={xCfg?.color??DEFAULT_COLORS[0]} opacity={0.7} name="Datos" />
          <Line data={trendData} dataKey="trend" type="linear"
            stroke="#FF433D" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Tendencia" />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  // Densidad
  if (chartType === "densidad") {
    const cfg0 = visibleCfgs[0]
    const data = applyTransform(seriesData.find(s=>s.id===cfg0?.id)?.data??[], cfg0?.transform??"ninguna")
    const dens = buildDensity(data)
    return (
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={dens} margin={{top:10,right:20,bottom:30,left:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#111" />
          <XAxis dataKey="bin" tick={{fontSize:8,fill:"#444"}} label={{value:"Valor",position:"bottom",fontSize:9,fill:"#555"}} />
          <YAxis tick={{fontSize:8,fill:"#444"}} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="count" stroke={cfg0?.color??DEFAULT_COLORS[0]} fill={cfg0?.color??DEFAULT_COLORS[0]} fillOpacity={0.2} name="Frecuencia" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // Línea / Área / Barra con doble eje Y y transformaciones
  const merged  = mergeSeries(transformed)
  const hasRight = visibleCfgs.some(c => c.axis === "right")

  const commonProps = {
    data: merged,
    margin: {top:10,right: hasRight?50:20,bottom: showBrush?40:20,left:0},
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#0d0d0d" />
      <XAxis dataKey="date" tick={{fontSize:7,fill:"#333"}} tickFormatter={fmtDate} interval="preserveStartEnd" />
      <YAxis yAxisId="left"  orientation="left"  tick={{fontSize:8,fill:"#444"}} />
      {hasRight && <YAxis yAxisId="right" orientation="right" tick={{fontSize:8,fill:"#444"}} />}
      <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtDate} />
      <Legend wrapperStyle={{fontSize:9}} />
      <ReferenceLine yAxisId="left" y={0} stroke="#1a1a1a" strokeDasharray="3 3" />
      {showBrush && <Brush dataKey="date" height={20} stroke="#222" fill="#080808" travellerWidth={6} tickFormatter={fmtDate} />}
    </>
  )

  if (chartType === "barra") return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart {...commonProps}>
        {axes}
        {visibleCfgs.map(cfg => (
          <Bar key={cfg.id} yAxisId={cfg.axis} dataKey={cfg.id}
            name={seriesMeta.find(m=>m.id===cfg.id)?.label??cfg.id}
            fill={cfg.color} opacity={0.85} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )

  if (chartType === "area") return (
    <ResponsiveContainer width="100%" height={380}>
      <AreaChart {...commonProps}>
        {axes}
        {visibleCfgs.map(cfg => (
          <Area key={cfg.id} yAxisId={cfg.axis} type="monotone" dataKey={cfg.id}
            name={seriesMeta.find(m=>m.id===cfg.id)?.label??cfg.id}
            stroke={cfg.color} fill={cfg.color} fillOpacity={0.1}
            strokeWidth={cfg.strokeWidth} dot={cfg.dotted?{r:2}:false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart {...commonProps}>
        {axes}
        {visibleCfgs.map(cfg => (
          <Line key={cfg.id} yAxisId={cfg.axis} type="monotone" dataKey={cfg.id}
            name={seriesMeta.find(m=>m.id===cfg.id)?.label??cfg.id}
            stroke={cfg.color} strokeWidth={cfg.strokeWidth}
            dot={cfg.dotted?{r:2,fill:cfg.color}:false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Tabla ─────────────────────────────────────────────────────────────────────

function PivotTable({ configs, seriesData, seriesMeta }: {
  configs: SerieConfig[]; seriesData: SerieData[]; seriesMeta: SerieMetadata[]
}) {
  const active  = configs.filter(c => !c.hidden)
  const allData = active.map(cfg => {
    const raw = seriesData.find(s=>s.id===cfg.id)?.data??[]
    return { id:cfg.id, transformed: applyTransform(raw, cfg.transform) }
  })
  const merged  = mergeSeries(allData).slice().reverse()
  const [page, setPage] = useState(0)
  const PAGE = 25

  return (
    <div style={{display:"flex", flexDirection:"column", gap:6}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span style={{fontSize:9, color:"#444"}}>{merged.length} registros</span>
        <button onClick={() => downloadCSV(merged, active.map(c=>c.id), active.map(c=>seriesMeta.find(m=>m.id===c.id)?.label??c.id))}
          style={{fontSize:9, color:"#4AF6C3", background:"none", border:"1px solid #4AF6C344", borderRadius:2, padding:"3px 10px", cursor:"pointer", fontFamily:"monospace"}}>
          ↓ CSV
        </button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse", fontSize:9}}>
          <thead>
            <tr style={{borderBottom:"1px solid #1a1a1a"}}>
              <th style={{padding:"5px 10px", textAlign:"left", color:"#444", fontWeight:400}}>Fecha</th>
              {active.map(cfg => (
                <th key={cfg.id} style={{padding:"5px 10px", textAlign:"right", color:cfg.color, fontWeight:600, whiteSpace:"nowrap"}}>
                  {seriesMeta.find(m=>m.id===cfg.id)?.label??cfg.id}
                  <div style={{fontSize:7, color:"#333", fontWeight:400}}>{cfg.transform !== "ninguna" ? TRANSFORMS.find(t=>t.id===cfg.transform)?.label : ""}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {merged.slice(page*PAGE,(page+1)*PAGE).map((row,i)=>(
              <tr key={i} style={{background:i%2===0?"#050505":"transparent", borderBottom:"1px solid #080808"}}>
                <td style={{padding:"4px 10px", color:"#555", whiteSpace:"nowrap"}}>{fmtDate(row.date as string)}</td>
                {active.map(cfg=>{
                  const v = row[cfg.id] as number|undefined
                  return <td key={cfg.id} style={{padding:"4px 10px", textAlign:"right", color:v!=null?cfg.color:"#222", whiteSpace:"nowrap"}}>{v!=null?fmtN(v):"—"}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {merged.length>PAGE && (
        <div style={{display:"flex", gap:6, justifyContent:"center", alignItems:"center"}}>
          <button disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{fontSize:9,color:page===0?"#222":"#666",background:"none",border:"1px solid #1a1a1a",borderRadius:2,padding:"3px 10px",cursor:page===0?"default":"pointer",fontFamily:"monospace"}}>← Ant.</button>
          <span style={{fontSize:9,color:"#333"}}>{page+1} / {Math.ceil(merged.length/PAGE)}</span>
          <button disabled={(page+1)*PAGE>=merged.length} onClick={()=>setPage(p=>p+1)} style={{fontSize:9,color:(page+1)*PAGE>=merged.length?"#222":"#666",background:"none",border:"1px solid #1a1a1a",borderRadius:2,padding:"3px 10px",cursor:(page+1)*PAGE>=merged.length?"default":"pointer",fontFamily:"monospace"}}>Sig. →</button>
        </div>
      )}
    </div>
  )
}

// ── Selector simple ───────────────────────────────────────────────────────────

function SimpleSelector({ catalog, selected, onToggle }: {
  catalog:SerieMetadata[]; selected:string[]; onToggle:(id:string)=>void
}) {
  const [cat,    setCat]    = useState("Todos")
  const [search, setSearch] = useState("")
  const filtered = catalog.filter(s =>
    (cat==="Todos"||s.categoria===cat) &&
    (!search||s.label.toLowerCase().includes(search.toLowerCase()))
  )
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:3,color:"#ccc",fontSize:9,padding:"5px 8px",outline:"none",fontFamily:"monospace"}} />
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
        {["Todos",...CATEGORIAS].map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{fontSize:7,padding:"1px 5px",borderRadius:2,
            background:cat===c?"#FFA02822":"transparent", color:cat===c?"#FFA028":"#333",
            border:`1px solid ${cat===c?"#FFA02844":"#111"}`, cursor:"pointer",fontFamily:"monospace"}}>
            {c==="Todos"?"All":c}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:2,overflowY:"auto",maxHeight:320}}>
        {filtered.map(s=>{
          const idx=selected.indexOf(s.id), isSel=idx>=0
          const color=isSel?DEFAULT_COLORS[idx%DEFAULT_COLORS.length]:undefined
          return (
            <div key={s.id} onClick={()=>onToggle(s.id)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",
                background:isSel?"#0a0a0a":"transparent",
                border:`1px solid ${isSel?(color??"#333"):"#111"}`,
                borderRadius:3, cursor:selected.length>=5&&!isSel?"not-allowed":"pointer",
                opacity:selected.length>=5&&!isSel?0.35:1}}>
              <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:isSel?(color??"#333"):"#1a1a1a"}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,color:isSel?"#ccc":"#555"}}>{s.label}</div>
                <div style={{fontSize:7,color:"#2a2a2a"}}>{s.unidad}</div>
              </div>
              {isSel && <span style={{fontSize:8,color,fontWeight:700}}>#{idx+1}</span>}
            </div>
          )
        })}
      </div>
      <div style={{fontSize:8,color:"#2a2a2a"}}>{selected.length}/5 seleccionadas</div>
    </div>
  )
}

// ── CSV Upload ────────────────────────────────────────────────────────────────

interface CustomSerie {
  meta:  SerieMetadata
  data:  DataPoint[]
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
  /^\d{2}\/\d{2}\/\d{4}$/,                  // DD/MM/YYYY
  /^\d{2}\/\d{2}\/\d{2}$/,                  // DD/MM/YY
  /^\d{4}-\d{2}$/,                           // YYYY-MM
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
]

function isDateLike(val: string) {
  return DATE_PATTERNS.some(p => p.test(val.trim()))
}

function normalizeDate(val: string): string {
  const v = val.trim()
  // DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d,m,y] = v.split("/"); return `${y}-${m}-${d}`
  }
  // DD/MM/YY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(v)) {
    const [d,m,y] = v.split("/"); return `20${y}-${m}-${d}`
  }
  return v
}

function parseCSV(text: string): CustomSerie[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  // Detectar separador
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g,""))

  // Detectar columna de fecha (primer col que parezca fecha en los datos)
  const sample = lines.slice(1,6).map(l => l.split(sep))
  let dateCol = -1
  for (let c = 0; c < headers.length; c++) {
    if (sample.filter(r => r[c] && isDateLike(r[c].trim())).length >= 2) {
      dateCol = c; break
    }
  }
  if (dateCol === -1) dateCol = 0 // fallback: primera columna

  // Columnas numéricas
  const numCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== dateCol)
    .filter(({ i }) => {
      const vals = sample.map(r => r[i]?.trim().replace(",",".")).filter(Boolean)
      return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)))
    })

  if (!numCols.length) return []

  const dataRows = lines.slice(1).map(l => {
    const cells = l.split(sep).map(c => c.trim().replace(/^"|"$/g,""))
    return cells
  }).filter(r => r[dateCol] && isDateLike(r[dateCol]))

  return numCols.map(({ h, i }) => ({
    meta: {
      id:         `csv_${h.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")}`,
      label:      `📂 ${h}`,
      unidad:     "csv",
      categoria:  "CSV",
      frecuencia: "variable",
    },
    data: dataRows
      .map(r => ({ date: normalizeDate(r[dateCol]), value: parseFloat(r[i].replace(",",".")) }))
      .filter(p => !isNaN(p.value))
      .sort((a,b) => a.date.localeCompare(b.date)),
  }))
}

// ── Auditor de datos ──────────────────────────────────────────────────────────

type Severity = "ok" | "warn" | "error"

interface AuditIssue {
  severity: Severity
  mensaje:  string
  detalle?: string
}

interface AuditResult {
  serieId:   string
  serieLabel:string
  filas:     number
  issues:    AuditIssue[]
  aprobado:  boolean
}

function auditSerie(serie: CustomSerie): AuditResult {
  const { data, meta } = serie
  const issues: AuditIssue[] = []

  // 1. Mínimo de puntos
  if (data.length < 2) {
    issues.push({ severity:"error", mensaje:"Menos de 2 puntos de datos — insuficiente para graficar" })
  }

  // 2. Fechas duplicadas
  const dateSet = new Set(data.map(p => p.date))
  if (dateSet.size < data.length) {
    const dups = data.length - dateSet.size
    issues.push({ severity:"warn", mensaje:`${dups} fecha(s) duplicada(s)`, detalle:"Se usará el primer valor de cada fecha duplicada" })
  }

  // 3. Fechas fuera de orden
  const sorted = [...data].sort((a,b) => a.date.localeCompare(b.date))
  const outOfOrder = data.some((p,i) => p.date !== sorted[i]?.date)
  if (outOfOrder) {
    issues.push({ severity:"warn", mensaje:"Fechas fuera de orden cronológico", detalle:"Se reordenarán automáticamente" })
  }

  // 4. Valores nulos / NaN
  const nullCount = data.filter(p => isNaN(p.value) || p.value === null).length
  if (nullCount > 0) {
    const pct = ((nullCount / data.length) * 100).toFixed(1)
    issues.push({
      severity: nullCount / data.length > 0.2 ? "error" : "warn",
      mensaje: `${nullCount} valores nulos (${pct}%)`,
      detalle: nullCount / data.length > 0.2 ? "Más del 20% de los datos son nulos" : "Se omitirán en el gráfico"
    })
  }

  // 5. Outliers extremos (z-score > 4)
  const vals = data.map(p => p.value).filter(v => !isNaN(v))
  if (vals.length > 4) {
    const mean = vals.reduce((s,v) => s+v, 0) / vals.length
    const std  = Math.sqrt(vals.reduce((s,v) => s+(v-mean)**2, 0) / vals.length)
    const outliers = vals.filter(v => Math.abs(v - mean) > 4 * std)
    if (outliers.length > 0 && std > 0) {
      issues.push({
        severity: "warn",
        mensaje: `${outliers.length} outlier(s) extremo(s) detectado(s)`,
        detalle: `Valores fuera de 4σ: ${outliers.slice(0,3).map(v => v.toFixed(2)).join(", ")}${outliers.length > 3 ? "..." : ""}`,
      })
    }
  }

  // 6. Columna toda ceros
  const allZero = vals.every(v => v === 0)
  if (allZero && vals.length > 0) {
    issues.push({ severity:"error", mensaje:"Todos los valores son cero — posible error de columna" })
  }

  // 7. Gaps temporales grandes (para series mensuales)
  if (data.length > 10) {
    const dates = data.map(p => new Date(p.date).getTime()).filter(t => !isNaN(t)).sort((a,b)=>a-b)
    if (dates.length > 2) {
      const gaps = dates.slice(1).map((t,i) => t - dates[i])
      const medGap = gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]
      const bigGaps = gaps.filter(g => g > medGap * 3).length
      if (bigGaps > 0) {
        issues.push({ severity:"warn", mensaje:`${bigGaps} gap(s) temporal(es) inusualmente grande(s)`, detalle:"Posibles datos faltantes en el período" })
      }
    }
  }

  // 8. Rango de fechas sospechoso
  const minDate = data[0]?.date ?? ""
  const maxDate = data.at(-1)?.date ?? ""
  const minYear = parseInt(minDate.slice(0,4))
  const maxYear = parseInt(maxDate.slice(0,4))
  if (minYear < 1900 || maxYear > 2100) {
    issues.push({ severity:"error", mensaje:`Fechas fuera de rango razonable (${minDate} → ${maxDate})` })
  }

  const hasErrors = issues.some(i => i.severity === "error")
  return {
    serieId:    meta.id,
    serieLabel: meta.label,
    filas:      data.length,
    issues,
    aprobado:   !hasErrors,
  }
}

// ── Panel CSV con auditor + ayuda Pizi ────────────────────────────────────────

const FORMAT_HELP = `¿Qué formato acepta el cargador de CSV de La Pizarra PIVOT?

**Estructura básica:**
- Una columna de **fecha** + una o más columnas **numéricas**
- Primera fila: encabezados de columna

**Formatos de fecha aceptados:**
- \`YYYY-MM-DD\` → 2024-03-15 (recomendado)
- \`DD/MM/YYYY\` → 15/03/2024
- \`YYYY-MM\` → 2024-03 (mensual)

**Separadores:** coma (,) punto y coma (;) o tabulación

**Ejemplo válido:**
\`\`\`
fecha,ventas,costos
2024-01-01,1500,900
2024-02-01,1800,950
\`\`\`

**Límites:** máx 5 MB · 5.000 filas por serie · solo números en columnas de datos`

function CSVUploadPanel({ onLoad }: { onLoad: (series: CustomSerie[]) => void }) {
  const [step,        setStep]        = useState<"idle"|"auditando"|"auditado"|"cargado">("idle")
  const [parsed,      setParsed]      = useState<CustomSerie[]>([])
  const [audits,      setAudits]      = useState<AuditResult[]>([])
  const [piziHelp,    setPiziHelp]    = useState<string|null>(null)
  const [piziLoading, setPiziLoading] = useState(false)
  const [parseError,  setParseError]  = useState<string|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setParseError(null); setAudits([]); setPiziHelp(null)
    if (!file.name.match(/\.(csv|txt)$/i)) { setParseError("Solo archivos .csv o .txt"); return }
    if (file.size > 5 * 1024 * 1024)        { setParseError("Máximo 5 MB"); return }

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const result = parseCSV(text)
      if (!result.length) { setParseError("No se encontraron columnas numéricas con fechas. Revisá el formato."); return }
      const trimmed = result.map(s => ({ ...s, data: s.data.slice(-5000) }))
      setParsed(trimmed)
      setStep("auditando")
      // Auditar
      const auditResults = trimmed.map(auditSerie)
      setAudits(auditResults)
      setStep("auditado")
    }
    reader.onerror = () => setParseError("Error leyendo el archivo")
    reader.readAsText(file, "UTF-8")
  }

  const askPiziFormat = async () => {
    setPiziLoading(true)
    const res = await fetch("/api/agente/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: FORMAT_HELP, model: "haiku-4.5" }),
    })
    const d = await res.json() as { answer?: string }
    setPiziHelp(d.answer ?? FORMAT_HELP)
    setPiziLoading(false)
  }

  const confirmLoad = () => {
    const approved = parsed.filter((_,i) => audits[i]?.aprobado)
    if (!approved.length) return
    onLoad(approved)
    setStep("cargado")
  }

  const allOk   = audits.every(a => a.aprobado)
  const someOk  = audits.some(a => a.aprobado)
  const hasWarn = audits.some(a => a.issues.some(i => i.severity === "warn"))

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>

      {/* Drop zone */}
      {step === "idle" && (
        <>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }}
            onClick={() => inputRef.current?.click()}
            style={{ border:"1px dashed #333", borderRadius:4, padding:"16px 10px",
              textAlign:"center", cursor:"pointer", background:"#050505",
              transition:"border-color 0.15s" }}
          >
            <div style={{fontSize:22, color:"#444", marginBottom:4}}>⬆</div>
            <div style={{fontSize:9, color:"#555"}}>Arrastrá un .csv o clickeá</div>
            <div style={{fontSize:8, color:"#2a2a2a", marginTop:2}}>Máx 5 MB · 5.000 filas</div>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.txt" style={{display:"none"}}
            onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f) }} />

          {/* Botón ayuda Pizi */}
          <button onClick={askPiziFormat} disabled={piziLoading} style={{
            fontSize:9, padding:"6px 8px", borderRadius:3,
            background:"#0a0e14", color:"#4FC3F7",
            border:"1px solid #4FC3F744", cursor:"pointer", fontFamily:"monospace", fontWeight:600,
          }}>{piziLoading ? "···" : "💬 ¿Qué formato acepta Pizi?"}</button>

          {piziHelp && (
            <div style={{ background:"#080810", border:"1px solid #1a1a2a", borderRadius:3,
              padding:"10px", fontSize:9, color:"#aaa", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
              {piziHelp}
            </div>
          )}

          {/* Formato rápido */}
          {!piziHelp && (
            <div style={{fontSize:8, color:"#2a2a2a", lineHeight:1.6}}>
              <div style={{color:"#333", marginBottom:2}}>Formatos de fecha:</div>
              {["YYYY-MM-DD  →  2024-03-15","DD/MM/YYYY  →  15/03/2024","YYYY-MM     →  2024-03"].map(f=>(
                <div key={f} style={{fontFamily:"monospace", color:"#2a2a2a"}}>{f}</div>
              ))}
            </div>
          )}

          {parseError && (
            <div style={{fontSize:9, color:"#FF433D", background:"#1a0808",
              border:"1px solid #FF433D44", borderRadius:3, padding:"6px 8px"}}>
              ⚠ {parseError}
            </div>
          )}
        </>
      )}

      {/* Auditando */}
      {step === "auditando" && (
        <div style={{fontSize:9, color:"#FFA028", padding:"10px 0"}}>
          Auditando datos ···
        </div>
      )}

      {/* Resultado de auditoría */}
      {step === "auditado" && (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <div style={{fontSize:9, color:"#888", fontWeight:600}}>
            INFORME DE AUDITORÍA — {parsed.length} serie(s)
          </div>

          {audits.map((audit, i) => (
            <div key={audit.serieId} style={{
              background: audit.aprobado ? "#080808" : "#100808",
              border: `1px solid ${audit.aprobado ? "#222" : "#FF433D44"}`,
              borderLeft: `3px solid ${audit.aprobado ? "#4AF6C3" : "#FF433D"}`,
              borderRadius:3, padding:"8px 10px",
            }}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5}}>
                <span style={{fontSize:10, color:"#ccc", fontWeight:600}}>{audit.serieLabel.replace("📂 ","")}</span>
                <span style={{fontSize:8, padding:"1px 6px", borderRadius:2,
                  background: audit.aprobado ? "#4AF6C322":"#FF433D22",
                  color: audit.aprobado ? "#4AF6C3":"#FF433D"}}>
                  {audit.aprobado ? "✓ APROBADA" : "✗ RECHAZADA"}
                </span>
              </div>
              <div style={{fontSize:8, color:"#444", marginBottom:5}}>
                {audit.filas} filas · {parsed[i]?.data[0]?.date} → {parsed[i]?.data.at(-1)?.date}
              </div>
              {audit.issues.length === 0 ? (
                <div style={{fontSize:8, color:"#4AF6C3"}}>✓ Sin inconsistencias detectadas</div>
              ) : (
                <div style={{display:"flex", flexDirection:"column", gap:3}}>
                  {audit.issues.map((issue, j) => (
                    <div key={j} style={{fontSize:8, lineHeight:1.4}}>
                      <span style={{color: issue.severity==="error"?"#FF433D":issue.severity==="warn"?"#FFA028":"#4AF6C3", marginRight:4}}>
                        {issue.severity==="error"?"✗":issue.severity==="warn"?"⚠":"✓"}
                      </span>
                      <span style={{color: issue.severity==="error"?"#FF433D55":issue.severity==="warn"?"#888":"#555"}}>
                        {issue.mensaje}
                      </span>
                      {issue.detalle && <div style={{fontSize:7, color:"#333", marginLeft:12}}>{issue.detalle}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Acciones */}
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            {someOk && (
              <button onClick={confirmLoad} style={{
                flex:1, fontSize:9, padding:"8px", borderRadius:3, fontFamily:"monospace", fontWeight:700,
                background: allOk ? "#FFA028" : "#1a0d00",
                color: allOk ? "#000" : "#FFA028",
                border: allOk ? "none" : "1px solid #FFA02844", cursor:"pointer",
              }}>
                {allOk
                  ? `✓ Cargar ${parsed.length} serie(s)`
                  : `Cargar ${audits.filter(a=>a.aprobado).length} serie(s) aprobada(s)`}
              </button>
            )}
            <button onClick={() => { setParsed([]); setAudits([]); setStep("idle"); setParseError(null) }}
              style={{fontSize:9, padding:"8px 10px", borderRadius:3, background:"transparent",
                color:"#444", border:"1px solid #1a1a1a", cursor:"pointer", fontFamily:"monospace"}}>
              Cancelar
            </button>
          </div>

          {!someOk && (
            <div style={{fontSize:9, color:"#FF433D", lineHeight:1.5}}>
              Ninguna serie pasó la auditoría. Revisá el formato del archivo.
            </div>
          )}
        </div>
      )}

      {step === "cargado" && (
        <div style={{fontSize:9, color:"#4AF6C3", background:"#0a1a0a",
          border:"1px solid #4AF6C344", borderRadius:3, padding:"8px"}}>
          ✓ Series cargadas correctamente
          <button onClick={()=>setStep("idle")} style={{display:"block",marginTop:4,fontSize:8,color:"#555",
            background:"none",border:"none",cursor:"pointer",fontFamily:"monospace"}}>
            Cargar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TabPivot() {
  const [catalog,     setCatalog]     = useState<SerieMetadata[]>([])
  const [catalogOk,   setCatalogOk]   = useState(false)
  const [csvSeries,   setCsvSeries]   = useState<CustomSerie[]>([])
  const [showUpload,  setShowUpload]  = useState(false)
  const [mode,        setMode]        = useState<PivotMode>("simple")
  const [simpleIds,   setSimpleIds]   = useState<string[]>([])
  const [xAxis,       setXAxis]       = useState<string[]>([])
  const [yAxis,       setYAxis]       = useState<string[]>([])
  const [seriesData,  setSeriesData]  = useState<SerieData[]>([])
  const [configs,     setConfigs]     = useState<SerieConfig[]>([])
  const [chartType,   setChartType]   = useState<ChartType>("linea")
  const [period,      setPeriod]      = useState("1y")
  const [loading,     setLoading]     = useState(false)
  const [view,        setView]        = useState<ActiveView>("grafico")
  const [rightPanel,  setRightPanel]  = useState<"pizi"|"config"|"stats">("pizi")
  const [showBrush,   setShowBrush]   = useState(false)
  const [piziNote,    setPiziNote]    = useState<string|null>(null)
  const [piziSugg,    setPiziSugg]    = useState<{tipo:ChartType;razon:string}[]>([])
  const [piziLoading, setPiziLoading] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  const loadCatalog = useCallback(async () => {
    const res = await fetch("/api/pivot?series=catalog")
    const d   = await res.json() as {catalog:SerieMetadata[]}
    setCatalog(d.catalog); setCatalogOk(true)
  }, [])
  if (!catalogOk) loadCatalog()

  // Catálogo combinado: API + CSV subidos
  const fullCatalog = useMemo(
    () => [...catalog, ...csvSeries.map(s => s.meta)],
    [catalog, csvSeries]
  )

  const handleCSVLoad = useCallback((newSeries: CustomSerie[]) => {
    setCsvSeries(prev => {
      // Evitar duplicados por id
      const existing = new Set(prev.map(s => s.meta.id))
      const fresh = newSeries.filter(s => !existing.has(s.meta.id))
      return [...prev, ...fresh]
    })
    setShowUpload(false)
  }, [])

  const isScatter  = chartType === "scatter"
  const activeXIds = mode==="simple" ? [] : xAxis
  const activeYIds = mode==="simple" ? simpleIds : yAxis
  const allUsedIds = [...new Set([...activeXIds,...activeYIds])]

  // Sync configs cuando cambian las series
  const syncConfigs = useCallback((ids: string[]) => {
    setConfigs(prev => {
      const existing = new Map(prev.map(c=>[c.id,c]))
      return ids.map((id,i) => existing.get(id) ?? {
        id, color: DEFAULT_COLORS[i%DEFAULT_COLORS.length],
        transform:"ninguna", axis:"left", strokeWidth:1.5, dotted:false, hidden:false,
      })
    })
  }, [])

  const toggleSimple = useCallback((id:string) => {
    setSimpleIds(prev => {
      const next = prev.includes(id) ? prev.filter(s=>s!==id) : prev.length>=5 ? prev : [...prev,id]
      syncConfigs(next)
      return next
    })
    setPiziNote(null); setPiziSugg([])
  }, [syncConfigs])

  const addToAxis = useCallback((axis:"x"|"y", id:string) => {
    if (axis==="x") setXAxis(prev => {
      const next = prev.includes(id)?prev: isScatter?[id]:prev.length>=1?prev:[...prev,id]
      syncConfigs([...new Set([...next,...yAxis])])
      return next
    })
    else setYAxis(prev => {
      const next = prev.includes(id)?prev: isScatter?[id]:prev.length>=4?prev:[...prev,id]
      syncConfigs([...new Set([...xAxis,...next])])
      return next
    })
    setPiziNote(null); setPiziSugg([])
  }, [isScatter, xAxis, yAxis, syncConfigs])

  const updateConfig = useCallback((id:string, patch:Partial<SerieConfig>) => {
    setConfigs(prev => prev.map(c => c.id===id ? {...c,...patch} : c))
  }, [])

  const clearAll = () => {
    setXAxis([]); setYAxis([]); setSimpleIds([])
    setSeriesData([]); setConfigs([]); setPiziNote(null); setPiziSugg([]); setPiziCombos([])
  }

  const applyCombo = (combo:typeof QUICK_COMBOS[0]) => {
    setMode(combo.mode)
    if (combo.mode==="ejes") { setXAxis(combo.x); setYAxis(combo.y); setChartType("scatter") }
    else { setSimpleIds(combo.y); setChartType("linea") }
    syncConfigs(combo.mode==="ejes" ? [...combo.x,...combo.y] : combo.y)
    setSeriesData([]); setPiziNote(null); setPiziSugg([])
  }

  const fetchData = useCallback(async () => {
    if (!allUsedIds.length) return
    setLoading(true); setPiziNote(null)

    const csvIds = allUsedIds.filter(id => id.startsWith("csv_"))
    const apiIds = allUsedIds.filter(id => !id.startsWith("csv_"))

    // Fetch series de API
    const apiResults: SerieData[] = apiIds.length
      ? await fetch(`/api/pivot?series=${apiIds.join(",")}&period=${period}`)
          .then(r => r.json())
          .then((d: {series:SerieData[]}) => d.series)
          .catch(() => [])
      : []

    // Series CSV locales (no requieren fetch)
    const csvResults: SerieData[] = csvIds.map(id => {
      const found = csvSeries.find(s => s.meta.id === id)
      return found ? { id, data: found.data } : { id, data: [], error: "No encontrada" }
    })

    setSeriesData([...apiResults, ...csvResults])
    setLoading(false)
  }, [allUsedIds, period, csvSeries])

  // Export PNG
  const exportPNG = async () => {
    if (!chartRef.current) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h2c = (await import("html2canvas" as any)).default
      const canvas = await h2c(chartRef.current, { backgroundColor:"#000", scale:2 })
      Object.assign(document.createElement("a"),{href:canvas.toDataURL("image/png"),download:"pivot.png"}).click()
    } catch {
      alert("Para exportar PNG: npm install html2canvas")
    }
  }

  // Pizi sugerencias
  // Ref para evitar stale closure en suggestCharts/askPizi
  const allUsedIdsRef = useRef<string[]>([])
  allUsedIdsRef.current = allUsedIds
  const catalogRef = useRef<SerieMetadata[]>([])
  catalogRef.current = catalog

  const [piziCombos, setPiziCombos] = useState<{ids:string[];label:string;tipo:ChartType;explicacion:string}[]>([])

  const suggestCharts = useCallback(async () => {
    const ids = allUsedIdsRef.current
    setPiziLoading(true); setPiziSugg([]); setPiziCombos([]); setPiziNote(null)

    try {
      const res = await fetch("/api/pivot/suggest", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ selected_ids: ids }),
      })
      const d = await res.json() as { suggestions?: unknown[]; error?: string }

      if (!res.ok || d.error) {
        setPiziNote(d.error ?? "No pude generar sugerencias.")
      } else {
        setPiziCombos((d.suggestions ?? []) as {ids:string[];label:string;tipo:ChartType;explicacion:string}[])
      }
    } catch (e) {
      setPiziNote("Error de conexión con el asistente.")
    }
    setPiziLoading(false)
  }, [])

  const askPizi = useCallback(async () => {
    if (!seriesData.length) return
    setPiziLoading(true); setPiziSugg([])
    const meta = allUsedIdsRef.current.map(id=>catalogRef.current.find(c=>c.id===id)?.label??id)
    const resumen = seriesData.map(s=>{
      const last=s.data.at(-1); const first=s.data.at(0)
      return `${s.id}(${s.data.length}pts,último:${last?.value?.toFixed(2)})`
    }).join("; ")
    const res = await fetch("/api/agente/chat",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:`Gráfico "${chartType}" con: ${meta.join(",")}. Datos: ${resumen}. Explicá en 3 oraciones qué muestra y si hay patrón notable.`,
        model:"haiku-4.5",
      }),
    })
    const d = await res.json() as {answer?:string}
    setPiziNote(d.answer??"—")
    setPiziLoading(false)
  }, [allUsedIds, seriesData, chartType, catalog])

  const selectedMeta = useMemo(
    ()=>allUsedIds.map(id=>fullCatalog.find(c=>c.id===id)).filter(Boolean) as SerieMetadata[],
    [allUsedIds,fullCatalog]
  )

  return (
    <div style={{display:"flex",gap:1,background:"#111",height:"calc(100dvh - 68px)",fontFamily:"monospace"}}>

      {/* ── Panel izquierdo ── */}
      <div style={{width:230,flexShrink:0,background:"#000",display:"flex",flexDirection:"column"}}>
        <div className="bbg-panel-header" style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#FFA028"}}>▐</span> SERIES
        </div>
        {/* Toggle modo */}
        <div style={{display:"flex",borderBottom:"1px solid #0d0d0d"}}>
          {(["simple","ejes"] as PivotMode[]).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setSeriesData([]);setPiziNote(null)}} style={{
              flex:1,fontSize:8,padding:"5px",cursor:"pointer",fontFamily:"monospace",
              background:mode===m?"#0d0d0d":"transparent",
              color:mode===m?"#FFA028":"#333", border:"none",
              borderBottom:`2px solid ${mode===m?"#FFA028":"transparent"}`,
            }}>{m==="simple"?"✓ Simple":"⠿ Ejes X/Y"}</button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 8px"}}>
          {!catalogOk && <div style={{fontSize:9,color:"#333",padding:8}}>Cargando ···</div>}
          {/* Botón de carga CSV */}
          <div style={{marginBottom:6}}>
            <button onClick={()=>setShowUpload(v=>!v)} style={{
              width:"100%",fontSize:9,padding:"6px",borderRadius:3,
              background:showUpload?"#0a1a0a":"transparent",
              color:showUpload?"#4AF6C3":"#555",
              border:`1px solid ${showUpload?"#4AF6C344":"#1a1a1a"}`,
              cursor:"pointer",fontFamily:"monospace",fontWeight:600,
            }}>
              ⬆ Cargar CSV propio {csvSeries.length>0&&`(${csvSeries.length} serie${csvSeries.length>1?"s":""})`}
            </button>
            {showUpload && (
              <div style={{marginTop:6}}>
                <CSVUploadPanel onLoad={handleCSVLoad} />
                {csvSeries.length>0 && (
                  <button onClick={()=>{setCsvSeries([]);setShowUpload(false)}} style={{
                    marginTop:4,fontSize:8,color:"#FF433D",background:"none",border:"none",
                    cursor:"pointer",fontFamily:"monospace",
                  }}>✕ Quitar datos CSV</button>
                )}
              </div>
            )}
          </div>

          {catalogOk && mode==="simple" && <SimpleSelector catalog={fullCatalog} selected={simpleIds} onToggle={toggleSimple} />}
          {catalogOk && mode==="ejes" && (
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <div style={{fontSize:8,color:"#333",marginBottom:4}}>Arrastrá a los ejes →</div>
              {fullCatalog.map(s=><SerieItem key={s.id} s={s} usedIds={allUsedIds}/>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel central ── */}
      <div style={{flex:1,minWidth:0,background:"#000",display:"flex",flexDirection:"column"}}>

        {/* Drop zones — solo modo ejes */}
        {mode==="ejes" && (
          <div style={{padding:"8px 10px",borderBottom:"1px solid #0d0d0d",display:"flex",gap:8}}>
            <DropZone label="Eje X" color="#4FC3F7" ids={xAxis} meta={selectedMeta}
              maxItems={isScatter?1:1} onDrop={id=>addToAxis("x",id)} onRemove={id=>setXAxis(p=>p.filter(s=>s!==id))} />
            <DropZone label="Eje Y" color="#4AF6C3" ids={yAxis} meta={selectedMeta}
              maxItems={isScatter?1:4} onDrop={id=>addToAxis("y",id)} onRemove={id=>setYAxis(p=>p.filter(s=>s!==id))} />
          </div>
        )}

        {/* Toolbar */}
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderBottom:"1px solid #0d0d0d",flexWrap:"wrap"}}>
          {CHART_TYPES.map(ct=>(
            <button key={ct.id} onClick={()=>setChartType(ct.id)} title={ct.desc} style={{
              fontSize:9,padding:"3px 7px",borderRadius:2,
              background:chartType===ct.id?"#1a1a1a":"transparent",
              color:chartType===ct.id?"#FFA028":"#444",
              border:`1px solid ${chartType===ct.id?"#FFA028":"#1a1a1a"}`,
              cursor:"pointer",fontFamily:"monospace",
            }}>{ct.icon} {ct.label}</button>
          ))}
          <div style={{width:1,height:14,background:"#1a1a1a"}} />
          {PERIODS.map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
              fontSize:9,padding:"3px 6px",borderRadius:2,
              background:period===p.id?"#1a1a1a":"transparent",
              color:period===p.id?"#4FC3F7":"#444",
              border:`1px solid ${period===p.id?"#4FC3F7":"#1a1a1a"}`,
              cursor:"pointer",fontFamily:"monospace",
            }}>{p.label}</button>
          ))}
          <div style={{width:1,height:14,background:"#1a1a1a"}} />
          {/* Brush toggle */}
          <button onClick={()=>setShowBrush(b=>!b)} title="Selector de rango" style={{
            fontSize:9,padding:"3px 7px",borderRadius:2,
            background:showBrush?"#1a1a1a":"transparent",
            color:showBrush?"#ce93d8":"#444",
            border:`1px solid ${showBrush?"#ce93d8":"#1a1a1a"}`,
            cursor:"pointer",fontFamily:"monospace",
          }}>⇔ Zoom</button>

          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
            {(["grafico","tabla","estadisticas"] as ActiveView[]).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                fontSize:9,padding:"3px 7px",borderRadius:2,
                background:view===v?"#1a1a1a":"transparent",
                color:view===v?"#ccc":"#444",
                border:`1px solid ${view===v?"#333":"#111"}`,
                cursor:"pointer",fontFamily:"monospace",
              }}>{v==="grafico"?"Gráfico":v==="tabla"?"Tabla":"Stats"}</button>
            ))}
            <button onClick={exportPNG} title="Exportar PNG" style={{
              fontSize:9,padding:"3px 7px",borderRadius:2,background:"transparent",
              color:"#444",border:"1px solid #111",cursor:"pointer",fontFamily:"monospace",
            }}>↓ PNG</button>
            {allUsedIds.length>0 && (
              <button onClick={clearAll} style={{
                fontSize:9,padding:"3px 7px",borderRadius:2,background:"transparent",
                color:"#555",border:"1px solid #111",cursor:"pointer",fontFamily:"monospace",
              }}>✕</button>
            )}
            <button onClick={fetchData} disabled={!allUsedIds.length||loading} style={{
              fontSize:9,padding:"3px 14px",borderRadius:2,
              background:!allUsedIds.length||loading?"#111":"#FFA028",
              color:!allUsedIds.length||loading?"#444":"#000",
              border:"none",cursor:!allUsedIds.length?"default":"pointer",
              fontFamily:"monospace",fontWeight:700,
            }}>{loading?"···":"▶ GRAFICAR"}</button>
          </div>
        </div>

        {/* Chips de series activas */}
        {allUsedIds.length>0 && configs.length>0 && (
          <div style={{display:"flex",gap:4,padding:"4px 10px",borderBottom:"1px solid #080808",flexWrap:"wrap"}}>
            {configs.filter(c=>!c.hidden).map(cfg=>{
              const m=selectedMeta.find(m=>m.id===cfg.id)
              return (
                <span key={cfg.id} style={{
                  fontSize:8,padding:"2px 8px",borderRadius:2,
                  background:cfg.color+"22",color:cfg.color,
                  border:`1px solid ${cfg.color}44`,fontFamily:"monospace",
                }}>
                  {m?.label??cfg.id}
                  {cfg.transform!=="ninguna" && <span style={{color:cfg.color+"88",marginLeft:4}}>[{TRANSFORMS.find(t=>t.id===cfg.transform)?.label}]</span>}
                  {cfg.axis==="right" && <span style={{color:cfg.color+"88",marginLeft:4}}>→R</span>}
                </span>
              )
            })}
          </div>
        )}

        {/* Contenido */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 10px"}}>
          {!allUsedIds.length && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"80%",gap:16}}>
              <div style={{fontSize:36,color:"#1a1a1a"}}>◎</div>
              <div style={{textAlign:"center",fontSize:11,lineHeight:1.8,color:"#2a2a2a"}}>
                {mode==="simple"
                  ? <>Clickeá series y presioná <span style={{color:"#FFA028"}}>▶ GRAFICAR</span></>
                  : <>Arrastrá series a los ejes <span style={{color:"#4FC3F7"}}>X</span> / <span style={{color:"#4AF6C3"}}>Y</span></>}
              </div>
            </div>
          )}
          {loading && <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:"#444",fontSize:11}}>Cargando datos ···</div>}
          {seriesData.length>0 && !loading && (
            <>
              {view==="grafico" && (
                <div ref={chartRef}>
                  <PivotChart chartType={chartType} xIds={activeXIds} configs={configs}
                    seriesData={seriesData} seriesMeta={selectedMeta} showBrush={showBrush} />
                </div>
              )}
              {view==="tabla" && <PivotTable configs={configs} seriesData={seriesData} seriesMeta={selectedMeta} />}
              {view==="estadisticas" && <StatsPanel configs={configs} seriesData={seriesData} meta={selectedMeta} />}
            </>
          )}
        </div>
      </div>

      {/* ── Panel derecho ── */}
      <div style={{width:220,flexShrink:0,background:"#000",display:"flex",flexDirection:"column"}}>
        <div className="bbg-panel-header" style={{display:"flex",alignItems:"center",gap:0}}>
          {(["pizi","config","stats"] as const).map(p=>(
            <button key={p} onClick={()=>setRightPanel(p)} style={{
              flex:1,fontSize:8,padding:"5px 4px",cursor:"pointer",fontFamily:"monospace",
              background:rightPanel===p?"#0d0d0d":"transparent",
              color:rightPanel===p?"#FFA028":"#333", border:"none",
              borderBottom:`2px solid ${rightPanel===p?"#FFA028":"transparent"}`,
            }}>{p==="pizi"?"💬 Pizi":p==="config"?"⚙ Series":"◎ Stats"}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"8px"}}>

          {/* Pizi */}
          {rightPanel==="pizi" && (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {/* Sugerir — siempre disponible */}
              <button onClick={suggestCharts} disabled={piziLoading} style={{
                fontSize:9, padding:"8px", borderRadius:3,
                background: piziLoading ? "#0a0a0a" : "#0a0e14",
                color:      piziLoading ? "#333"    : "#4FC3F7",
                border:`1px solid ${piziLoading ? "#111" : "#4FC3F744"}`,
                cursor: piziLoading ? "default" : "pointer",
                fontFamily:"monospace", fontWeight:700,
              }}>{piziLoading && !seriesData.length ? "Pensando ···" : "💡 Sugerir análisis"}</button>

              {/* Combinaciones sugeridas por Pizi */}
              {piziCombos.length > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:8,color:"#333",letterSpacing:1}}>PIZI RECOMIENDA</div>
                  {piziCombos.map((combo: {label:string;ids:string[];tipo:ChartType;explicacion:string}, i:number) => {
                    const ct       = CHART_TYPES.find(c => c.id === combo.tipo)
                    const serMeta  = (combo.ids ?? [])
                      .map((id:string) => fullCatalog.find(c => c.id === id))
                      .filter(Boolean) as SerieMetadata[]
                    if (!serMeta.length) return null
                    return (
                      <div key={i} style={{
                        background:"#080810", border:"1px solid #1a1a2a",
                        borderRadius:4, padding:"10px 10px",
                        display:"flex", flexDirection:"column", gap:6,
                      }}>
                        {/* Nombre */}
                        <div style={{fontSize:10, color:"#fff", fontWeight:700}}>
                          {combo.label}
                          {i === 0 && <span style={{fontSize:7,color:"#4FC3F7",marginLeft:5}}>★ top</span>}
                        </div>
                        {/* Series */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                          {serMeta.map((m,j) => (
                            <span key={m.id} style={{
                              fontSize:8, padding:"2px 6px", borderRadius:2,
                              background: DEFAULT_COLORS[j%DEFAULT_COLORS.length]+"22",
                              color:      DEFAULT_COLORS[j%DEFAULT_COLORS.length],
                              border:`1px solid ${DEFAULT_COLORS[j%DEFAULT_COLORS.length]}44`,
                              fontFamily:"monospace",
                            }}>{m.label}</span>
                          ))}
                        </div>
                        {/* Tipo de gráfico */}
                        <div style={{fontSize:8, color:"#4FC3F7", display:"flex", alignItems:"center", gap:4}}>
                          <span>{ct?.icon}</span>
                          <span style={{fontWeight:600}}>{ct?.label ?? combo.tipo}</span>
                          <span style={{color:"#333"}}>recomendado</span>
                        </div>
                        {/* Explicación */}
                        <div style={{fontSize:8.5, color:"#666", lineHeight:1.5}}>{combo.explicacion}</div>
                        {/* Botón aplicar todo */}
                        <button
                          onClick={() => {
                            setMode("simple")
                            const next = combo.ids.slice(0,5)
                            setSimpleIds(next)
                            syncConfigs(next)
                            setChartType(combo.tipo)
                            setSeriesData([])
                            setPiziCombos([])
                          }}
                          style={{
                            fontSize:9, padding:"6px", borderRadius:3, fontFamily:"monospace", fontWeight:700,
                            background:"#4FC3F722", color:"#4FC3F7",
                            border:"1px solid #4FC3F744", cursor:"pointer",
                          }}
                        >
                          ▶ Aplicar y graficar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={askPizi} disabled={!seriesData.length||piziLoading} style={{
                fontSize:9,padding:"8px",borderRadius:3,
                background:!seriesData.length?"#0a0a0a":"#0e0e14",
                color:!seriesData.length?"#333":"#FFA028",
                border:`1px solid ${!seriesData.length?"#111":"#FFA028"}`,
                cursor:!seriesData.length?"default":"pointer",
                fontFamily:"monospace",fontWeight:700,
              }}>{piziLoading&&seriesData.length?"Analizando ···":"💬 Explicar gráfico"}</button>

              {piziNote && (
                <div style={{background:"#0e0e14",border:"1px solid #1e1e2a",borderRadius:3,padding:"10px",fontSize:9.5,color:"#bbb",lineHeight:1.6}}>
                  {piziNote}
                </div>
              )}

              <div style={{fontSize:8,color:"#2a2a2a",letterSpacing:1,marginTop:4}}>COMBOS RÁPIDOS</div>
              {QUICK_COMBOS.map(combo=>(
                <button key={combo.label} onClick={()=>applyCombo(combo)} style={{
                  display:"block",width:"100%",textAlign:"left",
                  fontSize:9,padding:"5px 8px",borderRadius:2,
                  background:"transparent",color:"#444",
                  border:"1px solid #0d0d0d",cursor:"pointer",fontFamily:"monospace",
                }}>▸ {combo.label}</button>
              ))}
            </div>
          )}

          {/* Config de series */}
          {rightPanel==="config" && configs.length>0 && (
            <SerieConfigPanel configs={configs} meta={selectedMeta} onChange={updateConfig} />
          )}
          {rightPanel==="config" && configs.length===0 && (
            <div style={{fontSize:10,color:"#333",padding:"10px 0"}}>Graficá primero para configurar series.</div>
          )}

          {/* Stats */}
          {rightPanel==="stats" && seriesData.length>0 && (
            <StatsPanel configs={configs} seriesData={seriesData} meta={selectedMeta} />
          )}
          {rightPanel==="stats" && !seriesData.length && (
            <div style={{fontSize:10,color:"#333",padding:"10px 0"}}>Graficá para ver estadísticas.</div>
          )}
        </div>
      </div>
    </div>
  )
}
