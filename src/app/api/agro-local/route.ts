import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/agro-local — Precios locales de granos · pizarra Rosario (USD/tn)
 *
 * Fuente: mercado.rava.com/api/prices/indices — JSON público sin autenticación.
 * La URL histórica de BCR responde 404. Girasol no está disponible en esta
 * fuente y se conserva como null.
 *
 * El FOB oficial y la retención no se derivan: permanecen explícitamente
 * ausentes hasta contar con una fuente y vigencia verificables.
 */

import { NextResponse } from "next/server"
import { parseRavaRosarioPrices } from "@/server/external/rava-prices"

export const runtime = "nodejs"

const RAVA_INDICES_URL = "https://mercado.rava.com/api/prices/indices"
let _cache: { data: AgroLocalData; expiry: number } | null = null

interface GranoData {
  disponible: number | null
  fobOficial: number | null
  retencion: number | null
  unidad: string
}

interface AgroLocalData {
  status: "ok"
  soja: GranoData
  maiz: GranoData
  trigo: GranoData
  girasol: GranoData
  updated_at: string
  source: string
}

function grainData(precio: number | null): GranoData {
  return {
    disponible: precio,
    fobOficial: null,
    retencion: null,
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
      status: "ok",
      soja: grainData(prices.soja),
      maiz: grainData(prices.maiz),
      trigo: grainData(prices.trigo),
      girasol: grainData(null),
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

  const degraded = {
    status: "degraded" as const,
    error: "La fuente Rosario no está disponible; no hay precios locales verificables.",
    source: "mercado.rava.com (pizarra Rosario)",
    updated_at: new Date().toISOString(),
  }
  return NextResponse.json(degraded, { status: 503 })
}
