"use client"

import { useState, useEffect, useCallback } from "react"
import { LiveSection } from "./live-section"

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

const COUNTRIES = [
  { key: "todos",        label: "Todos"        },
  { key: "eeuu",         label: "EEUU"         },
  { key: "uk",           label: "UK"           },
  { key: "francia",      label: "Francia"      },
  { key: "alemania",     label: "Alemania"     },
  { key: "medio-oriente",label: "M. Oriente"   },
  { key: "rusia",        label: "Rusia"        },
  { key: "china",        label: "China"        },
  { key: "brasil",       label: "Brasil"       },
]

const CATEGORIES = [
  { key: "todos",       label: "Todos",       color: "#888888" },
  { key: "economía",    label: "Economía",    color: "#4FC3F7" },
  { key: "finanzas",    label: "Finanzas",    color: "#FFD54F" },
  { key: "política",    label: "Política",    color: "#ce93d8" },
  { key: "comercio",    label: "Comercio",    color: "#4488ff" },
  { key: "energía",     label: "Energía",     color: "#ffaa00" },
  { key: "commodities", label: "Commodities", color: "#81c784" },
]

const INITIAL = 8

function fmtTime(d: string): string {
  try {
    return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "--:--"
  }
}

interface NewsTableProps {
  rows: RSSItem[]
  extra: number
  loading: boolean
  expandedId: string | null
  onToggle: (id: string) => void
  onMore: () => void
}

function NewsTable({ rows, extra, loading, expandedId, onToggle, onMore }: NewsTableProps) {
  const visible   = rows.slice(0, INITIAL + extra)
  const remaining = rows.length - visible.length

  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>Hora</th>
            <th style={{ width: 100 }}>Fuente</th>
            <th>Titular</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, i) => (
            <tr
              key={item.id + i}
              style={{
                background: i % 2 === 0 ? "#000000" : "#060606",
                cursor: item.description ? "pointer" : "default",
              }}
              onClick={() => item.description && onToggle(item.id)}
            >
              <td style={{ color: "#FFA028", fontSize: 10, verticalAlign: "top" }}>
                {fmtTime(item.pubDate)}
              </td>
              <td style={{ color: "#0068FF", fontSize: 10, verticalAlign: "top", fontWeight: 500 }}>
                {item.source.toUpperCase().slice(0, 14)}
              </td>
              <td style={{ whiteSpace: "normal" }}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#FFFFFF", fontSize: 11 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.title}
                </a>
                {expandedId === item.id && item.description && (
                  <div style={{ color: "#888888", fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                )}
              </td>
            </tr>
          ))}

          {visible.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "#555555", textAlign: "center", padding: 20 }}>
                {loading ? "CARGANDO NOTICIAS..." : "SIN RESULTADOS"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {remaining > 0 && (
        <div style={{ padding: "6px 12px", borderTop: "1px solid #111111" }}>
          <button
            onClick={onMore}
            style={{
              color: "#0068FF",
              fontSize: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Ver {remaining} más ▼
          </button>
        </div>
      )}
    </>
  )
}

export function NewsFeed() {
  const [items, setItems]           = useState<RSSItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [category, setCategory]     = useState("todos")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [moreAR, setMoreAR]         = useState(0)
  const [moreIN, setMoreIN]         = useState(0)
  const [country, setCountry]       = useState("todos")

  const fetchRSS = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/rss-news")
      if (res.ok) setItems(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchRSS()
    const t = setInterval(fetchRSS, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchRSS])

  // Resetear paginación al cambiar filtros
  useEffect(() => { setMoreAR(0); setMoreIN(0) }, [category, country])

  const onToggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  const filtered      = category === "todos" ? items : items.filter((i) => i.category === category)
  const argentina     = filtered.filter((i) => i.region === "argentina")
  const internacional = filtered
    .filter((i) => i.region === "internacional")
    .filter((i) => country === "todos" || i.country === country)

  const activeCat = CATEGORIES.find((c) => c.key === category)

  return (
    <div>
      {/* EN VIVO */}
      <LiveSection />

      {/* Tabs de categoría */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #1a1a1a",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            style={{
              padding: "5px 14px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              border: "none",
              borderBottom: category === cat.key ? `2px solid ${cat.color}` : "2px solid transparent",
              background: "none",
              color: category === cat.key ? cat.color : "#444444",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "color 0.15s",
            }}
          >
            {cat.label}
          </button>
        ))}
        <span
          style={{
            marginLeft: "auto",
            color: "#333333",
            fontSize: 10,
            padding: "5px 12px",
            alignSelf: "center",
            whiteSpace: "nowrap",
          }}
        >
          {filtered.length} noticias
        </span>
      </div>

      {/* Dos columnas: Argentina | Internacional */}
      <div style={{ display: "flex", gap: 1, background: "#111111" }}>
        {/* Argentina */}
        <div style={{ flex: 1, minWidth: 0, background: "#000000" }}>
          <div
            className="bbg-panel-header"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ color: activeCat?.color ?? "#4FC3F7" }}>▐</span>
            ARGENTINA
            <span style={{ marginLeft: "auto", color: "#333333", fontWeight: 400 }}>
              {argentina.length}
            </span>
          </div>
          <NewsTable
            rows={argentina}
            extra={moreAR}
            loading={loading}
            expandedId={expandedId}
            onToggle={onToggle}
            onMore={() => setMoreAR((n) => n + INITIAL)}
          />
        </div>

        {/* Internacional */}
        <div style={{ flex: 1, minWidth: 0, background: "#000000" }}>
          <div
            className="bbg-panel-header"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ color: activeCat?.color ?? "#FFA028" }}>▐</span>
            INTERNACIONAL
            <span style={{ marginLeft: "auto", color: "#333333", fontWeight: 400 }}>
              {internacional.length}
            </span>
          </div>
          {/* Filtro por país */}
          <div style={{ display: "flex", gap: 2, padding: "4px 8px", borderBottom: "1px solid #111", flexWrap: "wrap", background: "#050505" }}>
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCountry(c.key)}
                style={{
                  padding: "2px 8px",
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  border: "none",
                  borderBottom: country === c.key ? "2px solid #FFA028" : "2px solid transparent",
                  background: "none",
                  color: country === c.key ? "#FFA028" : "#444",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <NewsTable
            rows={internacional}
            extra={moreIN}
            loading={loading}
            expandedId={expandedId}
            onToggle={onToggle}
            onMore={() => setMoreIN((n) => n + INITIAL)}
          />
        </div>
      </div>
    </div>
  )
}
