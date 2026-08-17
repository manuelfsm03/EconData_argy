/**
 * TabCalendario — Calendario de mercados (bonos, vencimientos, LECAPs, macro, Fed, earnings)
 *
 * FECHAS (aproximadas): pagos de bonos, vencimientos y LECAPs derivados de src/lib/bonds-data.ts
 *   (BOND_DEFS.cashflows + BOND_DEFS.vencimiento + CAP_INSTRUMENT_DEFS.vencimiento), solo futuras
 *   desde HOY (2026-08-09). Son fechas de PROSPECTO: aproximadas (los soberanos HD suelen figurar
 *   9-jul, feriado, y liquidar el día hábil siguiente).
 * ⚠️ MONTOS NO VALIDADOS: los cupón%/amort% de bonds-data.ts tienen errores conocidos (Donna) y
 *   NO se muestran como dato firme. Se validarán con el motor de bonos → futuro `bond-schedule.ts`.
 * FOMC (Fed): conectado a /api/calendario/fomc (fechas oficiales, fijas, no requiere fetch en
 *   vivo real -- ver src/server/domain/fomc-calendar.ts). Se fetchea una vez al montar y se
 *   combina con los eventos derivados de bonos.
 * Fuente NO conectada (sin fechas inventadas): macro AR (INDEC IPC/EMAE, BCRA REM, BCRA IPOM),
 *   licitaciones del Tesoro y earnings de empresas AR — capacidad ya visible en la UI.
 * Alarmas ("avisarme N días antes"): SOLO UI de preferencias (vista previa). La entrega
 *   real (push/email) es Fase 2: requiere identidad de usuario, scheduler durable e idempotencia.
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { BOND_DEFS, CAP_INSTRUMENT_DEFS } from "@/server/domain/bonds-data"
import type { FomcMeeting } from "@/server/domain/fomc-calendar"

// ── Tipos ───────────────────────────────────────────────────────────────────
type TipoEvento = "bono" | "vencimiento" | "lecap" | "licitacion" | "macro" | "internacional" | "earnings"
// "pendiente" = impacto sin clasificar (montos de bono en revisión — no marcar ALTO por montos falsos)
type Impacto = "alto" | "medio" | "bajo" | "pendiente"
interface CalEvent {
  fecha: string
  tipo: TipoEvento
  pais: string
  activo: string
  titulo: string
  detalle: string
  fuente: string
  impacto: Impacto
  estado: string
  cupon?: number
  amortizacion?: number
}

// ── Constantes ──────────────────────────────────────────────────────────────
// HOY dinámico en zona horaria de Argentina (evita corrimientos cerca de medianoche
// si el server corre en otro huso). en-CA formatea como YYYY-MM-DD.
function hoyEnAR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now)
}
const HOY = hoyEnAR()

const TIPO_META: Record<TipoEvento, { label: string; short: string; color: string; real: boolean }> = {
  bono:          { label: "Bono (pago)",   short: "BONO",  color: "var(--amber)",    real: true  },
  vencimiento:   { label: "Vencimiento",   short: "VENC",  color: "var(--negative)", real: true  },
  lecap:         { label: "LECAP",         short: "LECAP", color: "var(--sky)",      real: true  },
  licitacion:    { label: "Licitación",    short: "LICIT", color: "var(--yellow)",   real: false },
  macro:         { label: "Macro AR",      short: "MACRO", color: "#5B9BD5",         real: false },
  internacional: { label: "Internacional", short: "INTL",  color: "#A98EDA",         real: true  },
  earnings:      { label: "Earnings",      short: "EARN",  color: "var(--positive)", real: false },
}
const TIPOS = Object.keys(TIPO_META) as TipoEvento[]
const PAISES = ["AR", "US", "Global"]
const IMPACTOS: Impacto[] = ["alto", "medio", "bajo"]
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const DOW_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

// Capacidades con fuente NO conectada (sin fechas simuladas — honestidad de datos).
// Cada "ejemplo" describe qué dato traería al conectarse.
interface FuenteItem { nombre: string; que: string; freq: string; ticker?: string }
interface Placeholder { tipo: TipoEvento; pais: string; label: string; fuente: string; estado: string; impacto: Impacto; items: FuenteItem[] }
const PLACEHOLDERS: Placeholder[] = [
  {
    tipo: "macro", pais: "AR", label: "Macro Argentina (INDEC / BCRA)", fuente: "INDEC / BCRA — calendario oficial", estado: "fuente no conectada", impacto: "alto",
    items: [
      { nombre: "INDEC · IPC", que: "Inflación mensual (variación de precios al consumidor)", freq: "mensual" },
      { nombre: "INDEC · EMAE", que: "Actividad económica mensual (proxy del PBI)", freq: "mensual" },
      { nombre: "BCRA · REM", que: "Relevamiento de Expectativas de Mercado (inflación, tasa, dólar)", freq: "mensual" },
      { nombre: "BCRA · IPOM", que: "Informe de Política Monetaria: diagnóstico y lineamientos del BCRA", freq: "trimestral" },
    ],
  },
  {
    tipo: "licitacion", pais: "AR", label: "Licitaciones del Tesoro", fuente: "Secretaría de Finanzas / Tesoro", estado: "fuente no conectada", impacto: "medio",
    items: [{ nombre: "Tesoro · Licitación", que: "Colocación de deuda en pesos: instrumentos, montos y tasas adjudicadas", freq: "quincenal" }],
  },
  {
    tipo: "earnings", pais: "AR", label: "Earnings — empresas AR", fuente: "pendiente fuente oficial BYMA / CNV", estado: "fuente no conectada", impacto: "alto",
    items: [
      { nombre: "GGAL", que: "Resultados trimestrales (ingresos, ganancia, ROE)", freq: "trimestral", ticker: "GGAL" },
      { nombre: "YPF", que: "Resultados trimestrales (producción, EBITDA)", freq: "trimestral", ticker: "YPF" },
      { nombre: "PAMP", que: "Resultados trimestrales", freq: "trimestral", ticker: "PAMP" },
      { nombre: "BMA", que: "Resultados trimestrales (banco)", freq: "trimestral", ticker: "BMA" },
      { nombre: "LOMA", que: "Resultados trimestrales", freq: "trimestral", ticker: "LOMA" },
      { nombre: "TXAR", que: "Resultados trimestrales (acero)", freq: "trimestral", ticker: "TXAR" },
      { nombre: "CEPU", que: "Resultados trimestrales (energía)", freq: "trimestral", ticker: "CEPU" },
    ],
  },
]

// Ficha por activo (para la "página del activo" / drawer)
interface AssetMeta { nombre: string; clase: string; color: string; empresa?: boolean }
const ASSET_META: Record<string, AssetMeta> = {
  AL29: { nombre: "Bono Soberano USD Ley Arg. 2029", clase: "Bono soberano", color: "var(--amber)" },
  AL30: { nombre: "Bono Soberano USD Ley Arg. 2030", clase: "Bono soberano", color: "var(--amber)" },
  AL35: { nombre: "Bono Soberano USD Ley Arg. 2035", clase: "Bono soberano", color: "var(--amber)" },
  GD30: { nombre: "Bono Soberano USD Ley NY 2030", clase: "Bono soberano", color: "var(--amber)" },
  GD35: { nombre: "Bono Soberano USD Ley NY 2035", clase: "Bono soberano", color: "var(--amber)" },
  GD41: { nombre: "Bono Soberano USD Ley NY 2041", clase: "Bono soberano", color: "var(--amber)" },
  AE38: { nombre: "Bono Soberano USD Ley Arg. 2038", clase: "Bono soberano", color: "var(--amber)" },
  T15D6: { nombre: "BONCAP / LECAP (venc. 15-dic-2026)", clase: "LECAP", color: "var(--sky)" },
  T15E6: { nombre: "BONCAP / LECAP", clase: "LECAP", color: "var(--sky)" },
  T30J6: { nombre: "BONCAP / LECAP", clase: "LECAP", color: "var(--sky)" },
  GGAL: { nombre: "Grupo Financiero Galicia", clase: "Empresa AR · Banco", color: "var(--positive)", empresa: true },
  YPF: { nombre: "YPF S.A.", clase: "Empresa AR · Energía", color: "var(--positive)", empresa: true },
  PAMP: { nombre: "Pampa Energía", clase: "Empresa AR · Energía", color: "var(--positive)", empresa: true },
  BMA: { nombre: "Banco Macro", clase: "Empresa AR · Banco", color: "var(--positive)", empresa: true },
  LOMA: { nombre: "Loma Negra", clase: "Empresa AR · Materiales", color: "var(--positive)", empresa: true },
  TXAR: { nombre: "Ternium Argentina", clase: "Empresa AR · Acero", color: "var(--positive)", empresa: true },
  CEPU: { nombre: "Central Puerto", clase: "Empresa AR · Energía", color: "var(--positive)", empresa: true },
}

// ── Derivación de eventos desde bonds-data.ts (FECHAS aprox.; montos NO validados) ──
function derivarEventos(): CalEvent[] {
  const out: CalEvent[] = []
  // ⚠️ HONESTIDAD DE DATOS — bonds-data.ts es el PROSPECTO:
  //   • Las FECHAS sirven como aproximadas (los soberanos HD suelen figurar 9-jul, feriado, y
  //     liquidar el día hábil siguiente), por eso estado = "fecha aprox.".
  //   • Los MONTOS de cupón%/amort% tienen errores conocidos (Donna): NO se muestran como dato
  //     firme y NO se usan para clasificar impacto (impacto de pago de bono = "pendiente").
  //   👉 PUNTO DE CAMBIO: cuando exista `bond-schedule.ts` (motor de bonos de Donna, con cupón/
  //      amort/fechas validados y liquidación en día hábil), reemplazar esta derivación por su
  //      lectura → ahí sí: mostrar montos, clasificar impacto real y estado = "confirmado".
  for (const b of BOND_DEFS) {
    for (const cf of b.cashflows) {
      if (cf.fecha >= HOY) {
        out.push({
          fecha: cf.fecha, tipo: "bono", pais: "AR", activo: b.ticker,
          titulo: `Pago ${b.ticker}`, detalle: "cupón + amort. (montos sin validar)",
          fuente: "bonds-data.ts (prospecto)", impacto: "pendiente", estado: "fecha aprox.",
          // Montos del prospecto — NO validados; se guardan pero NO se renderizan como firmes.
          cupon: cf.cupon, amortizacion: cf.amortizacion,
        })
      }
    }
    if (b.vencimiento >= HOY) {
      out.push({ fecha: b.vencimiento, tipo: "vencimiento", pais: "AR", activo: b.ticker, titulo: `Vencimiento ${b.ticker}`, detalle: "vencimiento final del bono", fuente: "bonds-data.ts (prospecto)", impacto: "alto", estado: "fecha aprox." })
    }
  }
  for (const l of CAP_INSTRUMENT_DEFS) {
    if (l.vencimiento >= HOY) {
      out.push({ fecha: l.vencimiento, tipo: "lecap", pais: "AR", activo: l.ticker, titulo: `Vencimiento LECAP ${l.ticker}`, detalle: `${l.tipo} — vencimiento`, fuente: "bonds-data.ts (prospecto)", impacto: "medio", estado: "fecha aprox." })
    }
  }
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.activo < b.activo ? -1 : 1))
  return out
}
// Base sincrónica (bonos/LECAPs, derivada de prospecto, no requiere fetch).
// El FOMC (async, ver más abajo) se agrega recién dentro de TabCalendario().
const EVENTOS_BASE = derivarEventos()

function fomcMeetingToEvento(m: FomcMeeting, fuente: string): CalEvent {
  return {
    fecha: m.fecha, tipo: "internacional", pais: "US", activo: "FOMC",
    titulo: m.descripcion,
    detalle: m.proyecciones ? "Incluye proyecciones económicas (dot plot)" : "Sin proyecciones económicas",
    fuente, impacto: "alto", estado: "confirmado",
  }
}

// ── Helpers de fecha ─────────────────────────────────────────────────────────
function parseFecha(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
function pad2(n: number): string { return n < 10 ? "0" + n : "" + n }
function isoDate(d: Date): string { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) }
function diffDias(a: string, b: string): number { return Math.round((parseFecha(a).getTime() - parseFecha(b).getTime()) / 86400000) }
function fmtCorta(s: string): string { const d = parseFecha(s); return d.getDate() + " " + MESES[d.getMonth()].slice(0, 3).toLowerCase() + " " + d.getFullYear() }
function fmtLarga(s: string): string { const d = parseFecha(s); return `${DOW_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` }
function relTexto(fecha: string): string {
  const d = diffDias(fecha, HOY)
  if (d < 0) return ""
  if (d === 0) return "HOY"
  if (d === 1) return "mañana"
  if (d <= 7) return "en " + d + " días"
  if (d < 31) return "en " + Math.round(d / 7) + " sem"
  if (d < 365) return "en " + Math.round(d / 30) + " meses"
  return "en " + (Math.round(d / 36.5) / 10) + " años"
}
function mix(color: string, pct: number): string { return `color-mix(in srgb, ${color} ${pct}%, transparent)` }
function descEvento(ev: CalEvent): string {
  if (ev.tipo === "bono") return `Pago de renta del bono ${ev.activo} (cupón y/o amortización). Los MONTOS están pendientes de validación (motor de bonos en revisión) y no se muestran como firmes. La fecha es aproximada del prospecto: los soberanos suelen figurar 9-jul (feriado) y liquidar el día hábil siguiente.`
  if (ev.tipo === "vencimiento") return `Vencimiento final del bono ${ev.activo}: se paga el capital remanente y el título deja de cotizar. Fecha aproximada del prospecto (liquidación el día hábil siguiente).`
  if (ev.tipo === "lecap") return `Vencimiento de la letra capitalizable ${ev.activo}: al vencimiento se cobra el capital más los intereses capitalizados. Fecha aproximada del prospecto.`
  return ev.detalle
}

// mes del próximo evento real (para arrancar la vista mensual con datos)
function mesInicial(): { y: number; m: number } {
  const p = EVENTOS_BASE.map(e => e.fecha).filter(f => f >= HOY).sort()[0]
  const d = p ? parseFecha(p) : parseFecha(HOY)
  return { y: d.getFullYear(), m: d.getMonth() }
}
const MES_INICIAL = mesInicial()

// ── Estilo detalle ──
type Detail =
  | { kind: "event"; ev: CalEvent }
  | { kind: "source"; tipo: TipoEvento; titulo: string; pais: string; que: string; fuente: string; freq: string; ticker?: string }

// ── Sub-componentes de presentación ─────────────────────────────────────────
function ImpactoBadge({ imp }: { imp: Impacto }) {
  const c = imp === "alto" ? "var(--negative)" : imp === "medio" ? "var(--amber)" : imp === "bajo" ? "var(--text-dim)" : "var(--text-mute)"
  const label = imp === "pendiente" ? "s/ validar" : imp
  return <span title={imp === "pendiente" ? "impacto sin clasificar — montos de bono en revisión" : undefined} style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "2px 8px", borderRadius: 999, color: c, background: mix(c, 15) }}>{label}</span>
}
function Tag({ tipo }: { tipo: TipoEvento }) {
  const m = TIPO_META[tipo]
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: m.color, background: mix(m.color, 16), border: `1px solid ${mix(m.color, 40)}`, padding: "2px 8px", borderRadius: 5, flex: "0 0 auto" }}>{m.short}</span>
}

// ── Componente principal ────────────────────────────────────────────────────
export function TabCalendario() {
  const [vista, setVista] = useState<"mensual" | "agenda">("mensual")   // mensual = protagonista
  const [mes, setMes] = useState<{ y: number; m: number }>(MES_INICIAL)
  const [fomcEventos, setFomcEventos] = useState<CalEvent[]>([])

  useEffect(() => {
    let cancelado = false
    fetch("/api/calendario/fomc?futuras=1")
      .then(r => r.json())
      .then(j => {
        if (cancelado || !Array.isArray(j.data)) return
        setFomcEventos((j.data as FomcMeeting[]).map(m => fomcMeetingToEvento(m, j.source ?? "Federal Reserve")))
      })
      .catch(() => { /* si falla, el calendario sigue con los eventos de bonos solos */ })
    return () => { cancelado = true }
  }, [])

  const EVENTOS = useMemo(
    () => [...EVENTOS_BASE, ...fomcEventos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
    [fomcEventos],
  )
  const [tipos, setTipos] = useState<Record<string, boolean>>(() => Object.fromEntries(TIPOS.map(k => [k, true])))
  const [paises, setPaises] = useState<Record<string, boolean>>({ AR: true, US: true, Global: true })
  const [impactos, setImpactos] = useState<Record<string, boolean>>({ alto: true, medio: true, bajo: true })
  const [busqueda, setBusqueda] = useState("")
  const [alarmaTipos, setAlarmaTipos] = useState<Record<string, boolean>>(() => { const o = Object.fromEntries(TIPOS.map(k => [k, false])); o.earnings = true; return o })
  const [diasGlobal, setDiasGlobal] = useState(3)
  const [diasEarnings, setDiasEarnings] = useState(3)
  const [configOpen, setConfigOpen] = useState(false)
  const [asset, setAsset] = useState<{ ticker: string; tab: "foro" | "calendario" | "historicos" } | null>(null)
  const [dayPop, setDayPop] = useState<{ iso: string; left: number; top: number } | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)

  // ── Derivados ──
  const q = busqueda.trim().toLowerCase()
  const eventosFiltrados = EVENTOS.filter(e =>
    // "pendiente" (pagos de bono, impacto sin validar) no se filtra por impacto: siempre visible
    tipos[e.tipo] && paises[e.pais] && (e.impacto === "pendiente" || impactos[e.impacto]) &&
    (!q || (e.activo + " " + e.titulo + " " + e.detalle).toLowerCase().includes(q))
  )
  const placeholdersFiltrados = PLACEHOLDERS.filter(p =>
    tipos[p.tipo] && paises[p.pais] && impactos[p.impacto] &&
    (!q || (p.label + " " + p.items.map(i => i.nombre + " " + i.que).join(" ")).toLowerCase().includes(q))
  )
  const alarmaDe = (t: TipoEvento): number | null => alarmaTipos[t] ? (t === "earnings" ? diasEarnings : diasGlobal) : null
  const proximo = eventosFiltrados.find(e => diffDias(e.fecha, HOY) >= 0)

  // ── Acciones ──
  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, k: string) => setter(prev => ({ ...prev, [k]: !prev[k] }))
  const openAsset = (ticker: string) => { if (ticker && ticker !== "-") { setDayPop(null); setDetail(null); setAsset({ ticker, tab: "calendario" }) } }
  const openEvent = (ev: CalEvent) => { setDayPop(null); setAsset(null); setDetail({ kind: "event", ev }) }
  const openSource = (p: Placeholder, it: FuenteItem) => { setDayPop(null); setAsset(null); setDetail({ kind: "source", tipo: p.tipo, titulo: it.nombre, pais: p.pais, que: it.que, fuente: p.fuente, freq: it.freq, ticker: it.ticker }) }
  const openDay = (iso: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const pw = 330
    const n = eventosFiltrados.filter(ev => ev.fecha === iso).length
    const ph = Math.min(400, 70 + n * 58)
    let left = r.right + 8; if (left + pw > window.innerWidth - 8) left = r.left - pw - 8; if (left < 8) left = Math.max(8, (window.innerWidth - pw) / 2)
    let top = r.top; if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8; if (top < 8) top = 8
    setDayPop({ iso, left, top })
  }
  const cambiarMes = (delta: number) => setMes(prev => { let { y, m } = prev; m += delta; if (m < 0) { m = 11; y-- } if (m > 11) { m = 0; y++ } return { y, m } })

  // ── Estilos reutilizables ──
  const panel: React.CSSProperties = { background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 2px rgba(0,0,0,.12)" }
  const eyebrow: React.CSSProperties = { fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-mute)", fontWeight: 700 }

  // ── Chip de alarma ──
  const AlarmBadge = ({ t }: { t: TipoEvento }) => {
    const d = alarmaDe(t)
    if (d === null) return null
    return <span style={{ fontSize: 9, fontWeight: 700, color: "var(--amber)", background: "var(--amber-soft)", border: `1px solid ${mix("var(--amber)", 45)}`, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>🔔 -{d}d</span>
  }

  // ── Filtro chip ──
  const FilterChip = ({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: React.ReactNode }) => (
    <span onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", transition: "all .14s ease",
      border: `1px solid ${on && color ? mix(color, 55) : "var(--border)"}`,
      background: on && color ? mix(color, 12) : "var(--bg)",
      color: on ? "var(--text)" : "var(--text-dim)", borderRadius: 999, padding: "5px 11px", fontSize: 10.5, fontWeight: on ? 600 : 500,
    }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 3, background: on ? color : "var(--text-mute)", flex: "0 0 auto" }} />}
      {children}
    </span>
  )

  // ── Leyenda ──
  const Legend = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "0 0 14px" }}>
      <span style={{ ...eyebrow, marginRight: 2 }}>Referencias</span>
      {TIPOS.map(t => {
        const meta = TIPO_META[t]
        return (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600, background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 10px 4px 6px", opacity: meta.real ? 1 : 0.6 }}>
            <span style={{ width: 16, height: 10, borderRadius: 3, background: mix(meta.color, 26), borderLeft: `3px solid ${meta.color}`, flex: "0 0 auto" }} />
            {meta.label}
            {!meta.real && <span style={{ fontSize: 7.5, color: "var(--text-mute)", border: "1px solid var(--border-hi)", borderRadius: 5, padding: "0 4px", letterSpacing: 0.5 }}>NC</span>}
          </span>
        )
      })}
    </div>
  )

  // ── Vista MENSUAL (protagonista) ──
  const VistaMensual = () => {
    const { y, m } = mes
    const mapa: Record<string, CalEvent[]> = {}
    eventosFiltrados.forEach(e => { (mapa[e.fecha] = mapa[e.fecha] || []).push(e) })
    const delMes = eventosFiltrados.filter(e => { const d = parseFecha(e.fecha); return d.getFullYear() === y && d.getMonth() === m })
    const offset = (new Date(y, m, 1).getDay() + 6) % 7
    const diasMes = new Date(y, m + 1, 0).getDate()
    const filas = Math.ceil((offset + diasMes) / 7)
    const totalCeldas = filas * 7
    const inicio = new Date(y, m, 1 - offset)
    const dow = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    const proxFecha = EVENTOS.map(e => e.fecha).filter(f => f >= HOY).sort()[0]

    const btn: React.CSSProperties = { background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "6px 13px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer", fontFamily: "var(--font-data)", transition: "all .14s ease" }
    const nav: React.CSSProperties = { background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", color: "var(--text)", borderRadius: 8, width: 32, height: 32, fontSize: 15, cursor: "pointer", transition: "all .14s ease" }

    const celdas = []
    for (let i = 0; i < totalCeldas; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i)
      const iso = isoDate(d)
      const inMes = d.getMonth() === m
      const esHoy = iso === HOY
      const finde = d.getDay() === 0 || d.getDay() === 6
      const items = mapa[iso] || []
      const baseBorder = esHoy ? "var(--amber)" : (inMes ? "var(--border)" : "transparent")
      const bg = esHoy ? mix("var(--amber)", 8) : (!inMes ? "transparent" : finde ? "var(--bg-row-alt)" : "var(--bg-elev)")
      celdas.push(
        <div key={iso} onClick={items.length ? (e => openDay(iso, e)) : undefined}
          onMouseEnter={items.length ? (e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,.22)" }) : undefined}
          onMouseLeave={items.length ? (e => { e.currentTarget.style.borderColor = baseBorder; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = esHoy ? "0 0 0 1px var(--amber) inset" : "none" }) : undefined}
          style={{
            background: bg, border: `1px solid ${baseBorder}`,
            boxShadow: esHoy ? "0 0 0 1px var(--amber) inset" : "none",
            borderRadius: 10, minHeight: 126, padding: "8px 8px 9px", display: "flex", flexDirection: "column", gap: 5,
            cursor: items.length ? "pointer" : "default", transition: "border-color .14s ease, transform .14s ease, box-shadow .14s ease", opacity: inMes ? 1 : 0.5,
          }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: esHoy ? "var(--bg)" : (inMes ? "var(--text)" : "var(--text-mute)"), fontFamily: "var(--font-data)" }}>
              {esHoy
                ? <span style={{ background: "var(--amber)", color: "var(--bg)", borderRadius: 7, minWidth: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }}>{d.getDate()}</span>
                : d.getDate()}
            </span>
            {items.length > 0 && <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--amber)", background: "var(--amber-soft)", borderRadius: 999, padding: "1px 7px", fontFamily: "var(--font-data)" }}>{items.length}</span>}
          </div>
          {items.slice(0, 3).map((ev, idx) => {
            const meta = TIPO_META[ev.tipo]
            const txt = ev.tipo === "vencimiento" ? "▼ " + ev.activo : ev.activo
            return (
              <div key={idx} onClick={e => { e.stopPropagation(); openEvent(ev) }}
                onMouseEnter={e => { e.currentTarget.style.background = mix(meta.color, 30) }}
                onMouseLeave={e => { e.currentTarget.style.background = mix(meta.color, 16) }}
                title={`${ev.titulo} — ${ev.detalle}`}
                style={{
                  fontSize: 10.5, fontWeight: 600, color: "var(--text)", background: mix(meta.color, 16), cursor: "pointer",
                  borderLeft: `3px solid ${meta.color}`, borderRadius: 5, padding: "3px 7px", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6, lineHeight: 1.35,
                  fontFamily: "var(--font-data)", transition: "background .12s ease",
                }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flex: "0 0 auto" }} />{txt}
                {alarmaDe(ev.tipo) !== null && <span style={{ marginLeft: "auto", fontSize: 8 }}>🔔</span>}
              </div>
            )
          })}
          {items.length > 3 && <div style={{ fontSize: 9, color: "var(--text-mute)", padding: "1px 5px", fontWeight: 700, letterSpacing: 0.3 }}>+{items.length - 3} más…</div>}
        </div>
      )
    }

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <button style={nav} onClick={() => cambiarMes(-1)} title="Mes anterior" onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-hi)"; e.currentTarget.style.color = "var(--text)" }}>‹</button>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, minWidth: 210 }}>{MESES[m]} <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>{y}</span></h2>
          <button style={nav} onClick={() => cambiarMes(1)} title="Mes siguiente" onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-hi)"; e.currentTarget.style.color = "var(--text)" }}>›</button>
          <button style={btn} onClick={() => setMes(mesInicial())} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}>Próximo evento ›</button>
          <button style={btn} onClick={() => { const d = parseFecha(HOY); setMes({ y: d.getFullYear(), m: d.getMonth() }) }} onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)" }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}>Hoy</button>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-dim)" }}>{delMes.length} evento(s) programado(s) en {MESES[m].toLowerCase()}</span>
        </div>
        <Legend />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, marginBottom: 7 }}>
          {dow.map((d, i) => <div key={d} style={{ textAlign: "left", fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", color: i >= 5 ? "var(--text-dim)" : "var(--text-mute)", fontWeight: 700, padding: "0 8px 6px", borderBottom: "1px solid var(--border)" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "1fr", gap: 7 }}>{celdas}</div>
        {delMes.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-mute)", padding: "28px 20px", fontSize: 12.5, lineHeight: 1.6 }}>
            Este mes no tiene eventos programados.<br />Próximo evento: <b style={{ color: "var(--amber)" }}>{proxFecha ? fmtCorta(proxFecha) : "—"}</b> — usá «Próximo evento ›».
          </div>
        )}
      </div>
    )
  }

  // ── Vista AGENDA (secundaria) ──
  const VistaAgenda = () => {
    if (!eventosFiltrados.length) return <div style={{ textAlign: "center", color: "var(--text-mute)", padding: "36px 20px", fontSize: 12.5, lineHeight: 1.6 }}>Sin eventos programados para estos filtros.<br /><span style={{ fontSize: 11 }}>Solo bonos/LECAPs tienen fecha (aprox.); el resto está en «fuentes pendientes» abajo.</span></div>
    const grupos: Record<string, CalEvent[]> = {}
    eventosFiltrados.forEach(e => { (grupos[e.fecha] = grupos[e.fecha] || []).push(e) })
    return (
      <div>
        {Object.keys(grupos).sort().map(f => {
          const d = parseFecha(f); const rel = relTexto(f)
          return (
            <div key={f}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "18px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--border-hi)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-data)" }}>{d.getDate()} {MESES[d.getMonth()]} {d.getFullYear()}</span>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-mute)", fontWeight: 700 }}>{DOW_LARGO[d.getDay()]}</span>
                {rel && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--amber)", fontWeight: 700 }}>{rel}</span>}
              </div>
              {grupos[f].map((ev, i) => (
                <div key={i} onClick={() => openEvent(ev)}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-elev-2)"; e.currentTarget.style.borderColor = "var(--border-hi)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-elev)"; e.currentTarget.style.borderColor = "var(--border)" }}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-elev)", border: "1px solid var(--border)", borderLeft: `3px solid ${TIPO_META[ev.tipo].color}`, borderRadius: 9, padding: "9px 12px", marginBottom: 6, cursor: "pointer", transition: "background .12s ease, border-color .12s ease" }}>
                  <Tag tipo={ev.tipo} />
                  <span onClick={e => { e.stopPropagation(); openAsset(ev.activo) }} title={`Ver página de ${ev.activo}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", padding: "2px 9px", borderRadius: 5, flex: "0 0 auto", fontFamily: "var(--font-data)", cursor: "pointer" }}>{ev.activo}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>{ev.detalle} · fuente <span style={{ fontFamily: "var(--font-data)" }}>{ev.fuente}</span> · <span style={{ fontStyle: "italic", color: "var(--yellow)" }}>{ev.estado}</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "0 0 auto" }}>
                    <AlarmBadge t={ev.tipo} />
                    <span style={{ fontSize: 9, color: "var(--text-dim)", fontWeight: 700, letterSpacing: 0.5, border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px" }}>{ev.pais}</span>
                    <ImpactoBadge imp={ev.impacto} />
                    <span style={{ color: "var(--text-mute)", fontSize: 15, lineHeight: 1 }}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  // ── KPIs ──
  const tiposConFuente = TIPOS.filter(t => TIPO_META[t].real).length
  const kpiAccents = ["var(--amber)", "var(--sky)", "var(--positive)", "var(--text-mute)"]
  const KPIs = () => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {[
        { label: "Eventos programados", value: String(eventosFiltrados.length), sub: `de ${EVENTOS.length} · bonos aprox. (prospecto) + FOMC confirmado`, big: true },
        { label: "Próximo evento", value: proximo ? `${proximo.activo} · ${fmtCorta(proximo.fecha)}` : "—", sub: proximo ? relTexto(proximo.fecha) : "sin próximos", big: false },
        { label: "Con fecha", value: `${tiposConFuente} / ${TIPOS.length}`, sub: "bonos/lecaps (aprox.) · FOMC (confirmado)", big: true },
        { label: "Fuentes pendientes", value: String(PLACEHOLDERS.length), sub: "macro (INDEC/BCRA) · licit. · earnings", big: true },
      ].map((k, i) => (
        <div key={i} style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderLeft: `3px solid ${kpiAccents[i]}`, borderRadius: 12, padding: "12px 16px", flex: "1 1 170px", boxShadow: "0 1px 2px rgba(0,0,0,.12)" }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{k.label}</div>
          <div style={{ fontSize: k.big ? 22 : 14, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--font-data)", lineHeight: 1.15 }}>{k.value}</div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  )

  // ── Fuentes no conectadas ──
  const Placeholders = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {placeholdersFiltrados.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-mute)", padding: "24px", fontSize: 12 }}>Sin fuentes pendientes para estos filtros.</div>}
      {placeholdersFiltrados.map((p, i) => {
        const meta = TIPO_META[p.tipo]
        const esEarn = p.tipo === "earnings"
        return (
          <div key={i} style={{ border: `1px dashed ${esEarn ? mix("var(--positive)", 45) : "var(--border-hi)"}`, background: esEarn ? mix("var(--positive)", 6) : "var(--bg)", borderRadius: 11, padding: "13px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <Tag tipo={p.tipo} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-mute)", background: "var(--bg-elev-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{p.estado}</span>
            </div>
            {[["País", p.pais], ["Fecha", "— (sin conectar)"], ["Fuente", p.fuente]].map(([k, v], j) => (
              <div key={j} style={{ fontSize: 10.5, color: "var(--text-dim)", margin: "3px 0", display: "flex", gap: 6 }}>
                <b style={{ color: "var(--text-mute)", fontWeight: 600, minWidth: 52, flex: "0 0 auto" }}>{k}</b>
                <span style={k === "Fecha" ? { fontFamily: "var(--font-data)" } : undefined}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
              {p.items.map(it => (
                <span key={it.nombre} onClick={() => openSource(p, it)} title={`Ver detalle — ${it.nombre}`}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)" }}
                  style={{ fontSize: 9.5, fontFamily: "var(--font-data)", color: "var(--text-dim)", background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", transition: "all .12s ease" }}>{it.nombre}</span>
              ))}
            </div>
            {esEarn && (
              <div style={{ marginTop: 10, padding: "7px 10px", borderRadius: 8, background: mix("var(--positive)", 10), border: `1px solid ${mix("var(--positive)", 35)}`, fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 7 }}>
                🔔 Alarma {alarmaDe("earnings") !== null ? `avisarme -${alarmaDe("earnings")}d` : "desactivada"}
                <span style={{ marginLeft: "auto", ...vpTag }}>Vista previa</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Render principal ──
  return (
    <div style={{ padding: "12px 6px 50px", fontFamily: "var(--font-ui)" }}>
      {/* Nota de datos — HONESTIDAD: fechas aprox. del prospecto; montos de bono SIN validar */}
      <div style={{ background: "var(--amber-soft)", border: "1px solid var(--border-hi)", borderRadius: 10, color: "var(--text-dim)", fontSize: 11, padding: "9px 15px", marginBottom: 14, lineHeight: 1.5 }}>
        <b style={{ color: "var(--amber)" }}>Datos:</b> las FECHAS de bonos/LECAPs son <b style={{ color: "var(--amber)" }}>aproximadas</b> del prospecto (bonds-data.ts); los <b style={{ color: "var(--amber)" }}>montos de cupón/amortización están pendientes de validación</b> (motor de bonos → futuro <span style={{ fontFamily: "var(--font-data)" }}>bond-schedule.ts</span>) y no se muestran como firmes.
        Macro (INDEC/BCRA, incl. IPOM) / licitaciones / earnings: <b style={{ color: "var(--amber)" }}>fuente no conectada</b> (sin fechas simuladas). FOMC (Fed): conectado.
        Alarmas: <b style={{ color: "var(--amber)" }}>vista previa</b> (entrega = fase 2).
        <div style={{ marginTop: 5, fontSize: 10, color: "var(--text-mute)" }}>⚠️ Los pagos HD suelen figurar 9-jul (feriado) y liquidar el día hábil siguiente; las fechas exactas llegan al conectar el motor de bonos.</div>
      </div>

      {/* Título */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "0 2px 14px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--amber)", fontWeight: 700 }}>Calendario de mercados</div>
          <h1 style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>Calendario</h1>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)", paddingBottom: 2 }}>Pagos de bonos, vencimientos y LECAPs (fechas aprox. del prospecto · montos sin validar) · macro AR, Fed, licitaciones y earnings (capacidad, fuente pendiente)</div>
      </div>

      <KPIs />

      {/* Panel principal */}
      <div style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "11px 15px", background: "var(--bg)", borderBottom: "1px solid var(--bg-elev-2)" }}>
          <button onClick={() => setVista("mensual")} style={subBtn(vista === "mensual")}>📅 Mensual</button>
          <button onClick={() => setVista("agenda")} style={subBtn(vista === "agenda")}>☰ Agenda</button>
          <button onClick={() => setConfigOpen(true)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", borderRadius: 8, padding: "6px 13px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", cursor: "pointer" }}>⚙ Config &amp; Alarmas</button>
        </div>

        {/* Filtros */}
        <div style={{ padding: "15px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 340px" }}>
            <span style={{ ...eyebrow, display: "block", marginBottom: 7 }}>Tipo de evento</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIPOS.map(t => <FilterChip key={t} on={!!tipos[t]} color={TIPO_META[t].color} onClick={() => toggle(setTipos, t)}>{TIPO_META[t].label}<span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>{TIPO_META[t].real ? EVENTOS.filter(e => e.tipo === t).length : "NC"}</span></FilterChip>)}
            </div>
          </div>
          <div>
            <span style={{ ...eyebrow, display: "block", marginBottom: 7 }}>País</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{PAISES.map(p => <FilterChip key={p} on={!!paises[p]} onClick={() => toggle(setPaises, p)}>{p}</FilterChip>)}</div>
          </div>
          <div>
            <span style={{ ...eyebrow, display: "block", marginBottom: 7 }}>Impacto</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{IMPACTOS.map(im => <FilterChip key={im} on={!!impactos[im]} onClick={() => toggle(setImpactos, im)}><ImpactoBadge imp={im} /></FilterChip>)}</div>
          </div>
          <div>
            <span style={{ ...eyebrow, display: "block", marginBottom: 7 }}>Buscar activo / ticker</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="AL30, GD41, IPOM…" style={{ background: "var(--bg)", border: "1px solid var(--border-hi)", color: "var(--text)", borderRadius: 8, padding: "8px 11px", fontSize: 12, width: 200, fontFamily: "var(--font-data)" }} />
          </div>
        </div>

        {/* Vista */}
        <div style={{ padding: "16px" }}>{vista === "mensual" ? <VistaMensual /> : <VistaAgenda />}</div>
      </div>

      {/* Fuentes no conectadas */}
      <div style={panel}>
        <div style={{ padding: "13px 16px", fontSize: 12, fontWeight: 600, color: "var(--text)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>🔌 Próximamente — fuentes pendientes de conectar
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-mute)", letterSpacing: 0.3 }}>capacidades ya visibles en la UI; se activan al enchufar la fuente oficial (sin fechas simuladas) · <b style={{ color: "var(--text-dim)", fontWeight: 600 }}>clic para ver detalle</b></span>
        </div>
        <div style={{ padding: "15px 16px" }}><Placeholders /></div>
      </div>

      {/* ── Config modal ── */}
      {configOpen && (
        <>
          <div onClick={() => setConfigOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 80 }} />
          <div style={{ position: "fixed", top: 40, left: "50%", transform: "translateX(-50%)", width: "min(560px, 92vw)", maxHeight: "88vh", overflowY: "auto", background: "var(--bg-elev)", border: "1px solid var(--border-hi)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.4)", zIndex: 81 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>⚙ Configuración &amp; Alarmas</h3>
              <button onClick={() => setConfigOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px 22px" }}>
              <div style={{ marginBottom: 20 }}>
                <span style={{ ...eyebrow, display: "block", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>Tipos de evento a mostrar</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 18px" }}>
                  {TIPOS.map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!tipos[t]} onChange={() => toggle(setTipos, t)} style={{ accentColor: "var(--amber)", width: 14, height: 14 }} />
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: TIPO_META[t].color }} />{TIPO_META[t].label}
                      {!TIPO_META[t].real && <span style={{ ...vpTag, fontSize: 8, padding: "1px 5px" }}>NC</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8, marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>Alarmas — avisarme antes del evento <span style={vpTag}>Vista previa</span></span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <label style={{ fontSize: 12, color: "var(--text-dim)" }}>Aviso general:</label>
                  <select value={diasGlobal} onChange={e => setDiasGlobal(Number(e.target.value))} style={selectInp}>
                    <option value={1}>1 día antes</option><option value={3}>3 días antes</option><option value={7}>7 días antes</option>
                  </select>
                </div>
                {TIPOS.filter(t => t !== "earnings").map(t => (
                  <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)", padding: "2px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!alarmaTipos[t]} onChange={() => toggle(setAlarmaTipos, t)} style={{ accentColor: "var(--amber)", width: 14, height: 14 }} />
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: TIPO_META[t].color }} />Avisar de {TIPO_META[t].label}
                  </label>
                ))}
              </div>

              <div style={{ background: mix("var(--positive)", 10), border: `1px solid ${mix("var(--positive)", 40)}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--positive)", textTransform: "uppercase", letterSpacing: 0.8 }}>📈 Foco: Resultados de empresas (earnings)</div>
                <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>Elegí con cuánta anticipación querés que te avisemos cuando una empresa argentina (GGAL, YPF, PAMP, BMA, LOMA, TXAR, CEPU) publique resultados trimestrales. La fecha real llegará al conectar la fuente oficial (BYMA/CNV).</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <label style={{ fontSize: 12, color: "var(--text-dim)" }}>Avisarme de earnings:</label>
                  <select value={diasEarnings} onChange={e => setDiasEarnings(Number(e.target.value))} style={selectInp}>
                    <option value={1}>1 día antes</option><option value={3}>3 días antes</option><option value={7}>7 días antes</option>
                  </select>
                  <span style={vpTag}>Vista previa</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!alarmaTipos.earnings} onChange={() => toggle(setAlarmaTipos, "earnings")} style={{ accentColor: "var(--amber)", width: 14, height: 14 }} />
                  Activar alarma para todos los earnings
                </label>
              </div>

              {/* Fase 2: la ENTREGA real de alarmas NO está implementada — solo UI de preferencias.
                  Requiere identidad de usuario (login), scheduler durable que dispare N días antes,
                  e idempotencia para no duplicar avisos. */}
              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg-elev-2)", border: "1px dashed var(--border-hi)", borderRadius: 8, fontSize: 10.5, color: "var(--text-mute)", lineHeight: 1.55 }}>
                <b style={{ color: "var(--text-dim)" }}>ℹ️ Nota (Fase 2):</b> este panel configura preferencias en el navegador (vista previa). La <b style={{ color: "var(--text-dim)" }}>entrega real</b> de avisos (push / email) queda para Fase 2: requiere identidad de usuario (login), un scheduler durable que dispare N días antes, e idempotencia para no duplicar avisos.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Drawer de DETALLE de evento / fuente ── */}
      {detail && (() => {
        const ev = detail.kind === "event" ? detail.ev : null
        const src = detail.kind === "source" ? detail : null
        const tipo: TipoEvento = ev ? ev.tipo : src!.tipo
        const tmeta = TIPO_META[tipo]
        const ticker = ev ? ev.activo : src!.ticker
        const conAsset = !!(ticker && ASSET_META[ticker])
        const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
          <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
            <span style={{ color: "var(--text-mute)", minWidth: 104, flex: "0 0 auto", fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, paddingTop: 1 }}>{k}</span>
            <span style={{ color: "var(--text)", flex: 1, minWidth: 0 }}>{children}</span>
          </div>
        )
        return (
          <>
            <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 96 }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 430, maxWidth: "94vw", background: "var(--bg-elev)", borderLeft: "1px solid var(--border-hi)", zIndex: 97, display: "flex", flexDirection: "column", boxShadow: "-14px 0 44px rgba(0,0,0,.4)" }}>
              {/* Header */}
              <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", borderTop: `3px solid ${tmeta.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <Tag tipo={tipo} />
                  <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: ev ? "var(--yellow)" : "var(--text-mute)", background: ev ? mix("var(--yellow)", 14) : "var(--bg-elev-2)", border: `1px solid ${ev ? mix("var(--yellow)", 35) : "var(--border)"}`, padding: "2px 8px", borderRadius: 999 }}>{ev ? ev.estado : "fuente no conectada"}</span>
                  <button onClick={() => setDetail(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.2 }}>{ev ? ev.titulo : src!.titulo}</div>
                {ev && <div style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 600, marginTop: 3, fontFamily: "var(--font-data)" }}>{fmtLarga(ev.fecha)}{relTexto(ev.fecha) ? ` · ${relTexto(ev.fecha)}` : ""}</div>}
              </div>

              {/* Body */}
              <div style={{ padding: "6px 18px 30px", overflowY: "auto", flex: 1 }}>
                <Row k="Tipo">{tmeta.label}</Row>
                <Row k="Fecha efectiva">{ev ? <span style={{ fontFamily: "var(--font-data)" }}>{ev.fecha} <span style={{ color: "var(--text-mute)", fontFamily: "var(--font-ui)", fontStyle: "italic" }}>· aprox. (prospecto)</span></span> : <span style={{ color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>— (sin conectar)</span>}</Row>
                <Row k="País">{ev ? ev.pais : src!.pais}</Row>
                <Row k="Activo">
                  {conAsset
                    ? <span onClick={() => openAsset(ticker!)} style={{ cursor: "pointer", color: "var(--amber)", fontFamily: "var(--font-data)", fontWeight: 700, textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{ticker}</span>
                    : <span style={{ fontFamily: "var(--font-data)" }}>{ticker || "—"}</span>}
                </Row>
                <Row k="Fuente"><span style={{ fontFamily: "var(--font-data)", fontSize: 11 }}>{ev ? ev.fuente : src!.fuente}</span></Row>
                {ev && <Row k="Impacto">{ev.impacto === "pendiente" ? <span style={{ color: "var(--text-mute)" }}>pendiente — sin clasificar (montos de bono en revisión)</span> : <ImpactoBadge imp={ev.impacto} />}</Row>}
                {src && <Row k="Frecuencia">{src.freq}</Row>}
                <Row k="Alarma">{alarmaDe(tipo) !== null ? <AlarmBadge t={tipo} /> : <span style={{ color: "var(--text-mute)" }}>sin alarma — activala en <b style={{ color: "var(--text-dim)" }}>Config &amp; Alarmas</b></span>}</Row>

                {/* Bono: montos NO validados — no se muestran números (bonds-data.ts tiene errores conocidos).
                    👉 al conectar bond-schedule.ts, mostrar acá cupón/amort validados. */}
                {ev && ev.tipo === "bono" && (
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    {(["Cupón", "Amortización"] as const).map(k => (
                      <div key={k} style={{ flex: 1, background: mix("var(--yellow)", 8), border: `1px dashed ${mix("var(--yellow)", 45)}`, borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ ...eyebrow, marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-data)" }}>s/ validar</div>
                        <div style={{ fontSize: 9, color: "var(--text-mute)", marginTop: 3 }}>motor de bonos en revisión</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Descripción */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ ...eyebrow, marginBottom: 6 }}>Descripción</div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>{ev ? descEvento(ev) : `Todavía sin conectar la fuente oficial. Al conectarse, este evento traerá: ${src!.que}.`}</p>
                </div>

                {/* No conectada: qué traería */}
                {src && (
                  <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, background: mix(tmeta.color, 8), border: `1px dashed ${mix(tmeta.color, 40)}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: tmeta.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>⏳ Qué traería al conectarse</div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.55 }}>{src.que} · frecuencia {src.freq}. La fecha efectiva aparecerá acá cuando se enchufe <b style={{ color: "var(--text-dim)" }}>{src.fuente}</b> — sin fechas simuladas.</p>
                  </div>
                )}

                {/* CTA a la página del activo */}
                {conAsset && (
                  <button onClick={() => openAsset(ticker!)} style={{ marginTop: 16, width: "100%", background: "var(--amber-soft)", border: `1px solid ${mix("var(--amber)", 45)}`, color: "var(--amber)", borderRadius: 10, padding: "10px 12px", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>Ver página del activo — ${ticker} ›</button>
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Asset drawer ── */}
      {asset && (() => {
        const meta = ASSET_META[asset.ticker] || { nombre: "Activo", clase: "—", color: "var(--border-hi)" }
        return (
          <>
            <div onClick={() => setAsset(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 90 }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 410, maxWidth: "93vw", background: "var(--bg-elev)", borderLeft: "1px solid var(--border-hi)", zIndex: 95, display: "flex", flexDirection: "column", boxShadow: "-14px 0 44px rgba(0,0,0,.38)" }}>
              <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)", letterSpacing: 0.5 }}><span style={{ color: "var(--text-mute)" }}>$</span>{asset.ticker}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2 }}>{meta.nombre}</div>
                  <span style={{ display: "inline-block", marginTop: 6, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: meta.color, background: mix(meta.color, 15), border: `1px solid ${mix(meta.color, 40)}`, padding: "2px 8px", borderRadius: 999 }}>{meta.clase}</span>
                </div>
                <button onClick={() => setAsset(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 4, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
                {([["foro", "💬", "Foro", "próx."], ["calendario", "📅", "Calendario", ""], ["historicos", "📊", "Históricos", "próx."]] as const).map(([k, ic, lbl, soon]) => (
                  <button key={k} onClick={() => setAsset({ ...asset, tab: k })} style={{
                    flex: 1, background: asset.tab === k ? "var(--amber-soft)" : "transparent", color: asset.tab === k ? "var(--amber)" : "var(--text-dim)",
                    border: `1px solid ${asset.tab === k ? mix("var(--amber)", 45) : "var(--border)"}`, borderRadius: 8, padding: "8px 6px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}><span style={{ fontSize: 14 }}>{ic}</span>{lbl}{soon && <span style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-mute)" }}>{soon}</span>}</button>
                ))}
              </div>
              <div style={{ padding: "14px 16px 30px", overflowY: "auto", flex: 1 }}>
                {asset.tab === "foro" && <div style={{ textAlign: "center", color: "var(--text-mute)", padding: "34px 14px", fontSize: 12, lineHeight: 1.6 }}><span style={{ fontSize: 26, display: "block", marginBottom: 8 }}>💬</span><b style={{ color: "var(--text-dim)" }}>Foro de ${asset.ticker}</b><br />En La Pizarra, acá va la conversación de la comunidad sobre el activo.<br /><span style={{ fontSize: 10 }}>Acceso placeholder — se abre en la página del activo.</span></div>}
                {asset.tab === "historicos" && <div style={{ textAlign: "center", color: "var(--text-mute)", padding: "34px 14px", fontSize: 12, lineHeight: 1.6 }}><span style={{ fontSize: 26, display: "block", marginBottom: 8 }}>📊</span><b style={{ color: "var(--text-dim)" }}>Datos históricos de ${asset.ticker}</b><br />Precios, series y descargas del activo.<br /><span style={{ fontSize: 10 }}>Acceso placeholder — se abre en la página del activo.</span></div>}
                {asset.tab === "calendario" && (meta.empresa
                  ? (
                    <div>
                      <p style={{ ...eyebrow, margin: "0 0 8px" }}>Próximos eventos</p>
                      <div style={{ border: `1px dashed ${mix("var(--positive)", 45)}`, background: mix("var(--positive)", 6), borderRadius: 10, padding: "12px 13px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <Tag tipo="earnings" />
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Resultados trimestrales</span>
                          <span style={{ marginLeft: "auto", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-mute)", background: "var(--bg-elev-2)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 999 }}>fuente no conectada</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text-dim)", margin: "3px 0", display: "flex", gap: 6 }}><b style={{ color: "var(--text-mute)", fontWeight: 600, minWidth: 56 }}>Fecha</b><span style={{ fontFamily: "var(--font-data)" }}>— (sin conectar)</span></div>
                        <div style={{ fontSize: 10.5, color: "var(--text-dim)", margin: "3px 0", display: "flex", gap: 6 }}><b style={{ color: "var(--text-mute)", fontWeight: 600, minWidth: 56 }}>Fuente</b><span>pendiente fuente oficial BYMA/CNV</span></div>
                        <div style={{ marginTop: 9, padding: "7px 9px", borderRadius: 8, background: mix("var(--positive)", 10), border: `1px solid ${mix("var(--positive)", 35)}`, fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 7 }}>🔔 Alarma {alarmaDe("earnings") !== null ? `avisarme -${alarmaDe("earnings")}d` : "desactivada"}<span style={{ marginLeft: "auto", ...vpTag }}>Vista previa</span></div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "var(--bg-elev-2)", border: "1px dashed var(--border-hi)", borderRadius: 8, fontSize: 10.5, color: "var(--text-mute)", lineHeight: 1.55 }}>Cuando se conecte BYMA/CNV, acá aparecerán las fechas reales de resultados de <b style={{ color: "var(--text-dim)" }}>${asset.ticker}</b> y la alarma se dispara según tu preferencia.</div>
                    </div>
                  )
                  : (() => {
                    const evs = EVENTOS.filter(e => e.activo === asset.ticker && e.fecha >= HOY)
                    if (!evs.length) return <div style={{ textAlign: "center", color: "var(--text-mute)", padding: "34px 14px", fontSize: 12 }}><span style={{ fontSize: 26, display: "block", marginBottom: 8 }}>📅</span>Sin eventos futuros para <b>${asset.ticker}</b>.</div>
                    return (
                      <div>
                        <p style={{ ...eyebrow, margin: "0 0 8px" }}>Próximos eventos · {evs.length} · fechas aprox. (prospecto)</p>
                        {evs.map((ev, i) => {
                          const m2 = TIPO_META[ev.tipo]
                          return (
                            <div key={i} onClick={() => openEvent(ev)} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--bg)", border: "1px solid var(--border)", borderLeft: `3px solid ${m2.color}`, borderRadius: 8, padding: "8px 10px", marginBottom: 5, cursor: "pointer" }}>
                              <span style={{ fontSize: 10.5, fontFamily: "var(--font-data)", color: "var(--text)", fontWeight: 600, width: 74, flex: "0 0 auto" }}>{fmtCorta(ev.fecha)}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 600 }}>{m2.short} · {ev.titulo}</div>
                                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{ev.detalle} · <span style={{ fontStyle: "italic", color: "var(--yellow)" }}>{ev.estado}</span></div>
                              </div>
                              <AlarmBadge t={ev.tipo} />
                              <span style={{ color: "var(--text-mute)", fontSize: 14 }}>›</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                )}
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Popover de detalle de día ── */}
      {dayPop && (() => {
        const items = eventosFiltrados.filter(e => e.fecha === dayPop.iso).sort((a, b) => a.activo < b.activo ? -1 : 1)
        if (!items.length) return null
        const d = parseFecha(dayPop.iso); const rel = relTexto(dayPop.iso)
        return (
          <>
            <div onClick={() => setDayPop(null)} style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 87 }} />
            <div onClick={e => e.stopPropagation()} style={{ position: "fixed", left: dayPop.left, top: dayPop.top, width: 330, maxWidth: "92vw", background: "var(--bg-elev)", border: "1px solid var(--border-hi)", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,.5)", zIndex: 88, overflow: "hidden" }}>
              <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "baseline", gap: 9 }}>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-data)" }}>{d.getDate()} {MESES[d.getMonth()].slice(0, 3)} {d.getFullYear()}</span>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-mute)", fontWeight: 700 }}>{DOW_LARGO[d.getDay()]}</span>
                {rel && <span style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--amber)", fontWeight: 700 }}>{rel}</span>}
                <button onClick={() => setDayPop(null)} style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer", paddingLeft: 4 }}>✕</button>
              </div>
              <div style={{ padding: "9px 12px 12px", maxHeight: 340, overflowY: "auto" }}>
                <div style={{ ...eyebrow, margin: "0 0 7px", fontSize: 8.5 }}>Clic en un evento para ver el detalle</div>
                {items.map((e, i) => {
                  const meta = TIPO_META[e.tipo]
                  return (
                    <div key={i} onClick={() => openEvent(e)}
                      onMouseEnter={ev2 => { ev2.currentTarget.style.background = "var(--bg-elev-2)"; ev2.currentTarget.style.borderColor = "var(--border-hi)" }}
                      onMouseLeave={ev2 => { ev2.currentTarget.style.background = "var(--bg)"; ev2.currentTarget.style.borderColor = "var(--border)" }}
                      style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--bg)", border: "1px solid var(--border)", borderLeft: `3px solid ${meta.color}`, borderRadius: 8, padding: "7px 9px", marginBottom: 5, cursor: "pointer", transition: "background .12s ease, border-color .12s ease" }}>
                      <Tag tipo={e.tipo} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600 }}>{e.titulo.split(e.activo)[0]}<span onClick={ev2 => { ev2.stopPropagation(); openAsset(e.activo) }} title={`Ver página de ${e.activo}`} style={{ cursor: "pointer", color: "var(--amber)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{e.activo}</span>{e.titulo.split(e.activo)[1] || ""}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{e.detalle} · <span style={{ fontStyle: "italic", color: "var(--yellow)" }}>{e.estado}</span></div>
                      </div>
                      <AlarmBadge t={e.tipo} />
                      <span style={{ color: "var(--text-mute)", fontSize: 14 }}>›</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// ── Estilos compartidos (fuera del componente) ──
const vpTag: React.CSSProperties = { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--sky)", background: mix("var(--sky)", 15), border: `1px solid ${mix("var(--sky)", 40)}`, padding: "2px 8px", borderRadius: 999 }
const selectInp: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--border-hi)", color: "var(--text)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }
function subBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--amber-soft)" : "transparent", color: active ? "var(--amber)" : "var(--text-dim)",
    border: `1px solid ${active ? mix("var(--amber)", 45) : "var(--border)"}`, borderRadius: 999, padding: "6px 15px",
    fontSize: 10, fontWeight: active ? 700 : 500, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-data)",
  }
}
