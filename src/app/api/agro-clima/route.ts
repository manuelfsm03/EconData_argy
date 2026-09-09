/**
 * /api/agro-clima — Lluvia por campaña agrícola y su relación con el rinde
 *
 * Acumula precipitación en el ciclo octubre-marzo para una zona productiva y,
 * cuando se pide, la cruza con el rendimiento del SIIA para estimar cuánto
 * rinde vale la lluvia una vez descontada la tendencia tecnológica.
 *
 * Query params:
 *   ?zonas=1                    → zonas disponibles
 *   ?zona=nucleo                → zona a consultar (default: nucleo)
 *   ?cultivo=soja total         → cruza con el rinde de ese cultivo
 *   ?desde=1970                 → primera campaña (default: 1970)
 *
 * La fuente de lluvia es reanálisis ERA5, no observación de estación. El
 * envelope lo dice en warnings: es una advertencia sobre qué es el dato, no
 * un error, y tiene que llegar hasta la pantalla.
 */

import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildErrorEnvelope, buildSuccessEnvelope } from "@/server/api/envelope"
import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import {
  acumularPorCampania,
  promediarZona,
  resumirLluvia,
  sensibilidadClimaRinde,
  zonaPorId,
  ZONAS_AGRICOLAS,
  type PuntoLluvia,
  type PuntoRinde,
  type ZonaAgricola,
} from "@/server/external/clima-campania"
import { claveSerie } from "@/server/external/siia-estimaciones"
import { obtenerIndiceSiia } from "@/server/external/siia-fuente"

export const runtime = "nodejs"

const ERA5 = SOURCE_REGISTRY.open_meteo_archive
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
const ANIO_INICIO = 1969

const NOTA_REANALISIS =
  "La lluvia proviene del reanálisis ERA5 (ECMWF) interpolado a los puntos de referencia de la zona, " +
  "no de estaciones meteorológicas. Sirve para comparar campañas entre sí; no reemplaza la medición en tierra."

type LluviaCacheada = { serie: PuntoLluvia[]; retrievedAt: string; expiry: number }
const cachePorZona = new Map<string, LluviaCacheada>()

type RespuestaArchive = {
  daily?: { time?: string[]; precipitation_sum?: (number | null)[] }
  error?: boolean
  reason?: string
}

/**
 * Open-Meteo señala sus errores con HTTP 200 y un `error: true` en el cuerpo
 * (por ejemplo al exceder el límite de pedidos por minuto). Sin este chequeo
 * un rate limit se leería como "la fuente no tiene datos", que es un
 * diagnóstico distinto y manda a buscar el problema al lado equivocado.
 */
function fallaDeclarada(payload: RespuestaArchive | RespuestaArchive[]): boolean {
  const partes = Array.isArray(payload) ? payload : [payload]
  return partes.some((parte) => parte?.error === true)
}

async function lluviaDeZona(zona: ZonaAgricola): Promise<{ serie: PuntoLluvia[]; retrievedAt: string }> {
  const cacheada = cachePorZona.get(zona.id)
  if (cacheada && cacheada.expiry > Date.now()) {
    return { serie: cacheada.serie, retrievedAt: cacheada.retrievedAt }
  }

  const hasta = new Date()
  const query = new URLSearchParams({
    latitude: zona.puntos.map((punto) => punto.lat).join(","),
    longitude: zona.puntos.map((punto) => punto.lon).join(","),
    start_date: `${ANIO_INICIO}-01-01`,
    end_date: hasta.toISOString().slice(0, 10),
    daily: "precipitation_sum",
    timezone: "America/Argentina/Buenos_Aires",
  })

  const response = await fetchRegistered(`${ARCHIVE_URL}?${query}`, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(ERA5.timeoutMs),
    next: { revalidate: ERA5.cache.freshSeconds },
  })
  if (!response.ok) throw new Error(`SOURCE_BAD_RESPONSE:${response.status}`)

  // Con una sola coordenada la API devuelve un objeto; con varias, un array.
  const payload = await response.json() as RespuestaArchive | RespuestaArchive[]
  if (fallaDeclarada(payload)) throw new Error("SOURCE_UNAVAILABLE:UPSTREAM_ERROR")
  const porPunto = Array.isArray(payload) ? payload : [payload]

  const series = porPunto
    .map((punto) => acumularPorCampania(punto.daily?.time ?? [], punto.daily?.precipitation_sum ?? []))
    .filter((serie) => serie.length > 0)
  if (series.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

  const serie = promediarZona(series)
  const retrievedAt = new Date().toISOString()
  cachePorZona.set(zona.id, { serie, retrievedAt, expiry: Date.now() + ERA5.cache.freshSeconds * 1000 })
  return { serie, retrievedAt }
}

/**
 * Rinde de la zona: agrega las provincias que la componen ponderando por
 * superficie cosechada, que es como se agrega un rendimiento.
 */
async function rindeDeZona(zona: ZonaAgricola, cultivo: string): Promise<PuntoRinde[]> {
  const { indice } = await obtenerIndiceSiia()
  const provincias = [...new Set(zona.puntos.map((punto) => punto.provincia))]

  const acumulado = new Map<number, { produccion: number; superficie: number }>()
  for (const provincia of provincias) {
    const serie = indice.series.get(claveSerie(cultivo, provincia))
    if (!serie) continue
    for (const punto of serie) {
      if (punto.produccionTm === null || punto.superficieCosechadaHa === null) continue
      const previo = acumulado.get(punto.anio) ?? { produccion: 0, superficie: 0 }
      previo.produccion += punto.produccionTm
      previo.superficie += punto.superficieCosechadaHa
      acumulado.set(punto.anio, previo)
    }
  }

  return [...acumulado.entries()]
    .filter(([, valor]) => valor.superficie > 0)
    .map(([campania, valor]) => ({
      campania,
      rendimientoKgHa: (valor.produccion * 1000) / valor.superficie,
    }))
    .sort((a, b) => a.campania - b.campania)
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)

  if (searchParams.get("zonas") === "1") {
    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "agro-clima-zonas",
      data: {
        zonas: ZONAS_AGRICOLAS.map((zona) => ({
          id: zona.id,
          nombre: zona.nombre,
          descripcion: zona.descripcion,
          puntos: zona.puntos.length,
          provincias: [...new Set(zona.puntos.map((punto) => punto.provincia))],
        })),
      },
      asOf: generatedAt.slice(0, 10),
      freshness: "static",
      completeness: "complete",
      source: { id: ERA5.id, publisher: ERA5.publisher, mode: "curated_static", retrievedAt: generatedAt, fallbackFrom: null },
    }))
  }

  const zona = zonaPorId(searchParams.get("zona") ?? "nucleo")
  if (!zona) {
    return NextResponse.json(
      buildErrorEnvelope({ requestId, generatedAt, dataset: "agro-clima", code: "INVALID_INPUT", retryable: false }),
      { status: 400 },
    )
  }

  const cultivo = searchParams.get("cultivo") ?? "soja total"
  const desde = Number(searchParams.get("desde") ?? "1970")

  try {
    const { serie, retrievedAt } = await lluviaDeZona(zona)
    const recortada = serie.filter((punto) => punto.campania >= (Number.isInteger(desde) ? desde : 1970))
    if (recortada.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

    // El cruce con el rinde es lo valioso, pero si el SIIA falla la lluvia
    // sigue sirviendo sola: se degrada, no se cae.
    let sensibilidad = null
    let avisoRinde: string | null = null
    try {
      sensibilidad = sensibilidadClimaRinde(recortada, await rindeDeZona(zona, cultivo))
      if (sensibilidad === null) avisoRinde = `Sin campañas suficientes para cruzar '${cultivo}' con la lluvia de esta zona.`
    } catch {
      avisoRinde = "No se pudo consultar el rendimiento del SIIA: se devuelve solo la serie de lluvia."
    }

    const resumen = resumirLluvia(recortada)

    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "agro-clima",
      data: {
        zona: { id: zona.id, nombre: zona.nombre, descripcion: zona.descripcion, puntos: zona.puntos },
        cultivo,
        serie: recortada,
        resumen,
        sensibilidad,
      },
      asOf: recortada[recortada.length - 1].etiqueta,
      freshness: "fresh",
      completeness: sensibilidad ? "complete" : "partial",
      source: { id: ERA5.id, publisher: ERA5.publisher, mode: "live", retrievedAt, fallbackFrom: null },
      warnings: [NOTA_REANALISIS, ...(avisoRinde ? [avisoRinde] : [])],
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    const code = message.startsWith("SOURCE_BAD_RESPONSE")
      ? "SOURCE_BAD_RESPONSE"
      : message.toLowerCase().includes("timeout")
        ? "SOURCE_TIMEOUT"
        : "SOURCE_UNAVAILABLE"

    return NextResponse.json(
      buildErrorEnvelope({ requestId, generatedAt, dataset: "agro-clima", code, retryable: true }),
      { status: 503 },
    )
  }
}
