import { NextRequest, NextResponse } from "next/server"

// Simple RSS XML parser
function parseRSS(xml: string, source: string): Array<{
  id: string
  title: string
  link: string
  description: string | null
  source: string
  pubDate: string
  category: string | null
}> {
  const items: Array<{
    id: string
    title: string
    link: string
    description: string | null
    source: string
    pubDate: string
    category: string | null
  }> = []

  // Match <item> or <entry> blocks
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1] || match[2]
    if (!block) continue

    const getTag = (tag: string): string => {
      // Handle CDATA
      const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i")
      const cdataMatch = block.match(cdataRegex)
      if (cdataMatch) return cdataMatch[1].trim()

      const simpleRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
      const simpleMatch = block.match(simpleRegex)
      if (simpleMatch) return simpleMatch[1].trim()

      // Atom link with href attribute
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
        id: `rss-${Buffer.from(link).toString("base64").slice(0, 20)}`,
        title: title.replace(/<[^>]*>/g, ""),
        link,
        description: description ? description.replace(/<[^>]*>/g, "").slice(0, 500) : null,
        source,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category: category || null,
      })
    }
  }

  return items.slice(0, 20) // Limit to 20 items per feed
}

// Allowed RSS feed domains
const ALLOWED_DOMAINS = [
  "ambito.com",
  "cronista.com",
  "infobae.com",
  "iprofesional.com",
  "bloomberglinea.com",
  "lanacion.com.ar",
  "clarin.com",
  "baenegocios.com",
  "eleconomista.com.ar",
  "perfil.com",
]

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Validate domain
  try {
    const parsedUrl = new URL(url)
    const isAllowed = ALLOWED_DOMAINS.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))
    if (!isAllowed) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PanelDeControl/1.0; +https://terminal.solulith.com)",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Feed returned ${response.status}` }, { status: 502 })
    }

    const xml = await response.text()
    const source = new URL(url).hostname.replace("www.", "").split(".")[0]
    const items = parseRSS(xml, source)

    return NextResponse.json(items, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("RSS proxy error:", error)
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 502 })
  }
}
