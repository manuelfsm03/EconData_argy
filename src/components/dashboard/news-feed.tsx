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

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.key === category)
  if (!cat || cat.key === "todos") return null
  return (
    <span style={{
      display: "inline-block",
      fontSize: 8,
      fontFamily: "monospace",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: cat.color,
      border: `1px solid ${cat.color}44`,
      borderRadius: 10,
      padding: "1px 5px",
      marginRight: 5,
      verticalAlign: "middle",
      whiteSpace: "nowrap",
    }}>
      {cat.label}
    </span>
  )
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
              <td style={{ color: "#FFA028", fontSize: 12, verticalAlign: "top", paddingTop: 10, paddingBottom: 10 }}>
                {fmtTime(item.pubDate)}
              </td>
              <td style={{ color: "#0068FF", fontSize: 12, verticalAlign: "top", fontWeight: 500, paddingTop: 10, paddingBottom: 10 }}>
                {item.source.toUpperCase().slice(0, 14)}
              </td>
              <td style={{ whiteSpace: "normal", paddingTop: 10, paddingBottom: 10 }}>
                <CategoryBadge category={item.category} />
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.5 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.title}
                </a>
                {expandedId === item.id && item.description && (
                  <div style={{ color: "#888888", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 68px)" }}>
      {/* Filtros de categoría — pill */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          padding: "10px 14px",
          borderBottom: "1px solid #111",
          background: "#050505",
          alignItems: "center",
        }}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                padding: "4px 12px",
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                border: active ? `1px solid ${cat.color}66` : "1px solid #2a2a2a",
                borderRadius: 20,
                background: active ? `${cat.color}18` : "transparent",
                color: active ? cat.color : "#555",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                fontFamily: "monospace",
              }}
            >
              {cat.label}
            </button>
          )
        })}
        <span style={{ marginLeft: "auto", color: "#333", fontSize: 10, fontFamily: "monospace" }}>
          {filtered.length} noticias
        </span>
      </div>

      {/* Dos columnas: Argentina | Internacional */}
      <div style={{ display: "flex", gap: 1, background: "#111111", flex: 1, minHeight: 0 }}>
        {/* Argentina */}
        <div style={{ flex: 1, minWidth: 0, background: "#000000", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <NewsTable
              rows={argentina}
              extra={moreAR}
              loading={loading}
              expandedId={expandedId}
              onToggle={onToggle}
              onMore={() => setMoreAR((n) => n + INITIAL)}
            />
          </div>
        </div>

        {/* Internacional */}
        <div style={{ flex: 1, minWidth: 0, background: "#000000", display: "flex", flexDirection: "column" }}>
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
          {/* Filtro por país — pill */}
          <div style={{ display: "flex", gap: 4, padding: "8px 10px", borderBottom: "1px solid #111", flexWrap: "wrap", background: "#060606" }}>
            {COUNTRIES.map((c) => {
              const active = country === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setCountry(c.key)}
                  style={{
                    padding: "3px 10px",
                    fontSize: 9,
                    fontWeight: active ? 600 : 400,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    border: active ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
                    borderRadius: 20,
                    background: active ? "rgba(255,160,40,0.08)" : "transparent",
                    color: active ? "#FFA028" : "#555",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                    fontFamily: "monospace",
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
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

      {/* EN VIVO */}
      <LiveSection />
    </div>
  )
}
