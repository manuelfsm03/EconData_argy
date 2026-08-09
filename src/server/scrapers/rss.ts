import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import Parser from "rss-parser"

interface RSSFeed {
  name: string
  url: string
  category: string
}

const RSS_FEEDS: RSSFeed[] = [
  {
    name: "Ambito Financiero",
    url: "https://www.ambito.com/rss/economia.xml",
    category: "economia",
  },
  {
    name: "Infobae",
    url: "https://www.infobae.com/arc/outboundfeeds/rss/",
    category: "economia",
  },
  {
    name: "El Cronista",
    url: "https://www.cronista.com/files/rss/news.xml",
    category: "mercados",
  },
  {
    name: "iProfesional",
    url: "https://www.iprofesional.com/rss/finanzas",
    category: "finanzas",
  },
  {
    name: "La Nacion",
    url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/",
    category: "economia",
  },
  {
    name: "Perfil",
    url: "http://www.perfil.com/feed/economia",
    category: "economia",
  },
  {
    name: "El Economista",
    url: "https://www.eleconomista.com.ar/feed/",
    category: "economia",
  },
  {
    name: "BAE Negocios",
    url: "https://www.baenegocios.com/feed/",
    category: "mercados",
  },
]

export class RSSScraper extends BaseScraper {
  private parser: Parser

  constructor() {
    super("rss")
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PanelDeControl/1.0)",
      },
    })
  }

  async scrape(): Promise<ScrapeResult> {
    let recordsAdded = 0
    const errors: string[] = []

    for (const feed of RSS_FEEDS) {
      try {
        const result = await this.scrapeFeed(feed)
        recordsAdded += result
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        errors.push(`${feed.name}: ${message}`)
        console.error(`Error scraping ${feed.name}:`, error)
      }
    }

    return {
      success: errors.length === 0,
      recordsAdded,
      message: errors.length > 0 ? `Errors: ${errors.join("; ")}` : `Scraped ${recordsAdded} news items`,
    }
  }

  private cleanDescription(raw: string | undefined): string | null {
    if (!raw) return null
    // Strip script tags and their content, then trim
    const cleaned = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/\(function\([^)]*\)\{[\s\S]*?\}\)\([\s\S]*?\);?/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()
    return cleaned || null
  }

  private async scrapeFeed(feed: RSSFeed): Promise<number> {
    let added = 0

    try {
      const parsed = await this.parser.parseURL(feed.url)

      for (const item of parsed.items.slice(0, 20)) {
        if (!item.link || !item.title) continue

        const description = this.cleanDescription(item.contentSnippet || item.content)

        try {
          await prisma.newsItem.upsert({
            where: { link: item.link },
            update: {
              title: item.title,
              description,
              pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
            },
            create: {
              title: item.title,
              link: item.link,
              description,
              source: feed.name,
              pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
              category: feed.category,
            },
          })
          added++
        } catch {
          // Skip duplicates or invalid items
        }
      }
    } catch (error) {
      throw error
    }

    return added
  }
}
