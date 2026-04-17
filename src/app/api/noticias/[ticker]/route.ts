/**
 * /api/noticias/[ticker] — Noticias por ticker
 *
 * Fuentes:
 *   - Yahoo Finance RSS (para US tickers y ADRs argentinos)
 *   - Infobae Economía RSS filtrado por ticker
 *   - Ámbito RSS filtrado por ticker
 *   - Cronista RSS filtrado por ticker
 *
 * Output estandarizado: { date, source, title, url, ticker }
 */

import { NextRequest, NextResponse } from "next/server"

interface NewsItem {
  id: string
  ticker: string
  title: string
  url: string
  source: string
  date: string
  snippet?: string
}

// RSS Sources
const RSS_SOURCES = [
  { name: "Infobae Economía", url: "https://www.infobae.com/feeds/rss/economia.xml" },
  { name: "Ámbito", url: "https://www.ambito.com/rss/economia.xml" },
  { name: "iProfesional", url: "https://www.iprofesional.com/rss/home.xml" },
]

// Tickers with Yahoo Finance RSS (US listed or ADRs)
const YF_TICKERS: Record<string, string> = {
  MELI: "MELI",
  VIST: "VISTA",
  GLOB: "GLOB",
  GGAL: "GGAL",
  BMA: "BMA",
  BBAR: "BBAR",
  YPF: "YPF",
  CEPU: "CEPU",
  PAM: "PAM",
  TGS: "TGS",
}

// ── In-memory cache ────────────────────────────────────────────────────────────
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

// ── Parse RSS ─────────────────────────────────────────────────────────────────
function parseRSSItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(itemXml)?.[1] ?? "").trim()
    const link = (/<link>(.*?)<\/link>|<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/.exec(itemXml)?.[1] ?? "").trim()
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(itemXml)?.[1] ?? "").trim()
    const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/.exec(itemXml)?.[1] ?? "").trim()
    if (title && link) items.push({ title, link, pubDate, description })
  }

  return items
}

async function fetchYFNews(ticker: string): Promise<NewsItem[]> {
  const yfTicker = YF_TICKERS[ticker] ?? ticker
  const urls = [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${yfTicker}&region=US&lang=en-US`,
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${yfTicker}.BA&region=AR&lang=es-AR`,
  ]

  const results: NewsItem[] = []

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/rss+xml,application/xml,text/xml" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 1800 },
      })
      if (!res.ok) continue
      const xml = await res.text()
      const items = parseRSSItems(xml)

      for (const item of items.slice(0, 10)) {
        results.push({
          id: Buffer.from(item.link).toString("base64").slice(0, 16),
          ticker,
          title: item.title,
          url: item.link,
          source: "Yahoo Finance",
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          snippet: item.description?.replace(/<[^>]*>/g, "").slice(0, 200),
        })
      }
    } catch {
      continue
    }
  }

  return results
}

async function fetchLocalRSSNews(ticker: string): Promise<NewsItem[]> {
  const results: NewsItem[] = []
  const keywords = [ticker.toLowerCase(), tickerToName(ticker)]

  for (const source of RSS_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/rss+xml,text/xml" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue
      const xml = await res.text()
      const items = parseRSSItems(xml)

      for (const item of items) {
        const text = (item.title + " " + item.description).toLowerCase()
        const matches = keywords.some((kw) => kw && text.includes(kw.toLowerCase()))
        if (!matches) continue

        results.push({
          id: Buffer.from(item.link).toString("base64").slice(0, 16),
          ticker,
          title: item.title,
          url: item.link,
          source: source.name,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          snippet: item.description?.replace(/<[^>]*>/g, "").slice(0, 200),
        })
      }
    } catch {
      continue
    }
  }

  return results
}

// Mapeo ticker → nombre para búsqueda en noticias
function tickerToName(ticker: string): string {
  const names: Record<string, string> = {
    GGAL: "Galicia", BMA: "Macro", BBAR: "Frances", SUPV: "Supervielle",
    YPFD: "YPF", PAMP: "Pampa", CEPU: "Central Puerto", EDN: "Edenor",
    TECO2: "Telecom", ALUA: "Aluar", TXAR: "Ternium", LOMA: "Loma Negra",
    MIRG: "Mirgor", IRSA: "IRSA", MELI: "MercadoLibre", BYMA: "BYMA",
    VALO: "Valores", TGSU2: "Transportadora Gas Sur",
  }
  return names[ticker.toUpperCase()] ?? ""
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const tickerUpper = ticker.toUpperCase()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") ?? "20")

  const cacheKey = `noticias_${tickerUpper}`
  const cached = getCached<NewsItem[]>(cacheKey)
  if (cached) {
    return NextResponse.json({ data: cached.slice(0, limit), ticker: tickerUpper, cached: true })
  }

  // Fetch from YF + local RSS in parallel
  const [yfNews, localNews] = await Promise.all([
    fetchYFNews(tickerUpper),
    fetchLocalRSSNews(tickerUpper),
  ])

  // Merge, deduplicate, sort by date desc
  const all = [...yfNews, ...localNews]
  const seen = new Set<string>()
  const deduped = all
    .filter((n) => {
      if (seen.has(n.url)) return false
      seen.add(n.url)
      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  setCached(cacheKey, deduped, 3600) // Cache 1h
  return NextResponse.json({
    data: deduped.slice(0, limit),
    ticker: tickerUpper,
    total: deduped.length,
    updated_at: new Date().toISOString(),
  })
}
