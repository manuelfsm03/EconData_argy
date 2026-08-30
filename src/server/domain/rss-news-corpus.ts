import {
  dedupeNewsItems,
  isFreshNewsDate,
  isRelevantNewsItem,
  matchesAnyWholeTerm,
} from "@/server/domain/rss-news-policy"

export interface RSSFeed {
  url: string
  source: string
  region: "argentina" | "internacional"
  category: string
  country?: string
  lang: "es" | "en"
}

export interface RSSItem {
  id: string
  title: string
  link: string
  description: string | null
  source: string
  pubDate: string
  region: "argentina" | "internacional"
  category: string
  country?: string
}

export interface RSSCorpus {
  items: RSSItem[]
  retrievedAt: string
  feedsSucceeded: number
  feedsFailed: number
  mode: "live" | "cache"
}

export const RSS_FEEDS: readonly RSSFeed[] = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito", region: "argentina", category: "economía", lang: "es" },
  { url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Fin.", region: "argentina", category: "finanzas", lang: "es" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/", source: "Infobae Economía", region: "argentina", category: "economía", lang: "es" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/category/politica/", source: "Infobae Política", region: "argentina", category: "política", lang: "es" },
  { url: "https://www.cronista.com/files/rss/news.xml", source: "El Cronista", region: "argentina", category: "finanzas", lang: "es" },
  { url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional", region: "argentina", category: "finanzas", lang: "es" },
  { url: "https://www.baenegocios.com/feed/", source: "BAE Negocios", region: "argentina", category: "economía", lang: "es" },
  { url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/", source: "La Nación", region: "argentina", category: "economía", lang: "es" },
  { url: "https://www.perfil.com/feed/economia", source: "Perfil", region: "argentina", category: "economía", lang: "es" },
  { url: "https://www.eleconomista.com.ar/feed/", source: "El Economista", region: "argentina", category: "economía", lang: "es" },
  { url: "https://rss.politico.com/politics-news.xml", source: "Politico", region: "internacional", category: "política", country: "eeuu", lang: "en" },
  { url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", source: "WSJ", region: "internacional", category: "economía", country: "eeuu", lang: "en" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC Business", region: "internacional", category: "economía", country: "uk", lang: "en" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian", region: "internacional", category: "política", country: "uk", lang: "en" },
  { url: "https://www.ft.com/rss/home", source: "Financial Times", region: "internacional", category: "economía", country: "uk", lang: "en" },
  { url: "https://www.france24.com/es/rss", source: "France 24", region: "internacional", category: "política", country: "francia", lang: "es" },
  { url: "https://rss.dw.com/rdf/rss-es-eco", source: "DW Español", region: "internacional", category: "economía", country: "alemania", lang: "es" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera", region: "internacional", category: "conflicto", country: "medio-oriente", lang: "en" },
  { url: "https://www.al-monitor.com/rss.xml", source: "Al Monitor", region: "internacional", category: "política", country: "medio-oriente", lang: "en" },
  { url: "https://www.themoscowtimes.com/rss/news", source: "Moscow Times", region: "internacional", category: "política", country: "rusia", lang: "en" },
  { url: "https://thewirechina.com/feed/", source: "The Wire China", region: "internacional", category: "economía", country: "china", lang: "en" },
  { url: "https://brazilreport.com/feed/", source: "Brazil Report", region: "internacional", category: "política", country: "brasil", lang: "en" },
  { url: "https://riotimesonline.com/feed/", source: "Rio Times", region: "internacional", category: "economía", country: "brasil", lang: "en" },
]

const RELEVANT_TERMS = [
  "economía", "economia", "económico", "economico", "económica", "economica", "pbi", "gdp",
  "producto bruto", "crecimiento", "recesión", "recesion", "inflación", "inflacion", "deflación",
  "deflacion", "ipc", "ipcm", "cpi", "precio", "precios", "costo", "costos", "tarifas", "tarifa",
  "salario", "salarios", "sueldo", "sueldos", "empleo", "desempleo", "pobreza", "indigencia",
  "canasta", "ingresos", "exportación", "exportaciones", "importación", "importaciones",
  "balanza comercial", "balanza de pagos", "superávit", "deficit", "déficit", "presupuesto", "fiscal",
  "impuesto", "impuestos", "recaudación", "recaudacion", "gasto público", "deuda pública", "deuda externa",
  "deuda soberana", "emisión monetaria", "base monetaria", "circulante", "agregados monetarios", "reservas",
  "reservas internacionales", "oro", "divisas", "producción", "industria", "industrial", "manufactura",
  "construcción", "construccion", "actividad económica", "emae", "indec", "bcra", "anses", "afip", "arca",
  "tesoro", "hacienda", "mercado", "mercados", "bolsa", "bolsas", "bursátil", "bursatil", "acciones",
  "acción", "accion", "título", "titulo", "valores", "bonos", "bono", "deuda", "letra", "letras", "lebac",
  "lecap", "letes", "dólar", "dolar", "dólares", "dolares", "blue", "ccl", "mep", "oficial", "paralelo",
  "divisa", "tipo de cambio", "brecha cambiaria", "cepo", "cepo cambiario", "tasa de interés", "tasa de interes",
  "tasa", "tasas", "rendimiento", "riesgo país", "riesgo pais", "spread", "embi", "merval", "cedear", "s&p",
  "nasdaq", "dow jones", "nikkei", "ftse", "rofex", "caucion", "caución", "repo", "swap", "banco", "bancos",
  "entidad financiera", "crédito", "credito", "préstamo", "inversión", "inversion", "inversor", "inversores",
  "fondo", "fondos", "hedge fund", "fci", "fed", "bce", "banco central", "bitcoin", "criptomoneda", "cripto",
  "blockchain", "petróleo", "petroleo", "brent", "wti", "crudo", "gas natural", "soja", "maíz", "maiz",
  "trigo", "girasol", "agro", "campo", "granos", "litio", "minería", "mineria", "ypf", "vaca muerta", "shale",
  "energía", "energia", "electricidad", "nafta", "combustible", "fmi", "banco mundial", "bid", "caf", "g20",
  "g7", "ocde", "omc", "arancel", "aranceles", "comercio exterior", "aduana", "sanción", "sanciones",
  "gobierno", "gobernador", "presidente", "presidenta", "ministro", "ministra", "ministerio", "secretaría",
  "secretaria", "decreto", "resolución", "resoluciones", "congreso", "senado", "diputados", "legislativo", "ley ",
  "proyecto de ley", "elección", "elecciones", "votación", "votacion", "candidato", "campaña", "milei", "kicillof",
  "massa", "macri", "kirchner", "caputo", "oposición", "oposicion", "coalición", "bloque", "partido político",
  "reforma", "ajuste", "plan económico", "medida económica", "guerra", "conflicto", "invasión", "invasion",
  "ataque", "bombardeo", "ucrania", "rusia", "gaza", "israel", "irán", "iran", "china", "eeuu", "trump", "biden",
  "zelensky", "putin", "xi jinping", "otan", "nato", "onu", "united nations", "consejo de seguridad", "diplomacia",
  "tratado", "acuerdo bilateral", "alianza", "tensión geopolítica", "sanction", "sanctions", "embargo", "economy",
  "economic", "economics", "growth", "recession", "inflation", "deflation", "price", "prices", "wage", "wages",
  "employment", "unemployment", "jobless", "payroll", "budget", "deficit", "surplus", "debt", "spending", "revenue",
  "tax", "trade", "tariff", "tariffs", "export", "import", "current account", "monetary", "fiscal", "treasury",
  "central bank", "interest rate", "federal reserve", "imf", "world bank", "ecb", "market", "markets", "stock",
  "bonds", "yield", "spread", "dollar", "exchange rate", "currency", "forex", "investment", "investor", "fund",
  "hedge", "equity", "commodity", "oil", "crude", "gold", "silver", "copper", "wheat", "corn", "soybean", "bank",
  "banking", "credit", "loan", "lending", "mortgage", "crypto", "government", "president", "minister", "parliament",
  "congress", "senate", "election", "vote", "policy", "reform", "regulation", "war", "conflict", "invasion",
  "diplomacy", "treaty", "security council",
] as const

const RELEVANT_SET = RELEVANT_TERMS.map((term) => term.toLowerCase())
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  finanzas: ["bolsa", "acciones", "bonos", "bursátil", "merval", "cedear", "dólar", "dolar", "tasas", "bcra", "rofex", "letras", "inflación", "inflacion", "tasa"],
  comercio: ["exportaciones", "importaciones", "balanza", "arancel", "comercio exterior", "aduana", "trump", "aranceles", "tarifa"],
  energía: ["petróleo", "petroleo", "gas", "energía", "energia", "litio", "ypf", "combustible", "nafta", "vaca muerta"],
  commodities: ["soja", "maíz", "maiz", "trigo", "girasol", "agro", "cereales", "oleaginosas", "granos", "campo"],
  política: ["gobierno", "congreso", "senado", "milei", "decreto", "fmi", "elecciones", "legislativo", "ministerio"],
}

function detectCategory(title: string, base: string): string {
  for (const [category, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    if (matchesAnyWholeTerm(title, terms)) return category
  }
  return base
}

function extractItems(xml: string, feed: RSSFeed): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]
      ?? content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""
    const link = content.match(/<link><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]
      ?? content.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""
    const description = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]
      ?? content.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? null
    const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ""
    const cleanTitle = title.replace(/<[^>]*>/g, "").trim()
    const cleanLink = link.trim()
    if (!cleanTitle || !cleanLink || !isFreshNewsDate(pubDate)) continue
    if (/[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]/.test(cleanTitle)) continue
    if (!isRelevantNewsItem(cleanTitle, RELEVANT_SET, cleanLink)) continue

    items.push({
      id: Buffer.from(cleanLink).toString("base64").slice(0, 20),
      title: cleanTitle,
      link: cleanLink,
      description: description ? description.replace(/<[^>]*>/g, "").trim().slice(0, 300) : null,
      source: feed.source,
      pubDate: new Date(pubDate).toISOString(),
      region: feed.region,
      category: detectCategory(cleanTitle, feed.category),
      country: feed.country,
    })
  }
  return items
}

const CACHE_VERSION = 7
const INSTANCE_TTL = 5 * 60 * 1000
let cache: (Omit<RSSCorpus, "mode"> & { ts: number; version: number }) | null = null

export async function loadRssNewsCorpus(
  fetchXml: (feed: RSSFeed) => Promise<string | null>,
): Promise<RSSCorpus> {
  if (cache && Date.now() - cache.ts < INSTANCE_TTL && cache.version === CACHE_VERSION) {
    return { ...cache, mode: "cache" }
  }

  const allItems: RSSItem[] = []
  let feedsSucceeded = 0
  let feedsFailed = 0
  await Promise.allSettled(RSS_FEEDS.map(async (feed) => {
    try {
      const xml = await fetchXml(feed)
      if (xml == null) {
        feedsFailed += 1
        return
      }
      feedsSucceeded += 1
      allItems.push(...extractItems(xml, feed).slice(0, 15))
    } catch {
      feedsFailed += 1
    }
  }))

  allItems.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
  const result: RSSCorpus = {
    items: dedupeNewsItems(allItems),
    retrievedAt: new Date(Date.now()).toISOString(),
    feedsSucceeded,
    feedsFailed,
    mode: "live",
  }
  if (result.items.length > 0) {
    cache = { ...result, ts: Date.now(), version: CACHE_VERSION }
  }
  return result
}

export function newestRssPubDate(items: readonly RSSItem[]): string | null {
  let newest: { value: string; timestamp: number } | null = null
  for (const item of items) {
    const timestamp = Date.parse(item.pubDate)
    if (Number.isFinite(timestamp) && (!newest || timestamp > newest.timestamp)) {
      newest = { value: item.pubDate, timestamp }
    }
  }
  return newest?.value ?? null
}
