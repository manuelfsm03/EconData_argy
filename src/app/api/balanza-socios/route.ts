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


async function fetchPartnerExports() {
  const ids = PARTNER_EXPORT_SERIES.map((partner) => partner.id).join(",")
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(ids)}&sort=desc&limit=1`
  const response = await fetchRegistered(url, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 21_600 },
  })
  if (!response.ok) throw new Error(`datos.gob.ar ${response.status}`)
  return parsePartnerExportPayload(await response.json())
}

async function fetchPartnerImports() {
  const ids = PARTNER_IMPORT_SERIES.map((partner) => partner.id).join(",")
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(ids)}&sort=desc&limit=1`
  const response = await fetchRegistered(url, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 21_600 },
  })
  if (!response.ok) throw new Error(`datos.gob.ar ${response.status}`)
  return parsePartnerImportPayload(await response.json())
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
