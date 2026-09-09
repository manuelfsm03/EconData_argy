"use client"

/**
 * ClimaRegionalMap — dónde llovió esta semana en el Mercosur agrícola.
 *
 * Consume /api/clima-regional. Dibuja los contornos de Argentina, Brasil,
 * Uruguay y Paraguay (asset estático liviano, ~13 KB) y encima una grilla de
 * puntos coloreados por intensidad de lluvia acumulada.
 *
 * Es un mapa de referencia, no cartografía de precisión: la proyección es
 * equirectangular simple (válida para esta escala regional) y la grilla es
 * de puntos de reanálisis, no de estaciones. Ambas cosas se lo decimos al
 * usuario, no las escondemos.
 */

import { useEffect, useMemo, useState } from "react"

import mercosurOutline from "@/client/data/mercosur-outline.json"
import { SectionHeader } from "../ui/section-header"
import { fmtNum } from "@/lib/utils"

type Anillo = [number, number][]
type GeometriaPais = { tipo: "Polygon" | "MultiPolygon"; anillos: Anillo[][] }

type FeatureCruda = {
  properties: { nombre: string }
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown }
}

type PuntoGrilla = { lat: number; lon: number; pais: string; mm: number; diasConDato: number }
type ResumenPais = { pais: string; puntos: number; promedioMm: number; maximoMm: number; minimoMm: number }
type Payload = { ventanaDias: number; grilla: PuntoGrilla[]; resumenPorPais: ResumenPais[] }

// Mismos niveles que el backend (server/external/clima-regional.ts). Se
// duplican acá porque el color es un detalle de presentación, no de dominio:
// si mañana cambia la paleta no hace falta tocar el cálculo del servidor.
const NIVELES = [
  { hasta: 1, color: "#2a2a2e" },
  { hasta: 10, color: "#123f5a" },
  { hasta: 30, color: "#159c8a" },
  { hasta: 50, color: "#4cb96b" },
  { hasta: 75, color: "#d8c53f" },
  { hasta: 100, color: "#e8a33d" },
  { hasta: Infinity, color: "#c62f45" },
] as const

function colorDeLluvia(mm: number): string {
  return (NIVELES.find((n) => mm <= n.hasta) ?? NIVELES[NIVELES.length - 1]).color
}

// Cuadrante de la grilla del backend (server/external/clima-regional.ts).
const LON_MIN = -70, LON_MAX = -46
const LAT_MIN = -36, LAT_MAX = -6
const ANCHO = 560, ALTO = 620

function proyectar(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * ANCHO
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * ALTO
  return [x, y]
}

function anilloASvgPath(anillo: Anillo): string {
  return anillo.map(([lon, lat], i) => {
    const [x, y] = proyectar(lat, lon)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ") + " Z"
}

function paisASvgPath(geo: GeometriaPais): string {
  return geo.anillos.map((poligono) => poligono.map(anilloASvgPath).join(" ")).join(" ")
}

// El asset trae países vecinos de más (Chile, Bolivia) porque se descargó
// junto con el resto del cono sur. Acá se recorta a los cuatro que cubre la
// grilla, y se traduce el nombre: la fuente lo trae en inglés ("Brazil") y
// el resto de la app —incluida la grilla del backend— habla en español.
const NOMBRE_ES: Record<string, string> = {
  Argentina: "Argentina",
  Brazil: "Brasil",
  Uruguay: "Uruguay",
  Paraguay: "Paraguay",
}

const PAISES: { nombre: string; geo: GeometriaPais }[] = (mercosurOutline as { features: FeatureCruda[] })
  .features
  .filter((f) => f.properties.nombre in NOMBRE_ES)
  .map((f) => ({
    nombre: NOMBRE_ES[f.properties.nombre],
    geo: f.geometry.type === "Polygon"
      ? { tipo: "Polygon", anillos: [f.geometry.coordinates as Anillo[]] }
      : { tipo: "MultiPolygon", anillos: f.geometry.coordinates as Anillo[][] },
  }))

export function ClimaRegionalMap() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [paisFiltro, setPaisFiltro] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/clima-regional?dias=14")
      .then((r) => r.json())
      .then((b) => {
        if (!b?.ok) { setError("No se pudo construir el mapa regional."); return }
        setPayload(b.data as Payload)
        setAvisos(b.meta?.warnings ?? [])
      })
      .catch(() => setError("No se pudo consultar el clima regional."))
      .finally(() => setCargando(false))
  }, [])

  const contornos = useMemo(() => PAISES.map((p) => ({ nombre: p.nombre, d: paisASvgPath(p.geo) })), [])

  const grillaVisible = useMemo(() => {
    if (!payload) return []
    return paisFiltro ? payload.grilla.filter((p) => p.pais === paisFiltro) : payload.grilla
  }, [payload, paisFiltro])

  return (
    <div>
      <SectionHeader title="Lluvia reciente — Mercosur agrícola" source="Open-Meteo / ECMWF ERA5" />

      {cargando ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--text-dim)" }}>
          Armando la grilla regional (puede tardar unos segundos)…
        </div>
      ) : error ? (
        <div style={{ padding: "18px 14px", fontSize: 11, color: "var(--negative)" }}>{error}</div>
      ) : payload && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 14px" }}>
            {payload.resumenPorPais.map((r) => (
              <button
                key={r.pais}
                onClick={() => setPaisFiltro(paisFiltro === r.pais ? null : r.pais)}
                style={{
                  flex: "1 1 130px", textAlign: "left", cursor: "pointer",
                  background: paisFiltro === r.pais ? "var(--bg-elev-2)" : "var(--bg-elev)",
                  border: `1px solid ${paisFiltro === r.pais ? "var(--amber)" : "var(--border)"}`,
                  padding: "9px 11px", fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>
                  {r.pais}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-data)" }}>
                  {fmtNum(r.promedioMm, 0)} <span style={{ fontSize: 10, color: "var(--text-dim)" }}>mm prom.</span>
                </div>
                <div style={{ fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
                  {r.puntos} puntos · {fmtNum(r.minimoMm, 0)}–{fmtNum(r.maximoMm, 0)} mm
                </div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", padding: "4px 14px 8px" }}>
            <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width="100%" style={{ maxWidth: 420 }}>
              {contornos.map((c) => (
                <path key={c.nombre} d={c.d} fill="var(--bg-elev)" stroke="var(--border-hi)" strokeWidth={1} />
              ))}
              {grillaVisible.map((punto) => {
                const [x, y] = proyectar(punto.lat, punto.lon)
                return (
                  <circle key={`${punto.lat},${punto.lon}`} cx={x} cy={y} r={4.5}
                    fill={colorDeLluvia(punto.mm)} fillOpacity={0.88} stroke="#00000055" strokeWidth={0.4}>
                    <title>{`${punto.pais} · ${fmtNum(punto.mm, 0)} mm en ${payload.ventanaDias} días`}</title>
                  </circle>
                )
              })}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "0 14px 10px", justifyContent: "center" }}>
            {NIVELES.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: "var(--text-dim)" }}>
                <span style={{ width: 9, height: 9, background: n.color, display: "inline-block", borderRadius: 2 }} />
                {n.hasta === Infinity ? `>${NIVELES[i - 1].hasta} mm` : `≤${n.hasta} mm`}
              </div>
            ))}
          </div>

          <div style={{ padding: "0 14px 4px", fontSize: 9, color: "var(--text-dim)", textAlign: "center" }}>
            Últimos {payload.ventanaDias} días · {payload.grilla.length} puntos de referencia
            {paisFiltro && <> · filtrado a <b style={{ color: "var(--text)" }}>{paisFiltro}</b> (clic de nuevo para ver todo)</>}
          </div>

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
