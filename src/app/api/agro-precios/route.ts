/**
 * /api/agro-precios — Precios de granos de la pizarra Rosario + diferencial CBOT
 *
 * Fuente: API pública de granos.ar (uso libre con atribución). Reemplaza el
 * scraping de Rava de /api/agro-local por datos mejores y ya calculados por la
 * fuente: los 5 granos (soja, maíz, trigo, sorgo, girasol) en ARS/tn y USD/tn
 * con variación, más el diferencial FOB local vs CBOT (el "descuento argentino").
 *
 * granos.ar pide dos cosas en su licencia y las cumplimos:
 *   - cachear del lado nuestro (no pegarle en cada request) → stale-cache
 *   - atribuir a granos.ar → va en `source` y se muestra en la UI
 */

import { NextResponse } from "next/server"

import { fetchRegistered } from "@/server/http/fetch-source"
import { leerFresco, guardarExito, leerUltimoBueno } from "@/server/http/stale-cache"
import { GRANOS_AR_BASE, combinarPrecios, type PreciosAgro } from "@/server/external/granos-ar"

export const runtime = "nodejs"

const CACHE_KEY = "agro_precios_granos_ar"
const TTL_SEG = 900 // 15 min: la pizarra cambia por rueda, no por minuto

async function pedir(path: string): Promise<unknown> {
  const res = await fetchRegistered(`${GRANOS_AR_BASE}${path}`, {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: TTL_SEG },
  })
  if (!res.ok) throw new Error(`SOURCE_BAD_RESPONSE:${res.status}`)
  return res.json()
}

async function obtenerPrecios(): Promise<PreciosAgro> {
  const [pizarra, diferencial] = await Promise.all([
    pedir("/pizarra"),
    pedir("/cbot/diferencial"),
  ])
  const data = combinarPrecios(
    pizarra as Parameters<typeof combinarPrecios>[0],
    diferencial as Parameters<typeof combinarPrecios>[1],
  )
  if (!data) throw new Error("SOURCE_BAD_RESPONSE:sin precios")
  return data
}

export async function GET() {
  const fresco = leerFresco<PreciosAgro>(CACHE_KEY)
  if (fresco) {
    return NextResponse.json({
      data: fresco,
      cached: true,
      updated_at: new Date().toISOString(),
      source: "granos.ar — API pública (uso libre con atribución)",
    })
  }

  try {
    const data = await obtenerPrecios()
    guardarExito(CACHE_KEY, data, TTL_SEG)
    return NextResponse.json({
      data,
      updated_at: new Date().toISOString(),
      source: "granos.ar — API pública (uso libre con atribución)",
    })
  } catch (error) {
    console.error("[/api/agro-precios]", error)
    const stale = leerUltimoBueno<PreciosAgro>(CACHE_KEY)
    if (stale) {
      return NextResponse.json(
        {
          data: stale.data,
          cached: true,
          stale: true,
          stale_since: stale.staleSince,
          updated_at: new Date().toISOString(),
          source: "granos.ar (stale-cache)",
        },
        { headers: { "X-Data-Source": "stale-cache" } },
      )
    }
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Precios de granos no disponibles", retryable: true } },
      { status: 502 },
    )
  }
}
