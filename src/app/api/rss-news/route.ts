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
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito Economía" },
  { url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Finanzas" },
  { url: "https://www.infobae.com/feeds/rss/economia/", source: "Infobae" },
  { url: "https://www.cronista.com/files/rss/apertura.xml", source: "El Cronista" },
  { url: "https://www.baenegocios.com/rss", source: "BAE Negocios" },
]

// Simple XML tag extractor (no dependency needed)
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  if (!match) return ""
  return (match[1] || match[2] || "").trim()
}

function parseRSS(xml: string, source: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = extractTag(itemXml, "title")
    const link = extractTag(itemXml, "link")
    const description = extractTag(itemXml, "description")
    const pubDate = extractTag(itemXml, "pubDate")
    const category = extractTag(itemXml, "category")

    if (title && link) {
      items.push({
        id: Buffer.from(link).toString("base64").slice(0, 32),
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/<[^>]+>/g, ""),
        link,
        description: description ? description.replace(/<[^>]+>/g, "").slice(0, 300) : null,
        source,
        pubDate: pubDate || new Date().toISOString(),
        category: category || null,
      })
    }
  }

  return items
}

// In-memory cache
let cache: { items: RSSItem[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.items)
  }

  const allItems: RSSItem[] = []

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0 PanelDeControl/1.0" },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return
        const xml = await res.text()
        const items = parseRSS(xml, feed.source)
        allItems.push(...items)
      } catch {
        // Skip failed feeds
      }
    })
  )

  // Sort by date descending
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Limit to 100 items
  const result = allItems.slice(0, 100)

  // Update cache
  cache = { items: result, timestamp: Date.now() }

  return NextResponse.json(result)
}
