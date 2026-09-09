/**
 * Descarga y caché del dataset del SIIA.
 *
 * Vive aparte de los endpoints porque lo consumen dos: la serie de producción
 * y el cruce clima-rendimiento. El CSV pesa ~15 MB y se publica una vez por
 * campaña, así que se baja una vez, se indexa y se descartan las filas crudas.
 */

import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import { construirIndice, parseSiiaCsv, type SiiaIndice } from "./siia-estimaciones"

const SIIA = SOURCE_REGISTRY.magyp_siia

export const SIIA_CSV_URL =
  "https://datos.magyp.gob.ar/dataset/9e1e77ba-267e-4eaa-a59f-3296e86b5f36/resource/95d066e6-8a0f-4a80-b59d-6f28f88eacd5/download/estimaciones-agricolas-2026-03.csv"

export type IndiceSiiaCacheado = { indice: SiiaIndice; retrievedAt: string }

let cache: (IndiceSiiaCacheado & { expiry: number }) | null = null
let enVuelo: Promise<IndiceSiiaCacheado> | null = null

async function descargar(): Promise<IndiceSiiaCacheado> {
  const response = await fetchRegistered(SIIA_CSV_URL, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "text/csv" },
    signal: AbortSignal.timeout(SIIA.timeoutMs),
    next: { revalidate: SIIA.cache.freshSeconds },
  })
  if (!response.ok) throw new Error(`SOURCE_BAD_RESPONSE:${response.status}`)

  const rows = parseSiiaCsv(await response.text())
  if (rows.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

  const resultado = { indice: construirIndice(rows), retrievedAt: new Date().toISOString() }
  cache = { ...resultado, expiry: Date.now() + SIIA.cache.freshSeconds * 1000 }
  return resultado
}

/**
 * Índice del SIIA, de caché si está fresco.
 *
 * Si dos requests llegan juntas con la caché fría comparten la misma descarga:
 * sin esto, cada una se bajaría sus propios 15 MB en paralelo.
 */
export async function obtenerIndiceSiia(): Promise<IndiceSiiaCacheado> {
  if (cache && cache.expiry > Date.now()) return { indice: cache.indice, retrievedAt: cache.retrievedAt }
  if (enVuelo) return enVuelo

  enVuelo = descargar().finally(() => { enVuelo = null })
  return enVuelo
}
