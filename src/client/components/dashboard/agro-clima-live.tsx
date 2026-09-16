"use client"

/**
 * AgroClimaLive — mapa meteorológico animado en vivo (Windy embed).
 *
 * Complementa el mapa histórico de lluvia (clima-regional): ése es análisis
 * —acumulado anual comparable entre años—, éste es el pronóstico animado en
 * tiempo real (lluvia, viento, temperatura, radar). Es el widget oficial y
 * gratuito de Windy, embebido por iframe; el dato es de Windy, no nuestro.
 *
 * Se elige la capa con el selector propio en vez de la barra de Windy, para
 * mantener la estética del tablero; "Abrir en Windy" queda para el detalle.
 */

import { useState } from "react"
import { SectionHeader } from "../ui/section-header"

type Capa = { overlay: string; label: string }

const CAPAS: Capa[] = [
  { overlay: "rain", label: "Lluvia" },
  { overlay: "wind", label: "Viento" },
  { overlay: "temp", label: "Temperatura" },
  { overlay: "clouds", label: "Nubes" },
]

// Centro sobre la zona núcleo agrícola; zoom regional.
const LAT = -33.5
const LON = -61.5
const ZOOM = 5

function embedUrl(overlay: string): string {
  const q = new URLSearchParams({
    lat: String(LAT),
    lon: String(LON),
    detailLat: String(LAT),
    detailLon: String(LON),
    zoom: String(ZOOM),
    level: "surface",
    overlay,
    menu: "",
    message: "true",
    marker: "",
    calendar: "now",
    pressure: "",
    type: "map",
    location: "coordinates",
    metricWind: "km/h",
    metricTemp: "°C",
    radarRange: "-1",
  })
  return `https://embed.windy.com/embed2.html?${q}`
}

export function AgroClimaLive() {
  const [capa, setCapa] = useState<string>("rain")

  return (
    <div>
      <SectionHeader title="Clima en vivo — pronóstico animado" source="Windy.com" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 12px 4px" }}>
        {CAPAS.map(c => (
          <button
            key={c.overlay}
            onClick={() => setCapa(c.overlay)}
            style={{
              background: capa === c.overlay ? "var(--amber)" : "var(--bg-elev)",
              color: capa === c.overlay ? "#000" : "var(--text-mute)",
              border: `1px solid ${capa === c.overlay ? "var(--amber)" : "var(--border)"}`,
              padding: "5px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1,
              cursor: "pointer", fontWeight: 700, fontFamily: "inherit",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "4px 12px 8px" }}>
        <iframe
          key={capa}
          title="Mapa meteorológico en vivo (Windy)"
          src={embedUrl(capa)}
          style={{ width: "100%", height: 460, border: "1px solid var(--border)", display: "block" }}
          loading="lazy"
        />
      </div>

      <div style={{ padding: "0 12px 8px", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.6 }}>
        Pronóstico y observación en tiempo real de <strong style={{ color: "var(--text-mute)" }}>Windy.com</strong>.
        Para el análisis histórico comparable entre años, ver el mapa de lluvia acumulada más abajo.
      </div>
    </div>
  )
}
