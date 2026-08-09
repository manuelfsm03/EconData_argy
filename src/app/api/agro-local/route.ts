/**
 * /api/agro-local — Precios locales de granos · pizarra Rosario (USD/tn)
 *
 * Fuente: mercado.rava.com/api/prices/indices — JSON público sin autenticación
 * (panel gratuito "Rava Mercado"). El scraping anterior a bcr.com.ar dejó de
 * funcionar: la BCR movió la página a cac.bcr.com.ar/es/precios-de-pizarra y
 * ahora carga los precios por JavaScript, sin datos en el HTML estático.
 * Girasol no está disponible en esta fuente — queda en null.
 *
 * Retenciones actuales vigentes (abril 2026, Resolución MEyF):
 *   Soja: 33%
 *   Maíz: 12%
 *   Trigo: 12%
 *   Girasol: 7%
 *
 * FOB teórico = precio_disponible_USD × (1 - retención%) − gastos_portuarios_estimados
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

async function fetchRavaGranos(): Promise<AgroLocalData | null> {
  try {
    const res = await fetch("https://mercado.rava.com/api/prices/indices", {
      headers: { "User-Agent": "Mozilla/5.0 PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const rows: { especie: string; ultimo: string }[] = json?.datos ?? []
    const get = (especie: string): number | null => {
      const row = rows.find(r => r.especie === especie)
      const val = row ? parseFloat(row.ultimo) : NaN
      return !isNaN(val) && val > 0 ? val : null
    }

    // "* ROSARIO" = precio disponible pizarra Rosario en USD/tn.
    const soja  = get("SOJA ROSARIO")
    const maiz  = get("MAIZ ROSARIO")
    const trigo = get("TRIGO ROSARIO")
    // Girasol no está disponible en esta fuente.

    if (!soja && !maiz && !trigo) return null

    return {
      soja:    { disponible: soja,  fobOficial: soja  ? soja  * (1 - RETENCIONES.soja)  - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.soja * 100,    unidad: "USD/tn" },
      maiz:    { disponible: maiz,  fobOficial: maiz  ? maiz  * (1 - RETENCIONES.maiz)  - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.maiz * 100,    unidad: "USD/tn" },
      trigo:   { disponible: trigo, fobOficial: trigo ? trigo * (1 - RETENCIONES.trigo) - GASTOS_PORTUARIOS : null, retencion: RETENCIONES.trigo * 100,   unidad: "USD/tn" },
      girasol: { disponible: null,  fobOficial: null,  retencion: RETENCIONES.girasol * 100, unidad: "USD/tn" },
      updated_at: new Date().toISOString(),
      source: "mercado.rava.com (pizarra Rosario)",
    }
  } catch (e) {
    console.warn("[agro-local] fetch mercado.rava.com falló:", e)
    return null
  }
}

export async function GET() {
  // Serve from cache (15 min)
  if (_cache && _cache.expiry > Date.now()) {
    return NextResponse.json(_cache.data)
  }

  const data = await fetchRavaGranos()

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
    source: "fuente no disponible",
  }
  return NextResponse.json(empty, { status: 206 })
}
