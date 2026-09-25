/**
 * Calendario Financiero — tipos + helpers puros.
 *
 * El catálogo curado vive en public/data/calendario-eventos.json. Este archivo
 * define el contrato TS y utilidades sin dependencias externas (para que se
 * pueda usar tanto server-side como client-side).
 *
 * Ver public/data/calendario-eventos.README.md para el criterio de curación.
 */

export type CategoriaEvento =
  | "licitacion"
  | "publicacion_datos"
  | "vencimiento_tesoro"
  | "earnings"
  | "feriado"
  | "otro"

export type ImportanciaEvento = "alta" | "media" | "baja"

export type RecurrenciaEvento = "mensual" | "trimestral" | "anual" | null

export interface FuenteEvento {
  nombre: string
  url?: string
}

export interface EventoFinanciero {
  id: string
  fecha: string       // ISO YYYY-MM-DD (America/Argentina/Buenos_Aires)
  hora?: string       // HH:mm (24h) — opcional
  categoria: CategoriaEvento
  titulo: string
  descripcion?: string
  fuente: FuenteEvento
  importancia: ImportanciaEvento
  recurrencia?: RecurrenciaEvento
}

export interface CatalogoCalendario {
  actualizado: string
  cobertura: { desde: string; hasta: string }
  nota: string
  eventos: EventoFinanciero[]
}

// ── Metadatos por categoría ──────────────────────────────────────────────────

export interface CategoriaMeta {
  label: string
  short: string
  icono: string  // emoji o carácter — texto plano para no depender de icon libs
  color: string  // color hex / css var — apto para dot y borde
}

export const CATEGORIA_META: Record<CategoriaEvento, CategoriaMeta> = {
  licitacion: {
    label: "Licitación del Tesoro",
    short: "LIC",
    icono: "L",
    color: "var(--amber, #E8A87C)",
  },
  publicacion_datos: {
    label: "Publicación de datos",
    short: "DATA",
    icono: "D",
    color: "var(--positive, #58C3A6)",
  },
  vencimiento_tesoro: {
    label: "Vencimiento de deuda",
    short: "VTO",
    icono: "V",
    color: "var(--sky, #6FB3D4)",
  },
  earnings: {
    label: "Balances (earnings)",
    short: "EARN",
    icono: "E",
    color: "var(--yellow, #E6C86A)",
  },
  feriado: {
    label: "Feriado",
    short: "FER",
    icono: "F",
    color: "var(--negative, #C56F6F)",
  },
  otro: {
    label: "Otro",
    short: "ETC",
    icono: "•",
    color: "var(--text-mute, #888)",
  },
}

export const CATEGORIAS_ORDENADAS: CategoriaEvento[] = [
  "licitacion",
  "publicacion_datos",
  "vencimiento_tesoro",
  "earnings",
  "feriado",
  "otro",
]

export const IMPORTANCIA_COLOR: Record<ImportanciaEvento, string> = {
  alta: "var(--negative, #C56F6F)",
  media: "var(--amber, #E8A87C)",
  baja: "var(--text-mute, #888)",
}

// ── Helpers de fecha ────────────────────────────────────────────────────────

/** ISO YYYY-MM-DD para "hoy" en Buenos Aires (UTC-3, sin DST). */
export function hoyISO(): string {
  const ahora = new Date()
  // Convertir a UTC-3 restando 3h a UTC.
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60_000
  const bsAsMs = utcMs - 3 * 60 * 60_000
  return new Date(bsAsMs).toISOString().slice(0, 10)
}

/** Parsea YYYY-MM-DD como fecha UTC "estable" (sin zona local). */
export function parseISO(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`)
}

/** Días de diferencia entre `hasta` y `desde` (positivo si `hasta` > `desde`). */
export function diffDias(desde: string, hasta: string): number {
  const a = parseISO(desde).getTime()
  const b = parseISO(hasta).getTime()
  return Math.round((b - a) / (24 * 60 * 60_000))
}

/** Suma `dias` a una fecha ISO. */
export function sumarDias(fecha: string, dias: number): string {
  const d = parseISO(fecha)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Formato humano corto: "Vie 14/10". */
export function fmtFechaCorta(fecha: string): string {
  const d = parseISO(fecha)
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
  return `${dias[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Formato largo: "14 de octubre de 2026". */
export function fmtFechaLarga(fecha: string): string {
  const d = parseISO(fecha)
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ]
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

// ── Filtrado + agrupación ───────────────────────────────────────────────────

export interface FiltrosCalendario {
  desde?: string   // ISO
  hasta?: string   // ISO
  categoria?: CategoriaEvento | CategoriaEvento[]
  soloAlta?: boolean
}

export function filtrarEventos(
  eventos: EventoFinanciero[],
  filtros: FiltrosCalendario = {},
): EventoFinanciero[] {
  const cats = filtros.categoria
    ? Array.isArray(filtros.categoria) ? filtros.categoria : [filtros.categoria]
    : null
  return eventos.filter((e) => {
    if (filtros.desde && e.fecha < filtros.desde) return false
    if (filtros.hasta && e.fecha > filtros.hasta) return false
    if (cats && !cats.includes(e.categoria)) return false
    if (filtros.soloAlta && e.importancia !== "alta") return false
    return true
  })
}

export function ordenarPorFecha(eventos: EventoFinanciero[]): EventoFinanciero[] {
  return [...eventos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
    return (a.hora ?? "").localeCompare(b.hora ?? "")
  })
}

/** Grupos semanales relativos a `hoy`. */
export type GrupoSemana = "esta_semana" | "proxima_semana" | "en_2_semanas" | "mas_adelante"

export const GRUPO_LABEL: Record<GrupoSemana, string> = {
  esta_semana: "Esta semana",
  proxima_semana: "Próxima semana",
  en_2_semanas: "En 2 semanas",
  mas_adelante: "Más adelante",
}

/** Domingo → 0, lunes → 1, etc. Semanas empiezan el lunes. */
function inicioSemanaLunes(fecha: string): string {
  const d = parseISO(fecha)
  const dia = d.getUTCDay()
  const offset = dia === 0 ? -6 : 1 - dia
  return sumarDias(fecha, offset)
}

export function grupoDeEvento(hoy: string, fechaEvento: string): GrupoSemana {
  const semanaHoy = inicioSemanaLunes(hoy)
  const dias = diffDias(semanaHoy, inicioSemanaLunes(fechaEvento))
  if (dias <= 0) return "esta_semana"
  if (dias <= 7) return "proxima_semana"
  if (dias <= 14) return "en_2_semanas"
  return "mas_adelante"
}

export function agruparPorSemana(
  eventos: EventoFinanciero[],
  hoy: string,
): Record<GrupoSemana, EventoFinanciero[]> {
  const salida: Record<GrupoSemana, EventoFinanciero[]> = {
    esta_semana: [],
    proxima_semana: [],
    en_2_semanas: [],
    mas_adelante: [],
  }
  for (const e of eventos) {
    salida[grupoDeEvento(hoy, e.fecha)].push(e)
  }
  return salida
}

// ── Validación runtime (defensiva) ──────────────────────────────────────────

/** Chequea rápido que un objeto matchee la forma de EventoFinanciero.
 *  No hace validación exhaustiva — es para descartar basura del JSON. */
export function esEventoValido(x: unknown): x is EventoFinanciero {
  if (!x || typeof x !== "object") return false
  const e = x as Record<string, unknown>
  if (typeof e.id !== "string" || typeof e.fecha !== "string") return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) return false
  if (typeof e.titulo !== "string") return false
  const catsValidas: CategoriaEvento[] = [
    "licitacion", "publicacion_datos", "vencimiento_tesoro", "earnings", "feriado", "otro",
  ]
  if (!catsValidas.includes(e.categoria as CategoriaEvento)) return false
  const impValidas: ImportanciaEvento[] = ["alta", "media", "baja"]
  if (!impValidas.includes(e.importancia as ImportanciaEvento)) return false
  if (!e.fuente || typeof (e.fuente as { nombre: unknown }).nombre !== "string") return false
  return true
}

export function parseCatalogo(raw: unknown): CatalogoCalendario {
  if (!raw || typeof raw !== "object") {
    return { actualizado: "", cobertura: { desde: "", hasta: "" }, nota: "", eventos: [] }
  }
  const c = raw as Record<string, unknown>
  const eventosCrudos = Array.isArray(c.eventos) ? c.eventos : []
  const eventos = eventosCrudos.filter(esEventoValido)
  return {
    actualizado: typeof c.actualizado === "string" ? c.actualizado : "",
    cobertura: {
      desde: typeof (c.cobertura as { desde?: string } | undefined)?.desde === "string"
        ? (c.cobertura as { desde: string }).desde : "",
      hasta: typeof (c.cobertura as { hasta?: string } | undefined)?.hasta === "string"
        ? (c.cobertura as { hasta: string }).hasta : "",
    },
    nota: typeof c.nota === "string" ? c.nota : "",
    eventos,
  }
}
