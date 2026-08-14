import type { DataClass, SourceDefinition, SourceKind } from "./types"

const MB = 1024 * 1024

type SourceSeed = {
  displayName: string
  publisher: string
  host: string
  allowedHosts?: readonly string[]
  kind?: SourceKind
  dataClass?: DataClass
  baseUrl?: string
  credentialEnv?: string
  healthcheckPath?: string
  fallbackSourceIds?: readonly string[]
  maxResponseBytes?: number
}

function source<Id extends string>(id: Id, seed: SourceSeed): SourceDefinition<Id> {
  const dataClass = seed.dataClass ?? "official_daily"
  const cacheByClass = {
    intraday_market: { freshSeconds: 60, staleWhileRevalidateSeconds: 240, staleIfErrorSeconds: 900 },
    daily_market: { freshSeconds: 300, staleWhileRevalidateSeconds: 900, staleIfErrorSeconds: 3_600 },
    official_daily: { freshSeconds: 3_600, staleWhileRevalidateSeconds: 21_600, staleIfErrorSeconds: 172_800 },
    official_monthly: { freshSeconds: 21_600, staleWhileRevalidateSeconds: 86_400, staleIfErrorSeconds: 604_800 },
    annual: { freshSeconds: 86_400, staleWhileRevalidateSeconds: 604_800, staleIfErrorSeconds: 2_592_000 },
    news: { freshSeconds: 900, staleWhileRevalidateSeconds: 900, staleIfErrorSeconds: 21_600 },
  } as const
  const freshnessByClass = {
    intraday_market: { warnAfterSeconds: 600, rejectAfterSeconds: 1_800 },
    daily_market: { warnAfterSeconds: 129_600, rejectAfterSeconds: 432_000 },
    official_daily: { warnAfterSeconds: 129_600, rejectAfterSeconds: 432_000 },
    official_monthly: { warnAfterSeconds: 3_888_000, rejectAfterSeconds: 6_480_000 },
    annual: { warnAfterSeconds: 34_560_000, rejectAfterSeconds: 69_120_000 },
    news: { warnAfterSeconds: 7_200, rejectAfterSeconds: 43_200 },
  } as const

  return {
    id,
    displayName: seed.displayName,
    publisher: seed.publisher,
    kind: seed.kind ?? "json",
    dataClass,
    baseUrl: seed.baseUrl ?? `https://${seed.host}`,
    allowedHosts: seed.allowedHosts ?? [seed.host],
    timeoutMs: 10_000,
    maxResponseBytes: seed.maxResponseBytes ?? (seed.kind === "csv" || seed.kind === "xlsx" ? 25 * MB : 5 * MB),
    retry: { attempts: 1, retryOn: ["timeout", "429", "5xx"] },
    cache: cacheByClass[dataClass],
    freshness: freshnessByClass[dataClass],
    credentialEnv: seed.credentialEnv,
    fallbackSourceIds: seed.fallbackSourceIds ?? [],
    healthcheck: seed.healthcheckPath ? { path: seed.healthcheckPath, expectedStatuses: [200] } : undefined,
  }
}

// datos_gob_series y bcra_official: healthchecks corregidos (2026-08-14) tras
// verificar en vivo que el path anterior devolvía error SIEMPRE, envenenando
// /api/status aunque los datos reales anduvieran bien: la serie sin ?ids= es
// 400 por diseño (requiere al menos un id), y la v3.0 del BCRA está dada de
// baja (410 Gone) — el resto del código ya usa v4.0.
export const SOURCE_REGISTRY = {
  argentina_datos: source("argentina_datos", { displayName: "ArgentinaDatos cotizaciones", publisher: "ArgentinaDatos", host: "api.argentinadatos.com", dataClass: "intraday_market", healthcheckPath: "/v1/cotizaciones/dolares" }),
  datos_gob_series: source("datos_gob_series", { displayName: "Series de Tiempo", publisher: "datos.gob.ar", host: "apis.datos.gob.ar", healthcheckPath: "/series/api/series/?ids=143.3_NO_PR_2004_A_21&limit=1" }),
  datos_gob_files: source("datos_gob_files", { displayName: "Archivos datos.gob.ar", publisher: "datos.gob.ar", host: "infra.datos.gob.ar", kind: "csv", dataClass: "official_monthly" }),
  dolar_api: source("dolar_api", { displayName: "DolarAPI", publisher: "DolarAPI", host: "dolarapi.com", dataClass: "intraday_market", healthcheckPath: "/v1/dolares", fallbackSourceIds: ["argentina_datos"] }),
  bluelytics: source("bluelytics", { displayName: "Bluelytics", publisher: "Bluelytics", host: "api.bluelytics.com.ar", dataClass: "intraday_market", healthcheckPath: "/v2/latest" }),
  bcra_official: source("bcra_official", { displayName: "BCRA API", publisher: "Banco Central de la República Argentina", host: "api.bcra.gob.ar", dataClass: "official_daily", healthcheckPath: "/estadisticas/v4.0/Monetarias" }),
  bcra_files: source("bcra_files", { displayName: "BCRA archivos", publisher: "Banco Central de la República Argentina", host: "www.bcra.gob.ar", kind: "xlsx", dataClass: "official_monthly" }),
  world_bank: source("world_bank", { displayName: "World Bank API", publisher: "World Bank", host: "api.worldbank.org", dataClass: "annual", healthcheckPath: "/v2/country/ARG/indicator/NY.GDP.MKTP.KD.ZG?format=json&per_page=1" }),
  yahoo_finance_chart: source("yahoo_finance_chart", { displayName: "Yahoo Finance Chart", publisher: "Yahoo Finance", host: "query1.finance.yahoo.com", dataClass: "intraday_market" }),
  yahoo_finance: source("yahoo_finance", { displayName: "Yahoo Finance", publisher: "Yahoo Finance", host: "finance.yahoo.com", dataClass: "intraday_market" }),
  yahoo_finance_rss: source("yahoo_finance_rss", { displayName: "Yahoo Finance RSS", publisher: "Yahoo Finance", host: "feeds.finance.yahoo.com", kind: "rss", dataClass: "news" }),
  api_merval: source("api_merval", { displayName: "API Merval", publisher: "API Merval", host: "api-merval-production.up.railway.app", dataClass: "intraday_market", healthcheckPath: "/health" }),
  rava: source("rava", { displayName: "Rava", publisher: "Rava Bursátil", host: "www.rava.com", kind: "html", dataClass: "intraday_market", healthcheckPath: "/perfil/gd30" }),
  // El dump completo de /api/prices/arg pesa ~8.4 MB (16k+ instrumentos, sin
  // filtro server-side posible) -- superaba el default de 5 MB para JSON y
  // fetchRegistered lo rechazaba con SOURCE_RESPONSE_TOO_LARGE en cada
  // request, dejando /api/rofex sin datos en vivo (verificado en vivo
  // 2026-08-14: Content-Length real 8830509 bytes).
  rava_market: source("rava_market", { displayName: "Rava Mercado", publisher: "Rava Bursátil", host: "mercado.rava.com", dataClass: "intraday_market", maxResponseBytes: 15 * MB }),
  owid: source("owid", { displayName: "Our World in Data", publisher: "Our World in Data", host: "ourworldindata.org", kind: "csv", dataClass: "annual", healthcheckPath: "/grapher/soybean-production.csv" }),
  owid_github: source("owid_github", { displayName: "OWID datasets", publisher: "Our World in Data", host: "raw.githubusercontent.com", kind: "csv", dataClass: "annual" }),
  eia: source("eia", { displayName: "EIA API", publisher: "U.S. Energy Information Administration", host: "api.eia.gov", dataClass: "official_monthly", credentialEnv: "EIA_API_KEY", healthcheckPath: "/v2/" }),
  polymarket: source("polymarket", { displayName: "Polymarket Gamma", publisher: "Polymarket", host: "gamma-api.polymarket.com", dataClass: "intraday_market", healthcheckPath: "/markets?limit=1" }),
  huggingface: source("huggingface", { displayName: "Hugging Face Hub", publisher: "Hugging Face", host: "huggingface.co", dataClass: "daily_market", healthcheckPath: "/api/models?limit=1" }),
  coingecko: source("coingecko", { displayName: "CoinGecko", publisher: "CoinGecko", host: "api.coingecko.com", dataClass: "intraday_market", healthcheckPath: "/api/v3/ping" }),
  criptoya: source("criptoya", { displayName: "CriptoYa", publisher: "CriptoYa", host: "criptoya.com", dataClass: "intraday_market" }),
  treasury_us: source("treasury_us", { displayName: "U.S. Treasury", publisher: "U.S. Department of the Treasury", host: "home.treasury.gov", kind: "xml", dataClass: "official_daily" }),
  indec: source("indec", { displayName: "INDEC", publisher: "INDEC", host: "www.indec.gob.ar", kind: "xlsx", dataClass: "official_monthly" }),
  argentina_gob: source("argentina_gob", { displayName: "Argentina.gob.ar", publisher: "Gobierno de Argentina", host: "www.argentina.gob.ar", kind: "html", dataClass: "official_monthly" }),
  estadisticas_bcra_legacy: source("estadisticas_bcra_legacy", { displayName: "Estadísticas BCRA legacy", publisher: "BCRA", host: "api.estadisticasbcra.com", dataClass: "official_daily" }),
  dolarsi: source("dolarsi", { displayName: "DolarSi", publisher: "DolarSi", host: "www.dolarsi.com", dataClass: "intraday_market" }),
  population_pyramid: source("population_pyramid", { displayName: "PopulationPyramid.net", publisher: "PopulationPyramid.net", host: "www.populationpyramid.net", kind: "csv", dataClass: "annual" }),
  news_rss: source("news_rss", {
    displayName: "Registered news feeds",
    publisher: "Registered publishers",
    host: "www.infobae.com",
    allowedHosts: [
      "www.ambito.com", "www.infobae.com", "www.cronista.com", "www.iprofesional.com",
      "www.baenegocios.com", "www.lanacion.com.ar", "www.perfil.com", "www.eleconomista.com.ar",
      "rss.politico.com", "feeds.a.dj.com", "feeds.bbci.co.uk", "www.theguardian.com", "www.ft.com",
      "www.france24.com", "rss.dw.com", "www.aljazeera.com", "www.al-monitor.com", "www.themoscowtimes.com",
      "thewirechina.com", "brazilreport.com", "riotimesonline.com",
    ],
    kind: "rss",
    dataClass: "news",
    healthcheckPath: "/arc/outboundfeeds/rss/",
  }),
} as const satisfies Record<string, SourceDefinition>

export type SourceId = keyof typeof SOURCE_REGISTRY

export function registeredHealthchecks(): Array<(typeof SOURCE_REGISTRY)[SourceId]> {
  return Object.values(SOURCE_REGISTRY).filter(
    (definition): definition is (typeof SOURCE_REGISTRY)[SourceId] => definition.healthcheck != null,
  )
}

export function hostMatches(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
}

export function findSourceForUrl(url: string): SourceDefinition {
  const parsed = new URL(url)
  if (parsed.protocol !== "https:") throw new Error("SOURCE_REQUIRES_HTTPS")
  const match = Object.values(SOURCE_REGISTRY).find((definition) =>
    definition.allowedHosts.some((allowedHost) => hostMatches(parsed.hostname, allowedHost)),
  )
  if (!match) throw new Error(`UNREGISTERED_SOURCE_HOST:${parsed.hostname}`)
  return match
}

export function validateSourceRegistry(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const hosts = new Set<string>()
  for (const [key, definition] of Object.entries(SOURCE_REGISTRY)) {
    if (key !== definition.id) errors.push(`${key}: id mismatch`)
    if (ids.has(definition.id)) errors.push(`${key}: duplicate id`)
    ids.add(definition.id)
    if (definition.baseUrl && new URL(definition.baseUrl).protocol !== "https:") errors.push(`${key}: baseUrl must be HTTPS`)
    if (definition.timeoutMs < 3_000 || definition.timeoutMs > 15_000) errors.push(`${key}: invalid timeout`)
    if (definition.retry.attempts > 1) errors.push(`${key}: too many retries`)
    for (const host of definition.allowedHosts) {
      if (hosts.has(host)) errors.push(`${key}: duplicate host ${host}`)
      hosts.add(host)
    }
    for (const fallback of definition.fallbackSourceIds) {
      if (!(fallback in SOURCE_REGISTRY)) errors.push(`${key}: unknown fallback ${fallback}`)
      if (fallback === key) errors.push(`${key}: cyclic fallback`)
      const fallbackDefinition = SOURCE_REGISTRY[fallback as SourceId]
      if (fallbackDefinition && fallbackDefinition.dataClass !== definition.dataClass) {
        errors.push(`${key}: incompatible fallback ${fallback}`)
      }
    }
  }
  return errors
}
