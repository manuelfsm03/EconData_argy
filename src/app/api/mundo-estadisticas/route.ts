/**
 * /api/mundo-estadisticas — Datos macro globales de organismos internacionales.
 *
 * Fuentes en vivo (sin API key):
 *   - IMF WEO API : crecimiento PIB real por país (www.imf.org/external/datamapper)
 *   - World Bank  : PIB real growth, ya registrado como "world_bank" en SOURCE_REGISTRY
 *   - Eurostat    : inflación HICP Eurozona (ec.europa.eu) — best-effort, falla silencio
 *
 * Datos que cambian lento (anuales) → TTL 24h (86400 seg).
 * Si una fuente falla → fallback hardcodeado con estimaciones publicadas + esVivo:false.
 *
 * Nota: IMF y Eurostat no están en el SOURCE_REGISTRY. Se usa fetch nativo (mismo
 * patrón que /api/internacional con Frankfurter). World Bank sí está registrado
 * y se consulta con fetchRegistered.
 */

import { NextResponse } from "next/server"
import { fetchRegistered } from "@/server/http/fetch-source"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

export const runtime = "nodejs"

const CACHE_KEY = "mundo-estadisticas:macro"
const TTL_SEG = 86400 // 24 horas

// Países que seguimos para PIB.
const PAISES_PIB = ["ARG", "BRA", "USA", "CHN"] as const
type PaisPIB = (typeof PAISES_PIB)[number]

interface DatoPIB {
  valor: number | null
  anio: number | null
  fuente: string
  esVivo: boolean
}

interface DatoInflacion {
  valor: number | null
  anio: number | null
  fuente: string
  nota?: string
}

interface DatosMundoEstadisticas {
  pib_crecimiento: Record<PaisPIB, DatoPIB>
  inflacion_global: {
    ARG: DatoInflacion
    USA: DatoInflacion
    EZ: DatoInflacion
  }
}

// Fallbacks hardcodeados con proyecciones WEO / estimaciones publicadas.
const FALLBACK_PIB: Record<PaisPIB, DatoPIB> = {
  ARG: { valor: -1.6, anio: 2024, fuente: "estimación WEO", esVivo: false },
  BRA: { valor: 2.9,  anio: 2024, fuente: "estimación WEO", esVivo: false },
  USA: { valor: 2.8,  anio: 2024, fuente: "estimación WEO", esVivo: false },
  CHN: { valor: 4.9,  anio: 2024, fuente: "estimación WEO", esVivo: false },
}

const FALLBACK_INFLACION = {
  ARG: { valor: null, anio: null, fuente: "ver /api/inflation", nota: "ver /api/inflation para dato en tiempo real" },
  USA: { valor: 3.0,  anio: 2024, fuente: "estimación" },
  EZ:  { valor: 2.6,  anio: 2024, fuente: "Eurostat/estimación" },
}

// ── IMF WEO API: crecimiento PIB real (NGDP_RPCH) ─────────────────────────
// Endpoint público sin key. Devuelve:
//   { values: { NGDP_RPCH: { ARG: { "2023": 1.2, "2024": -1.6, ... }, ... } } }
async function getPIBdesdeIMF(): Promise<Record<PaisPIB, DatoPIB> | null> {
  try {
    const paises = PAISES_PIB.join("/")
    const url = `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/${paises}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const seriesPorPais = json?.values?.NGDP_RPCH
    if (!seriesPorPais || typeof seriesPorPais !== "object") return null

    const resultado = {} as Record<PaisPIB, DatoPIB>
    for (const pais of PAISES_PIB) {
      const serie = seriesPorPais[pais]
      if (!serie || typeof serie !== "object") {
        resultado[pais] = { ...FALLBACK_PIB[pais] }
        continue
      }
      // Buscar el año más reciente con valor disponible (bajar desde 2025).
      let valor: number | null = null
      let anio: number | null = null
      for (let yr = 2025; yr >= 2020; yr--) {
        const v = serie[String(yr)]
        if (typeof v === "number" && Number.isFinite(v)) {
          valor = parseFloat(v.toFixed(2))
          anio = yr
          break
        }
      }
      resultado[pais] = {
        valor,
        anio,
        fuente: "IMF WEO API",
        esVivo: valor !== null,
      }
    }
    return resultado
  } catch {
    return null
  }
}

// ── World Bank API: PIB real growth (NY.GDP.MKTP.KD.ZG) ───────────────────
// Host ya registrado en SOURCE_REGISTRY como "world_bank" → usar fetchRegistered.
// Devuelve array de dos elementos: [metadatos, [array de observaciones]].
async function getPIBdesdeWorldBank(): Promise<Partial<Record<PaisPIB, DatoPIB>>> {
  try {
    const paises = "AR;BR;US;CN"
    const url = `https://api.worldbank.org/v2/country/${paises}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=1`
    const res = await fetchRegistered(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return {}

    const json = await res.json()
    // El Banco Mundial devuelve [paginacion, [datos]]; datos puede ser null en error.
    const observaciones: Array<{ countryiso3code?: string; value?: number | null; date?: string }> = json?.[1] ?? []
    if (!Array.isArray(observaciones)) return {}

    // Mapeo de códigos ISO2 (que usa WB) a ISO3 (nuestro estándar).
    const iso2aIso3: Record<string, PaisPIB> = { AR: "ARG", BR: "BRA", US: "USA", CN: "CHN" }
    const resultado: Partial<Record<PaisPIB, DatoPIB>> = {}

    for (const obs of observaciones) {
      // El campo que viene puede ser iso3 directamente.
      const clave3 = obs.countryiso3code as PaisPIB | undefined
      const paisClave = clave3 && PAISES_PIB.includes(clave3) ? clave3 : undefined
      if (!paisClave) continue
      if (typeof obs.value !== "number" || !Number.isFinite(obs.value)) continue

      resultado[paisClave] = {
        valor: parseFloat(obs.value.toFixed(2)),
        anio: obs.date ? parseInt(obs.date, 10) : null,
        fuente: "World Bank API",
        esVivo: true,
      }
    }
    return resultado
  } catch {
    return {}
  }
}

// ── Eurostat: inflación HICP Eurozona ─────────────────────────────────────
// SDMX 2.1 JSON. Best-effort: si falla, se usa el fallback sin ruido.
async function getInflacionEurostat(): Promise<DatoInflacion | null> {
  try {
    const url =
      "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/PRC_HICP_MIDX/M.I05.CP00.EA20?format=JSON&lastTimePeriod=1"
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null

    const json = await res.json()
    // El SDMX-JSON tiene la estructura: { dataSets: [{ observations: { "0:0:0:0": [valor,...] } }] }
    const observations = json?.dataSets?.[0]?.observations
    if (!observations || typeof observations !== "object") return null

    // Tomar el primer (y único, por lastTimePeriod=1) valor.
    const vals = Object.values(observations) as Array<Array<number | null>>
    const primerValor = vals[0]?.[0]
    if (typeof primerValor !== "number" || !Number.isFinite(primerValor)) return null

    // El índice HICP base 2015=100 no es la tasa YoY directamente.
    // Devolvemos el índice con nota aclaratoria para no confundir con %.
    return {
      valor: parseFloat(primerValor.toFixed(1)),
      anio: new Date().getFullYear(),
      fuente: "Eurostat HICP",
      nota: "índice HICP (2015=100), no variación %",
    }
  } catch {
    return null
  }
}

export async function GET() {
  // 1) Cache fresco vigente → servir sin llamadas externas.
  const cached = leerFresco<DatosMundoEstadisticas>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({
      data: cached,
      cached: true,
      stale: false,
      updated_at: new Date().toISOString(),
      fuentes: ["IMF WEO API", "World Bank API", "Eurostat"],
      nota: "Datos anuales de organismos internacionales. Actualizados semestral/anualmente.",
    })
  }

  // 2) Consultar todas las fuentes en paralelo.
  const [imfData, wbData, eurostatInflacion] = await Promise.all([
    getPIBdesdeIMF(),
    getPIBdesdeWorldBank(),
    getInflacionEurostat(),
  ])

  // 3) Combinar PIB: IMF tiene prioridad, World Bank rellena lo que falta.
  const pib_crecimiento = {} as Record<PaisPIB, DatoPIB>
  for (const pais of PAISES_PIB) {
    if (imfData?.[pais]?.esVivo) {
      pib_crecimiento[pais] = imfData[pais]
    } else if (wbData[pais]?.esVivo) {
      pib_crecimiento[pais] = wbData[pais]!
    } else {
      pib_crecimiento[pais] = { ...FALLBACK_PIB[pais] }
    }
  }

  // 4) Inflación global.
  const inflacion_global = {
    ARG: { ...FALLBACK_INFLACION.ARG },
    USA: { ...FALLBACK_INFLACION.USA },
    EZ: eurostatInflacion ?? { ...FALLBACK_INFLACION.EZ },
  }

  const data: DatosMundoEstadisticas = { pib_crecimiento, inflacion_global }

  // 5) Si conseguimos al menos un dato en vivo → guardar en cache.
  const vivosOk = Object.values(pib_crecimiento).filter((d) => d.esVivo).length
  if (vivosOk >= 1) {
    guardarExito(CACHE_KEY, data, TTL_SEG)
    return NextResponse.json({
      data,
      stale: false,
      updated_at: new Date().toISOString(),
      fuentes: ["IMF WEO API", "World Bank API", "Eurostat"],
      nota: "Datos anuales de organismos internacionales. Actualizados semestral/anualmente.",
    })
  }

  // 6) Todo falló en vivo → stale-cache.
  const stale = leerUltimoBueno<DatosMundoEstadisticas>(CACHE_KEY)
  if (stale) {
    return NextResponse.json({
      data: stale.data,
      stale: true,
      stale_since: stale.staleSince,
      updated_at: new Date().toISOString(),
      fuentes: ["IMF WEO API", "World Bank API", "Eurostat"],
      nota: "Datos anuales de organismos internacionales. Actualizados semestral/anualmente.",
    })
  }

  // 7) Primera vez y todo falla → devolver hardcoded sin romper el contrato.
  return NextResponse.json({
    data,
    stale: false,
    updated_at: new Date().toISOString(),
    source: "hardcoded-fallback",
    fuentes: ["IMF WEO API", "World Bank API", "Eurostat"],
    nota: "Datos anuales de organismos internacionales. Actualizados semestral/anualmente.",
  })
}
