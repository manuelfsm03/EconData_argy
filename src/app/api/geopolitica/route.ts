/**
 * /api/geopolitica — Noticias geopolíticas via RSS feeds
 *
 * Fuentes de datos (RSS públicos):
 *   - BBC World / Business / Mundo
 *   - Al Jazeera English
 *   - France24 Español
 *   - Infobae Economía
 *   - Ámbito Internacionales
 *   - El Cronista Mundo
 *
 * Portado desde EconData_argy/api/services/rss_service.py + routers/geopolitica.py
 *
 * Nota: No usa feedparser (Python), parsea RSS/Atom manualmente con regex sobre XML.
 */

import { NextRequest, NextResponse } from "next/server"

const RSS_FEEDS: Record<string, string> = {
  // Argentina
  ambito_eco:     "https://www.ambito.com/rss/economia.xml",
  ambito_fin:     "https://www.ambito.com/rss/finanzas.xml",
  iprofesional:   "https://www.iprofesional.com/rss/finanzas",
  bae_negocios:   "https://www.baenegocios.com/feed/",
  la_nacion:      "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/",
  perfil:         "http://www.perfil.com/feed/economia",
  el_economista:  "https://www.eleconomista.com.ar/feed/",
  // Existentes
  bbc_world:      "http://feeds.bbci.co.uk/news/world/rss.xml",
  bbc_business:   "http://feeds.bbci.co.uk/news/business/rss.xml",
  aljazeera_en:   "https://www.aljazeera.com/xml/rss/all.xml",
  france24_es:    "https://www.france24.com/es/rss",
  bbc_mundo:      "https://feeds.bbci.co.uk/mundo/rss.xml",
  infobae_eco:    "https://www.infobae.com/arc/outboundfeeds/rss/",
  ambito_inter:   "https://www.ambito.com/rss/internacionales.xml",
  cronista_mundo: "https://www.cronista.com/files/rss/news.xml",
  // EEUU
  politico:       "https://rss.politico.com/politics-news.xml",
  wsj:            "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
  // UK
  guardian:       "https://www.theguardian.com/world/rss",
  financial_times:"https://www.ft.com/rss/home",
  // Alemania
  handelsblatt:   "https://www.handelsblatt.com/contentexport/feed/top-themen",
  // Medio Oriente
  al_monitor:     "https://www.al-monitor.com/rss.xml",
  // Rusia
  meduza:         "https://meduza.io/rss/all",
  kommersant:     "https://www.kommersant.ru/RSS/main.xml",
  // China
  wire_china:     "https://thewirechina.com/feed/",
  // Brasil
  folha:          "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",
  infomoney:      "https://www.infomoney.com.br/feed/",
}

const CATEGORIES: Record<string, string[]> = {
  conflicto: [
    "war", "guerra", "conflict", "military", "missile", "attack", "invasion",
    "troops", "strike", "bombing", "drone", "ceasefire", "nato", "sanctions",
    "weapons", "armas", "ejercito", "ataque", "terroris",
  ],
  comercio: [
    "trade", "tariff", "export", "import", "comercio", "arancel", "dumping",
    "wto", "mercosur", "protectionism", "exportaciones", "importaciones",
    "aranceles", "libre comercio",
  ],
  energia: [
    "oil", "gas", "petroleo", "opec", "pipeline", "nuclear", "energy",
    "renewable", "lng", "shale", "vaca muerta", "crude", "refinery",
    "energia", "combustible", "litio", "lithium",
  ],
  politica: [
    "mercosur", "brics", "g20", "g7", "fmi", "imf", "milei", "lula",
    "trump", "banco mundial", "celac", "oea", "elections", "elecciones",
    "president", "presidente", "xi jinping", "putin", "biden", "modi",
  ],
  commodities: [
    "soja", "soybean", "trigo", "wheat", "maiz", "corn", "lithium", "litio",
    "oro", "gold", "copper", "cobre", "iron", "mining", "agriculture", "agro",
    "fertilizer", "fertilizante",
  ],
  mercados: [
    "fed", "federal reserve", "bce", "ecb", "interest rate", "inflation",
    "recession", "default", "bonds", "wall street", "yields", "treasury",
    "emergentes", "tasa", "inflacion", "dow", "nasdaq", "sp500", "bitcoin",
  ],
}

const CAT_COLORS: Record<string, string> = {
  conflicto: "#ff4444",
  comercio: "#4488ff",
  energia: "#ffaa00",
  politica: "#8855ff",
  commodities: "#00ff88",
  mercados: "#00cccc",
  general: "#8888aa",
}

function categorize(title: string, summary: string): string {
  const text = (title + " " + summary).toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => text.includes(kw))) return cat
  }
  return "general"
}

function getRegion(title: string, summary: string): string {
  const text = (title + " " + summary).toLowerCase()
  const arKw = ["argentina", "buenos aires", "milei", "bcra", "peso argentino", "dolar blue"]
  const latamKw = [
    "brasil", "chile", "uruguay", "paraguay", "colombia", "mexico",
    "venezuela", "peru", "bolivia", "latinoamerica", "latam",
    "mercosur", "celac", "america latina",
  ]
  if (arKw.some((k) => text.includes(k))) return "argentina"
  if (latamKw.some((k) => text.includes(k))) return "latam"
  return "global"
}

/** Minimal RSS/Atom XML parser using regex — no external deps */
function parseRssItems(xml: string): { title: string; link: string; pub: string; summary: string }[] {
  const items: { title: string; link: string; pub: string; summary: string }[] = []

  // Match <item> or <entry> blocks
  const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi
  let itemMatch
  while ((itemMatch = itemRe.exec(xml)) !== null) {
    const block = itemMatch[1]

    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() ?? ""
    const link =
      (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] ??
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim() ??
      ""
    const pub =
      (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() ??
      (block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || [])[1]?.trim() ??
      ""
    const summary =
      (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim() ??
      (block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1]?.trim() ??
      ""

    if (title && link) {
      items.push({ title, link, pub, summary: summary.replace(/<[^>]+>/g, "").slice(0, 280) })
    }
  }
  return items.slice(0, 6)
}

// In-memory cache
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface NewsItem {
  title: string
  link: string
  source: string
  pub: string
  category: string
  color: string
  region: string
  summary: string
}

async function getFeed(): Promise<{ items: NewsItem[]; count: number; categories: string[] }> {
  const cached = getCache<{ items: NewsItem[]; count: number; categories: string[] }>("geo_feed")
  if (cached) return cached

  const noticias: NewsItem[] = []

  await Promise.allSettled(
    Object.entries(RSS_FEEDS).map(async ([sourceName, url]) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 PanelDeControl/2.0" },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 900 },
        })
        if (!res.ok) return
        const xml = await res.text()
        const items = parseRssItems(xml)
        for (const item of items) {
          const cat = categorize(item.title, item.summary)
          const region = getRegion(item.title, item.summary)
          noticias.push({
            title: item.title.slice(0, 160),
            link: item.link,
            source: sourceName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            pub: item.pub,
            category: cat,
            color: CAT_COLORS[cat] ?? CAT_COLORS.general,
            region,
            summary: item.summary,
          })
        }
      } catch {
        // Feed unavailable — skip
      }
    }),
  )

  // Deduplicate by link
  const seen = new Set<string>()
  const unique = noticias.filter((n) => {
    if (seen.has(n.link)) return false
    seen.add(n.link)
    return true
  })

  const result = {
    items: unique.slice(0, 60),
    count: Math.min(unique.length, 60),
    categories: Object.keys(CAT_COLORS),
  }

  if (unique.length > 0) setCache("geo_feed", result, 900)
  return result
}

export async function GET(_request: NextRequest) {
  try {
    const data = await getFeed()
    return NextResponse.json({
      data,
      updated_at: new Date().toISOString(),
      source: "rss_feeds",
    })
  } catch (error) {
    console.error("[/api/geopolitica]", error)
    return NextResponse.json({ error: "Error al obtener noticias", detail: String(error) }, { status: 500 })
  }
}
