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

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import mercosurOutline from "@/client/data/mercosur-outline.json"
import { SectionHeader } from "../ui/section-header"
import { fmtNum } from "@/lib/utils"
import { aplicarRuedaZoom, encuadrarPuntos, pasoZoomBoton } from "@/lib/mapa-vista"

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

function botonMapaEstilo(deshabilitado: boolean): React.CSSProperties {
  return {
    fontSize: 11, color: deshabilitado ? "var(--text-mute)" : "var(--text-dim)",
    background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "3px 9px",
    cursor: deshabilitado ? "default" : "pointer", fontFamily: "inherit", lineHeight: 1.3,
    opacity: deshabilitado ? 0.5 : 1,
  }
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

// Zoom mínimo y máximo del mapa. Con 1x se ve la región entera; con VISTA_ZOOM_MAX
// se puede acercar a un país sin perder nitidez, porque todo sigue siendo SVG.
const VISTA_ZOOM_MIN = 1
const VISTA_ZOOM_MAX = 6

export function ClimaRegionalMap() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [paisFiltro, setPaisFiltro] = useState<string | null>(null)

  // Vista del mapa: pan (desplazamiento) y zoom, en coordenadas del viewBox.
  // No es zoom de navegador ni de imagen: es un transform sobre el propio SVG,
  // así que agrandar nunca pixela.
  const [vista, setVista] = useState({ x: 0, y: 0, zoom: 1 })
  const arrastreRef = useRef<{ activo: boolean; xInicial: number; yInicial: number; vistaInicial: { x: number; y: number } }>({
    activo: false, xInicial: 0, yInicial: 0, vistaInicial: { x: 0, y: 0 },
  })
  const svgRef = useRef<SVGSVGElement | null>(null)

  const reiniciarVista = useCallback(() => setVista({ x: 0, y: 0, zoom: 1 }), [])

  // Factor para pasar de píxeles de pantalla a unidades del viewBox: el SVG se
  // renderiza más chico que sus 560 unidades de ancho, así que un movimiento
  // de mouse de 10px tiene que mover el mapa más de 10 unidades de viewBox.
  const factorEscala = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? ANCHO / rect.width : 1
  }, [])

  // React adjunta onWheel como listener PASIVO por default: evento.preventDefault()
  // ahí adentro no bloquea el scroll real de la página en navegadores modernos
  // (a lo sumo tira un warning en consola y sigue de largo). El síntoma en
  // pantalla es exactamente "no puedo navegar": la rueda scrollea la página
  // entera en vez de acercar el mapa. Por eso el listener se agrega a mano
  // sobre el DOM con { passive: false }, la única forma de que preventDefault
  // realmente frene el scroll del documento.
  useEffect(() => {
    const nodo = svgRef.current
    if (!nodo) return
    const manejar = (evento: WheelEvent) => {
      evento.preventDefault()
      setVista((previa) => aplicarRuedaZoom(
        previa, evento.deltaY, { x: ANCHO / 2, y: ALTO / 2 },
        { zoomMin: VISTA_ZOOM_MIN, zoomMax: VISTA_ZOOM_MAX },
      ))
    }
    nodo.addEventListener("wheel", manejar, { passive: false })
    return () => nodo.removeEventListener("wheel", manejar)
  }, [])

  const zoomBoton = useCallback((direccion: "acercar" | "alejar") => {
    setVista((previa) => pasoZoomBoton(
      previa, direccion, { x: ANCHO / 2, y: ALTO / 2 },
      { zoomMin: VISTA_ZOOM_MIN, zoomMax: VISTA_ZOOM_MAX },
    ))
  }, [])

  const [arrastrando, setArrastrando] = useState(false)

  const onPointerDown = useCallback((evento: React.PointerEvent<SVGSVGElement>) => {
    arrastreRef.current = { activo: true, xInicial: evento.clientX, yInicial: evento.clientY, vistaInicial: { x: vista.x, y: vista.y } }
    svgRef.current?.setPointerCapture(evento.pointerId)
    setArrastrando(true)
  }, [vista.x, vista.y])

  const onPointerMove = useCallback((evento: React.PointerEvent<SVGSVGElement>) => {
    if (!arrastreRef.current.activo) return
    const escala = factorEscala()
    const dx = (evento.clientX - arrastreRef.current.xInicial) * escala
    const dy = (evento.clientY - arrastreRef.current.yInicial) * escala
    setVista((previa) => ({
      ...previa,
      x: arrastreRef.current.vistaInicial.x + dx,
      y: arrastreRef.current.vistaInicial.y + dy,
    }))
  }, [factorEscala])

  const onPointerUp = useCallback((evento: React.PointerEvent<SVGSVGElement>) => {
    arrastreRef.current.activo = false
    svgRef.current?.releasePointerCapture(evento.pointerId)
    setArrastrando(false)
  }, [])

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

  // Elegir un país no es solo filtrar qué puntos se muestran: mueve y acerca
  // la cámara para que ese país llene la pantalla ("navegar a Brasil", no
  // dejarlo del tamaño de una moneda en el mapa general). Sin país elegido,
  // vuelve a la vista de toda la región.
  useEffect(() => {
    if (!paisFiltro) { setVista({ x: 0, y: 0, zoom: 1 }); return }
    const puntos = grillaVisible.map((p) => {
      const [x, y] = proyectar(p.lat, p.lon)
      return { x, y }
    })
    setVista(encuadrarPuntos(puntos, { ancho: ANCHO, alto: ALTO }, {
      zoomMin: VISTA_ZOOM_MIN, zoomMax: VISTA_ZOOM_MAX, anchoMinimo: 70, altoMinimo: 70,
    }))
    // grillaVisible ya depende de [payload, paisFiltro]: no hace falta
    // repetir esas dependencias acá, alcanza con paisFiltro para disparar
    // el encuadre cada vez que cambia la selección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paisFiltro])

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

          <div style={{ display: "flex", justifyContent: "center", padding: "4px 14px 8px", position: "relative" }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              width="100%"
              style={{ maxWidth: 720, touchAction: "none", cursor: arrastrando ? "grabbing" : "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onDoubleClick={reiniciarVista}
            >
              <defs>
                {/* Cada punto se dibuja dos veces: una versión grande y difuminada
                    detrás (glow) que funde con sus vecinos y da lectura de "mancha
                    de lluvia", y encima el punto nítido real. Sin esto, 182 puntos
                    sueltos sobre fondo oscuro se leen como ruido, no como mapa. */}
                <filter id="difuminado-lluvia" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="9" />
                </filter>
              </defs>
              {/* El pan (x,y) es el transform externo y el zoom el interno: así
                  arrastrar mueve en unidades de viewBox sin importar cuánto esté
                  acercado, y hacer zoom no descentra el punto donde estabas. */}
              <g transform={`translate(${vista.x},${vista.y}) scale(${vista.zoom})`}>
                {contornos.map((c) => (
                  <path key={c.nombre} d={c.d} fill="var(--bg-elev-2)" stroke="var(--text-dim)" strokeWidth={1.5 / vista.zoom} />
                ))}
                <g filter="url(#difuminado-lluvia)" opacity={0.55}>
                  {grillaVisible.map((punto) => {
                    const [x, y] = proyectar(punto.lat, punto.lon)
                    return <circle key={`glow-${punto.lat},${punto.lon}`} cx={x} cy={y} r={11} fill={colorDeLluvia(punto.mm)} />
                  })}
                </g>
                {grillaVisible.map((punto) => {
                  const [x, y] = proyectar(punto.lat, punto.lon)
                  return (
                    <circle key={`${punto.lat},${punto.lon}`} cx={x} cy={y} r={5.5}
                      fill={colorDeLluvia(punto.mm)} fillOpacity={0.95} stroke="#00000066" strokeWidth={0.5 / vista.zoom}>
                      <title>{`${punto.pais} · ${fmtNum(punto.mm, 0)} mm en ${payload.ventanaDias} días`}</title>
                    </circle>
                  )
                })}
              </g>
            </svg>
            {/* Botones siempre visibles: no dependen de que la rueda del mouse
                funcione (trackpads, navegadores raros, mobile) y son la forma
                confiable de navegar cuando arrastrar+rueda no alcanza. */}
            <div style={{ position: "absolute", top: 4, right: 14, display: "flex", gap: 4 }}>
              <button onClick={() => zoomBoton("alejar")} disabled={vista.zoom <= VISTA_ZOOM_MIN} aria-label="Alejar" style={botonMapaEstilo(vista.zoom <= VISTA_ZOOM_MIN)}>−</button>
              <button onClick={() => zoomBoton("acercar")} disabled={vista.zoom >= VISTA_ZOOM_MAX} aria-label="Acercar" style={botonMapaEstilo(vista.zoom >= VISTA_ZOOM_MAX)}>+</button>
              {(vista.zoom > 1.02 || Math.abs(vista.x) > 0.5 || Math.abs(vista.y) > 0.5) && (
                <button onClick={reiniciarVista} style={botonMapaEstilo(false)}>
                  Reiniciar ({fmtNum(vista.zoom, 1)}×)
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 8, color: "var(--text-mute)", textAlign: "center", marginTop: -4 }}>
            Clic en un país para acercarte · botones +/− o rueda del mouse para zoom · arrastrar para mover
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
