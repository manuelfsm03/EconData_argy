import { NextResponse } from "next/server"

interface RSSItem {
  id: string
  title: string
  link: string
  description: string | null
  source: string
  pubDate: string
  category: string | null
}

const RSS_FEEDS = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito" },
  { url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Fin." },
  { url: "https://www.infobae.com/feeds/rss/economia/", source: "Infobae" },
  { url: "https://www.cronista.com/rss/", source: "Cronista" },
  { url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional" },
  { url: "https://www.baenegocios.com/rss", source: "BAE" },
]

function parseRSS(xml: string, source: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2]
    if (!block) continue

    const getTag = (tag: string): string => {
      const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i")
      const cdataMatch = block.match(cdataRegex)
      if (cdataMatch) return cdataMatch[1].trim()

      const simpleRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
      const simpleMatch = block.match(simpleRegex)
      if (simpleMatch) return simpleMatch[1].trim()

      if (tag === "link") {
        const hrefRegex = /<link[^>]*href="([^"]*)"[^>]*\/?>/i
        const hrefMatch = block.match(hrefRegex)
        if (hrefMatch) return hrefMatch[1]
      }

      return ""
    }

    const title = getTag("title")
    const link = getTag("link")
    const description = getTag("description") || getTag("summary") || getTag("content")
    const pubDate = getTag("pubDate") || getTag("published") || getTag("updated") || getTag("dc:date")
    const category = getTag("category")

    if (title && link) {
      items.push({
        id: `rss-${Buffer.from(link).toString("base64url").slice(0, 24)}`,
        title: title.replace(/<[^>]*>/g, "").trim(),
        link,
        description: description ? description.replace(/<[^>]*>/g, "").slice(0, 500) : null,
        source,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category: category ? category.replace(/<[^>]*>/g, "") : null,
      })
    }
  }

  return items.slice(0, 20)
}

// In-memory cache
let cache: { items: RSSItem[]; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchAllFeeds(): Promise<RSSItem[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.items
  }

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PanelDeControl/1.0)",
          Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return []
      const xml = await res.text()
      return parseRSS(xml, feed.source)
    })
  )

  const allItems: RSSItem[] = []
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value)
  }
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  cache = { items: allItems, ts: Date.now() }
  return allItems
}

export async function GET() {
  try {
    const items = await fetchAllFeeds()
    return NextResponse.json(items, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (error) {
    console.error("RSS news error:", error)
    return NextResponse.json([], { status: 500 })
  }
}
