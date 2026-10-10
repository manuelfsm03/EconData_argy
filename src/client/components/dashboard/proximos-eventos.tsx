"use client"

/**
 * ProximosEventos — card compacto con los N próximos eventos del calendario
 * financiero. Se embebe en el tab Resumen para que "qué viene esta semana"
 * quede a un scroll de distancia y traiga al usuario de vuelta a la pizarra.
 *
 * Se apoya en /api/calendario?futuras=1. Sin librerías nuevas.
 */

import { useEffect, useState } from "react"
import {
  CATEGORIA_META,
  IMPORTANCIA_COLOR,
  diffDias,
  fmtFechaCorta,
  hoyISO,
  type EventoFinanciero,
} from "@/lib/calendario-financiero"

interface Props {
  cantidad?: number
  onVerTodos?: () => void
}

function faltanTexto(hoy: string, fecha: string): string {
  const d = diffDias(hoy, fecha)
  if (d < 0) return "pasado"
  if (d === 0) return "hoy"
  if (d === 1) return "mañana"
  if (d < 7) return `en ${d} días`
  if (d < 14) return "próx. semana"
  if (d < 30) return `en ${Math.round(d / 7)} sem.`
  return `en ${Math.round(d / 30)} meses`
}

export function ProximosEventos({ cantidad = 5, onVerTodos }: Props) {
  const [eventos, setEventos] = useState<EventoFinanciero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/calendario?futuras=1")
      .then((r) => r.json())
      .then((j: { data?: EventoFinanciero[] }) => {
        setEventos((j.data ?? []).slice(0, cantidad))
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "error")
        setLoading(false)
      })
  }, [cantidad])

  const hoy = hoyISO()

  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
      <div
        onClick={onVerTodos}
        role={onVerTodos ? "button" : undefined}
        title={onVerTodos ? "Abrir calendario completo" : undefined}
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 9,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: onVerTodos ? "pointer" : "default",
        }}
      >
        <span>Próximos eventos</span>
        {onVerTodos && (
          <span style={{ color: "var(--text-mute)", fontSize: 9 }}>Ver todos →</span>
        )}
      </div>

      {loading && (
        <div style={{ padding: 16, color: "var(--text-mute)", fontSize: 11 }}>
          Cargando calendario...
        </div>
      )}

      {error && (
        <div style={{ padding: 16, color: "var(--text-mute)", fontSize: 11 }}>
          No se pudo cargar el calendario ({error}).
        </div>
      )}

      {!loading && !error && eventos.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-mute)", fontSize: 11 }}>
          No hay eventos próximos cargados.
        </div>
      )}

      {eventos.map((ev) => {
        const meta = CATEGORIA_META[ev.categoria]
        return (
          <div
            key={ev.id}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid var(--bg-elev-2)",
            }}
          >
            {/* Fecha corta */}
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-data)",
                color: "var(--amber)",
                minWidth: 62,
                flexShrink: 0,
              }}
            >
              {fmtFechaCorta(ev.fecha)}
            </div>

            {/* Chip categoría */}
            <span
              title={meta.label}
              style={{
                fontSize: 9,
                fontFamily: "var(--font-data)",
                fontWeight: 700,
                textTransform: "uppercase",
                color: meta.color,
                border: `1px solid ${meta.color}55`,
                borderRadius: 10,
                padding: "1px 6px",
                flexShrink: 0,
                lineHeight: 1.4,
              }}
            >
              {meta.short}
            </span>

            {/* Título + hora */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "#ddd",
                  lineHeight: 1.35,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ev.titulo}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                {ev.hora ? `${ev.hora} · ` : ""}
                {ev.fuente.nombre} · <em>{faltanTexto(hoy, ev.fecha)}</em>
              </div>
            </div>

            {/* Dot de importancia */}
            <span
              title={`Importancia ${ev.importancia}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: IMPORTANCIA_COLOR[ev.importancia],
                flexShrink: 0,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
