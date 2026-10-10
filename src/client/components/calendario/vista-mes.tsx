"use client"

/**
 * VistaMes — grid tradicional de calendario (7 columnas x N semanas).
 * Cada celda muestra hasta 3 dots (uno por evento) + un "+N" si hay más.
 * Click en la celda selecciona el primer evento del día.
 */

import { useMemo, useState } from "react"
import {
  CATEGORIA_META,
  parseISO,
  type EventoFinanciero,
} from "@/lib/calendario-financiero"

interface Props {
  eventos: EventoFinanciero[]
  onSeleccionar: (evento: EventoFinanciero) => void
  seleccionado?: string | null
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

/** Devuelve YYYY-MM del "hoy" del usuario, o el primer mes con eventos. */
function mesInicial(eventos: EventoFinanciero[]): { anio: number; mes: number } {
  const ahora = new Date()
  const anioAhora = ahora.getUTCFullYear()
  const mesAhora = ahora.getUTCMonth()
  const yyyymm = (a: number, m: number) => `${a}-${String(m + 1).padStart(2, "0")}`
  const claveAhora = yyyymm(anioAhora, mesAhora)
  const tieneEventosMesActual = eventos.some((e) => e.fecha.startsWith(claveAhora))
  if (tieneEventosMesActual || eventos.length === 0) {
    return { anio: anioAhora, mes: mesAhora }
  }
  const primero = eventos[0]
  const d = parseISO(primero.fecha)
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() }
}

/** Genera la grilla del mes: array de {fechaISO, esDelMes} — 6 filas x 7 = 42. */
function generarGrilla(anio: number, mes: number): { fechaISO: string; esDelMes: boolean }[] {
  const primerDia = new Date(Date.UTC(anio, mes, 1))
  const diaSemana = primerDia.getUTCDay() // Dom=0
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana // arranca en lunes
  const inicioGrilla = new Date(Date.UTC(anio, mes, 1 + offset))
  const grilla: { fechaISO: string; esDelMes: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrilla)
    d.setUTCDate(inicioGrilla.getUTCDate() + i)
    const iso = d.toISOString().slice(0, 10)
    grilla.push({ fechaISO: iso, esDelMes: d.getUTCMonth() === mes })
  }
  return grilla
}

export function VistaMes({ eventos, onSeleccionar, seleccionado }: Props) {
  const [{ anio, mes }, setMes] = useState<{ anio: number; mes: number }>(() => mesInicial(eventos))
  const hoy = new Date().toISOString().slice(0, 10)

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoFinanciero[]>()
    for (const ev of eventos) {
      const lista = mapa.get(ev.fecha) ?? []
      lista.push(ev)
      mapa.set(ev.fecha, lista)
    }
    return mapa
  }, [eventos])

  const grilla = useMemo(() => generarGrilla(anio, mes), [anio, mes])

  const irAnterior = () => {
    if (mes === 0) setMes({ anio: anio - 1, mes: 11 })
    else setMes({ anio, mes: mes - 1 })
  }
  const irSiguiente = () => {
    if (mes === 11) setMes({ anio: anio + 1, mes: 0 })
    else setMes({ anio, mes: mes + 1 })
  }
  const irHoy = () => {
    const ahora = new Date()
    setMes({ anio: ahora.getUTCFullYear(), mes: ahora.getUTCMonth() })
  }

  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
      {/* Barra de navegación */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={irAnterior}
            style={btnEstilo}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, minWidth: 180, textAlign: "center" }}>
            {MESES[mes]} {anio}
          </div>
          <button
            onClick={irSiguiente}
            style={btnEstilo}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
        <button
          onClick={irHoy}
          style={{ ...btnEstilo, padding: "4px 12px", fontSize: 11 }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          Hoy
        </button>
      </div>

      {/* Encabezado días */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          background: "var(--bg-elev-2)",
        }}
      >
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            style={{
              padding: "6px 8px",
              fontSize: 9,
              color: "var(--text-mute)",
              textTransform: "uppercase",
              letterSpacing: 1,
              textAlign: "center",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grilla */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridAutoRows: "minmax(80px, auto)",
        }}
      >
        {grilla.map(({ fechaISO, esDelMes }) => {
          const eventosDia = eventosPorDia.get(fechaISO) ?? []
          const esHoy = fechaISO === hoy
          const numDia = parseInt(fechaISO.slice(-2), 10)
          const daySelected = eventosDia.some((e) => e.id === seleccionado)

          return (
            <div
              key={fechaISO}
              onClick={() => eventosDia[0] && onSeleccionar(eventosDia[0])}
              style={{
                padding: 6,
                borderRight: "1px solid var(--bg-elev-2)",
                borderBottom: "1px solid var(--bg-elev-2)",
                background: esHoy ? "var(--bg-elev-2)" : "transparent",
                opacity: esDelMes ? 1 : 0.35,
                cursor: eventosDia.length > 0 ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minHeight: 80,
                borderLeft: daySelected ? "3px solid var(--amber)" : "3px solid transparent",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  color: esHoy ? "var(--amber)" : "var(--text-dim)",
                  fontWeight: esHoy ? 700 : 400,
                }}
              >
                {numDia}
              </div>
              {eventosDia.slice(0, 3).map((ev) => {
                const meta = CATEGORIA_META[ev.categoria]
                return (
                  <div
                    key={ev.id}
                    title={`${meta.label} — ${ev.titulo}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: meta.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: "#ccc",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ev.titulo}
                    </span>
                  </div>
                )
              })}
              {eventosDia.length > 3 && (
                <div style={{ fontSize: 9, color: "var(--text-mute)" }}>
                  +{eventosDia.length - 3} más
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const btnEstilo: React.CSSProperties = {
  background: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  color: "inherit",
  padding: "4px 10px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
}
