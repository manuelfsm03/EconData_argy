/**
 * /api/clima-regional — Lluvia reciente sobre el Mercosur agrícola
 *
 * Foto de los últimos N días (default 14) de precipitación sobre una grilla
 * que cubre Argentina, el sur de Brasil, Uruguay y el este de Paraguay.
 * Responde "dónde llovió esta semana en la región", no "cómo viene la
 * campaña" (para eso está /api/agro-clima).
 *
 * Query params:
 *   ?dias=14   → ventana de días hacia atrás desde hoy (3 a 30)
 *
 * Fuente: reanálisis ERA5 vía Open-Meteo, igual que /api/agro-clima. El
 * envelope avisa en warnings que es reanálisis, no estación.
 */

import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildErrorEnvelope, buildSuccessEnvelope } from "@/server/api/envelope"
import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import {
  acumularVentana,
  grillaMercosur,
  resumirPorPais,
  type PuntoGrilla,
  type PuntoLluviaAcumulada,
} from "@/server/external/clima-regional"

export const runtime = "nodejs"

const ERA5 = SOURCE_REGISTRY.open_meteo_archive
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
const TAMANO_LOTE = 50
const DIAS_DEFAULT = 14

const NOTA_REANALISIS =
  "La lluvia proviene del reanálisis ERA5 (ECMWF) sobre una grilla de referencia, no de estaciones " +
  "meteorológicas de cada país. Sirve para ver el patrón regional; no reemplaza el dato oficial local."

type RespuestaArchive = {
  daily?: { time?: string[]; precipitation_sum?: (number | null)[] }
  error?: boolean
}

/** Mismo chequeo que en /api/agro-clima: Open-Meteo señala rate limit con HTTP 200 y `error:true`. */
function fallaDeclarada(payload: RespuestaArchive | RespuestaArchive[]): boolean {
  const partes = Array.isArray(payload) ? payload : [payload]
  return partes.some((parte) => parte?.error === true)
}

type Cacheado = { data: PuntoLluviaAcumulada[]; retrievedAt: string; expiry: number }
const cachePorVentana = new Map<number, Cacheado>()

async function pedirLote(
  lote: readonly PuntoGrilla[],
  desde: string,
  hasta: string,
): Promise<PuntoLluviaAcumulada[]> {
  const query = new URLSearchParams({
    latitude: lote.map((p) => p.lat).join(","),
    longitude: lote.map((p) => p.lon).join(","),
    start_date: desde,
    end_date: hasta,
    daily: "precipitation_sum",
    models: "era5",
    timezone: "UTC",
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
  if (porPunto.length !== lote.length) throw new Error("SOURCE_BAD_RESPONSE:LOTE_INCOMPLETO")

  return lote.map((punto, i) =>
    acumularVentana(punto, porPunto[i].daily?.time ?? [], porPunto[i].daily?.precipitation_sum ?? []))
}

async function obtenerGrilla(dias: number): Promise<{ data: PuntoLluviaAcumulada[]; retrievedAt: string }> {
  const cacheado = cachePorVentana.get(dias)
  if (cacheado && cacheado.expiry > Date.now()) return cacheado

  const hasta = new Date()
  const desdeFecha = new Date(hasta)
  desdeFecha.setUTCDate(desdeFecha.getUTCDate() - dias)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const puntos = grillaMercosur(2)
  const lotes: PuntoGrilla[][] = []
  for (let i = 0; i < puntos.length; i += TAMANO_LOTE) lotes.push(puntos.slice(i, i + TAMANO_LOTE))

  // Los lotes van en paralelo: son pocos (≈4 para 155 puntos) y una sola
  // ráfaga de pedidos no dispara el límite por minuto de Open-Meteo, a
  // diferencia de series históricas largas pedidas en secuencia ajustada.
  const resultados = await Promise.all(lotes.map((lote) => pedirLote(lote, fmt(desdeFecha), fmt(hasta))))
  const data = resultados.flat()
  if (data.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

  const retrievedAt = new Date().toISOString()
  const resultado = { data, retrievedAt, expiry: Date.now() + ERA5.cache.freshSeconds * 1000 }
  cachePorVentana.set(dias, resultado)
  return resultado
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)

  const diasParam = Number(searchParams.get("dias") ?? DIAS_DEFAULT)
  const dias = Number.isInteger(diasParam) && diasParam >= 3 && diasParam <= 30 ? diasParam : DIAS_DEFAULT

  try {
    const { data, retrievedAt } = await obtenerGrilla(dias)

    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "clima-regional",
      data: {
        ventanaDias: dias,
        grilla: data,
        resumenPorPais: resumirPorPais(data),
      },
      asOf: generatedAt.slice(0, 10),
      freshness: "fresh",
      completeness: "complete",
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
      buildErrorEnvelope({ requestId, generatedAt, dataset: "clima-regional", code, retryable: true }),
      { status: 503 },
    )
  }
}
