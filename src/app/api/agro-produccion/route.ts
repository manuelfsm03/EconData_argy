/**
 * /api/agro-produccion — Producción y rendimientos agrícolas (SIIA · MAGyP)
 *
 * Serie oficial de superficie sembrada y cosechada, producción y rendimiento
 * por cultivo y campaña, desde 1969/1970, con corte nacional o provincial.
 *
 * Query params:
 *   ?catalogo=1                 → cultivos disponibles y su cobertura temporal
 *   ?cultivo=soja total         → serie del cultivo (requerido si no hay catálogo)
 *   ?provincia=Córdoba          → recorta a una provincia (default: país)
 *   ?desde=2000&hasta=2024      → recorta el rango de campañas
 *
 * La respuesta incluye siempre las discontinuidades declaradas del cultivo: la
 * serie no se entrega sin la advertencia de sus quiebres metodológicos.
 */

import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { buildErrorEnvelope, buildSuccessEnvelope } from "@/server/api/envelope"
import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import {
  claveSerie,
  construirIndice,
  discontinuidadesDe,
  parseSiiaCsv,
  SIIA_CULTIVOS_NO_CUBIERTOS,
  type SiiaIndice,
  type SiiaPuntoSerie,
} from "@/server/external/siia-estimaciones"

export const runtime = "nodejs"

const SIIA = SOURCE_REGISTRY.magyp_siia
const CSV_URL =
  "https://datos.magyp.gob.ar/dataset/9e1e77ba-267e-4eaa-a59f-3296e86b5f36/resource/95d066e6-8a0f-4a80-b59d-6f28f88eacd5/download/estimaciones-agricolas-2026-03.csv"

/**
 * El CSV pesa ~15 MB y la serie se actualiza una vez por campaña, así que se
 * parsea una sola vez y se guarda ya indexado. Las filas crudas se descartan.
 */
type IndiceCacheado = { indice: SiiaIndice; retrievedAt: string; expiry: number }
let cache: IndiceCacheado | null = null

async function obtenerIndice(): Promise<IndiceCacheado> {
  if (cache && cache.expiry > Date.now()) return cache

  const response = await fetchRegistered(CSV_URL, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "text/csv" },
    signal: AbortSignal.timeout(SIIA.timeoutMs),
    next: { revalidate: SIIA.cache.freshSeconds },
  })
  if (!response.ok) throw new Error(`SOURCE_BAD_RESPONSE:${response.status}`)

  const rows = parseSiiaCsv(await response.text())
  if (rows.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

  cache = {
    indice: construirIndice(rows),
    retrievedAt: new Date().toISOString(),
    expiry: Date.now() + SIIA.cache.freshSeconds * 1000,
  }
  return cache
}

function recortar(serie: SiiaPuntoSerie[], desde: number | null, hasta: number | null): SiiaPuntoSerie[] {
  return serie.filter((punto) =>
    (desde === null || punto.anio >= desde) && (hasta === null || punto.anio <= hasta))
}

function enteroOpcional(raw: string | null): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const generatedAt = new Date().toISOString()
  const { searchParams } = new URL(request.url)

  try {
    const { indice, retrievedAt } = await obtenerIndice()

    const fuente = {
      id: SIIA.id,
      publisher: SIIA.publisher,
      mode: "live" as const,
      retrievedAt,
      fallbackFrom: null,
    }

    if (searchParams.get("catalogo") === "1") {
      return NextResponse.json(buildSuccessEnvelope({
        requestId,
        generatedAt,
        dataset: "agro-produccion-catalogo",
        data: {
          cultivos: indice.cultivos,
          noCubiertos: SIIA_CULTIVOS_NO_CUBIERTOS,
        },
        asOf: String(Math.max(...indice.cultivos.map((c) => c.hasta))),
        freshness: "fresh",
        completeness: "complete",
        source: fuente,
      }))
    }

    // Sin cultivo no hay serie posible. El listado de cultivos válidos se pide
    // con ?catalogo=1: el envelope de error no transporta detalle por diseño.
    const cultivo = searchParams.get("cultivo")
    if (!cultivo) {
      return NextResponse.json(
        buildErrorEnvelope({
          requestId,
          generatedAt,
          dataset: "agro-produccion",
          code: "INVALID_INPUT",
          retryable: false,
        }),
        { status: 400 },
      )
    }

    const provincia = searchParams.get("provincia")
    const serieCompleta = indice.series.get(claveSerie(cultivo, provincia ?? undefined))
    if (!serieCompleta || serieCompleta.length === 0) {
      return NextResponse.json(
        buildErrorEnvelope({
          requestId,
          generatedAt,
          dataset: "agro-produccion",
          code: "INVALID_INPUT",
          retryable: false,
        }),
        { status: 404 },
      )
    }

    const serie = recortar(serieCompleta, enteroOpcional(searchParams.get("desde")), enteroOpcional(searchParams.get("hasta")))
    const discontinuidades = discontinuidadesDe(cultivo)
    const ultimaCampania = serieCompleta[serieCompleta.length - 1]

    // Una serie que terminó hace años no está "desactualizada": está
    // discontinuada, y decirlo es parte del dato.
    const anioMasReciente = Math.max(...indice.cultivos.map((c) => c.hasta))
    const discontinuada = ultimaCampania.anio < anioMasReciente

    return NextResponse.json(buildSuccessEnvelope({
      requestId,
      generatedAt,
      dataset: "agro-produccion",
      data: {
        cultivo,
        provincia: provincia ?? null,
        nivel: provincia ? "provincia" : "pais",
        serie,
        discontinuidades,
        discontinuada,
        provinciasDisponibles: indice.provinciasPorCultivo.get(claveSerie(cultivo).split("|")[0]) ?? [],
        ultimaCampania: ultimaCampania.campania,
      },
      asOf: ultimaCampania.campania,
      freshness: discontinuada ? "static" : "fresh",
      completeness: serie.length === serieCompleta.length ? "complete" : "partial",
      source: fuente,
      warnings: [
        ...discontinuidades.map((d) => d.nota),
        ...(discontinuada
          ? [`La serie de '${cultivo}' se discontinuó en ${ultimaCampania.campania}: no hay datos posteriores en el SIIA.`]
          : []),
      ],
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    const code = message.startsWith("SOURCE_BAD_RESPONSE")
      ? "SOURCE_BAD_RESPONSE"
      : message.includes("Timeout") || message.includes("timeout")
        ? "SOURCE_TIMEOUT"
        : "SOURCE_UNAVAILABLE"

    return NextResponse.json(
      buildErrorEnvelope({ requestId, generatedAt, dataset: "agro-produccion", code, retryable: true }),
      { status: 503 },
    )
  }
}
