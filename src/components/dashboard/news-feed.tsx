"use client"

import { useState, useEffect, useCallback } from "react"

interface NewsItem {
  id: string
  title: string
  link: string
  description?: string | null
  source: string
  pubDate: Date | string
  category?: string | null
}

interface NewsFeedProps {
  items?: NewsItem[]
  title?: string
}

// RSS feeds to fetch directly (Argentine financial news)
const RSS_FEEDS = [
  { url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito" },
  { url: "https://www.cronista.com/files/rss/apertura.xml", source: "Cronista" },
  { url: "https://www.infobae.com/feeds/rss/", source: "Infobae" },
  { url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional" },
  { url: "https://www.bloomberglinea.com/arc/outboundfeeds/rss/?outputType=xml", source: "Bloomberg Línea" },
]

async function fetchRSSViaProxy(feedUrl: string, source: string): Promise<NewsItem[]> {
  try {
    // Use a CORS proxy or our own API route
    const res = await fetch(`/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const items: NewsItem[] = await res.json()
    return items.map(item => ({ ...item, source }))
  } catch {
    return []
  }
}

export function NewsFeed({ items: propItems, title = "NOTICIAS" }: NewsFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rssItems, setRssItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const fetchAllFeeds = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        RSS_FEEDS.map(feed => fetchRSSViaProxy(feed.url, feed.source))
      )
      const allItems: NewsItem[] = []
      for (const result of results) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value)
        }
      }
      // Sort by date descending
      allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      setRssItems(allItems)
    } catch (error) {
      console.error("Error fetching RSS:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllFeeds()
    const interval = setInterval(fetchAllFeeds, 5 * 60 * 1000) // Refresh every 5 min
    return () => clearInterval(interval)
  }, [fetchAllFeeds])

  // Combine prop items (from DB) with RSS items
  const allItems = [...(propItems || []), ...rssItems]
  const filteredItems = sourceFilter
    ? allItems.filter(item => item.source === sourceFilter)
    : allItems

  // Get unique sources for filter
  const sources = [...new Set(allItems.map(item => item.source))]

  const fmtTime = (date: Date | string) => {
    try {
      return new Date(date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    } catch {
      return "--:--"
    }
  }

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <select
            value={sourceFilter || ""}
            onChange={(e) => setSourceFilter(e.target.value || null)}
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              color: "#888",
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
            }}
          >
            <option value="">Todas las fuentes</option>
            {sources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={fetchAllFeeds}
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              color: "#0068FF",
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "2px",
              cursor: "pointer",
            }}
          >
            ↻
          </button>
          <span style={{ color: "#555555", fontWeight: 400, fontSize: "10px" }}>
            {filteredItems.length} noticias
          </span>
        </div>
      </div>
      
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>Time</th>
              <th style={{ width: "100px" }}>Source</th>
              <th>Headline</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, i) => (
              <tr
                key={item.id || `rss-${i}`}
                style={{
                  background: expandedId === item.id ? "#0a0a0a" : i % 2 === 0 ? "#000000" : "#060606",
                  cursor: item.description ? "pointer" : "default",
                }}
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <td style={{ color: "#FFA028", fontSize: "10px", verticalAlign: "top" }}>
                  {fmtTime(item.pubDate)}
                </td>
                <td style={{ color: "#0068FF", fontSize: "10px", verticalAlign: "top" }}>
                  {item.source.toUpperCase().slice(0, 16)}
                </td>
                <td style={{ whiteSpace: "normal" }}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: "#FFFFFF", fontSize: "11px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.title}
                  </a>
                  {item.category && (
                    <span style={{ color: "#555555", fontSize: "9px", marginLeft: "8px" }}>
                      [{item.category.toUpperCase()}]
                    </span>
                  )}
                  {expandedId === item.id && item.description && (
                    <div style={{ color: "#888888", fontSize: "10px", marginTop: "4px", lineHeight: "1.4" }}>
                      {item.description.replace(/<[^>]*>/g, '').slice(0, 400)}
                      {(item.description?.length || 0) > 400 && "..."}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "#555555", textAlign: "center", padding: "20px" }}>
                  {loading ? "CARGANDO FEEDS RSS..." : "NO HAY NOTICIAS DISPONIBLES"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
