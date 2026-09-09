"use client"

/**
 * AgroClima — Lluvia por campaña agrícola y su relación con el rinde.
 *
 * Consume /api/agro-clima. Muestra la serie de lluvia de la zona, ubica la
 * última campaña contra su historia y, cuando el cruce con el SIIA está
 * disponible, expone cuánto rinde vale la lluvia una vez descontada la
 * tendencia tecnológica.
 *
 * La advertencia de que la fuente es reanálisis y no estación se renderiza
 * siempre y arriba: es parte del dato, no una nota al pie.
 */

import { useEffect, useState } from "react"
import {
  Bar, BarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { SectionHeader } from "../ui/section-header"
import { fmtNum } from "@/lib/utils"

type PuntoLluvia = { campania: number; etiqueta: string; mm: number; diasConDato: number }

type Sensibilidad = {
  campaniasCruzadas: number
  correlacionCruda: number
  tendenciaKgHaPorAnio: number
  correlacionDetrend: number
  r2Detrend: number
  kgHaPor100mm: number
  peoresDesvios: { campania: string; mm: number; rendimientoKgHa: number; desvioKgHa: number }[]
}

type Payload = {
  zona: { id: string; nombre: string; descripcion: string }
  cultivo: string
  serie: PuntoLluvia[]
  resumen: {
    campanias: number
    promedioMm: number
    ultima: PuntoLluvia | null
    percentilUltima: number | null
    desvioVsPromedioPct: number | null
    masSecas: PuntoLluvia[]
  }
  sensibilidad: Sensibilidad | null
}

type Zona = { id: string; nombre: string; descripcion: string; puntos: number; provincias: string[] }

export function AgroClima() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [zonaId, setZonaId] = useState("nucleo")
  const [payload, setPayload] = useState<Payload | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/agro-clima?zonas=1")
      .then((r) => r.json())
      .then((b) => { if (b?.ok) setZonas(b.data.zonas ?? []) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setCargando(true)
    setError(null)
    fetch(`/api/agro-clima?zona=${encodeURIComponent(zonaId)}&cultivo=soja%20total`)
      .then((r) => r.json())
      .then((b) => {
        if (!b?.ok) { setPayload(null); setError("No se pudo construir la serie de esta zona."); return }
        setPayload(b.data as Payload)
        setAvisos(b.meta?.warnings ?? [])
      })
      .catch(() => setError("No se pudo consultar el clima."))
      .finally(() => setCargando(false))
  }, [zonaId])

  const resumen = payload?.resumen
  const s = payload?.sensibilidad
  const promedio = resumen?.promedioMm ?? 0
  const ultimaCampania = resumen?.ultima?.campania

  return (
    <div>
      <SectionHeader title="Lluvia por campaña y rinde — ERA5" source="Open-Meteo / ECMWF · cruce con SIIA" />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 14px", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Zona</span>
          <select
            value={zonaId}
            onChange={(e) => setZonaId(e.target.value)}
            style={{
              background: "var(--bg-elev)", color: "var(--text)", border: "1px solid var(--border)",
              fontSize: 10, padding: "4px 8px", minWidth: 210, fontFamily: "inherit",
            }}
          >
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        {payload && (
          <span style={{ fontSize: 9, color: "var(--text-dim)", paddingBottom: 4, maxWidth: 520, lineHeight: 1.5 }}>
            {payload.zona.descripcion}
          </span>
        )}
      </div>

      {cargando ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--text-dim)" }}>Cargando 57 campañas…</div>
      ) : error ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--negative)" }}>{error}</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 14px 12px" }}>
            <Indicador
              titulo={`Campaña ${resumen?.ultima?.etiqueta ?? ""}`}
              valor={resumen?.ultima ? fmtNum(resumen.ultima.mm, 0) : null}
              unidad="mm acumulados"
              destacado
            />
            <Indicador titulo="Promedio histórico" valor={fmtNum(promedio, 0)} unidad={`mm · ${resumen?.campanias ?? 0} campañas`} />
            <Indicador
              titulo="Desvío"
              valor={resumen?.desvioVsPromedioPct != null ? `${resumen.desvioVsPromedioPct > 0 ? "+" : ""}${fmtNum(resumen.desvioVsPromedioPct, 1)}%` : null}
              unidad="vs promedio"
              color={(resumen?.desvioVsPromedioPct ?? 0) < -10 ? "var(--negative)" : undefined}
            />
            <Indicador
              titulo="Percentil"
              valor={resumen?.percentilUltima != null ? String(resumen.percentilUltima) : null}
              unidad="de la serie histórica"
              color={(resumen?.percentilUltima ?? 50) < 25 ? "var(--negative)" : undefined}
            />
          </div>

          <div style={{ height: 250, padding: "0 8px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload?.serie ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 8, fill: "var(--text-mute)" }}
                  tickLine={false} axisLine={false}
                  interval="preserveStartEnd" minTickGap={30}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--text-mute)" }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elev)", border: "1px solid var(--border)", fontSize: 10, color: "var(--text)" }}
                  formatter={(valor) => [typeof valor === "number" ? `${fmtNum(valor, 0)} mm` : "—", "Lluvia de campaña"]}
                />
                <ReferenceLine
                  y={promedio}
                  stroke="var(--amber)"
                  strokeDasharray="4 3"
                  label={{ value: `promedio ${fmtNum(promedio, 0)} mm`, fontSize: 8, fill: "var(--amber)", position: "insideTopLeft" }}
                />
                <Bar dataKey="mm" isAnimationActive={false}>
                  {(payload?.serie ?? []).map((punto) => (
                    <Cell
                      key={punto.campania}
                      fill={punto.campania === ultimaCampania
                        ? "var(--amber)"
                        : punto.mm < promedio * 0.7 ? "var(--negative)" : "#2f7fa8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {s && (
            <div style={{ padding: "10px 14px 4px" }}>
              <div style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 8 }}>
                Cuánto rinde vale la lluvia · {payload?.cultivo} · {s.campaniasCruzadas} campañas cruzadas
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Indicador titulo="Cada 100 mm valen" valor={fmtNum(s.kgHaPor100mm, 0)} unidad="kg/ha de rinde" destacado />
                <Indicador titulo="Correlación cruda" valor={fmtNum(s.correlacionCruda, 2)} unidad="lluvia vs rinde" />
                <Indicador titulo="Sacada la tendencia" valor={fmtNum(s.correlacionDetrend, 2)} unidad={`R² ${fmtNum(s.r2Detrend, 2)}`} color="var(--positive)" />
                <Indicador titulo="Tendencia tecnológica" valor={`+${fmtNum(s.tendenciaKgHaPorAnio, 1)}`} unidad="kg/ha por año" />
              </div>
              <p style={{ fontSize: 9, color: "var(--text-mute)", lineHeight: 1.6, margin: "10px 0 0", maxWidth: 900 }}>
                La correlación cruda subestima el efecto del clima porque el rinde crece de forma sostenida por
                mejoras técnicas. Descontada esa tendencia, la lluvia de campaña explica el{" "}
                <b style={{ color: "var(--text)" }}>{fmtNum(s.r2Detrend * 100, 0)}%</b> de la variación del rendimiento.
              </p>

              <div style={{ marginTop: 10, fontSize: 9, color: "var(--text-mute)" }}>
                <b style={{ color: "var(--text-dim)" }}>Peores campañas contra su tendencia:</b>{" "}
                {s.peoresDesvios.slice(0, 3).map((d) => `${d.campania} (${fmtNum(d.desvioKgHa, 0)} kg/ha, ${fmtNum(d.mm, 0)} mm)`).join(" · ")}
              </div>
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

function Indicador({ titulo, valor, unidad, destacado, color }: {
  titulo: string
  valor: string | null
  unidad: string
  destacado?: boolean
  color?: string
}) {
  return (
    <div style={{ flex: "1 1 160px", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "10px 12px" }}>
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
