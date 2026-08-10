/**
 * /api/balanza-socios — exportaciones argentinas por país de destino.
 *
 * Fuente: datos.gob.ar, dataset 357 (INDEC). No existe una fuente pública
 * gratuita equivalente para importaciones por país de origen: esos campos
 * se devuelven como null en vez de completar estimaciones como si fueran datos.
 */

import { NextResponse } from "next/server"
import {
  PARTNER_EXPORT_SERIES,
  parsePartnerExportPayload,
  type TradePartnerExport,
} from "@/lib/trade-data"

const cache = new Map<string, { data: unknown; expiry: number }>()

const EXPORTS_2024_FALLBACK: Record<string, number> = {
  Brasil: 13608.46,
  China: 5961.35,
  "Estados Unidos": 6394.71,
  Chile: 6321.82,
  India: 3933.32,
  Alemania: 809.99,
  "Países Bajos": 1691.43,
  Uruguay: 1642.99,
  España: 1445.9,
  Italia: 1082.99,
}

async function fetchPartnerExports() {
  const ids = PARTNER_EXPORT_SERIES.map((partner) => partner.id).join(",")
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${encodeURIComponent(ids)}&sort=desc&limit=1`
  const response = await fetch(url, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 21_600 },
  })
  if (!response.ok) throw new Error(`datos.gob.ar ${response.status}`)
  return parsePartnerExportPayload(await response.json())
}

function fallbackPartners(): TradePartnerExport[] {
  return PARTNER_EXPORT_SERIES.map((partner) => {
    const value = EXPORTS_2024_FALLBACK[partner.nombre] ?? null
    return {
      nombre: partner.nombre,
      iso2: partner.iso2,
      expo: value,
      impo: null,
      saldo: null,
      total: value,
    }
  })
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
    partners = fallbackPartners()
    referenceYear = "2024"
    source = "Última lectura verificada del dataset 357 (2024); fuente en vivo no disponible"
  }

  const sorted = partners.sort((a, b) => (b.expo ?? -1) - (a.expo ?? -1))
  const result = {
    data: {
      socios: sorted,
      top_exportacion: sorted.filter((partner) => partner.expo != null),
      top_importacion: [] as TradePartnerExport[],
      is_live: liveCount > 0,
      is_live_exportaciones: liveCount > 0,
      is_live_importaciones: false,
      live_count: liveCount,
      anio_referencia: referenceYear,
    },
    updated_at: new Date().toISOString(),
    source,
    nota: "Importaciones por país de origen no conectadas: UN Comtrade requiere una clave paga y no hay una fuente pública equivalente. El ranking se basa sólo en exportaciones.",
  }

  cache.set(cacheKey, { data: result, expiry: Date.now() + 21_600_000 })
  return NextResponse.json(result)
}
