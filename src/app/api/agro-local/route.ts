import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/agro-local — Precios locales de granos · pizarra Rosario (USD/tn)
 *
 * Fuente: mercado.rava.com/api/prices/indices — JSON público sin autenticación.
 * La URL histórica de BCR responde 404. Girasol no está disponible en esta
 * fuente y se conserva como null.
 *
 * FOB teórico = precio disponible × (1 - retención) - gastos estimados.
 */

import { NextResponse } from "next/server"
import { parseRavaRosarioPrices } from "@/server/external/rava-prices"

export const runtime = "nodejs"

const RAVA_INDICES_URL = "https://mercado.rava.com/api/prices/indices"
const RETENCIONES = {
  soja: 0.33,
  maiz: 0.12,
  trigo: 0.12,
  girasol: 0.07,
} as const
const GASTOS_PORTUARIOS = 15

let _cache: { data: AgroLocalData; expiry: number } | null = null

interface GranoData {
  disponible: number | null
  fobOficial: number | null
  retencion: number
  unidad: string
}

interface AgroLocalData {
  soja: GranoData
  maiz: GranoData
  trigo: GranoData
  girasol: GranoData
  updated_at: string
  source: string
}

function grainData(precio: number | null, retencion: number): GranoData {
  return {
    disponible: precio,
    fobOficial: precio === null
      ? null
      : Number((precio * (1 - retencion) - GASTOS_PORTUARIOS).toFixed(2)),
    retencion: retencion * 100,
    unidad: "USD/tn",
  }
}

async function fetchRavaGranos(): Promise<AgroLocalData | null> {
  try {
    const response = await fetchRegistered(RAVA_INDICES_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 PanelDeControl/2.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 900 },
    })
    if (!response.ok) return null

    const prices = parseRavaRosarioPrices(await response.json())
    if (prices.soja === null && prices.maiz === null && prices.trigo === null) {
      return null
    }

    return {
      soja: grainData(prices.soja, RETENCIONES.soja),
      maiz: grainData(prices.maiz, RETENCIONES.maiz),
      trigo: grainData(prices.trigo, RETENCIONES.trigo),
      girasol: grainData(null, RETENCIONES.girasol),
      updated_at: new Date().toISOString(),
      source: "mercado.rava.com (pizarra Rosario)",
    }
  } catch (error) {
    console.warn("[agro-local] fetch mercado.rava.com falló:", error)
    return null
  }
}

export async function GET() {
  if (_cache && _cache.expiry > Date.now()) {
    return NextResponse.json(_cache.data)
  }

  const data = await fetchRavaGranos()
  if (data) {
    _cache = { data, expiry: Date.now() + 900_000 }
    return NextResponse.json(data)
  }

  const empty: AgroLocalData = {
    soja: grainData(null, RETENCIONES.soja),
    maiz: grainData(null, RETENCIONES.maiz),
    trigo: grainData(null, RETENCIONES.trigo),
    girasol: grainData(null, RETENCIONES.girasol),
    updated_at: new Date().toISOString(),
    source: "fuente no disponible",
  }
  return NextResponse.json(empty, { status: 206 })
}
