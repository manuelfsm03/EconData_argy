"use client"

/**
 * VistaLista — eventos agrupados por semana ("Esta semana", "Próxima semana"...).
 */

import {
  CATEGORIA_META,
  IMPORTANCIA_COLOR,
  GRUPO_LABEL,
  agruparPorSemana,
  fmtFechaCorta,
  fmtFechaLarga,
  hoyISO,
  type EventoFinanciero,
  type GrupoSemana,
} from "@/lib/calendario-financiero"

interface Props {
  eventos: EventoFinanciero[]
  onSeleccionar: (evento: EventoFinanciero) => void
  seleccionado?: string | null
}

const GRUPOS_ORDEN: GrupoSemana[] = ["esta_semana", "proxima_semana", "en_2_semanas", "mas_adelante"]

export function VistaLista({ eventos, onSeleccionar, seleccionado }: Props) {
  const hoy = hoyISO()
  const grupos = agruparPorSemana(eventos, hoy)

  const todosVacios = eventos.length === 0
  if (todosVacios) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--text-mute)",
          fontSize: 12,
          border: "1px dashed var(--border)",
          background: "var(--bg-elev)",
        }}
      >
        No hay eventos que coincidan con los filtros actuales.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {GRUPOS_ORDEN.map((grupo) => {
        const items = grupos[grupo]
        if (items.length === 0) return null
        return (
          <section key={grupo}>
            <h2
              style={{
                fontSize: 10,
                color: "var(--text-mute)",
                textTransform: "uppercase",
                letterSpacing: 2,
                margin: "0 0 8px",
                fontWeight: 600,
              }}
            >
              {GRUPO_LABEL[grupo]} · {items.length} evento{items.length === 1 ? "" : "s"}
            </h2>
            <div
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
              }}
            >
              {items.map((ev) => {
                const meta = CATEGORIA_META[ev.categoria]
                const esSel = ev.id === seleccionado
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSeleccionar(ev)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: esSel ? "var(--bg-elev-2)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--bg-elev-2)",
                      borderLeft: `3px solid ${esSel ? meta.color : "transparent"}`,
                      padding: "12px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      color: "inherit",
                      transition: "background 0.1s, border-color 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elev-2)")}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = esSel ? "var(--bg-elev-2)" : "transparent"
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--amber)",
                        fontFamily: "var(--font-data)",
                        minWidth: 70,
                        flexShrink: 0,
                      }}
                      title={fmtFechaLarga(ev.fecha)}
                    >
                      {fmtFechaCorta(ev.fecha)}
                      {ev.hora && (
                        <div style={{ color: "var(--text-mute)", fontSize: 9, marginTop: 2 }}>
                          {ev.hora}
                        </div>
                      )}
                    </div>

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
                        padding: "2px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {meta.short}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#eee", lineHeight: 1.4 }}>
                        {ev.titulo}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 2 }}>
                        {ev.fuente.nombre}
                        {ev.recurrencia && ` · recurrencia ${ev.recurrencia}`}
                      </div>
                    </div>

                    <span
                      title={`Importancia ${ev.importancia}`}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: IMPORTANCIA_COLOR[ev.importancia],
                        flexShrink: 0,
                      }}
                    />
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
