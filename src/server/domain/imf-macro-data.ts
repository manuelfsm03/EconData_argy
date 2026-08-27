import { fetchRegistered } from "@/server/http/fetch-source"
import { MemoryDomainCache, type DomainCache } from "./central-bank-rates"

export type Region = "g7" | "brics" | "latam" | "g20"

export interface DatoPais {
  code: string
  nombre: string
  region: Region
  pib_crecimiento: number | null
  pib_anio: number | null
  inflacion: number | null
  inflacion_anio: number | null
  esForecast: boolean
}

export interface ImfLoadResult {
  data: DatoPais[]
  cached?: true
  stale: boolean
  staleSince?: string
  allFailed: boolean
}

export interface ImfLoadOptions {
  fetcher?: typeof fetchRegistered
  now?: () => Date
  cache?: DomainCache
}

const CACHE_KEY = "imf-macro:v1"
const TTL_SECONDS = 24 * 3600

const PAISES: Array<{ code: string; nombre: string; region: Region }> = [
  ["USA", "Estados Unidos", "g7"], ["DEU", "Alemania", "g7"], ["JPN", "Japón", "g7"], ["GBR", "Reino Unido", "g7"], ["FRA", "Francia", "g7"], ["ITA", "Italia", "g7"], ["CAN", "Canadá", "g7"],
  ["CHN", "China", "brics"], ["IND", "India", "brics"], ["BRA", "Brasil", "brics"], ["ZAF", "Sudáfrica", "brics"],
  ["ARG", "Argentina", "latam"], ["MEX", "México", "latam"], ["CHL", "Chile", "latam"], ["COL", "Colombia", "latam"], ["PER", "Perú", "latam"], ["URY", "Uruguay", "latam"], ["BOL", "Bolivia", "latam"],
  ["AUS", "Australia", "g20"], ["KOR", "Corea del Sur", "g20"], ["TUR", "Turquía", "g20"], ["SAU", "Arabia Saudita", "g20"], ["IDN", "Indonesia", "g20"], ["ESP", "España", "g20"], ["NLD", "Países Bajos", "g20"],
].map(([code, nombre, region]) => ({ code, nombre, region: region as Region }))

type ImfBody = { values?: Record<string, Record<string, Record<string, number>>> }

async function indicator(
  fetcher: typeof fetchRegistered,
  name: string,
): Promise<Record<string, Record<string, number>> | null> {
  try {
    const response = await fetcher(`https://www.imf.org/external/datamapper/api/v1/${name}`, { headers: { Accept: "application/json" } })
    if (!response.ok) return null
    return ((await response.json()) as ImfBody).values?.[name] ?? null
  } catch { return null }
}

function latest(values: Record<string, number> | undefined, year: number): { value: number | null; year: number | null; forecast: boolean } {
  const years = Object.keys(values ?? {}).map(Number).filter(Number.isFinite).sort((a, b) => b - a)
  const selected = years.find((candidate) => candidate <= year + 2)
  if (selected == null) return { value: null, year: null, forecast: false }
  return { value: Number(values?.[String(selected)]?.toFixed(2)), year: selected, forecast: selected > year }
}

const DEFAULT_CACHE = new MemoryDomainCache()

export async function loadImfMacro(options: ImfLoadOptions = {}): Promise<ImfLoadResult> {
  const fetcher = options.fetcher ?? fetchRegistered
  const now = options.now ?? (() => new Date())
  const cache = options.cache ?? DEFAULT_CACHE
  const nowMs = now().getTime()
  const fresh = cache.fresh<DatoPais[]>(CACHE_KEY, nowMs)
  if (fresh) return { data: fresh, cached: true, stale: false, allFailed: false }

  const [gdp, inflation] = await Promise.all([indicator(fetcher, "NGDP_RPCH"), indicator(fetcher, "PCPIPCH")])
  const year = now().getFullYear()
  const data = PAISES.map((country) => {
    const growth = latest(gdp?.[country.code], year)
    const prices = latest(inflation?.[country.code], year)
    return { code: country.code, nombre: country.nombre, region: country.region, pib_crecimiento: growth.value, pib_anio: growth.year, inflacion: prices.value, inflacion_anio: prices.year, esForecast: growth.forecast || prices.forecast }
  })

  const validRows = data.filter((item) => item.pib_crecimiento !== null || item.inflacion !== null).length
  if (validRows >= 5) {
    cache.put(CACHE_KEY, data, TTL_SECONDS, nowMs)
    return { data, stale: false, allFailed: false }
  }

  if (validRows === 0) {
    const stale = cache.lastGood<DatoPais[]>(CACHE_KEY)
    if (stale) return { data: stale.data, stale: true, staleSince: stale.staleSince, allFailed: true }
    return { data, stale: false, allFailed: true }
  }

  return { data, stale: false, allFailed: false }
}
