import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/economia — Tipos de cambio y BCRA
 *
 * Fuentes de datos:
 *   - DolarAPI: https://dolarapi.com/v1/dolares (sin auth)
 *   - datos.gob.ar series API: https://apis.datos.gob.ar/series/api/series/ (sin auth)
 *   - estadisticasbcra.com (opcional, requiere BCRA_TOKEN env var)
 *
 * Portado desde EconData_argy/api/services/dolar.py + routers/economia.py
 */

import { NextRequest, NextResponse } from "next/server"

const DOLAR_API = "https://dolarapi.com/v1"
const DATOS_API = "https://apis.datos.gob.ar/series/api/series/"

// Series verificadas en datos.gob.ar (sin token)
const BCRA_SERIES: Record<string, string> = {
  reservas: "92.2_RESERVAS_IRES_0_0_32_40", // USD millones
  badlar: "89.2_TS_INTELAR_0_D_20", // % anual
}

// Cache simple en memoria
const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const entry = _cache[key]
  if (entry && entry.expiry > Date.now()) return entry.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSeconds: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSeconds * 1000 }
}

async function getDolar() {
  const cached = getCache<unknown[]>("dolar_all")
  if (cached) return cached
  const res = await fetchRegistered(`${DOLAR_API}/dolares`, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`DolarAPI ${res.status}`)
  const data = await res.json()
  setCache("dolar_all", data, 300)
  return data
}

async function getBcraIndicadores() {
  const cached = getCache<Record<string, unknown>>("bcra_indicadores")
  if (cached) return cached

  const result: Record<string, unknown[]> = {
    reservas: [],
    riesgo_pais: [],
    badlar: [],
  }

  // 1. Reservas y BADLAR desde datos.gob.ar (sin token)
  try {
    const ids = Object.values(BCRA_SERIES).join(",")
    const url = `${DATOS_API}?ids=${encodeURIComponent(ids)}&limit=90&sort=desc`
    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      next: { revalidate: 900 },
    })
    if (res.ok) {
      const raw = await res.json()
      const rows: unknown[][] = raw.data || []
      result.reservas = rows
        .filter((r) => r.length > 1 && r[1] != null)
        .map((r) => [r[0], r[1]])
      result.badlar = rows
        .filter((r) => r.length > 2 && r[2] != null)
        .map((r) => [r[0], r[2]])
    }
  } catch {
    // datos.gob.ar unavailable — return empty arrays
  }

  // 2. Riesgo país via estadisticasbcra.com (requiere BCRA_TOKEN)
  const token = process.env.BCRA_TOKEN
  if (token) {
    try {
      const res = await fetchRegistered("https://api.estadisticasbcra.com/rp", {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "PanelDeControl/2.0",
        },
        next: { revalidate: 900 },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          result.riesgo_pais = data.slice(-365)
        }
      }
    } catch {
      // Optional — fail silently
    }
  }

  setCache("bcra_indicadores", result, 900)
  return result
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") ?? "dolar"

  try {
    if (endpoint === "dolar") {
      const data = await getDolar()
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "dolarapi.com",
      })
    }

    if (endpoint === "bcra") {
      const data = await getBcraIndicadores()
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "datos.gob.ar + estadisticasbcra.com (opcional)",
      })
    }

    return NextResponse.json({ error: "endpoint no válido. Usar ?endpoint=dolar|bcra" }, { status: 400 })
  } catch (error) {
    console.error("[/api/economia]", error)
    return NextResponse.json(
      { error: "Error al obtener datos", detail: String(error) },
      { status: 500 },
    )
  }
}
