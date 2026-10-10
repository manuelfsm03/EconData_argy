/**
 * Generador iCal (.ics) para el Calendario Financiero.
 *
 * El formato iCalendar (RFC 5545) es texto plano estructurado. No usamos
 * librería: es un array de líneas con CRLF, envueltas cada 75 caracteres.
 *
 * Contra este feed el usuario puede:
 *   - descargar el .ics y abrirlo en Outlook/Apple Calendar.
 *   - suscribirse desde Google Calendar → "Agregar por URL" → apuntar a
 *     https://.../api/calendario.ics para que se actualice solo.
 */

import type { EventoFinanciero } from "./calendario-financiero"

const CRLF = "\r\n"
const NAMESPACE = "lapizarra.ar"
const PROD_ID = "-//EconData Argy//Calendario Financiero//ES"

/** Escapa texto para valores iCal (RFC 5545 §3.3.11). */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** Envuelve líneas largas a máx. 75 octetos (regla "line folding" RFC 5545 §3.1). */
function envolver(linea: string): string {
  if (linea.length <= 75) return linea
  const partes: string[] = []
  let resto = linea
  partes.push(resto.slice(0, 75))
  resto = resto.slice(75)
  while (resto.length > 74) {
    partes.push(" " + resto.slice(0, 74))
    resto = resto.slice(74)
  }
  if (resto.length > 0) partes.push(" " + resto)
  return partes.join(CRLF)
}

/** Formato DATE (yyyymmdd) para eventos todo-el-día. */
function fmtDate(fechaISO: string): string {
  return fechaISO.replace(/-/g, "")
}

/** Formato DATE-TIME local (yyyymmddThhmmss) — TZID Buenos Aires. */
function fmtDateTime(fechaISO: string, hora: string): string {
  const [hh, mm] = hora.split(":")
  return `${fmtDate(fechaISO)}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`
}

/** Formato DTSTAMP UTC (yyyymmddThhmmssZ) — momento actual, obligatorio por RFC. */
function dtstampUTC(): string {
  const ahora = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    ahora.getUTCFullYear() +
    pad(ahora.getUTCMonth() + 1) +
    pad(ahora.getUTCDate()) +
    "T" +
    pad(ahora.getUTCHours()) +
    pad(ahora.getUTCMinutes()) +
    pad(ahora.getUTCSeconds()) +
    "Z"
  )
}

interface OpcionesICS {
  /** Nombre visible del calendario en el cliente (Google/Outlook). */
  nombreCalendario?: string
  /** Descripción visible del calendario. */
  descripcionCalendario?: string
}

/** Bloque VTIMEZONE mínimo para America/Argentina/Buenos_Aires (UTC-3 fijo). */
const VTIMEZONE_BUENOS_AIRES = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Argentina/Buenos_Aires",
  "X-LIC-LOCATION:America/Argentina/Buenos_Aires",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
]

function eventoAVEvent(evento: EventoFinanciero, stamp: string): string[] {
  const uid = `${evento.id}@${NAMESPACE}`
  const lineas: string[] = ["BEGIN:VEVENT"]
  lineas.push(`UID:${uid}`)
  lineas.push(`DTSTAMP:${stamp}`)
  if (evento.hora) {
    lineas.push(`DTSTART;TZID=America/Argentina/Buenos_Aires:${fmtDateTime(evento.fecha, evento.hora)}`)
    // Duración por defecto: 30 minutos.
    const [hh, mm] = evento.hora.split(":").map((s) => parseInt(s, 10))
    const finMin = mm + 30
    const finHh = hh + Math.floor(finMin / 60)
    const finMm = finMin % 60
    const horaFin = `${String(finHh).padStart(2, "0")}:${String(finMm).padStart(2, "0")}`
    lineas.push(`DTEND;TZID=America/Argentina/Buenos_Aires:${fmtDateTime(evento.fecha, horaFin)}`)
  } else {
    // Todo el día — VALUE=DATE, DTEND es el día siguiente (RFC 5545).
    const [y, m, d] = evento.fecha.split("-").map((s) => parseInt(s, 10))
    const finDate = new Date(Date.UTC(y, m - 1, d + 1))
    const finISO = finDate.toISOString().slice(0, 10)
    lineas.push(`DTSTART;VALUE=DATE:${fmtDate(evento.fecha)}`)
    lineas.push(`DTEND;VALUE=DATE:${fmtDate(finISO)}`)
  }
  lineas.push(`SUMMARY:${escapar(evento.titulo)}`)
  const descripcionPartes: string[] = []
  if (evento.descripcion) descripcionPartes.push(evento.descripcion)
  descripcionPartes.push(`Fuente: ${evento.fuente.nombre}`)
  descripcionPartes.push(`Categoría: ${evento.categoria}`)
  descripcionPartes.push(`Importancia: ${evento.importancia}`)
  lineas.push(`DESCRIPTION:${escapar(descripcionPartes.join(" — "))}`)
  if (evento.fuente.url) lineas.push(`URL:${escapar(evento.fuente.url)}`)
  lineas.push(`CATEGORIES:${evento.categoria.toUpperCase()}`)
  // Prioridad iCal 1-9 (1 = más alta). Mapeo simple:
  const prioridad = evento.importancia === "alta" ? 3 : evento.importancia === "media" ? 5 : 7
  lineas.push(`PRIORITY:${prioridad}`)
  lineas.push("END:VEVENT")
  return lineas
}

export function generarICS(
  eventos: EventoFinanciero[],
  opciones: OpcionesICS = {},
): string {
  const stamp = dtstampUTC()
  const nombre = opciones.nombreCalendario ?? "Calendario financiero AR — EconData"
  const desc = opciones.descripcionCalendario ??
    "Calendario financiero argentino curado por EconData: licitaciones del Tesoro, publicaciones INDEC/BCRA/AFIP, vencimientos de deuda soberana y feriados."
  const lineas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nombre)}`,
    `X-WR-CALDESC:${escapar(desc)}`,
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
    ...VTIMEZONE_BUENOS_AIRES,
  ]
  for (const evento of eventos) {
    lineas.push(...eventoAVEvent(evento, stamp))
  }
  lineas.push("END:VCALENDAR")
  return lineas.map(envolver).join(CRLF) + CRLF
}

/** Genera .ics para UN evento (para descarga puntual desde el detalle). */
export function generarICSEvento(evento: EventoFinanciero): string {
  return generarICS([evento], {
    nombreCalendario: evento.titulo,
    descripcionCalendario: evento.descripcion ?? evento.titulo,
  })
}
