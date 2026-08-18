import type { MarketCalendarEvent } from "./calendar-events"

/** Escapa texto para campos de texto de iCalendar (RFC 5545 §3.3.11). */
function escapeICSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

function toICSDate(iso: string): string {
  return iso.replace(/-/g, "")
}

/** Día siguiente en formato YYYYMMDD -- DTEND de un evento de día completo es exclusivo. */
function nextDayICSDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return toICSDate(date.toISOString().slice(0, 10))
}

function eventTitle(event: MarketCalendarEvent): string {
  return event.kind === "bono" ? `${event.title} (${event.ticker})` : `${event.title} (${event.ticker})`
}

function eventDescription(event: MarketCalendarEvent): string {
  const detail = event.kind === "bono" ? `Moneda ${event.currency} — ley ${event.law}` : event.detail
  return `${detail} — Fuente: ${event.source}`
}

function eventToVEVENT(event: MarketCalendarEvent, dtstamp: string): string {
  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@lapizarra.ar`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toICSDate(event.paymentDate)}`,
    `DTEND;VALUE=DATE:${nextDayICSDate(event.paymentDate)}`,
    `SUMMARY:${escapeICSText(eventTitle(event))}`,
    `DESCRIPTION:${escapeICSText(eventDescription(event))}`,
    "END:VEVENT",
  ].join("\r\n")
}

/** Arma el contenido de un archivo .ics (RFC 5545), importable en Google Calendar, Apple Calendar y Outlook. */
export function eventsToICS(events: MarketCalendarEvent[]): string {
  const dtstamp = `${toICSDate(new Date().toISOString().slice(0, 10))}T000000Z`
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Pizarra//Calendario de mercado//ES",
    "CALSCALE:GREGORIAN",
    ...events.map((event) => eventToVEVENT(event, dtstamp)),
    "END:VCALENDAR",
  ].join("\r\n")
}

/** Dispara la descarga de un .ics en el navegador -- funciona igual para uno o varios eventos. */
export function downloadICS(filename: string, events: MarketCalendarEvent[]): void {
  const blob = new Blob([eventsToICS(events)], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Link "Agregar en Google Calendar" para un solo evento -- no requiere descargar nada. */
export function googleCalendarUrl(event: MarketCalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(event),
    dates: `${toICSDate(event.paymentDate)}/${nextDayICSDate(event.paymentDate)}`,
    details: eventDescription(event),
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}
