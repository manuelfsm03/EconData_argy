import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/agro-local — Precios locales de granos · pizarra Rosario (USD/tn)
 *
 * Fuente: mercado.rava.com/api/prices/indices — JSON público sin autenticación.
 * La URL histórica de BCR responde 404. Girasol no está disponible en esta
 * fuente y se conserva como null.
 *
 * FOB teórico = precio disponible × (1 - retención) - gastos estimados.
 *
 * Retenciones y gastos portuarios: se leen de `public/data/retenciones.json`
 * para poder actualizarlos con un commit cuando cambien por resolución
 * ministerial, sin tocar código. Ver `public/data/retenciones.README.md`.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { parseRavaRosarioPrices } from "@/server/external/rava-prices"

export const runtime = "nodejs"

const RAVA_INDICES_URL = "https://mercado.rava.com/api/prices/indices"

// Fallback inline por si el JSON queda malformado o el archivo desaparece.
// Debe reflejar los valores hardcodeados históricos (previos a la migración).
const RETENCIONES_FALLBACK = {
  soja: 0.33,
  maiz: 0.12,
  trigo: 0.12,
  girasol: 0.07,
} as const
const GASTOS_PORTUARIOS_FALLBACK = 15

let _cache: { data: AgroLocalData; expiry: number } | null = null

type CultivoKey = "soja" | "maiz" | "trigo" | "girasol"

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

interface RetencionesConfig {
  retenciones: Record<CultivoKey, number>
  gastosPortuarios: number
  origen: string
}

/**
 * Lee `public/data/retenciones.json` y devuelve los valores parseados.
 * Si el archivo falta, el JSON está mal formado o le faltan campos, cae al
 * fallback inline y loguea la razón para poder diagnosticar en Vercel.
 */
function loadRetenciones(): RetencionesConfig {
  const path = join(process.cwd(), "public", "data", "retenciones.json")
  try {
    const raw = readFileSync(path, "utf8")
    const parsed = JSON.parse(raw) as {
      cultivos?: Record<string, { derecho_export?: number }>
      gastos_portuarios_usd_ton?: number
      vigente_desde?: string
    }

    const cultivos = parsed.cultivos
    if (!cultivos) throw new Error("cultivos missing")

    const retenciones = {
      soja: cultivos.soja?.derecho_export,
      maiz: cultivos.maiz?.derecho_export,
      trigo: cultivos.trigo?.derecho_export,
      girasol: cultivos.girasol?.derecho_export,
    }
    for (const [k, v] of Object.entries(retenciones)) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`derecho_export inválido para ${k}: ${v}`)
      }
    }

    const gastos = parsed.gastos_portuarios_usd_ton
    if (typeof gastos !== "number" || !Number.isFinite(gastos)) {
      throw new Error(`gastos_portuarios_usd_ton inválido: ${gastos}`)
    }

    console.log(
      `[agro-local] retenciones cargadas desde ${path} ` +
        `(vigente_desde=${parsed.vigente_desde ?? "?"}): ` +
        `soja=${retenciones.soja} maiz=${retenciones.maiz} ` +
        `trigo=${retenciones.trigo} girasol=${retenciones.girasol} ` +
        `gastos=${gastos}`,
    )

    return {
      retenciones: retenciones as Record<CultivoKey, number>,
      gastosPortuarios: gastos,
      origen: "public/data/retenciones.json",
    }
  } catch (error) {
    console.warn(
      `[agro-local] no pude leer retenciones.json (${path}), uso fallback inline:`,
      error,
    )
    return {
      retenciones: { ...RETENCIONES_FALLBACK },
      gastosPortuarios: GASTOS_PORTUARIOS_FALLBACK,
      origen: "fallback-inline",
    }
  }
}

function grainData(
  precio: number | null,
  retencion: number,
  gastosPortuarios: number,
): GranoData {
  return {
    disponible: precio,
    fobOficial: precio === null
      ? null
      : Number((precio * (1 - retencion) - gastosPortuarios).toFixed(2)),
    retencion: retencion * 100,
    unidad: "USD/tn",
  }
}

async function fetchRavaGranos(
  config: RetencionesConfig,
): Promise<AgroLocalData | null> {
  const { retenciones, gastosPortuarios } = config
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
      soja: grainData(prices.soja, retenciones.soja, gastosPortuarios),
      maiz: grainData(prices.maiz, retenciones.maiz, gastosPortuarios),
      trigo: grainData(prices.trigo, retenciones.trigo, gastosPortuarios),
      girasol: grainData(null, retenciones.girasol, gastosPortuarios),
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

  const config = loadRetenciones()
  const { retenciones, gastosPortuarios } = config

  const data = await fetchRavaGranos(config)
  if (data) {
    _cache = { data, expiry: Date.now() + 900_000 }
    return NextResponse.json(data)
  }

  const empty: AgroLocalData = {
    soja: grainData(null, retenciones.soja, gastosPortuarios),
    maiz: grainData(null, retenciones.maiz, gastosPortuarios),
    trigo: grainData(null, retenciones.trigo, gastosPortuarios),
    girasol: grainData(null, retenciones.girasol, gastosPortuarios),
    updated_at: new Date().toISOString(),
    source: "fuente no disponible",
  }
  return NextResponse.json(empty, { status: 206 })
}
