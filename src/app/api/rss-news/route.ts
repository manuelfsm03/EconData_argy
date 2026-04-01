import { NextResponse } from "next/server"

interface RSSItem {
  id: string
  title: string
  link: string
  description: string | null
  source: string
  pubDate: string
}

const RSS_FEEDS = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito" },
  { url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Finanzas" },
  { url: "https://www.infobae.com/feeds/rss/economia/", source: "Infobae" },
  { url: "https://www.cronista.com/rss/", source: "El Cronista" },
  { url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional" },
  { url: "https://www.baenegocios.com/rss", source: "BAE Negocios" },
]

// Simple XML item extractor (no dependency needed)
function extractItems(xml: string, source: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = content.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || content.match(/<title>(.*?)<\/title>/)?.[1] || ""
    const link = content.match(/<link><!\[CDATA\[(.*?)\]\]>|<link>(.*?)<\/link>/)?.[1] || content.match(/<link>(.*?)<\/link>/)?.[1] || ""
    const desc = content.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/)?.[1] || content.match(/<description>(.*?)<\/description>/)?.[1] || null
    const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ""

    if (title && link) {
      items.push({
        id: Buffer.from(link).toString("base64").slice(0, 20),
        title: title.replace(/<[^>]*>/g, "").trim(),
        link: link.trim(),
        description: desc ? desc.replace(/<[^>]*>/g, "").trim().slice(0, 300) : null,
        source,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      })
    }
  }

  return items
}

// Cache
let cache: { items: RSSItem[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  // Return cache if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.items, {
      headers: { "Cache-Control": "public, max-age=300" },
    })
  }

  const allItems: RSSItem[] = []

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "PanelDeControl/1.0" },
        })
        if (!res.ok) return
        const xml = await res.text()
        const items = extractItems(xml, feed.source)
        allItems.push(...items.slice(0, 15)) // Max 15 per feed
      } catch {
        // Skip failed feeds silently
      }
    })
  )

  // Sort by date descending
  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  // Update cache
  cache = { items: allItems, timestamp: Date.now() }

  return NextResponse.json(allItems, {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
