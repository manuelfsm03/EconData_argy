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
  { key: "economía",    label: "Economía",    color: "var(--sky)" },
  { key: "finanzas",    label: "Finanzas",    color: "var(--yellow)" },
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

function getDayKey(pubDate: string): string {
  const d = new Date(pubDate)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Prioridad de categorías para seleccionar las más importantes del día
const CAT_PRIORITY: Record<string, number> = {
  economía: 1, finanzas: 2, comercio: 3, energía: 4, commodities: 5, política: 6,
}

function pickTopItems(items: RSSItem[], n: number): RSSItem[] {
  // Deduplicar por fuente (max 1 por fuente), luego priorizar por categoría
  const seen = new Set<string>()
  const deduped = items.filter((item) => {
    if (seen.has(item.source)) return false
    seen.add(item.source)
    return true
  })
  return deduped
    .sort((a, b) => (CAT_PRIORITY[a.category] ?? 9) - (CAT_PRIORITY[b.category] ?? 9))
    .slice(0, n)
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

function CalendarTimelineView({ items, loading }: { items: RSSItem[]; loading: boolean }) {
  const today = new Date()
  const [navYear, setNavYear]   = useState(today.getFullYear())
  const [navMonth, setNavMonth] = useState(today.getMonth()) // 0-indexed

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-data)" }}>
        CARGANDO NOTICIAS...
      </div>
    )
  }

  // Group items by day key
  const grouped = items.reduce<Record<string, RSSItem[]>>((acc, item) => {
    const key = getDayKey(item.pubDate)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  // Build calendar grid for the displayed month
  const firstDay = new Date(navYear, navMonth, 1)
  const lastDay  = new Date(navYear, navMonth + 1, 0)
  const startDow = firstDay.getDay() // 0=Sun
  const totalDays = lastDay.getDate()

  // Fill cells: leading empty + day cells + trailing empty
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = getDayKey(today.toISOString())
  const monthLabel = `${MONTHS_ES[navMonth].toUpperCase()} ${navYear}`

  const prevMonth = () => {
    if (navMonth === 0) { setNavYear(y => y - 1); setNavMonth(11) }
    else setNavMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (navMonth === 11) { setNavYear(y => y + 1); setNavMonth(0) }
    else setNavMonth(m => m + 1)
  }

  const CELL_H = 120

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Month navigation */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-row-alt)", flexShrink: 0,
      }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, padding: "0 8px" }}>‹</button>
        <span style={{ fontSize: 12, fontFamily: "var(--font-data)", fontWeight: 700, color: "var(--amber)", letterSpacing: "0.1em" }}>
          {monthLabel}
        </span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, padding: "0 8px" }}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", padding: "5px 0", fontSize: 9, fontFamily: "var(--font-data)", color: "var(--text-mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div key={`empty-${idx}`} style={{
                  minHeight: CELL_H, borderRight: "1px solid var(--bg-elev-2)", borderBottom: "1px solid var(--bg-elev-2)",
                  background: "var(--bg)",
                }} />
              )
            }

            const cellKey = `${navYear}-${String(navMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const isToday = cellKey === todayKey
            const dayItems = grouped[cellKey] ?? []
            const top = pickTopItems(dayItems, 3)

            return (
              <div key={cellKey} style={{
                minHeight: CELL_H,
                borderRight: "1px solid var(--bg-elev-2)",
                borderBottom: "1px solid var(--bg-elev-2)",
                background: isToday ? "#0d0800" : "var(--bg)",
                padding: "6px 7px",
                position: "relative",
                verticalAlign: "top",
              }}>
                {/* Day number */}
                <div style={{ textAlign: "right", marginBottom: 5 }}>
                  {isToday ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 20, height: 20, borderRadius: "50%",
                      background: "var(--amber)", color: "var(--bg)",
                      fontSize: 10, fontFamily: "var(--font-data)", fontWeight: 700,
                    }}>{day}</span>
                  ) : (
                    <span style={{ fontSize: 10, fontFamily: "var(--font-data)", color: "var(--text-mute)" }}>{day}</span>
                  )}
                </div>

                {/* Top news items */}
                {top.map((item, i) => {
                  const cat = CATEGORIES.find((c) => c.key === item.category)
                  const color = cat?.color ?? "var(--text-dim)"
                  return (
                    <a
                      key={item.id + i}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.title}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 4,
                        marginBottom: 4, textDecoration: "none",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget.querySelector("span.ttl") as HTMLElement).style.color = "var(--amber)" }}
                      onMouseLeave={(e) => { (e.currentTarget.querySelector("span.ttl") as HTMLElement).style.color = "#ccc" }}
                    >
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%", background: color,
                        flexShrink: 0, marginTop: 3,
                      }} />
                      <span className="ttl" style={{
                        fontSize: 9, lineHeight: 1.35, color: "#ccc",
                        overflow: "hidden", display: "-webkit-box",
                        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        transition: "color 0.1s",
                      }}>
                        {item.title}
                      </span>
                    </a>
                  )
                })}

                {/* Overflow count */}
                {dayItems.length > 3 && (
                  <div style={{ fontSize: 8, color: "var(--text-mute)", fontFamily: "var(--font-data)", marginTop: 2 }}>
                    +{dayItems.length - 3} más
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.key === category)
  if (!cat || cat.key === "todos") return null
  return (
    <span style={{
      display: "inline-block",
      fontSize: 8,
      fontFamily: "var(--font-data)",
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
                background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
                cursor: item.description ? "pointer" : "default",
              }}
              onClick={() => item.description && onToggle(item.id)}
            >
              <td style={{ color: "var(--amber)", fontSize: 12, verticalAlign: "top", paddingTop: 10, paddingBottom: 10 }}>
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
                  style={{ color: "var(--text)", fontSize: 13, lineHeight: 1.5 }}
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
              <td colSpan={3} style={{ color: "var(--text-mute)", textAlign: "center", padding: 20 }}>
                {loading ? "CARGANDO NOTICIAS..." : "SIN RESULTADOS"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {remaining > 0 && (
        <div style={{ padding: "6px 12px", borderTop: "1px solid var(--bg-elev-2)" }}>
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
  const [viewMode, setViewMode]     = useState<"lista" | "calendario">("lista")

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

  const timelineItems = [...filtered]
    .filter((i) => country === "todos" || i.region === "argentina" || i.country === country)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

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
          borderBottom: "1px solid var(--bg-elev-2)",
          background: "var(--bg)",
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
                border: active ? `1px solid ${cat.color}66` : "1px solid var(--border)",
                borderRadius: 20,
                background: active ? `${cat.color}18` : "transparent",
                color: active ? cat.color : "var(--text-mute)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                fontFamily: "var(--font-data)",
              }}
            >
              {cat.label}
            </button>
          )
        })}
        <span style={{ marginLeft: "auto", color: "var(--text-mute)", fontSize: 10, fontFamily: "var(--font-data)" }}>
          {filtered.length} noticias
        </span>
        <span style={{ width: 1, height: 14, background: "var(--border)", flexShrink: 0 }} />
        {(["lista", "calendario"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              fontSize: 9, padding: "3px 8px",
              textTransform: "uppercase", letterSpacing: 1,
              border: "none",
              background: viewMode === mode ? "var(--amber)" : "transparent",
              color: viewMode === mode ? "var(--bg)" : "var(--text-mute)",
              cursor: "pointer", fontFamily: "var(--font-data)", borderRadius: 2,
            }}
          >
            {mode === "lista" ? "≡ LISTA" : "📅 CALENDARIO"}
          </button>
        ))}
      </div>

      {/* Calendar view */}
      {viewMode === "calendario" && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--bg)" }}>
          <CalendarTimelineView items={timelineItems} loading={loading} />
        </div>
      )}

      {/* Dos columnas: Argentina | Internacional */}
      {viewMode === "lista" && <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", flex: 1, minHeight: 0 }}>
        {/* Argentina */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            className="bbg-panel-header"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ color: activeCat?.color ?? "var(--sky)" }}>▐</span>
            ARGENTINA
            <span style={{ marginLeft: "auto", color: "var(--border-hi)", fontWeight: 400 }}>
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
        <div style={{ flex: 1, minWidth: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
          <div
            className="bbg-panel-header"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ color: activeCat?.color ?? "var(--amber)" }}>▐</span>
            INTERNACIONAL
            <span style={{ marginLeft: "auto", color: "var(--border-hi)", fontWeight: 400 }}>
              {internacional.length}
            </span>
          </div>
          {/* Filtro por país — pill */}
          <div style={{ display: "flex", gap: 4, padding: "8px 10px", borderBottom: "1px solid var(--bg-elev-2)", flexWrap: "wrap", background: "var(--bg)" }}>
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
                    border: active ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
                    borderRadius: 20,
                    background: active ? "rgba(255,160,40,0.08)" : "transparent",
                    color: active ? "var(--amber)" : "var(--text-mute)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-data)",
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
      </div>}

      {/* EN VIVO */}
      <LiveSection />
    </div>
  )
}
