/**
 * /api/clima-historico — Lluvia histórica por día, semana, mes o año
 *
 * Serie completa de precipitación diaria de ERA5 (desde 1940) agregada a la
 * granularidad que se pida, para una de las zonas agrícolas ya definidas en
 * clima-campania.ts. Es un explorador general de la serie, sin acoplar a
 * ningún cultivo ni campaña — para eso está /api/agro-clima.
 *
 * Query params:
 *   ?zonas=1                    → zonas disponibles (mismas que agro-clima)
 *   ?zona=nucleo                → zona a consultar (default: nucleo)
 *   ?granularidad=mes           → dia | semana | mes | anio (default: mes)
 *   ?desde=1990&hasta=2020       → recorta el rango de períodos devueltos
 *
 * "día" sobre 86 años son ~31.000 puntos por zona: sirve para graficar un
 * rango acotado (con ?desde/?hasta), no para traer todo de una.
 */

import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildErrorEnvelope, buildSuccessEnvelope } from "@/server/api/envelope"
import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import { ZONAS_AGRICOLAS, zonaPorId, type ZonaAgricola } from "@/server/external/clima-campania"
import {
  agregarSerieHistorica,
  promediarSerieHistorica,
  resumirSerieHistorica,
  type Granularidad,
  type PuntoHistorico,
} from "@/server/external/lluvia-historica"

export const runtime = "nodejs"

const ERA5 = SOURCE_REGISTRY.open_meteo_archive
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
const ANIO_INICIO = 1940

const NOTA_REANALISIS =
  "La lluvia proviene del reanálisis ERA5 (ECMWF), no de estaciones meteorológicas. Sirve para ver " +
  "tendencias y comparar períodos entre sí; para un evento puntual reciente no reemplaza el dato de estación."

const GRANULARIDADES: readonly Granularidad[] = ["dia", "semana", "mes", "anio"]

type RespuestaArchive = {
  daily?: { time?: string[]; precipitation_sum?: (number | null)[] }
  error?: boolean
}

/** Open-Meteo señala sus errores con HTTP 200 y `error: true` en el cuerpo (p.ej. al pasar el límite por minuto). */
function fallaDeclarada(payload: RespuestaArchive | RespuestaArchive[]): boolean {
  const partes = Array.isArray(payload) ? payload : [payload]
  return partes.some((parte) => parte?.error === true)
}

// Cachea el DIARIO crudo por zona (lo caro es la red); agregar a cualquier
// granularidad después es cómputo puro y barato, así que no hace falta un
// caché separado por cada combinación de zona+granularidad.
type DiarioCacheado = { porPunto: { time: string[]; mm: (number | null)[] }[]; retrievedAt: string; expiry: number }
const cachePorZona = new Map<string, DiarioCacheado>()

async function obtenerDiarioZona(zona: ZonaAgricola): Promise<DiarioCacheado> {
  const cacheado = cachePorZona.get(zona.id)
  if (cacheado && cacheado.expiry > Date.now()) return cacheado

  const hasta = new Date().toISOString().slice(0, 10)
  const query = new URLSearchParams({
    latitude: zona.puntos.map((p) => p.lat).join(","),
    longitude: zona.puntos.map((p) => p.lon).join(","),
    start_date: `${ANIO_INICIO}-01-01`,
    end_date: hasta,
    daily: "precipitation_sum",
    models: "era5",
    timezone: "America/Argentina/Buenos_Aires",
  })

  const response = await fetchRegistered(`${ARCHIVE_URL}?${query}`, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(ERA5.timeoutMs),
    next: { revalidate: ERA5.cache.freshSeconds },
  })
  if (!response.ok) throw new Error(`SOURCE_BAD_RESPONSE:${response.status}`)

  const payload = await response.json() as RespuestaArchive | RespuestaArchive[]
  if (fallaDeclarada(payload)) throw new Error("SOURCE_UNAVAILABLE:UPSTREAM_ERROR")

  const porPunto = Array.isArray(payload) ? payload : [payload]
  if (porPunto.length !== zona.puntos.length) throw new Error("SOURCE_BAD_RESPONSE:INCOMPLETE_ZONE")

  const resultado = {
    porPunto: porPunto.map((p) => ({ time: p.daily?.time ?? [], mm: p.daily?.precipitation_sum ?? [] })),
    retrievedAt: new Date().toISOString(),
    expiry: Date.now() + ERA5.cache.freshSeconds * 1000,
  }
  cachePorZona.set(zona.id, resultado)
  return resultado
}

function recortar(serie: PuntoHistorico[], desde: string | null, hasta: string | null): PuntoHistorico[] {
  return serie.filter((p) => (!desde || p.periodo >= desde) && (!hasta || p.periodo <= hasta))
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)

  if (searchParams.get("zonas") === "1") {
    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "clima-historico-zonas",
      data: { zonas: ZONAS_AGRICOLAS.map((z) => ({ id: z.id, nombre: z.nombre, descripcion: z.descripcion })) },
      asOf: generatedAt.slice(0, 10),
      freshness: "static",
      completeness: "complete",
      source: { id: ERA5.id, publisher: ERA5.publisher, mode: "curated_static", retrievedAt: generatedAt, fallbackFrom: null },
    }))
  }

  const zona = zonaPorId(searchParams.get("zona") ?? "nucleo")
  const granularidadParam = searchParams.get("granularidad") ?? "mes"
  const granularidad = GRANULARIDADES.includes(granularidadParam as Granularidad)
    ? granularidadParam as Granularidad
    : "mes"

  if (!zona) {
    return NextResponse.json(
      buildErrorEnvelope({ requestId, generatedAt, dataset: "clima-historico", code: "INVALID_INPUT", retryable: false }),
      { status: 400 },
    )
  }

  try {
    const { porPunto, retrievedAt } = await obtenerDiarioZona(zona)
    const seriesPorPunto = porPunto.map((p) => agregarSerieHistorica(p.time, p.mm, granularidad))
    const serieCompleta = promediarSerieHistorica(seriesPorPunto)
    if (serieCompleta.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

    const serie = recortar(serieCompleta, searchParams.get("desde"), searchParams.get("hasta"))
    const resumen = resumirSerieHistorica(serie)

    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "clima-historico",
      data: {
        zona: { id: zona.id, nombre: zona.nombre, descripcion: zona.descripcion },
        granularidad,
        serie,
        resumen,
      },
      asOf: serieCompleta[serieCompleta.length - 1].periodo,
      freshness: "fresh",
      completeness: serie.length === serieCompleta.length ? "complete" : "partial",
      source: { id: ERA5.id, publisher: ERA5.publisher, mode: "live", retrievedAt, fallbackFrom: null },
      warnings: [NOTA_REANALISIS],
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    const code = message.startsWith("SOURCE_BAD_RESPONSE")
      ? "SOURCE_BAD_RESPONSE"
      : message.toLowerCase().includes("timeout")
        ? "SOURCE_TIMEOUT"
        : "SOURCE_UNAVAILABLE"

    return NextResponse.json(
      buildErrorEnvelope({ requestId, generatedAt, dataset: "clima-historico", code, retryable: true }),
      { status: 503 },
    )
  }
}
