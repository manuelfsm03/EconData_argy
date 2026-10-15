/**
 * Descarga y caché del dataset del SIIA.
 *
 * Vive aparte de los endpoints porque lo consumen dos: la serie de producción
 * y el cruce clima-rendimiento. El CSV pesa ~15 MB y se publica una vez por
 * campaña, así que se baja una vez, se indexa y se descartan las filas crudas.
 */

import { fetchRegistered } from "@/server/http/fetch-source"
import { SOURCE_REGISTRY } from "@/server/sources/registry"
import { construirIndice, normalizarClave, parseSiiaCsv, type SiiaIndice, type SiiaRow } from "./siia-estimaciones"

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

// El CSV consolidado se publica una vez por campaña y arrastra a TODOS los
// cultivos al ritmo del más lento en cerrarse — verificado en vivo
// (14/10/2026) que se quedó en la campaña 2023/2024 desde marzo-2026. MAGyP
// también publica cada cultivo por separado (un dataset CKAN por especie),
// y cada uno cierra su campaña en un momento distinto del año según el
// calendario agrícola propio (ej. trigo y cebada, de invierno, ya tenían la
// campaña 2024/2025 completa cuando soja/maíz, de verano, todavía no). Se
// usa el consolidado como base (cobertura histórica completa desde 1969 y
// cultivos que no tienen dataset propio) y se lo extiende con lo que cada
// dataset individual tenga más allá del último año ya cubierto — nunca se
// resta ni se reemplaza nada, sólo se agregan años nuevos por cultivo.
//
// Ojo con el encoding: estos CSV individuales vienen en Latin-1 (verificado
// byte a byte — "maíz" sale como 0x6D 0x61 0xED 0x7A), a diferencia del
// consolidado que es UTF-8. Decodificarlos como UTF-8 corrompe los acentos.
type CultivoIndividual = { packageId: string; remapCultivo?: string }
const CULTIVOS_INDIVIDUALES: CultivoIndividual[] = [
  { packageId: "8ae4865f-d2f2-45a2-9343-7a4a12728a90", remapCultivo: "soja total" },
  { packageId: "514853fc-0a78-4b6f-a42f-8e89eab784c8" }, // Maíz
  { packageId: "10105e94-c560-4b02-b15f-ef3ef764b833", remapCultivo: "trigo total" },
  { packageId: "e080ceb1-c369-4d11-8eaf-ed5e2a21bdf2" }, // Girasol
  { packageId: "d996be66-fd46-42d5-aca9-018853d54e3a" }, // Sorgo
  { packageId: "060f3fa3-060a-4a5d-a753-b928cb00d2eb", remapCultivo: "cebada total" },
  { packageId: "ba016ebb-7b1c-413f-92de-62fe7ca9deab" }, // Avena
  { packageId: "7085900f-db65-45a7-92a1-136373c1e8cf" }, // Centeno
  { packageId: "954221e4-1d58-4103-bb09-88fa0868be34" }, // Maní
  { packageId: "1efdadba-d9b9-4437-9306-1dcf322b7bc1" }, // Arroz
  { packageId: "eb301092-4c01-470d-8b2c-8c0e35285084", remapCultivo: "poroto total" },
  { packageId: "40c1ddf3-95b7-4721-8ccb-ac3e4ee10fe0" }, // Lino
  { packageId: "60a9e1ed-071e-4a65-80a7-b1dc63827ab4" }, // Mijo
  { packageId: "7fa2c4f5-5403-4604-9810-67f5a5b494bb" }, // Té
  { packageId: "4160ff65-f619-4408-a85f-6751d951cdc5" }, // Yerba mate
]

async function resolverUrlCultivo(packageId: string): Promise<string | null> {
  try {
    const response = await fetchRegistered(
      `https://datos.magyp.gob.ar/api/3/action/package_show?id=${packageId}`,
      {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
        signal: AbortSignal.timeout(SIIA.timeoutMs),
        next: { revalidate: SIIA.cache.freshSeconds },
      },
    )
    if (!response.ok) return null
    const json = await response.json() as {
      result?: { resources?: Array<{ name?: string; format?: string; url?: string }> }
    }
    const recurso = json.result?.resources?.find(
      (r) => r.format?.toUpperCase() === "CSV" && /serie siembra/i.test(r.name ?? ""),
    )
    return recurso?.url ?? null
  } catch {
    return null
  }
}

/** Filas nuevas (años no cubiertos aún) de un cultivo individual, o [] si la fuente falla. */
async function filasExtensionCultivo(
  cultivo: CultivoIndividual,
  maxAnioPorCultivo: Map<string, number>,
): Promise<SiiaRow[]> {
  try {
    const url = await resolverUrlCultivo(cultivo.packageId)
    if (!url) return []
    const response = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "text/csv" },
      signal: AbortSignal.timeout(SIIA.timeoutMs),
      next: { revalidate: SIIA.cache.freshSeconds },
    })
    if (!response.ok) return []

    const texto = Buffer.from(await response.arrayBuffer()).toString("latin1")
    const filas = parseSiiaCsv(texto)
    if (filas.length === 0) return []

    const nombreFinal = cultivo.remapCultivo ?? filas[0].cultivo
    const clave = normalizarClave(nombreFinal)
    const maxAnioActual = maxAnioPorCultivo.get(clave) ?? -Infinity

    return filas
      .filter((fila) => fila.anio > maxAnioActual)
      .map((fila) => ({ ...fila, cultivo: nombreFinal }))
  } catch {
    return []
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

  const rowsBase = parseSiiaCsv(await response.text())
  if (rowsBase.length === 0) throw new Error("SOURCE_BAD_RESPONSE:EMPTY")

  const maxAnioPorCultivo = new Map<string, number>()
  for (const fila of rowsBase) {
    const clave = normalizarClave(fila.cultivo)
    const actual = maxAnioPorCultivo.get(clave) ?? -Infinity
    if (fila.anio > actual) maxAnioPorCultivo.set(clave, fila.anio)
  }

  const extensiones = await Promise.all(
    CULTIVOS_INDIVIDUALES.map((cultivo) => filasExtensionCultivo(cultivo, maxAnioPorCultivo)),
  )
  const rows = rowsBase.concat(...extensiones)

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
