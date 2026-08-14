import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"
import {
  dedupeNewsItems,
  isFreshNewsDate,
  isRelevantNewsItem,
  matchesAnyWholeTerm,
} from "@/server/domain/rss-news-policy"

// Vercel CDN cachea esta route 15 minutos — sin tokens, escala infinitamente
export const revalidate = 900

interface RSSFeed {
  url: string
  source: string
  region: "argentina" | "internacional"
  category: string
  country?: string
  lang: "es" | "en"
}

interface RSSItem {
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

const RSS_FEEDS: RSSFeed[] = [
  // ── Argentina (español) ──
  { url: "https://www.ambito.com/rss/economia.xml",                                            source: "Ámbito",        region: "argentina",     category: "economía",  lang: "es" },
  { url: "https://www.ambito.com/rss/finanzas.xml",                                            source: "Ámbito Fin.",   region: "argentina",     category: "finanzas",  lang: "es" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/",                  source: "Infobae Economía", region: "argentina",  category: "economía",  lang: "es" },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/category/politica/",                  source: "Infobae Política", region: "argentina",  category: "política",  lang: "es" },
  { url: "https://www.cronista.com/files/rss/news.xml",                                        source: "El Cronista",   region: "argentina",     category: "finanzas",  lang: "es" },
  { url: "https://www.iprofesional.com/rss/finanzas",                                          source: "iProfesional",  region: "argentina",     category: "finanzas",  lang: "es" },
  { url: "https://www.baenegocios.com/feed/",                                                  source: "BAE Negocios",  region: "argentina",     category: "economía",  lang: "es" },
  { url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/",              source: "La Nación",     region: "argentina",     category: "economía",  lang: "es" },
  { url: "https://www.perfil.com/feed/economia",                                               source: "Perfil",        region: "argentina",     category: "economía",  lang: "es" },
  { url: "https://www.eleconomista.com.ar/feed/",                                              source: "El Economista", region: "argentina",     category: "economía",  lang: "es" },
  // ── Internacional — EEUU (inglés) ──
  { url: "https://rss.politico.com/politics-news.xml",              source: "Politico",       region: "internacional", category: "política",  country: "eeuu",         lang: "en" },
  { url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",            source: "WSJ",            region: "internacional", category: "economía",  country: "eeuu",         lang: "en" },
  // ── Internacional — UK (inglés) ──
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml",         source: "BBC Business",   region: "internacional", category: "economía",  country: "uk",           lang: "en" },
  { url: "https://www.theguardian.com/world/rss",                   source: "The Guardian",   region: "internacional", category: "política",  country: "uk",           lang: "en" },
  { url: "https://www.ft.com/rss/home",                             source: "Financial Times",region: "internacional", category: "economía",  country: "uk",           lang: "en" },
  // ── Internacional — Francia (español) ──
  { url: "https://www.france24.com/es/rss",                         source: "France 24",      region: "internacional", category: "política",  country: "francia",      lang: "es" },
  // ── Internacional — Alemania (español) ──
  { url: "https://rss.dw.com/rdf/rss-es-eco",                      source: "DW Español",     region: "internacional", category: "economía",  country: "alemania",     lang: "es" },
  // ── Internacional — Medio Oriente (inglés) ──
  { url: "https://www.aljazeera.com/xml/rss/all.xml",              source: "Al Jazeera",     region: "internacional", category: "conflicto", country: "medio-oriente", lang: "en" },
  { url: "https://www.al-monitor.com/rss.xml",                     source: "Al Monitor",     region: "internacional", category: "política",  country: "medio-oriente", lang: "en" },
  // ── Internacional — Rusia (inglés) ──
  { url: "https://www.themoscowtimes.com/rss/news",                source: "Moscow Times",   region: "internacional", category: "política",  country: "rusia",         lang: "en" },
  // ── Internacional — China (inglés) ──
  { url: "https://thewirechina.com/feed/",                         source: "The Wire China", region: "internacional", category: "economía",  country: "china",         lang: "en" },
  // ── Internacional — Brasil (inglés) ──
  { url: "https://brazilreport.com/feed/",                         source: "Brazil Report",  region: "internacional", category: "política",  country: "brasil",        lang: "en" },
  { url: "https://riotimesonline.com/feed/",                       source: "Rio Times",      region: "internacional", category: "economía",  country: "brasil",        lang: "en" },
]

// Filtro POSITIVO: el título debe contener al menos un término relevante
const RELEVANT_TERMS: string[] = [
  // ── Macro / economía (ES) ──
  "economía", "economia", "económico", "economico", "económica", "economica",
  "pbi", "gdp", "producto bruto", "crecimiento", "recesión", "recesion",
  "inflación", "inflacion", "deflación", "deflacion", "ipc", "ipcm", "cpi",
  "precio", "precios", "costo", "costos", "tarifas", "tarifa",
  "salario", "salarios", "sueldo", "sueldos", "empleo", "desempleo",
  "pobreza", "indigencia", "canasta", "ingresos",
  "exportación", "exportaciones", "importación", "importaciones",
  "balanza comercial", "balanza de pagos", "superávit", "deficit", "déficit",
  "presupuesto", "fiscal", "impuesto", "impuestos", "recaudación", "recaudacion",
  "gasto público", "deuda pública", "deuda externa", "deuda soberana",
  "emisión monetaria", "base monetaria", "circulante", "agregados monetarios",
  "reservas", "reservas internacionales", "oro", "divisas",
  "producción", "industria", "industrial", "manufactura",
  "construcción", "construccion", "actividad económica",
  "emae", "indec", "bcra", "anses", "afip", "arca", "tesoro", "hacienda",
  // ── Finanzas / mercados (ES) ──
  "mercado", "mercados", "bolsa", "bolsas", "bursátil", "bursatil",
  "acciones", "acción", "accion", "título", "titulo", "valores",
  "bonos", "bono", "deuda", "letra", "letras", "lebac", "lecap", "letes",
  "dólar", "dolar", "dólares", "dolares", "blue", "ccl", "mep", "oficial", "paralelo", "divisa",
  "tipo de cambio", "brecha cambiaria", "cepo", "cepo cambiario",
  "tasa de interés", "tasa de interes", "tasa", "tasas", "rendimiento",
  "riesgo país", "riesgo pais", "spread", "embi",
  "merval", "cedear", "s&p", "nasdaq", "dow jones", "nikkei", "ftse",
  "rofex", "caucion", "caución", "repo", "swap",
  "banco", "bancos", "entidad financiera", "crédito", "credito", "préstamo",
  "inversión", "inversion", "inversor", "inversores", "fondo", "fondos",
  "hedge fund", "fci", "fed", "bce", "banco central",
  "bitcoin", "criptomoneda", "cripto", "blockchain",
  "petróleo", "petroleo", "brent", "wti", "crudo", "gas natural",
  "soja", "maíz", "maiz", "trigo", "girasol", "agro", "campo", "granos",
  "litio", "minería", "mineria", "ypf", "vaca muerta", "shale",
  "energía", "energia", "electricidad", "nafta", "combustible",
  "fmi", "banco mundial", "bid", "caf", "g20", "g7", "ocde", "omc",
  "arancel", "aranceles", "comercio exterior", "aduana", "sanción", "sanciones",
  // ── Política (ES) ──
  "gobierno", "gobernador", "presidente", "presidenta", "ministro", "ministra",
  "ministerio", "secretaría", "secretaria", "decreto", "resolución", "resoluciones",
  "congreso", "senado", "diputados", "legislativo", "ley ", "proyecto de ley",
  "elección", "elecciones", "votación", "votacion", "candidato", "campaña",
  "milei", "kicillof", "massa", "macri", "kirchner", "caputo",
  "oposición", "oposicion", "coalición", "bloque", "partido político",
  "reforma", "ajuste", "plan económico", "medida económica",
  // ── Geopolítica (ES + EN) ──
  "guerra", "conflicto", "invasión", "invasion", "ataque", "bombardeo",
  "ucrania", "rusia", "gaza", "israel", "irán", "iran", "china", "eeuu",
  "trump", "biden", "zelensky", "putin", "xi jinping",
  "otan", "nato", "onu", "united nations", "consejo de seguridad",
  "diplomacia", "tratado", "acuerdo bilateral", "alianza", "tensión geopolítica",
  "sanction", "sanctions", "embargo",
  // ── Macro / economía (EN) ──
  "economy", "economic", "economics", "gdp", "growth", "recession",
  "inflation", "deflation", "price", "prices", "wage", "wages",
  "employment", "unemployment", "jobless", "payroll",
  "budget", "deficit", "surplus", "debt", "spending", "revenue", "tax",
  "trade", "tariff", "tariffs", "export", "import", "current account",
  "monetary", "fiscal", "treasury", "central bank", "interest rate",
  "federal reserve", "imf", "world bank", "ecb",
  // ── Finanzas / mercados (EN) ──
  "market", "markets", "stock", "bonds", "yield", "spread",
  "dollar", "exchange rate", "currency", "forex",
  "investment", "investor", "fund", "hedge", "equity", "commodity",
  "oil", "crude", "gold", "silver", "copper", "wheat", "corn", "soybean",
  "bank", "banking", "credit", "loan", "lending", "mortgage",
  "crypto", "bitcoin", "blockchain",
  // ── Política / Geopolítica (EN) ──
  "government", "president", "minister", "parliament", "congress", "senate",
  "election", "vote", "policy", "reform", "regulation",
  "war", "conflict", "invasion", "sanctions", "diplomacy", "treaty",
  "nato", "united nations", "security council",
]

// Normalizar una sola vez; el matcher exige límites de palabra completos.
const RELEVANT_SET = RELEVANT_TERMS.map((t) => t.toLowerCase())

// Detección de categoría por keywords en el título
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  finanzas:    ["bolsa", "acciones", "bonos", "bursátil", "merval", "cedear", "dólar", "dolar", "tasas", "bcra", "rofex", "letras", "inflación", "inflacion", "tasa"],
  comercio:    ["exportaciones", "importaciones", "balanza", "arancel", "comercio exterior", "aduana", "trump", "aranceles", "tarifa"],
  energía:     ["petróleo", "petroleo", "gas", "energía", "energia", "litio", "ypf", "combustible", "nafta", "vaca muerta"],
  commodities: ["soja", "maíz", "maiz", "trigo", "girasol", "agro", "cereales", "oleaginosas", "granos", "campo"],
  política:    ["gobierno", "congreso", "senado", "milei", "decreto", "fmi", "elecciones", "legislativo", "ministerio"],
}

// Descarta cualquier título con caracteres cirílicos, árabes o CJK
function isNonLatinScript(text: string): boolean {
  return /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]/.test(text)
}
function detectCategory(title: string, base: string): string {
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (matchesAnyWholeTerm(title, kws)) return cat
  }
  return base
}

function extractItems(xml: string, feed: RSSFeed): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const c = match[1]
    const title =
      c.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ??
      c.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""
    const link =
      c.match(/<link><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ??
      c.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""
    const desc =
      c.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ??
      c.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? null
    const pubDate = c.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ""

    const cleanTitle = title.replace(/<[^>]*>/g, "").trim()
    const cleanLink  = link.trim()
    if (!cleanTitle || !cleanLink) continue
    if (!isFreshNewsDate(pubDate)) continue
    if (isNonLatinScript(cleanTitle)) continue   // descarta cirílico, árabe, chino, etc.
    if (!isRelevantNewsItem(cleanTitle, RELEVANT_SET, cleanLink)) continue

    items.push({
      id:          Buffer.from(cleanLink).toString("base64").slice(0, 20),
      title:       cleanTitle,
      link:        cleanLink,
      description: desc ? desc.replace(/<[^>]*>/g, "").trim().slice(0, 300) : null,
      source:      feed.source,
      pubDate:     new Date(pubDate).toISOString(),
      region:      feed.region,
      category:    detectCategory(cleanTitle, feed.category),
      country:     feed.country,
    })
  }

  return items
}

// Cache por instancia (secundario — el CDN de Vercel es la capa primaria)
let _cache: { items: RSSItem[]; ts: number; v: number } | null = null
// Versión del cache — cambiar para forzar invalidación
const CACHE_VERSION = 6
const INSTANCE_TTL = 5 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() - _cache.ts < INSTANCE_TTL && _cache.v === CACHE_VERSION) {
    return NextResponse.json(_cache.items, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" },
    })
  }

  const allItems: RSSItem[] = []

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetchRegistered(feed.url, {
          signal:  AbortSignal.timeout(8000),
          headers: { "User-Agent": "LaPizarra/1.0" },
        })
        if (!res.ok) return
        const xml   = await res.text()
        const items = extractItems(xml, feed)
        allItems.push(...items.slice(0, 15))
      } catch {
        // feed fallido — se ignora silenciosamente
      }
    })
  )

  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
  const uniqueItems = dedupeNewsItems(allItems)
  _cache = { items: uniqueItems, ts: Date.now(), v: CACHE_VERSION }

  return NextResponse.json(uniqueItems, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" },
  })
}
