"use client"

/**
 * CalendarioCliente — página completa del Calendario Financiero.
 * Tabs entre vista lista (default) y vista mes, filtros por categoría,
 * toggle "solo alta importancia" y botones de export (Google Calendar / .ics).
 */

import { useEffect, useMemo, useState } from "react"
import {
  CATEGORIAS_ORDENADAS,
  CATEGORIA_META,
  filtrarEventos,
  ordenarPorFecha,
  type CategoriaEvento,
  type EventoFinanciero,
} from "@/lib/calendario-financiero"
import { VistaLista } from "./vista-lista"
import { VistaMes } from "./vista-mes"
import { DetalleEvento } from "./detalle-evento"

interface RespuestaCatalogo {
  data?: EventoFinanciero[]
  actualizado?: string
  cobertura?: { desde: string; hasta: string }
  nota?: string
  total_en_catalogo?: number
}

type Modo = "lista" | "mes"

const ALARMA_KEY = "econdata.calendario.recordatorios.v1"

function guardarRecordatorio(id: string) {
  try {
    const raw = localStorage.getItem(ALARMA_KEY)
    const set = new Set<string>(raw ? JSON.parse(raw) : [])
    set.add(id)
    localStorage.setItem(ALARMA_KEY, JSON.stringify([...set]))
  } catch {
    // localStorage puede estar deshabilitado; ignorar.
  }
}

export function CalendarioCliente() {
  const [modo, setModo] = useState<Modo>("lista")
  const [catsActivas, setCatsActivas] = useState<Set<CategoriaEvento>>(
    () => new Set(CATEGORIAS_ORDENADAS),
  )
  const [soloAlta, setSoloAlta] = useState(false)
  const [seleccion, setSeleccion] = useState<EventoFinanciero | null>(null)
  const [recordadoInfo, setRecordadoInfo] = useState<string | null>(null)

  const [meta, setMeta] = useState<Omit<RespuestaCatalogo, "data">>({})
  const [eventos, setEventos] = useState<EventoFinanciero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/calendario?futuras=1")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<RespuestaCatalogo>
      })
      .then((j) => {
        setEventos(j.data ?? [])
        setMeta({
          actualizado: j.actualizado,
          cobertura: j.cobertura,
          nota: j.nota,
          total_en_catalogo: j.total_en_catalogo,
        })
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "error desconocido")
        setLoading(false)
      })
  }, [])

  const filtrados = useMemo(
    () =>
      ordenarPorFecha(
        filtrarEventos(eventos, {
          categoria: [...catsActivas],
          soloAlta,
        }),
      ),
    [eventos, catsActivas, soloAlta],
  )

  const toggleCat = (cat: CategoriaEvento) => {
    setCatsActivas((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const activarSoloCat = (cat: CategoriaEvento) => {
    setCatsActivas(new Set([cat]))
  }

  const activarTodas = () => setCatsActivas(new Set(CATEGORIAS_ORDENADAS))

  const onRecordar = (ev: EventoFinanciero) => {
    guardarRecordatorio(ev.id)
    setRecordadoInfo(
      "Recordatorio guardado localmente. Coordinar tipo `recordatorio_evento` con el sistema de alertas (PR #101) para notificaciones reales.",
    )
    setTimeout(() => setRecordadoInfo(null), 6000)
  }

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      {/* Encabezado */}
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "#eee" }}>
          Calendario financiero
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-mute)", margin: 0, maxWidth: 700 }}>
          Licitaciones, publicaciones de datos macro, vencimientos de deuda y feriados. Catálogo
          curado — {meta.total_en_catalogo ?? "?"} eventos.
          {meta.actualizado && ` Última actualización: ${meta.actualizado}.`}
        </p>
      </header>

      {/* Controles */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 12px",
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Tabs vista */}
        <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1 }}>
          {(["lista", "mes"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              style={{
                background: modo === m ? "var(--amber-soft, rgba(232,168,124,0.15))" : "var(--bg-elev)",
                border: "none",
                color: modo === m ? "var(--amber)" : "#ccc",
                padding: "6px 14px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: modo === m ? 700 : 500,
              }}
            >
              {m === "lista" ? "Lista" : "Mes"}
            </button>
          ))}
        </div>

        {/* Toggle alta */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#ccc",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={soloAlta}
            onChange={(e) => setSoloAlta(e.target.checked)}
          />
          Solo alta importancia
        </label>

        {/* Chips categorías */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <button
            onClick={activarTodas}
            style={{
              fontSize: 10,
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
            title="Reactivar todas las categorías"
          >
            Todas
          </button>
          {CATEGORIAS_ORDENADAS.map((cat) => {
            const m = CATEGORIA_META[cat]
            const activo = catsActivas.has(cat)
            return (
              <button
                key={cat}
                onClick={() => toggleCat(cat)}
                onDoubleClick={() => activarSoloCat(cat)}
                title={`${m.label} — click: toggle · doble click: solo esta`}
                style={{
                  fontSize: 10,
                  padding: "4px 10px",
                  background: activo ? `${m.color}22` : "transparent",
                  border: `1px solid ${activo ? m.color : "var(--border)"}`,
                  color: activo ? m.color : "var(--text-mute)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: activo ? 600 : 400,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {m.short}
              </button>
            )
          })}
        </div>

        {/* Export */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <a
            href="/api/calendario.ics"
            title="URL suscribible desde Google Calendar → 'Agregar por URL'"
            style={btnExport}
          >
            Suscribir feed
          </a>
          <a
            href="/api/calendario.ics?descarga=1"
            style={btnExport}
          >
            Descargar .ics
          </a>
        </div>
      </div>

      {/* Estado carga */}
      {loading && (
        <div style={{ padding: 24, color: "var(--text-mute)", fontSize: 12 }}>
          Cargando eventos...
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 16,
            color: "var(--negative)",
            background: "var(--bg-elev)",
            border: "1px solid var(--negative)",
            fontSize: 12,
          }}
        >
          No se pudo cargar el calendario: {error}
        </div>
      )}

      {/* Contenido: grid 2col en desktop */}
      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {modo === "lista" ? (
              <VistaLista
                eventos={filtrados}
                onSeleccionar={setSeleccion}
                seleccionado={seleccion?.id ?? null}
              />
            ) : (
              <VistaMes
                eventos={filtrados}
                onSeleccionar={setSeleccion}
                seleccionado={seleccion?.id ?? null}
              />
            )}

            <div style={{ marginTop: 12, fontSize: 10, color: "var(--text-mute)", lineHeight: 1.6 }}>
              {meta.nota}
            </div>
          </div>

          <DetalleEvento
            evento={seleccion}
            onCerrar={() => setSeleccion(null)}
            onRecordar={onRecordar}
            recordadoInfo={recordadoInfo ?? undefined}
          />
        </div>
      )}
    </div>
  )
}

const btnExport: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "#ddd",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
}
