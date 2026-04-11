import { NextResponse } from "next/server"

// Vercel CDN cachea esta route 15 minutos — sin tokens, escala infinitamente
export const revalidate = 900

interface RSSFeed {
  url: string
  source: string
  region: "argentina" | "internacional"
  category: string
  country?: string
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
  // ── Argentina ──
  { url: "https://www.ambito.com/rss/economia.xml",                                            source: "Ámbito",        region: "argentina",     category: "economía"  },
  { url: "https://www.ambito.com/rss/finanzas.xml",                                            source: "Ámbito Fin.",   region: "argentina",     category: "finanzas"  },
  { url: "https://www.infobae.com/arc/outboundfeeds/rss/",                                     source: "Infobae",       region: "argentina",     category: "economía"  },
  { url: "https://www.cronista.com/files/rss/news.xml",                                        source: "El Cronista",   region: "argentina",     category: "finanzas"  },
  { url: "https://www.iprofesional.com/rss/finanzas",                                          source: "iProfesional",  region: "argentina",     category: "finanzas"  },
  { url: "https://www.baenegocios.com/feed/",                                                  source: "BAE Negocios",  region: "argentina",     category: "economía"  },
  { url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/",              source: "La Nación",     region: "argentina",     category: "economía"  },
  { url: "http://www.perfil.com/feed/economia",                                                source: "Perfil",        region: "argentina",     category: "economía"  },
  { url: "https://www.eleconomista.com.ar/feed/",                                              source: "El Economista", region: "argentina",     category: "economía"  },
  // ── Internacional — EEUU ──
  { url: "https://rss.politico.com/politics-news.xml",              source: "Politico",       region: "internacional", category: "política",  country: "eeuu"        },
  { url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",            source: "WSJ",            region: "internacional", category: "economía",  country: "eeuu"        },
  // ── Internacional — UK ──
  { url: "http://feeds.bbci.co.uk/news/business/rss.xml",          source: "BBC Business",   region: "internacional", category: "economía",  country: "uk"          },
  { url: "https://www.theguardian.com/world/rss",                   source: "The Guardian",   region: "internacional", category: "política",  country: "uk"          },
  { url: "https://www.ft.com/rss/home",                             source: "Financial Times",region: "internacional", category: "economía",  country: "uk"          },
  // ── Internacional — Francia ──
  { url: "https://www.france24.com/es/rss",                         source: "France 24",      region: "internacional", category: "política",  country: "francia"     },
  // ── Internacional — Alemania ──
  { url: "https://rss.dw.com/rdf/rss-es-eco",                      source: "DW Español",     region: "internacional", category: "economía",  country: "alemania"    },
  { url: "https://www.handelsblatt.com/contentexport/feed/top-themen", source: "Handelsblatt",region: "internacional", category: "economía",  country: "alemania"    },
  // ── Internacional — Medio Oriente ──
  { url: "https://www.aljazeera.com/xml/rss/all.xml",              source: "Al Jazeera",     region: "internacional", category: "política",  country: "medio-oriente"},
  { url: "https://www.al-monitor.com/rss.xml",                     source: "Al Monitor",     region: "internacional", category: "política",  country: "medio-oriente"},
  // ── Internacional — Rusia ──
  { url: "https://meduza.io/rss/all",                              source: "Meduza",         region: "internacional", category: "política",  country: "rusia"       },
  { url: "https://www.kommersant.ru/RSS/main.xml",                 source: "Kommersant",     region: "internacional", category: "economía",  country: "rusia"       },
  // ── Internacional — China ──
  { url: "https://thewirechina.com/feed/",                         source: "The Wire China", region: "internacional", category: "economía",  country: "china"       },
  // ── Internacional — Brasil ──
  { url: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",source: "Folha",          region: "internacional", category: "política",  country: "brasil"      },
  { url: "https://www.infomoney.com.br/feed/",                     source: "InfoMoney",      region: "internacional", category: "economía",  country: "brasil"      },
]

// Detección de categoría por keywords en el título
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  finanzas:    ["bolsa", "acciones", "bonos", "bursátil", "merval", "cedear", "dólar", "dolar", "tasas", "bcra", "rofex", "letras", "inflación", "inflacion", "tasa"],
  comercio:    ["exportaciones", "importaciones", "balanza", "arancel", "comercio exterior", "aduana", "trump", "aranceles", "tarifa"],
  energía:     ["petróleo", "petroleo", "gas", "energía", "energia", "litio", "ypf", "combustible", "nafta", "vaca muerta"],
  commodities: ["soja", "maíz", "maiz", "trigo", "girasol", "agro", "cereales", "oleaginosas", "granos", "campo"],
  política:    ["gobierno", "congreso", "senado", "milei", "decreto", "fmi", "elecciones", "legislativo", "ministerio"],
}

function detectCategory(title: string, base: string): string {
  const lower = title.toLowerCase()
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) return cat
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

    items.push({
      id:          Buffer.from(cleanLink).toString("base64").slice(0, 20),
      title:       cleanTitle,
      link:        cleanLink,
      description: desc ? desc.replace(/<[^>]*>/g, "").trim().slice(0, 300) : null,
      source:      feed.source,
      pubDate:     pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      region:      feed.region,
      category:    detectCategory(cleanTitle, feed.category),
      country:     feed.country,
    })
  }

  return items
}

// Cache por instancia (secundario — el CDN de Vercel es la capa primaria)
let _cache: { items: RSSItem[]; ts: number } | null = null
const INSTANCE_TTL = 5 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() - _cache.ts < INSTANCE_TTL) {
    return NextResponse.json(_cache.items, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" },
    })
  }

  const allItems: RSSItem[] = []

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal:  AbortSignal.timeout(8000),
          headers: { "User-Agent": "PanelDeControl/1.0" },
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
  _cache = { items: allItems, ts: Date.now() }

  return NextResponse.json(allItems, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" },
  })
}
