"use client"

/**
 * DetalleEvento — panel lateral que muestra el evento seleccionado con toda
 * su info + acciones (exportar a Google Calendar, descargar .ics, recordarme).
 */

import {
  CATEGORIA_META,
  IMPORTANCIA_COLOR,
  fmtFechaLarga,
  type EventoFinanciero,
} from "@/lib/calendario-financiero"

interface Props {
  evento: EventoFinanciero | null
  onCerrar: () => void
  onRecordar?: (evento: EventoFinanciero) => void
  recordadoInfo?: string  // ej. "Recordatorio guardado" o mensaje pendiente
}

/** URL "Agregar evento" de Google Calendar (formato oficial de Google). */
function urlGoogleCalendar(ev: EventoFinanciero): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE"
  const fechaSinGuiones = ev.fecha.replace(/-/g, "")
  let dates: string
  if (ev.hora) {
    const [hh, mm] = ev.hora.split(":")
    const inicio = `${fechaSinGuiones}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`
    const finMin = parseInt(mm, 10) + 30
    const finHh = parseInt(hh, 10) + Math.floor(finMin / 60)
    const finMm = finMin % 60
    const finStr = `${String(finHh).padStart(2, "0")}${String(finMm).padStart(2, "0")}`
    const fin = `${fechaSinGuiones}T${finStr}00`
    dates = `${inicio}/${fin}`
  } else {
    // Todo el día — Google espera YYYYMMDD/YYYYMMDD+1
    const [y, m, d] = ev.fecha.split("-").map((s) => parseInt(s, 10))
    const finDate = new Date(Date.UTC(y, m - 1, d + 1))
    const finISO = finDate.toISOString().slice(0, 10).replace(/-/g, "")
    dates = `${fechaSinGuiones}/${finISO}`
  }
  const desc = [
    ev.descripcion ?? "",
    `Fuente: ${ev.fuente.nombre}`,
    ev.fuente.url ? `URL: ${ev.fuente.url}` : "",
    `Categoría: ${ev.categoria}`,
  ].filter(Boolean).join("\n")
  const params = new URLSearchParams({
    text: ev.titulo,
    dates,
    details: desc,
    ctz: "America/Argentina/Buenos_Aires",
  })
  return `${base}&${params.toString()}`
}

/** Descarga un .ics con un solo evento. Usa /api/calendario.ics — no genera nada en el cliente. */
function descargarIcsUnico(ev: EventoFinanciero) {
  // Truco: pedimos el feed completo pero como el usuario espera un ICS con
  // solo el evento seleccionado, generamos el archivo inline sin librería.
  const stampFecha = ev.fecha.replace(/-/g, "")
  const stampNow = new Date()
    .toISOString()
    .replace(/[-:.]/g, "")
    .slice(0, 15) + "Z"
  const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
  let dtstart: string, dtend: string
  if (ev.hora) {
    const [hh, mm] = ev.hora.split(":")
    dtstart = `DTSTART;TZID=America/Argentina/Buenos_Aires:${stampFecha}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`
    const finMin = parseInt(mm, 10) + 30
    const finHh = parseInt(hh, 10) + Math.floor(finMin / 60)
    const finMm = finMin % 60
    dtend = `DTEND;TZID=America/Argentina/Buenos_Aires:${stampFecha}T${String(finHh).padStart(2, "0")}${String(finMm).padStart(2, "0")}00`
  } else {
    const [y, m, d] = ev.fecha.split("-").map((s) => parseInt(s, 10))
    const finDate = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "")
    dtstart = `DTSTART;VALUE=DATE:${stampFecha}`
    dtend = `DTEND;VALUE=DATE:${finDate}`
  }
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EconData Argy//Evento//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@lapizarra.ar`,
    `DTSTAMP:${stampNow}`,
    dtstart,
    dtend,
    `SUMMARY:${escapar(ev.titulo)}`,
    `DESCRIPTION:${escapar((ev.descripcion ?? "") + " — Fuente: " + ev.fuente.nombre)}`,
    ev.fuente.url ? `URL:${ev.fuente.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n"
  const blob = new Blob([lineas], { type: "text/calendar" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${ev.id}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function DetalleEvento({ evento, onCerrar, onRecordar, recordadoInfo }: Props) {
  if (!evento) {
    return (
      <aside
        style={{
          padding: 24,
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
          color: "var(--text-mute)",
          fontSize: 12,
          minHeight: 200,
        }}
      >
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
          Detalle
        </div>
        Elegí un evento para ver toda la info y sumarlo a tu calendario.
      </aside>
    )
  }
  const meta = CATEGORIA_META[evento.categoria]

  return (
    <aside
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderTop: `3px solid ${meta.color}`,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-data)",
            fontWeight: 700,
            textTransform: "uppercase",
            color: meta.color,
            border: `1px solid ${meta.color}55`,
            borderRadius: 10,
            padding: "2px 8px",
          }}
        >
          {meta.label}
        </span>
        <button
          onClick={onCerrar}
          aria-label="Cerrar detalle"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-mute)",
            fontSize: 18,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", color: "#eee", lineHeight: 1.3 }}>
          {evento.titulo}
        </h3>
        <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-data)", marginBottom: 12 }}>
          {fmtFechaLarga(evento.fecha)}
          {evento.hora && ` · ${evento.hora}`}
        </div>

        {evento.descripcion && (
          <p style={{ fontSize: 13, color: "#ddd", lineHeight: 1.6, margin: "0 0 16px" }}>
            {evento.descripcion}
          </p>
        )}

        <dl
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 12px",
            margin: "0 0 16px",
          }}
        >
          <dt style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 9 }}>Fuente</dt>
          <dd style={{ margin: 0 }}>
            {evento.fuente.url ? (
              <a
                href={evento.fuente.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--sky)", textDecoration: "none" }}
              >
                {evento.fuente.nombre} ↗
              </a>
            ) : (
              evento.fuente.nombre
            )}
          </dd>

          <dt style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 9 }}>Importancia</dt>
          <dd style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, color: "#ccc" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: IMPORTANCIA_COLOR[evento.importancia],
              }}
            />
            {evento.importancia}
          </dd>

          {evento.recurrencia && (
            <>
              <dt style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 9 }}>Recurrencia</dt>
              <dd style={{ margin: 0, color: "#ccc" }}>{evento.recurrencia}</dd>
            </>
          )}

          <dt style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 9 }}>ID</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-data)", color: "var(--text-mute)", wordBreak: "break-all" }}>
            {evento.id}
          </dd>
        </dl>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a
            href={urlGoogleCalendar(evento)}
            target="_blank"
            rel="noopener noreferrer"
            style={btnPrimario}
          >
            + Agregar a Google Calendar
          </a>
          <button onClick={() => descargarIcsUnico(evento)} style={btnSecundario}>
            Descargar .ics
          </button>
          {onRecordar && (
            <button onClick={() => onRecordar(evento)} style={btnSecundario}>
              Recordarme 1 día antes
            </button>
          )}
          {recordadoInfo && (
            <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 4 }}>{recordadoInfo}</div>
          )}
        </div>
      </div>
    </aside>
  )
}

const btnPrimario: React.CSSProperties = {
  background: "var(--amber-soft, rgba(232,168,124,0.15))",
  border: "1px solid var(--amber, #E8A87C)",
  color: "var(--amber, #E8A87C)",
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center",
  cursor: "pointer",
  fontFamily: "inherit",
}

const btnSecundario: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  color: "#ddd",
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
}
