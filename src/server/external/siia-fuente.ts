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

// El dataset del SIIA es un CKAN: cada vez que MAGyP publica una campaña
// nueva, el CSV se sube como un recurso con un nombre y resource_id distinto
// (ej. "estimaciones-agricolas-2026-03.csv") dentro del MISMO dataset — una
// URL de descarga fijada a mano queda apuntando para siempre al snapshot de
// cuando se escribió este código. Se resuelve el recurso vigente en cada
// descarga vía package_show, igual que se hace para otros portales CKAN del
// proyecto (datos.gob.ar, datos.produccion.gob.ar).
// Mismo slug que ya usa el healthcheck de este source en registry.ts.
const SIIA_PACKAGE_ID = "estimaciones-agricolas"
const SIIA_RESOURCE_NAME = "Estimaciones agrícolas"
// Fallback si CKAN no responde — último recurso conocido (puede quedar viejo).
const SIIA_CSV_URL_FALLBACK =
  "https://datos.magyp.gob.ar/dataset/9e1e77ba-267e-4eaa-a59f-3296e86b5f36/resource/95d066e6-8a0f-4a80-b59d-6f28f88eacd5/download/estimaciones-agricolas-2026-03.csv"

async function resolverUrlVigente(): Promise<string> {
  try {
    const response = await fetchRegistered(
      `https://datos.magyp.gob.ar/api/3/action/package_show?id=${SIIA_PACKAGE_ID}`,
      {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
        signal: AbortSignal.timeout(SIIA.timeoutMs),
        next: { revalidate: SIIA.cache.freshSeconds },
      },
    )
    if (!response.ok) throw new Error(`CKAN package_show ${response.status}`)
    const json = await response.json() as {
      result?: { resources?: Array<{ name?: string; format?: string; url?: string }> }
    }
    const recurso = json.result?.resources?.find(
      (r) => r.format?.toUpperCase() === "CSV" && r.name === SIIA_RESOURCE_NAME,
    )
    if (recurso?.url) return recurso.url
    throw new Error("CKAN package_show: recurso no encontrado")
  } catch {
    return SIIA_CSV_URL_FALLBACK
  }
}

export type IndiceSiiaCacheado = { indice: SiiaIndice; retrievedAt: string }

let cache: (IndiceSiiaCacheado & { expiry: number }) | null = null
let enVuelo: Promise<IndiceSiiaCacheado> | null = null

async function descargar(): Promise<IndiceSiiaCacheado> {
  const url = await resolverUrlVigente()
  const response = await fetchRegistered(url, {
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
