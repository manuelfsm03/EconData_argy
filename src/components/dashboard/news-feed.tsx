"use client"

import { useState, useEffect, useCallback } from "react"

interface NewsItem {
  id: string
  title: string
  link: string
  description?: string | null
  source: string
  pubDate: string
  category?: string | null
}

interface NewsFeedProps {
  items?: NewsItem[]
  title?: string
}

export function NewsFeed({ items: propItems, title = "NOTICIAS — FEED RSS" }: NewsFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rssItems, setRssItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSource, setFilterSource] = useState<string | null>(null)

  const fetchRSS = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/rss-news")
      if (res.ok) {
        const data = await res.json()
        setRssItems(data)
      }
    } catch (error) {
      console.error("Error fetching RSS:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRSS()
    const interval = setInterval(fetchRSS, 5 * 60 * 1000) // 5 min
    return () => clearInterval(interval)
  }, [fetchRSS])

  // Use RSS items, fallback to prop items if RSS is empty
  const items = rssItems.length > 0 ? rssItems : (propItems || [])

  // Get unique sources for filter
  const sources = [...new Set(items.map(i => i.source))]

  const filteredItems = filterSource
    ? items.filter(i => i.source === filterSource)
    : items

  const fmtTime = (date: string) => {
    try {
      const d = new Date(date)
      const now = new Date()
      const diffH = (now.getTime() - d.getTime()) / 3600000
      if (diffH < 24) {
        return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      }
      return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
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
            value={filterSource || ""}
            onChange={(e) => setFilterSource(e.target.value || null)}
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
          <span style={{ color: "#555555", fontWeight: 400, fontSize: "10px" }}>
            {filteredItems.length} noticias
          </span>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "45px" }}>Hora</th>
              <th style={{ width: "120px" }}>Fuente</th>
              <th>Titular</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, i) => (
              <tr
                key={item.id}
                style={{
                  background: expandedId === item.id ? "#0a0a0a" : i % 2 === 0 ? "#000000" : "#060606",
                  cursor: item.description ? "pointer" : "default",
                }}
                onClick={() => item.description && setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <td style={{ color: "#FFA028", fontSize: "10px", verticalAlign: "top" }}>
                  {fmtTime(item.pubDate)}
                </td>
                <td style={{ color: "#0068FF", fontSize: "10px", verticalAlign: "top" }}>
                  {item.source.toUpperCase().slice(0, 18)}
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
                      {item.description}
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "#555555", textAlign: "center", padding: "20px" }}>
                  {loading ? "CARGANDO NOTICIAS RSS..." : "NO HAY NOTICIAS DISPONIBLES"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
