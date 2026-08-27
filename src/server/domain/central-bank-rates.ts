import { fetchRegistered } from "@/server/http/fetch-source"

export interface DatosBanco {
  pais: string
  moneda: string
  tasa: number | null
  esVivo: boolean
  fuente?: string
  sourceId?: string
  updated_at?: string
  nota?: string
}

export interface DatosBancosCentrales {
  fed: DatosBanco
  bce: DatosBanco
  bcb: DatosBanco
  boe: DatosBanco
  boc: DatosBanco
  banxico: DatosBanco
  bcentral_chile: DatosBanco
  boj: DatosBanco
  rba: DatosBanco
  bcra: DatosBanco
}

export interface DomainCache {
  fresh<T>(key: string, nowMs: number): T | null
  put<T>(key: string, data: T, ttlSeconds: number, nowMs: number): void
  lastGood<T>(key: string): { data: T; staleSince: string } | null
}

type CacheEntry = { data: unknown; expiry: number; savedAt: number }

export class MemoryDomainCache implements DomainCache {
  private readonly entries = new Map<string, CacheEntry>()

  fresh<T>(key: string, nowMs: number): T | null {
    const entry = this.entries.get(key)
    return entry && entry.expiry > nowMs ? entry.data as T : null
  }

  put<T>(key: string, data: T, ttlSeconds: number, nowMs: number): void {
    this.entries.set(key, { data, expiry: nowMs + ttlSeconds * 1000, savedAt: nowMs })
  }

  lastGood<T>(key: string): { data: T; staleSince: string } | null {
    const entry = this.entries.get(key)
    return entry ? { data: entry.data as T, staleSince: new Date(entry.savedAt).toISOString() } : null
  }
}

export interface CentralBankLoadResult {
  data: DatosBancosCentrales
  cached?: true
  stale: boolean
  staleSince?: string
  allFailed: boolean
}

export interface CentralBankLoadOptions {
  fetcher?: typeof fetchRegistered
  now?: () => Date
  cache?: DomainCache
}

const CACHE_KEY = "bancos-centrales:tasas"
const TTL_SECONDS = 3600
const NOTE = "Tasas de política monetaria de referencia. Fuentes en vivo donde hay API gratuita."
const EMPTY = (pais: string, moneda: string): DatosBanco => ({ pais, moneda, tasa: null, esVivo: false, fuente: "sin dato" })
const FALLBACK: DatosBancosCentrales = {
  fed: EMPTY("USA", "USD"),
  bce: EMPTY("Eurozona", "EUR"),
  bcb: EMPTY("Brasil", "BRL"),
  boe: EMPTY("Reino Unido", "GBP"),
  boc: EMPTY("Canadá", "CAD"),
  banxico: EMPTY("México", "MXN"),
  bcentral_chile: EMPTY("Chile", "CLP"),
  boj: EMPTY("Japón", "JPY"),
  rba: EMPTY("Australia", "AUD"),
  bcra: { ...EMPTY("Argentina", "ARS"), fuente: "/api/bcra", nota: "ver /api/bcra para datos en tiempo real" },
}
const DEFAULT_CACHE = new MemoryDomainCache()

async function getJson(fetcher: typeof fetchRegistered, url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const response = await fetcher(url, init)
    return response.ok ? await response.json() : null
  } catch { return null }
}

async function getCsv(fetcher: typeof fetchRegistered, url: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetcher(url, init)
    return response.ok ? await response.text() : null
  } catch { return null }
}

async function getTasaFed(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const raw = await getJson(fetcher, "https://markets.newyorkfed.org/api/rates/effr/last/1.json", { headers: { Accept: "application/json" } }) as { refRates?: Array<{ effectiveDate: string; percentRate: string; targetRateHigh?: number }> } | null
  const rate = raw?.refRates?.[0]
  const value = rate?.targetRateHigh ?? Number(rate?.percentRate)
  if (rate && Number.isFinite(value)) return { pais: "USA", moneda: "USD", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "NY Fed EFFR", sourceId: "ny_fed_rates", updated_at: rate.effectiveDate }

  const key = process.env.FRED_API_KEY
  if (key) {
    const fred = await getJson(fetcher, `https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU&api_key=${key}&sort_order=desc&limit=1&file_type=json`, { headers: { Accept: "application/json" } }) as { observations?: Array<{ date: string; value: string }> } | null
    const observation = fred?.observations?.[0]
    const value = Number(observation?.value)
    if (observation && Number.isFinite(value)) return { pais: "USA", moneda: "USD", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "FRED — St. Louis Fed (DFEDTARU)", sourceId: "fred", updated_at: observation.date }
  }
  return FALLBACK.fed
}

async function getOecdRate(fetcher: typeof fetchRegistered, countryCode: string): Promise<{ tasa: number; fecha: string; sourceId: "oecd_sdmx" } | null> {
  try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,1.0/M.${countryCode}.IR3TIB01.ST.A?format=jsondata&lastNObservations=1`
    const response = await fetcher(url, { headers: { Accept: "application/json" } })
    if (!response.ok) return null
    const json = await response.json() as {
      dataSets?: Array<{ observations?: Record<string, [number]> }>
      structure?: { dimensions?: { observation?: Array<{ values?: Array<{ id: string }> }> } }
    }
    const observations = json.dataSets?.[0]?.observations
    const keys = observations ? Object.keys(observations) : []
    if (!keys.length) return null
    const key = keys[keys.length - 1]
    const value = observations?.[key]?.[0]
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    const index = Number.parseInt(key.split(":").pop() ?? "0", 10)
    const date = json.structure?.dimensions?.observation?.[0]?.values?.[index]?.id
    if (!date) return null
    return { tasa: Number(value.toFixed(2)), fecha: date, sourceId: "oecd_sdmx" }
  } catch { return null }
}

async function getTasaBanxico(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const oecd = await getOecdRate(fetcher, "MEX")
  if (oecd) return { pais: "México", moneda: "MXN", tasa: oecd.tasa, esVivo: true, fuente: "OECD MEI Financial (IR3TIB01 MX)", sourceId: oecd.sourceId, updated_at: oecd.fecha, nota: "tasa interbancaria 3m — proxy de la tasa objetivo de Banxico" }

  const token = process.env.BMX_TOKEN
  if (token) {
    const raw = await getJson(fetcher, "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SR16850/datos/oportuno", { headers: { "Bmx-Token": token, Accept: "application/json" } }) as { bmx?: { series?: Array<{ datos?: Array<{ fecha: string; dato: string }> }> } } | null
    const dato = raw?.bmx?.series?.[0]?.datos?.[0]
    const value = Number(dato?.dato)
    if (dato && Number.isFinite(value)) return { pais: "México", moneda: "MXN", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "Banxico SIE (SR16850)", sourceId: "banxico_sie", updated_at: dato.fecha }
  }
  return FALLBACK.banxico
}

async function getTasaBCCh(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const oecd = await getOecdRate(fetcher, "CHL")
  return oecd
    ? { pais: "Chile", moneda: "CLP", tasa: oecd.tasa, esVivo: true, fuente: "OECD MEI Financial (IR3TIB01 CL)", sourceId: oecd.sourceId, updated_at: oecd.fecha, nota: "tasa interbancaria 3m — proxy del TPM del BCCh" }
    : FALLBACK.bcentral_chile
}

async function getTasaBCE(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const text = await getCsv(fetcher, "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_RT.LEV?format=csvdata&lastNObservations=1", { headers: { Accept: "application/csv, text/csv, */*" } })
  const lines = text?.trim().split("\n").filter((line) => line.trim() !== "") ?? []
  if (lines.length < 2) return FALLBACK.bce
  const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, ""))
  const valueIndex = headers.indexOf("OBS_VALUE")
  const dateIndex = headers.indexOf("TIME_PERIOD")
  if (valueIndex < 0) return FALLBACK.bce
  const last = lines[lines.length - 1].split(",").map((value) => value.trim().replace(/^"|"$/g, ""))
  const value = Number(last[valueIndex])
  if (!Number.isFinite(value)) return FALLBACK.bce
  return { pais: "Eurozona", moneda: "EUR", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "ECB SDW", sourceId: "ecb_sdw", updated_at: dateIndex >= 0 ? last[dateIndex] : new Date().toISOString() }
}

async function getTasaBCB(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const raw = await getJson(fetcher, "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json", { headers: { Accept: "application/json" } }) as Array<{ data?: string; valor?: string }> | null
  const item = Array.isArray(raw) ? raw[0] : undefined
  const value = Number(item?.valor)
  return item && Number.isFinite(value) ? { pais: "Brasil", moneda: "BRL", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "BCB SGS 432", sourceId: "bcb_sgs", updated_at: item.data } : FALLBACK.bcb
}

async function getTasaBoE(fetcher: typeof fetchRegistered, now: () => Date): Promise<DatosBanco> {
  const today = now().toISOString().slice(0, 10)
  const start = new Date(now().getTime() - 5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const format = (value: string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}` }
  const url = `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?CodeVer=new&xml.x=yes&Identifier=IUMABEDR&TD=${format(start)}&HD=${format(today)}&SERIES_MAX=10000&CSVF=TT&HideNums=-1&UsingCodes=Y&VFD=Y`
  const text = await getCsv(fetcher, url, { headers: { Accept: "text/csv, */*" } })
  const lines = text?.trim().split("\n").filter((line) => line.trim() && !line.startsWith("DATE") && !line.startsWith('"DATE')) ?? []
  const fields = lines.at(-1)?.split(",") ?? []
  const value = Number(fields[1])
  return Number.isFinite(value) ? { pais: "Reino Unido", moneda: "GBP", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "Bank of England API (IUMABEDR)", sourceId: "bank_of_england", updated_at: fields[0]?.replace(/"/g, "").trim() } : FALLBACK.boe
}

async function getTasaBoC(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const raw = await getJson(fetcher, "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1", { headers: { Accept: "application/json" } }) as { observations?: Array<{ d: string; V39079?: { v: string } }> } | null
  const observation = raw?.observations?.[0]
  const value = Number(observation?.V39079?.v)
  return observation && Number.isFinite(value) ? { pais: "Canadá", moneda: "CAD", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "Bank of Canada Valet API (V39079)", sourceId: "bank_of_canada", updated_at: observation.d } : FALLBACK.boc
}

async function getTasaBoJ(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const oecd = await getOecdRate(fetcher, "JPN")
  return oecd ? { pais: "Japón", moneda: "JPY", tasa: oecd.tasa, esVivo: true, fuente: "OECD MEI Financial (IR3TIB01 JP)", sourceId: oecd.sourceId, updated_at: oecd.fecha, nota: "tasa interbancaria 3m — proxy de la tasa de política del BoJ" } : FALLBACK.boj
}

async function getTasaRBA(fetcher: typeof fetchRegistered): Promise<DatosBanco> {
  const raw = await getJson(fetcher, "https://api.rba.gov.au/statistics/tables/f1/?series_ids=FIRMMCRT", { headers: { Accept: "application/json" } }) as { dataSets?: Array<{ series?: Record<string, { observations?: Record<string, [string | number]> }> }> } | null
  const series = raw?.dataSets?.[0]?.series
  const key = series ? Object.keys(series)[0] : undefined
  const observations = key ? series?.[key]?.observations : undefined
  const period = observations ? Object.keys(observations).sort().at(-1) : undefined
  const value = period ? Number(observations?.[period]?.[0]) : NaN
  if (period && Number.isFinite(value)) return { pais: "Australia", moneda: "AUD", tasa: Number(value.toFixed(2)), esVivo: true, fuente: "RBA Statistics (FIRMMCRT)", sourceId: "rba_statistics", updated_at: period }
  const oecd = await getOecdRate(fetcher, "AUS")
  return oecd ? { pais: "Australia", moneda: "AUD", tasa: oecd.tasa, esVivo: true, fuente: "OECD MEI Financial (IR3TIB01 AU)", sourceId: oecd.sourceId, updated_at: oecd.fecha, nota: "tasa interbancaria 3m — proxy del cash rate del RBA" } : FALLBACK.rba
}

export async function loadCentralBankRates(options: CentralBankLoadOptions = {}): Promise<CentralBankLoadResult> {
  const fetcher = options.fetcher ?? fetchRegistered
  const now = options.now ?? (() => new Date())
  const cache = options.cache ?? DEFAULT_CACHE
  const nowMs = now().getTime()
  const fresh = cache.fresh<DatosBancosCentrales>(CACHE_KEY, nowMs)
  if (fresh) return { data: fresh, cached: true, stale: false, allFailed: false }

  const [fed, bce, bcb, boe, boc, banxico, chile, boj, rba] = await Promise.all([
    getTasaFed(fetcher), getTasaBCE(fetcher), getTasaBCB(fetcher), getTasaBoE(fetcher, now), getTasaBoC(fetcher),
    getTasaBanxico(fetcher), getTasaBCCh(fetcher), getTasaBoJ(fetcher), getTasaRBA(fetcher),
  ])
  const data = { ...FALLBACK, fed, bce, bcb, boe, boc, banxico, bcentral_chile: chile, boj, rba }
  const vivosOk = [fed, bce, bcb, boe, boc, banxico, chile, boj, rba].filter((bank) => bank.esVivo).length
  if (vivosOk > 0) {
    cache.put(CACHE_KEY, data, TTL_SECONDS, nowMs)
    return { data, stale: false, allFailed: false }
  }
  const stale = cache.lastGood<DatosBancosCentrales>(CACHE_KEY)
  return stale ? { data: stale.data, stale: true, staleSince: stale.staleSince, allFailed: true } : { data, stale: false, allFailed: true }
}

export { FALLBACK as EMPTY_CENTRAL_BANK_RATES, NOTE as CENTRAL_BANK_NOTE }
export const CENTRAL_BANK_UNAVAILABLE_NOTE = "Tasas de política monetaria de referencia. Fuentes oficiales no disponibles; datos ausentes se informan como N/D."
