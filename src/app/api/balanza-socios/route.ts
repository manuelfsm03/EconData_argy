/**
 * /api/balanza-socios — Ranking de socios comerciales de Argentina
 *
 * Fuente EXPORTACIONES: datos.gob.ar, dataset 357 "Exportaciones por
 * provincia y por país de destino" (Subsecretaría de Programación
 * Macroeconómica / INDEC). Series anuales reales por país, última
 * actualización disponible: 2024.
 *
 * IMPORTACIONES POR PAÍS DE ORIGEN: no hay fuente pública gratuita
 * equivalente. UN Comtrade v2 (data real por país) requiere subscription
 * key paga — sin key devuelve 404. El endpoint "preview" gratuito de
 * Comtrade sólo entrega el total mundial (partnerCode=0), no desglose por
 * país. World Bank WITS bloquea con 403 (Cloudflare) sin navegador real.
 * Por eso `impo` va explícitamente en null por país — antes este endpoint
 * mostraba un fallback hardcodeado con el sello "INDEC · Comtrade 2023"
 * como si fuera dato real (y con China por delante de Brasil, que es
 * incorrecto). Preferible mostrar "no conectado" que un dato falso.
 */

import { NextResponse } from "next/server"

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// Países con serie propia en el dataset 357 (id de la serie → metadata del país)
const PAISES_357: Record<string, { nombre: string; iso2: string }> = {
  "357.1_EXPORTACIOSIL__28": { nombre: "Brasil",         iso2: "BR" },
  "357.1_EXPORTACIOINA__27": { nombre: "China",           iso2: "CN" },
  "357.1_EXPORTACIODOS__36": { nombre: "Estados Unidos",  iso2: "US" },
  "357.1_EXPORTACIOILE__27": { nombre: "Chile",            iso2: "CL" },
  "357.1_EXPORTACIODIA__27": { nombre: "India",            iso2: "IN" },
  "357.1_EXPORTACIONIA__30": { nombre: "Alemania",         iso2: "DE" },
  "357.1_EXPORTACIOJOS__34": { nombre: "Países Bajos",     iso2: "NL" },
  "357.1_EXPORTACIOUAY__29": { nombre: "Uruguay",           iso2: "UY" },
  "357.1_EXPORTACIONIA__29": { nombre: "España",            iso2: "ES" },
  "357.1_EXPORTACIOLIA__28": { nombre: "Italia",             iso2: "IT" },
}

// Fallback de último recurso si datos.gob.ar no responde — mismos valores
// reales que devuelve la fuente en vivo (última lectura manual), NO estimados
// inventados. Se usa solo si el fetch en vivo falla por completo.
const EXPO_FALLBACK: Record<string, number> = {
  Brasil: 13608.46, China: 5961.35, "Estados Unidos": 6394.71, Chile: 6321.82,
  India: 3933.32, Alemania: 809.99, "Países Bajos": 1691.43, Uruguay: 1642.99,
  España: 1445.90, Italia: 1082.99,
}
const EXPO_FALLBACK_YEAR = 2024

interface SocioRow {
  iso2: string
  nombre: string
  expo: number | null
  impo: null
  total: number | null
}

async function fetchExportSeries(seriesId: string): Promise<{ value: number; year: string } | null> {
  try {
    const res = await fetch(
      `https://apis.datos.gob.ar/series/api/series/?ids=${seriesId}&sort=desc&limit=1`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return null
    const json = await res.json()
    const row = json?.data?.[0]
    if (!row) return null
    return { value: Number(row[1]), year: String(row[0]).slice(0, 4) }
  } catch {
    return null
  }
}

export async function GET() {
  const cacheKey = "balanza_socios_v2"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  const entries = Object.entries(PAISES_357)
  const results = await Promise.all(
    entries.map(async ([seriesId, meta]) => {
      const serie = await fetchExportSeries(seriesId)
      return { ...meta, serie }
    }),
  )

  const liveCount = results.filter((r) => r.serie != null).length
  const isLive = liveCount === entries.length
  const anyLive = liveCount > 0
  const refYear = results.find((r) => r.serie)?.serie?.year ?? String(EXPO_FALLBACK_YEAR)

  const socios: SocioRow[] = results.map((r) => {
    const expo = r.serie?.value ?? (anyLive ? null : EXPO_FALLBACK[r.nombre] ?? null)
    return {
      iso2: r.iso2,
      nombre: r.nombre,
      expo,
      impo: null,
      total: expo,
    }
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1))

  const result = {
    data: {
      socios,
      top_exportacion: socios.filter((s) => s.expo != null),
      top_importacion: [] as SocioRow[],
      is_live: isLive || anyLive,
      is_live_exportaciones: isLive || anyLive,
      is_live_importaciones: false,
      anio_referencia: refYear,
    },
    updated_at: new Date().toISOString(),
    source: anyLive
      ? `datos.gob.ar — dataset 357 (exportaciones por país, ${refYear})`
      : `Última lectura manual guardada (exportaciones ${EXPO_FALLBACK_YEAR}) — datos.gob.ar no respondió`,
    nota: "Importaciones por país de origen: no hay fuente pública gratuita disponible (Comtrade requiere key paga, WITS bloquea el acceso automatizado). Ranking basado solo en exportaciones.",
  }

  setCache(cacheKey, result, 21600) // 6h — dataset es anual, no hace falta refrescar seguido
  return NextResponse.json(result)
}
