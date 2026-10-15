import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/balanza-socios — comercio argentino por país socio.
 *
 * Exportaciones: datos.gob.ar dataset 357 (INDEC), anual.
 * Importaciones: datos.gob.ar dataset 78 "Importaciones CIF por región y
 * país", mensual -- confirmada como fuente pública gratuita el 2026-08-15
 * (antes se creía que no existía equivalente a UN Comtrade; sí existe, solo
 * había que buscarla bien). Ver PARTNER_IMPORT_SERIES en trade-data.ts.
 *
 * Vintages distintos a propósito: exportaciones es el último año cerrado,
 * importaciones el último mes publicado. NO se calcula un "saldo" mezclando
 * ambos períodos -- sería un dato falso con apariencia de real.
 */

import { NextResponse } from "next/server"
import {
  PARTNER_EXPORT_SERIES,
  PARTNER_IMPORT_SERIES,
  parsePartnerExportPayload,
  parsePartnerImportPayload,
  type TradePartnerExport,
} from "@/lib/trade-data"

const cache = new Map<string, { data: unknown; expiry: number }>()


// La API de series de datos.gob.ar es flaky de un modo verificado en vivo
// (14/10/2026): para una MISMA combinación de series, un valor de `limit`
// que ahora mismo devuelve todo vacío/null puede ser el único que funciona
// cinco minutos después (y viceversa) — no es un umbral fijo, cambia en el
// tiempo (probablemente caché/réplicas del lado de ellos). Reintentar con el
// mismo `limit` no sirve si ESE valor está "pegado" en mal estado; lo que
// funciona en vivo es probar un valor DISTINTO en cada reintento.
const LIMITES_CANDIDATOS = [5000, 1000, 2000, 90, 50, 10]

// Una serie sola, con reintento. Pedir cada país POR SEPARADO (no los 10
// combinados en una sola consulta) porque la combinación puede devolver
// algunos países en null aunque sí tengan dato reciente (comprobado
// pidiéndolos solos) — y un conjunto combinado no deja detectar/reintentar
// esa corrupción parcial de forma confiable.
async function fetchSerieUnica(id: string): Promise<[string, number] | null> {
  for (const limit of LIMITES_CANDIDATOS) {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(id)}&sort=desc&limit=${limit}`
    const response = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store", // nunca servir desde el cache de fetch de Next un intento fallido
    })
    if (!response.ok) throw new Error(`datos.gob.ar ${response.status}`)
    const json = await response.json() as { data?: [string, number | null][] }
    const row = json.data?.[0]
    if (row && row[1] != null) return [row[0], row[1]]
  }
  return null
}

async function fetchPartnerExports() {
  const valores = await Promise.all(PARTNER_EXPORT_SERIES.map((p) => fetchSerieUnica(p.id)))
  const fecha = valores.find((v) => v != null)?.[0] ?? null
  const row: [string, ...(number | null)[]] = [fecha ?? "", ...valores.map((v) => v?.[1] ?? null)]
  return parsePartnerExportPayload({ data: [row] })
}

async function fetchPartnerImports() {
  const valores = await Promise.all(PARTNER_IMPORT_SERIES.map((p) => fetchSerieUnica(p.id)))
  const fecha = valores.find((v) => v != null)?.[0] ?? null
  const row: [string, ...(number | null)[]] = [fecha ?? "", ...valores.map((v) => v?.[1] ?? null)]
  return parsePartnerImportPayload({ data: [row] })
}


export async function GET() {
  const cacheKey = "balanza_socios_v3"
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return NextResponse.json(cached.data)

  let partners: TradePartnerExport[]
  let referenceYear: string
  let liveCount = 0
  let source: string

  try {
    const live = await fetchPartnerExports()
    partners = live.partners
    referenceYear = live.year ?? "sin fecha"
    liveCount = live.liveCount
    if (liveCount === 0) throw new Error("datos.gob.ar returned no partner values")
    source = `datos.gob.ar · INDEC · dataset 357 (${referenceYear})`
  } catch {
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Exportaciones por socio no disponibles", retryable: true } },
      { status: 502 },
    )
  }

  // Importaciones: fuente independiente, con su propio período. Si falla no
  // tumba el endpoint entero -- las exportaciones siguen siendo válidas solas.
  let importPeriodo: string | null = null
  let importLiveCount = 0
  try {
    const importsLive = await fetchPartnerImports()
    importPeriodo = importsLive.periodo
    importLiveCount = importsLive.liveCount
    if (importLiveCount > 0) {
      for (const partner of partners) {
        partner.impo = importsLive.values[partner.nombre] ?? null
      }
    }
  } catch {
    // se sigue con impo: null en todos los socios, ya inicializado por parsePartnerExportPayload
  }

  const sorted = partners.sort((a, b) => (b.expo ?? -1) - (a.expo ?? -1))
  const result = {
    data: {
      socios: sorted,
      top_exportacion: sorted.filter((partner) => partner.expo != null),
      top_importacion: [...sorted].filter((partner) => partner.impo != null).sort((a, b) => (b.impo ?? -1) - (a.impo ?? -1)),
      is_live: liveCount > 0,
      is_live_exportaciones: liveCount > 0,
      is_live_importaciones: importLiveCount > 0,
      live_count: liveCount,
      anio_referencia: referenceYear,
      periodo_importaciones: importPeriodo,
    },
    updated_at: new Date().toISOString(),
    source,
    nota: importLiveCount > 0
      ? `Importaciones: datos.gob.ar · INDEC · dataset 78 (${importPeriodo ?? "sin fecha"}, mensual) — período distinto al de exportaciones (${referenceYear}, anual) a propósito, no se combinan en un saldo para no mezclar vintages.`
      : "Importaciones por país de origen no disponibles en este momento (falló el fetch en vivo a datos.gob.ar dataset 78). El ranking se basa sólo en exportaciones.",
  }

  cache.set(cacheKey, { data: result, expiry: Date.now() + 21_600_000 })
  return NextResponse.json(result)
}
