"use client"

/**
 * NewsBrief — "Morning brief" diario de coyuntura económica AR.
 *
 * Muestra el brief pre-generado por el agente (Claude Haiku 4.5) que corre 2×/día:
 *  - 07:00 AR (morning): resumen de la última noche + apertura
 *  - 12:00 AR (noon): actualización del mediodía
 *
 * Endpoint: /api/news-brief
 * Producto: primer quick win de La Pizarra — la razón para abrir la app cada mañana.
 */

import { useEffect, useState } from "react"

interface Bullet {
  texto: string
  fuente: string | null
  url: string | null
}

interface Secciones {
  dolar_cambiario: Bullet[]
  tasas_monetario: Bullet[]
  deuda_fiscal: Bullet[]
  actividad_inflacion: Bullet[]
}

interface Brief {
  generado_en: string
  corte_horario: "morning" | "noon"
  fecha_display: string
  hora_display: string
  modelo: string
  total_noticias_input?: number
  secciones: Secciones
  total_bullets: number
}

type SeccionKey = keyof Secciones

interface SeccionMeta {
  key: SeccionKey
  label: string
  emoji: string
  color: string
}

const SECCIONES: SeccionMeta[] = [
  { key: "dolar_cambiario",     label: "Dólar / cambiario",     emoji: "💵", color: "var(--amber)"    },
  { key: "tasas_monetario",     label: "Tasas / monetario",     emoji: "📊", color: "var(--sky)"      },
  { key: "deuda_fiscal",        label: "Deuda / fiscal",        emoji: "🏛", color: "var(--yellow)"   },
  { key: "actividad_inflacion", label: "Actividad / inflación", emoji: "📈", color: "var(--positive)" },
]

function iconoCorte(corte: string): string {
  return corte === "morning" ? "☀️" : "🕛"
}

function armarTextoWhatsApp(brief: Brief): string {
  const encabezado = `*La Pizarra — Coyuntura ${brief.fecha_display}* (${brief.hora_display})\n`
  const cuerpo = SECCIONES.map((s) => {
    const bullets = brief.secciones[s.key] || []
    const lineas = bullets
      .map((b) => {
        const cita = b.fuente ? ` — ${b.fuente}` : ""
        return `• ${b.texto}${cita}`
      })
      .join("\n")
    return `${s.emoji} *${s.label}*\n${lineas}`
  }).join("\n\n")
  const pie = `\n\nGenerado por agente + Claude Haiku 4.5\nlapizarra.ar`
  return `${encabezado}\n${cuerpo}${pie}`
}

export function NewsBrief() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [abiertas, setAbiertas] = useState<Record<SeccionKey, boolean>>({
    dolar_cambiario: true,
    tasas_monetario: true,
    deuda_fiscal: true,
    actividad_inflacion: true,
  })

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    fetch("/api/news-brief")
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 503) throw new Error("El agente todavía no generó el brief de hoy.")
          throw new Error(`Error ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelado) {
          setBrief(data as Brief)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelado) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  function toggle(key: SeccionKey) {
    setAbiertas((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function compartirWhatsapp() {
    if (!brief) return
    const texto = armarTextoWhatsApp(brief)
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
          COYUNTURA — CARGANDO…
        </div>
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>☀️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            Coyuntura del día
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {error || "Sin brief disponible."}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 8 }}>
          Se genera automáticamente 07:00 y 12:00 (hora AR).
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-mute)",
              fontFamily: "var(--font-data)",
              textTransform: "uppercase",
              letterSpacing: 1.4,
              marginBottom: 4,
            }}
          >
            Morning brief · La Pizarra
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              letterSpacing: -0.2,
            }}
          >
            <span style={{ fontSize: 20 }}>{iconoCorte(brief.corte_horario)}</span>
            Coyuntura de hoy — {brief.hora_display}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
            {brief.fecha_display}
          </div>
        </div>

        <button
          onClick={compartirWhatsapp}
          style={{
            background: "var(--bg-elev-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            padding: "6px 12px",
            fontSize: 11,
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 4,
            letterSpacing: 0.2,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)")}
          title="Compartir el brief por WhatsApp"
        >
          <span>💬</span>
          Compartir por WhatsApp
        </button>
      </div>

      {/* ── Secciones ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 12 }}>
        {SECCIONES.map((s) => {
          const bullets = brief.secciones[s.key] || []
          const abierta = abiertas[s.key]
          return (
            <div
              key={s.key}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                padding: "10px 14px",
                borderLeft: `3px solid ${s.color}`,
              }}
            >
              <button
                onClick={() => toggle(s.key)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 0,
                  color: "var(--text)",
                  fontFamily: "var(--font-ui)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: -0.1,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{s.emoji}</span>
                  {s.label}
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-mute)",
                      fontFamily: "var(--font-data)",
                      fontWeight: 400,
                    }}
                  >
                    {bullets.length}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-mute)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  {abierta ? "▾" : "▸"}
                </span>
              </button>

              {abierta && (
                <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0 0", display: "grid", gap: 8 }}>
                  {bullets.map((b, idx) => (
                    <li
                      key={idx}
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        color: "var(--text)",
                        paddingLeft: 14,
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 8,
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: s.color,
                        }}
                      />
                      {b.texto}
                      {b.fuente && (
                        <>
                          {" "}
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-dim)",
                              fontFamily: "var(--font-data)",
                            }}
                          >
                            —{" "}
                            {b.url ? (
                              <a
                                href={b.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--text-dim)", textDecoration: "underline" }}
                              >
                                {b.fuente}
                              </a>
                            ) : (
                              b.fuente
                            )}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
          fontSize: 10,
          color: "var(--text-mute)",
          fontFamily: "var(--font-data)",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>Generado por agente + {brief.modelo}</span>
        <span>Actualiza 07:00 y 12:00 AR</span>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  padding: 18,
  marginBottom: 16,
}
