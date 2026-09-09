"use client"

/**
 * LluviaHistorica — explorador de la serie de ERA5 por día, semana, mes o año.
 *
 * Consume /api/clima-historico. A diferencia de AgroClima (que mira una
 * campaña agrícola) o del mapa regional (una ventana de 14 días), esto es
 * la serie completa desde 1940 a la granularidad que se elija.
 *
 * "Día" y "semana" sobre 86 años son miles de puntos: por default se
 * recorta a los últimos 10 años (el usuario puede pedir la serie completa),
 * para no mandar un gráfico ilegible ni una respuesta enorme al navegador.
 */

import { useEffect, useState } from "react"
import {
  Bar, BarChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { SectionHeader } from "../ui/section-header"
import { fmtNum } from "@/lib/utils"

type Granularidad = "dia" | "semana" | "mes" | "anio"

type PuntoHistorico = { periodo: string; etiqueta: string; mm: number; diasConDato: number }
type Resumen = {
  periodos: number
  promedioMm: number
  ultimo: PuntoHistorico | null
  masLluvioso: PuntoHistorico | null
  masSeco: PuntoHistorico | null
}
type Payload = { zona: { id: string; nombre: string }; granularidad: Granularidad; serie: PuntoHistorico[]; resumen: Resumen }
type Zona = { id: string; nombre: string; descripcion: string }

const GRANULARIDADES: { valor: Granularidad; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Por día" },
  { valor: "semana", etiqueta: "Por semana" },
  { valor: "mes", etiqueta: "Por mes" },
  { valor: "anio", etiqueta: "Por año" },
]

/** "desde" a mandarle al endpoint para no traer miles de puntos por default. */
function desdeParaRango(granularidad: Granularidad, verTodo: boolean): string | null {
  if (verTodo || granularidad === "anio") return null
  const anioDesde = new Date().getFullYear() - 10
  if (granularidad === "mes") return `${anioDesde}-01`
  if (granularidad === "semana") return `${anioDesde}-W01`
  return `${anioDesde}-01-01`
}

export function LluviaHistorica() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [zonaId, setZonaId] = useState("nucleo")
  const [granularidad, setGranularidad] = useState<Granularidad>("mes")
  const [verTodo, setVerTodo] = useState(false)
  const [payload, setPayload] = useState<Payload | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/clima-historico?zonas=1")
      .then((r) => r.json())
      .then((b) => { if (b?.ok) setZonas(b.data.zonas ?? []) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setCargando(true)
    setError(null)
    const query = new URLSearchParams({ zona: zonaId, granularidad })
    const desde = desdeParaRango(granularidad, verTodo)
    if (desde) query.set("desde", desde)

    fetch(`/api/clima-historico?${query}`)
      .then((r) => r.json())
      .then((b) => {
        if (!b?.ok) { setPayload(null); setError("No se pudo construir el histórico de esta zona."); return }
        setPayload(b.data as Payload)
        setAvisos(b.meta?.warnings ?? [])
      })
      .catch(() => setError("No se pudo consultar el histórico."))
      .finally(() => setCargando(false))
  }, [zonaId, granularidad, verTodo])

  const resumen = payload?.resumen
  const promedio = resumen?.promedioMm ?? 0
  const puntosMuchos = (payload?.serie.length ?? 0) > 400

  return (
    <div>
      <SectionHeader title="Lluvia histórica — desde 1940" source="Open-Meteo / ECMWF ERA5" />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 14px", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Zona</span>
          <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} style={selectorEstilo}>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Agrupar por</span>
          <select value={granularidad} onChange={(e) => setGranularidad(e.target.value as Granularidad)} style={selectorEstilo}>
            {GRANULARIDADES.map((g) => <option key={g.valor} value={g.valor}>{g.etiqueta}</option>)}
          </select>
        </label>
        {granularidad !== "anio" && (
          <button
            onClick={() => setVerTodo((v) => !v)}
            style={{
              fontSize: 9, color: verTodo ? "var(--amber)" : "var(--text-dim)",
              background: "var(--bg-elev)", border: `1px solid ${verTodo ? "var(--amber)" : "var(--border)"}`,
              padding: "5px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {verTodo ? "Mostrando toda la serie (desde 1940)" : "Ver últimos 10 años · clic para ver todo"}
          </button>
        )}
      </div>

      {cargando ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--text-dim)" }}>Cargando serie histórica…</div>
      ) : error ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--negative)" }}>{error}</div>
      ) : payload && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 14px 12px" }}>
            <Indicador titulo="Promedio del período" valor={fmtNum(promedio, 1)} unidad={`mm · ${resumen?.periodos ?? 0} períodos`} destacado />
            <Indicador titulo="Más lluvioso" valor={resumen?.masLluvioso ? fmtNum(resumen.masLluvioso.mm, 0) : null} unidad={resumen?.masLluvioso ? `mm · ${resumen.masLluvioso.etiqueta}` : ""} color="var(--positive)" />
            <Indicador titulo="Más seco" valor={resumen?.masSeco ? fmtNum(resumen.masSeco.mm, 0) : null} unidad={resumen?.masSeco ? `mm · ${resumen.masSeco.etiqueta}` : ""} color="var(--negative)" />
            <Indicador titulo="Último período" valor={resumen?.ultimo ? fmtNum(resumen.ultimo.mm, 0) : null} unidad={resumen?.ultimo ? `mm · ${resumen.ultimo.etiqueta}` : ""} />
          </div>

          <div style={{ height: 240, padding: "0 8px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload.serie} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 8, fill: "var(--text-mute)" }}
                  tickLine={false} axisLine={false}
                  interval="preserveStartEnd" minTickGap={puntosMuchos ? 60 : 30}
                />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-mute)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, color: "var(--text)" }}
                  formatter={(valor) => [typeof valor === "number" ? `${fmtNum(valor, 0)} mm` : "—", "Lluvia"]}
                />
                <ReferenceLine
                  y={promedio}
                  stroke="var(--amber)"
                  strokeDasharray="4 3"
                  label={{ value: `prom. ${fmtNum(promedio, 0)} mm`, fontSize: 8, fill: "var(--amber)", position: "insideTopLeft" }}
                />
                <Bar dataKey="mm" fill="#2f7fa8" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {puntosMuchos && (
            <div style={{ padding: "0 14px 4px", fontSize: 8, color: "var(--text-mute)", textAlign: "center" }}>
              {payload.serie.length} períodos en pantalla — con tantos puntos el detalle se ve mejor acercando el rango.
            </div>
          )}

          {avisos.map((aviso) => (
            <div key={aviso} style={{
              margin: "10px 14px 4px", padding: "8px 10px", fontSize: 9, lineHeight: 1.6,
              color: "var(--text-mute)", background: "var(--bg-elev)", borderLeft: "2px solid var(--amber)",
            }}>
              {aviso}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

const selectorEstilo: React.CSSProperties = {
  background: "var(--bg-elev)", color: "var(--text)", border: "1px solid var(--border)",
  fontSize: 10, padding: "4px 8px", minWidth: 170, fontFamily: "inherit",
}

function Indicador({ titulo, valor, unidad, destacado, color }: {
  titulo: string; valor: string | null; unidad: string; destacado?: boolean; color?: string
}) {
  return (
    <div style={{ flex: "1 1 170px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "10px 12px" }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {titulo}
      </div>
      <div style={{
        fontSize: destacado ? 20 : 16, fontWeight: 700,
        color: color ?? (destacado ? "var(--amber)" : "var(--text)"),
        fontFamily: "var(--font-data)",
      }}>
        {valor ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{unidad}</div>
    </div>
  )
}
