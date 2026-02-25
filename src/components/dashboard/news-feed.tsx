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

export function NewsFeed({ title = "NOTICIAS" }: { title?: string }) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/rss-news")
      if (res.ok) {
        const data: NewsItem[] = await res.json()
        setItems(data)
      }
    } catch (e) {
      console.error("Error fetching news:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNews])

  const filtered = sourceFilter ? items.filter(i => i.source === sourceFilter) : items
  const sources = [...new Set(items.map(i => i.source))]

  const fmtTime = (date: string) => {
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
            onClick={fetchNews}
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
            {filtered.length} noticias
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
            {filtered.map((item, i) => (
              <tr
                key={item.id}
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
                      {item.description.replace(/<[^>]*>/g, "").slice(0, 400)}
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
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
