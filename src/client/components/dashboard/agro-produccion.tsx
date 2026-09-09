"use client"

/**
 * AgroProduccion — Producción y rendimientos agrícolas (SIIA · MAGyP)
 *
 * Serie oficial por cultivo y campaña desde 1969/1970, con corte nacional o
 * provincial. Consume /api/agro-produccion.
 *
 * Decisión de diseño: los quiebres metodológicos de la serie se dibujan sobre
 * el gráfico y se listan debajo. Un salto de nivel producido por un cambio de
 * criterio de reporte no puede parecer un cambio productivo.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { SectionHeader } from "../ui/section-header"
import { fmtNum } from "@/lib/utils"

type PuntoSerie = {
  campania: string
  anio: number
  superficieSembradaHa: number | null
  superficieCosechadaHa: number | null
  produccionTm: number | null
  rendimientoKgHa: number | null
  unidadesReportadas: number
}

type Discontinuidad = {
  cultivos: string[]
  tipo: "cambio-metodologico" | "serie-discontinuada" | "serie-nueva"
  anio: number
  nota: string
}

type SeriePayload = {
  cultivo: string
  provincia: string | null
  serie: PuntoSerie[]
  discontinuidades: Discontinuidad[]
  discontinuada: boolean
  provinciasDisponibles: string[]
  ultimaCampania: string
}

type CultivoCatalogo = { cultivo: string; desde: number; hasta: number; registros: number }

/** Cultivos de arranque: los de mayor peso en la serie. */
const CULTIVO_INICIAL = "soja total"

const ETIQUETA_TIPO: Record<Discontinuidad["tipo"], string> = {
  "cambio-metodologico": "Cambio metodológico",
  "serie-discontinuada": "Serie discontinuada",
  "serie-nueva": "Serie nueva",
}

export function AgroProduccion() {
  const [catalogo, setCatalogo] = useState<CultivoCatalogo[]>([])
  const [noCubiertos, setNoCubiertos] = useState<{ cultivo: string; donde: string }[]>([])
  const [cultivo, setCultivo] = useState(CULTIVO_INICIAL)
  const [provincia, setProvincia] = useState("")
  const [payload, setPayload] = useState<SeriePayload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/agro-produccion?catalogo=1", { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (!body?.ok || controller.signal.aborted) return
        setCatalogo(body.data.cultivos ?? [])
        setNoCubiertos(body.data.noCubiertos ?? [])
      })
      .catch((error) => { if (!controller.signal.aborted) void error })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true)
    setError(null)
    const query = new URLSearchParams({ cultivo })
    if (provincia) query.set("provincia", provincia)

    fetch(`/api/agro-produccion?${query}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (controller.signal.aborted) return
        if (!body?.ok) {
          setPayload(null)
          setError("No hay serie disponible para esa combinación.")
          return
        }
        setPayload(body.data as SeriePayload)
      })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo consultar la serie.") })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [cultivo, provincia])

  // La producción se grafica en millones de toneladas: en toneladas el eje
  // queda ilegible para los cultivos grandes.
  const datos = useMemo(() => (payload?.serie ?? []).map((punto) => ({
    campania: punto.campania,
    anio: punto.anio,
    produccionMtn: punto.produccionTm === null ? null : punto.produccionTm / 1_000_000,
    rendimiento: punto.rendimientoKgHa,
  })), [payload])

  const ultimo = payload?.serie[payload.serie.length - 1] ?? null

  return (
    <div>
      <SectionHeader title="Producción y rendimientos — SIIA" source="MAGyP · Estimaciones Agrícolas" />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 14px", alignItems: "center" }}>
        <Selector
          label="Cultivo"
          value={cultivo}
          onChange={(value) => { setCultivo(value); setProvincia("") }}
          options={catalogo.map((entrada) => ({
            value: entrada.cultivo,
            label: `${entrada.cultivo} (${entrada.desde}-${entrada.hasta})`,
          }))}
        />
        <Selector
          label="Provincia"
          value={provincia}
          onChange={setProvincia}
          options={[
            { value: "", label: "Total país" },
            ...(payload?.provinciasDisponibles ?? []).map((nombre) => ({ value: nombre, label: nombre })),
          ]}
        />
      </div>

      {cargando ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--text-dim)" }}>Cargando serie…</div>
      ) : error ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--negative)" }}>{error}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 14px 12px" }}>
            <Indicador titulo={`Producción ${ultimo?.campania ?? ""}`} valor={ultimo?.produccionTm == null ? null : fmtNum(ultimo.produccionTm / 1_000_000, 2)} unidad="M tn" destacado />
            <Indicador titulo="Rendimiento" valor={ultimo?.rendimientoKgHa == null ? null : fmtNum(ultimo.rendimientoKgHa, 0)} unidad="kg/ha" />
            <Indicador titulo="Superficie sembrada" valor={ultimo?.superficieSembradaHa == null ? null : fmtNum(ultimo.superficieSembradaHa / 1_000_000, 2)} unidad="M ha" />
            <Indicador titulo="Departamentos" valor={ultimo ? String(ultimo.unidadesReportadas) : null} unidad="reportan" />
          </div>

          {payload?.discontinuada && (
            <Aviso tono="alerta">
              Serie discontinuada: el último dato disponible es {payload.ultimaCampania}. El SIIA no publica campañas posteriores para este cultivo.
            </Aviso>
          )}

          <div style={{ height: 300, padding: "0 8px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  dataKey="campania"
                  tick={{ fontSize: 8, fill: "var(--text-mute)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="produccion"
                  tick={{ fontSize: 9, fill: "var(--text-mute)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(valor: number) => `${valor}M`}
                />
                <YAxis
                  yAxisId="rendimiento"
                  orientation="right"
                  tick={{ fontSize: 9, fill: "var(--text-mute)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, color: "var(--text)" }}
                  formatter={(valor, nombre) => {
                    const etiqueta = typeof nombre === "string" ? nombre : ""
                    if (typeof valor !== "number") return ["—", etiqueta]
                    return [
                      etiqueta === "Producción" ? `${fmtNum(valor, 2)} M tn` : `${fmtNum(valor, 0)} kg/ha`,
                      etiqueta,
                    ]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />

                {/* Los quiebres se dibujan sobre la serie, no en una nota al pie. */}
                {(payload?.discontinuidades ?? []).map((quiebre) => {
                  const punto = datos.find((fila) => fila.anio === quiebre.anio)
                  if (!punto) return null
                  return (
                    <ReferenceLine
                      key={`${quiebre.tipo}-${quiebre.anio}`}
                      yAxisId="produccion"
                      x={punto.campania}
                      stroke="var(--negative)"
                      strokeDasharray="4 3"
                      label={{ value: `quiebre ${quiebre.anio}`, fontSize: 8, fill: "var(--negative)", position: "insideTopRight" }}
                    />
                  )
                })}

                <Bar yAxisId="produccion" dataKey="produccionMtn" name="Producción" fill="var(--amber)" fillOpacity={0.75} isAnimationActive={false} />
                <Line yAxisId="rendimiento" type="monotone" dataKey="rendimiento" name="Rendimiento" stroke="var(--positive)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {(payload?.discontinuidades ?? []).map((quiebre) => (
            <Aviso key={`${quiebre.tipo}-${quiebre.anio}`} tono="aviso">
              <b>{ETIQUETA_TIPO[quiebre.tipo]} ({quiebre.anio}):</b> {quiebre.nota}
            </Aviso>
          ))}

          {noCubiertos.length > 0 && (
            <div style={{ padding: "4px 14px 14px", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--text-mute)" }}>Fuera de esta serie:</b>{" "}
              {noCubiertos.map((entrada) => `${entrada.cultivo} (${entrada.donde})`).join(" · ")}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Selector({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: "var(--bg-elev)", color: "var(--text)", border: "1px solid var(--border)",
          fontSize: 10, padding: "4px 8px", minWidth: 180, fontFamily: "inherit",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function Indicador({ titulo, valor, unidad, destacado }: {
  titulo: string
  valor: string | null
  unidad: string
  destacado?: boolean
}) {
  return (
    <div style={{ flex: "1 1 150px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "10px 12px" }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {titulo}
      </div>
      <div style={{ fontSize: destacado ? 20 : 16, fontWeight: 700, color: destacado ? "var(--amber)" : "var(--text)", fontFamily: "var(--font-data)" }}>
        {valor ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{unidad}</div>
    </div>
  )
}

function Aviso({ tono, children }: { tono: "aviso" | "alerta"; children: React.ReactNode }) {
  const color = tono === "alerta" ? "var(--negative)" : "var(--text-mute)"
  return (
    <div style={{
      margin: "6px 14px", padding: "8px 10px", fontSize: 9, lineHeight: 1.6,
      color: "var(--text-mute)", background: "var(--bg-elev)",
      borderLeft: `2px solid ${color}`,
    }}>
      {children}
    </div>
  )
}
