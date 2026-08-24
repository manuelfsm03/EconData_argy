import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

/**
 * /api/imf-macro — PIB e inflación global desde el IMF DataMapper.
 *
 * Fuente: IMF DataMapper API (sin key, sin registro).
 * URL: https://www.imf.org/external/datamapper/api/v1/{INDICATOR}
 *
 * Indicadores:
 *   NGDP_RPCH — Crecimiento PIB real (%)
 *   PCPIPCH   — Inflación IPC (%)
 *
 * Ventaja vs /api/world-macro (World Bank): incluye estimados WEO hasta ~2031.
 * Cobertura: 25 países (G7, BRICS, LatAm, G20 selecto).
 * TTL cache: 24h.
 *
 * Query param: ?region=g7|brics|latam|g20|todos
 */

export const runtime = "nodejs"

const CACHE_KEY = "imf-macro:v1"
const TTL_SEG  = 24 * 3600

const IMF_BASE = "https://www.imf.org/external/datamapper/api/v1"

type Region = "g7" | "brics" | "latam" | "g20"

interface Pais { code: string; nombre: string; region: Region }

const PAISES: Pais[] = [
  // ── G7 ──────────────────────────────────────────────────────────────────
  { code: "USA", nombre: "Estados Unidos", region: "g7"   },
  { code: "DEU", nombre: "Alemania",       region: "g7"   },
  { code: "JPN", nombre: "Japón",          region: "g7"   },
  { code: "GBR", nombre: "Reino Unido",    region: "g7"   },
  { code: "FRA", nombre: "Francia",        region: "g7"   },
  { code: "ITA", nombre: "Italia",         region: "g7"   },
  { code: "CAN", nombre: "Canadá",         region: "g7"   },
  // ── BRICS ────────────────────────────────────────────────────────────────
  { code: "CHN", nombre: "China",          region: "brics" },
  { code: "IND", nombre: "India",          region: "brics" },
  { code: "BRA", nombre: "Brasil",         region: "brics" },
  { code: "ZAF", nombre: "Sudáfrica",      region: "brics" },
  // ── LatAm ────────────────────────────────────────────────────────────────
  { code: "ARG", nombre: "Argentina",      region: "latam" },
  { code: "MEX", nombre: "México",         region: "latam" },
  { code: "CHL", nombre: "Chile",          region: "latam" },
  { code: "COL", nombre: "Colombia",       region: "latam" },
  { code: "PER", nombre: "Perú",           region: "latam" },
  { code: "URY", nombre: "Uruguay",        region: "latam" },
  { code: "BOL", nombre: "Bolivia",        region: "latam" },
  // ── G20 resto ────────────────────────────────────────────────────────────
  { code: "AUS", nombre: "Australia",      region: "g20"   },
  { code: "KOR", nombre: "Corea del Sur",  region: "g20"   },
  { code: "TUR", nombre: "Turquía",        region: "g20"   },
  { code: "SAU", nombre: "Arabia Saudita", region: "g20"   },
  { code: "IDN", nombre: "Indonesia",      region: "g20"   },
  { code: "ESP", nombre: "España",         region: "g20"   },
  { code: "NLD", nombre: "Países Bajos",   region: "g20"   },
]

interface DatoPais {
  code: string
  nombre: string
  region: Region
  pib_crecimiento:  number | null
  pib_anio:         number | null
  inflacion:        number | null
  inflacion_anio:   number | null
  esForecast: boolean
}

// IMF DataMapper response shape:
//   { values: { [indicator]: { [countryCode]: { [year]: value } } } }
type ImfBody = { values?: Record<string, Record<string, Record<string, number>>> }

async function fetchImfIndicator(indicator: string): Promise<Record<string, Record<string, number>> | null> {
  try {
    const res = await fetch(`${IMF_BASE}/${indicator}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as ImfBody
    return json.values?.[indicator] ?? null
  } catch {
    return null
  }
}

function getLatestValue(
  countryData: Record<string, number> | undefined,
  currentYear: number,
): { value: number | null; anio: number | null; esForecast: boolean } {
  if (!countryData) return { value: null, anio: null, esForecast: false }

  const years = Object.keys(countryData)
    .map(Number)
    .filter((y) => !isNaN(y))
    .sort((a, b) => b - a)

  if (years.length === 0) return { value: null, anio: null, esForecast: false }

  // Usar año actual o el estimado WEO del siguiente año (más reciente disponible).
  // Rechazar estimados muy lejanos (>2 años adelante) para no mostrar proyecciones como hechos.
  const cutoff = currentYear + 2
  const preferred = years.find((y) => y <= cutoff) ?? years[years.length - 1]
  const raw = countryData[String(preferred)]

  return {
    value:      typeof raw === "number" ? parseFloat(raw.toFixed(2)) : null,
    anio:       preferred,
    esForecast: preferred > currentYear,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const regionParam = searchParams.get("region") ?? "todos"

  const cached = leerFresco<DatoPais[]>(CACHE_KEY)
  if (cached) {
    const filtrado = regionParam === "todos" ? cached : cached.filter((d) => d.region === regionParam)
    return NextResponse.json({ data: filtrado, cached: true, updated_at: new Date().toISOString() })
  }

  const currentYear = new Date().getFullYear()

  const [gdpData, inflData] = await Promise.all([
    fetchImfIndicator("NGDP_RPCH"),
    fetchImfIndicator("PCPIPCH"),
  ])

  const data: DatoPais[] = PAISES.map((p) => {
    const gdp  = getLatestValue(gdpData?.[p.code],  currentYear)
    const infl = getLatestValue(inflData?.[p.code], currentYear)
    return {
      code:             p.code,
      nombre:           p.nombre,
      region:           p.region,
      pib_crecimiento:  gdp.value,
      pib_anio:         gdp.anio,
      inflacion:        infl.value,
      inflacion_anio:   infl.anio,
      esForecast:       gdp.esForecast || infl.esForecast,
    }
  })

  const vivosOk = data.filter((d) => d.pib_crecimiento !== null || d.inflacion !== null).length
  if (vivosOk >= 5) guardarExito(CACHE_KEY, data, TTL_SEG)

  // Todo falló → stale cache
  if (vivosOk === 0) {
    const stale = leerUltimoBueno<DatoPais[]>(CACHE_KEY)
    if (stale) {
      const fs = regionParam === "todos" ? stale.data : stale.data.filter((d) => d.region === regionParam)
      return NextResponse.json({
        data: fs, stale: true, stale_since: stale.staleSince,
        updated_at: new Date().toISOString(),
      })
    }
    return NextResponse.json({ error: "IMF DataMapper no disponible" }, { status: 503 })
  }

  const filtrado = regionParam === "todos" ? data : data.filter((d) => d.region === regionParam)
  return NextResponse.json({
    data: filtrado,
    cached: false,
    updated_at: new Date().toISOString(),
    fuente: "IMF DataMapper API — NGDP_RPCH + PCPIPCH (sin key; incluye estimados WEO)",
  })
}
