/**
 * /api/agro-local — Precios locales de granos · Bolsa de Comercio de Rosario
 *
 * Fuente: BCR disponible (USD/tn FOB y disponible)
 *   Scraping de https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-actuales-0
 *
 * Retenciones actuales vigentes (abril 2026, Resolución MEyF):
 *   Soja: 33%
 *   Maíz: 12%
 *   Trigo: 12%
 *   Girasol: 7%
 *
 * FOB teórico = precio_CBOT_USD × (1 - retención%) − gastos_portuarios_estimados
 * Los precios reales se obtienen por scraping de BCR.
 */

import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Retenciones vigentes (hardcodeado hasta tener endpoint oficial)
const RETENCIONES: Record<string, number> = {
  soja: 0.33,
  maiz: 0.12,
  trigo: 0.12,
  girasol: 0.07,
}

// Gastos de comercialización estimados FOB Rosario (USD/tn)
const GASTOS_PORTUARIOS = 15

// Cache en memoria
let _cache: { data: AgroLocalData; expiry: number } | null = null

interface GranoData {
  disponible: number | null    // USD/tn precio disponible local
  fobOficial: number | null    // USD/tn FOB oficial BCR
  retencion: number            // % retención
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

async function scrapeBCR(): Promise<AgroLocalData | null> {
  try {
    const res = await fetch(
      "https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-actuales-0",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return null

    const html = await res.text()

    // Extraer precios de la tabla BCR
    // La BCR muestra precios en una tabla con formato: Soja / Maíz / Trigo / Girasol
    // Buscamos patrones numéricos en el contexto del grano

    const extractPrice = (grain: string, text: string): number | null => {
      // Patrón para encontrar precio USD/tn después del nombre del grano
      const patterns = [
        new RegExp(`${grain}[^0-9]{1,50}([0-9]{3,4}(?:[.,][0-9]{1,2})?)`, "i"),
        new RegExp(`([0-9]{3,4}(?:[.,][0-9]{1,2})?)[^0-9]{1,30}${grain}`, "i"),
      ]
      for (const pattern of patterns) {
        const m = text.match(pattern)
        if (m?.[1]) {
          const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."))
          if (!isNaN(val) && val > 50 && val < 1000) return val
        }
      }
      return null
    }

    const soja    = extractPrice("Soja", html)
    const maiz    = extractPrice("Ma[íi]z", html)
    const trigo   = extractPrice("Trigo", html)
    const girasol = extractPrice("Girasol", html)

    // Si no conseguimos ningún precio, el scraping falló
    if (!soja && !maiz && !trigo) return null

    return {
      soja:    { disponible: soja,    fobOficial: soja    ? soja    * (1 - RETENCIONES.soja)    - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.soja * 100,    unidad: "USD/tn" },
      maiz:    { disponible: maiz,    fobOficial: maiz    ? maiz    * (1 - RETENCIONES.maiz)    - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.maiz * 100,    unidad: "USD/tn" },
      trigo:   { disponible: trigo,   fobOficial: trigo   ? trigo   * (1 - RETENCIONES.trigo)   - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.trigo * 100,   unidad: "USD/tn" },
      girasol: { disponible: girasol, fobOficial: girasol ? girasol * (1 - RETENCIONES.girasol) - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.girasol * 100, unidad: "USD/tn" },
      updated_at: new Date().toISOString(),
      source: "BCR (scraping)",
    }
  } catch (e) {
    console.warn("[agro-local] scraping BCR falló:", e)
    return null
  }
}

export async function GET() {
  // Serve from cache (15 min)
  if (_cache && _cache.expiry > Date.now()) {
    return NextResponse.json(_cache.data)
  }

  const data = await scrapeBCR()

  if (data) {
    _cache = { data, expiry: Date.now() + 900_000 }
    return NextResponse.json(data)
  }

  // Fallback: retornar estructura vacía con mensaje claro
  const empty: AgroLocalData = {
    soja:    { disponible: null, fobOficial: null, retencion: RETENCIONES.soja * 100,    unidad: "USD/tn" },
    maiz:    { disponible: null, fobOficial: null, retencion: RETENCIONES.maiz * 100,    unidad: "USD/tn" },
    trigo:   { disponible: null, fobOficial: null, retencion: RETENCIONES.trigo * 100,   unidad: "USD/tn" },
    girasol: { disponible: null, fobOficial: null, retencion: RETENCIONES.girasol * 100, unidad: "USD/tn" },
    updated_at: new Date().toISOString(),
    source: "BCR no disponible",
  }
  return NextResponse.json(empty, { status: 206 })
}
