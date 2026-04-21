/**
 * TabGeopolitica — Noticias geopolíticas + impacto Argentina
 *
 * API: /api/geopolitica (RSS feeds públicos)
 *      /api/mundo (Yahoo Finance — indicadores clave)
 *
 * Portado de EconData_argy/js/components/sections/economia/SeccionGeopolitica.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsItem {
  title: string
  link: string
  source: string
  pub: string
  category: string
  color: string
  region: string
  country: string
  summary: string
}

interface GeoFeed {
  items: NewsItem[]
  count: number
  categories: string[]
}

interface QuoteResult {
  precio: number
  variacion_pct: number
  ticker: string
}

// ── Impact rules ───────────────────────────────────────────────────────────────

const IMPACT_RULES: {
  check: (snap: Record<string, QuoteResult | null>) => boolean
  title: string
  detail: string
  sentiment: "positive" | "negative" | "mixed"
}[] = [
  {
    check: (s) => (s?.petroleo?.variacion_pct ?? 0) > 2,
    title: "Petróleo en alza",
    detail: "Positivo para Vaca Muerta y exportaciones energéticas. Posible presión en precios de combustibles internos.",
    sentiment: "mixed",
  },
  {
    check: (s) => (s?.petroleo?.variacion_pct ?? 0) < -2,
    title: "Caída en petróleo",
    detail: "Menor ingreso de divisas por energía. Alivio posible en costos de combustible.",
    sentiment: "mixed",
  },
  {
    check: (s) => (s?.soja?.variacion_pct ?? 0) < -2,
    title: "Caída en soja",
    detail: "Menor ingreso de divisas por exportaciones del agro. Presión sobre reservas del BCRA.",
    sentiment: "negative",
  },
  {
    check: (s) => (s?.soja?.variacion_pct ?? 0) > 2,
    title: "Soja en alza",
    detail: "Mayor ingreso de divisas para el sector agro. Positivo para reservas.",
    sentiment: "positive",
  },
  {
    check: (s) => (s?.vix?.precio ?? 0) > 25,
    title: "Volatilidad global elevada",
    detail: "Risk-off en emergentes. Posible presión sobre bonos AR y tipo de cambio.",
    sentiment: "negative",
  },
  {
    check: (s) => (s?.oro?.variacion_pct ?? 0) > 1.5,
    title: "Oro en alza",
    detail: "Señal de aversión al riesgo global. Puede indicar presión sobre activos emergentes.",
    sentiment: "negative",
  },
]

const SENTIMENT_STYLE = {
  positive: { color: "var(--positive)", icon: "▲" },
  negative: { color: "var(--negative)", icon: "▼" },
  mixed: { color: "var(--amber)", icon: "↔" },
}

const CAT_COLORS: Record<string, string> = {
  conflicto: "#ff4444",
  comercio: "#4488ff",
  energia: "#ffaa00",
  politica: "#8855ff",
  commodities: "#00ff88",
  mercados: "#00cccc",
  general: "#8888aa",
}

// ── Key indicators ─────────────────────────────────────────────────────────────

const GEO_INDICATORS = [
  { key: "petroleo", label: "WTI" },
  { key: "brent", label: "BRENT" },
  { key: "oro", label: "ORO" },
  { key: "soja", label: "SOJA" },
  { key: "trigo", label: "TRIGO" },
  { key: "maiz", label: "MAÍZ" },
  { key: "vix", label: "VIX" },
  { key: "us10y", label: "US 10Y" },
  { key: "dxy", label: "DXY" },
]

function GeoIndicatorCard({ nombre, label, data }: { nombre: string; label: string; data: QuoteResult | null }) {
  const pos = (data?.variacion_pct ?? 0) >= 0
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "8px 10px", flex: "1 1 100px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: "var(--font-data)", fontWeight: 700, color: "var(--text)" }}>
        {data?.precio != null ? data.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
      </div>
      <div style={{ fontSize: 10, fontFamily: "var(--font-data)", color: data ? (pos ? "var(--positive)" : "var(--negative)") : "var(--text-mute)" }}>
        {data?.variacion_pct != null ? `${pos ? "+" : ""}${data.variacion_pct.toFixed(2)}%` : "—"}
      </div>
    </div>
  )
}

// ── News item ──────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const color = CAT_COLORS[item.category] ?? CAT_COLORS.general
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
        padding: "8px 10px",
        textDecoration: "none",
        marginBottom: 1,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            padding: "1px 6px",
            background: color + "22",
            color,
            border: `1px solid ${color}55`,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {item.category}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{item.source}</span>
        <span style={{ fontSize: 9, color: "var(--text-mute)", marginLeft: "auto" }}>{item.region}</span>
      </div>
      <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.4 }}>{item.title}</div>
      {item.pub && <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{item.pub}</div>}
    </a>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const CATS = ["conflicto", "comercio", "energia", "politica", "commodities", "mercados"]
const COUNTRIES = [
  { key: "argentina",    label: "Argentina"   },
  { key: "eeuu",         label: "EEUU"        },
  { key: "uk",           label: "UK"          },
  { key: "francia",      label: "Francia"     },
  { key: "alemania",     label: "Alemania"    },
  { key: "medio-oriente",label: "M. Oriente"  },
  { key: "rusia",        label: "Rusia"       },
  { key: "china",        label: "China"       },
  { key: "brasil",       label: "Brasil"      },
]

export function TabGeopolitica() {
  const [feed, setFeed] = useState<GeoFeed | null>(null)
  const [mundo, setMundo] = useState<Record<string, QuoteResult | null> | null>(null)
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [geoRes, mundoRes] = await Promise.all([
        fetch("/api/geopolitica"),
        fetch("/api/mundo"),
      ])
      if (geoRes.ok) {
        const j = await geoRes.json()
        setFeed(j.data)
        setLastUpdate(j.updated_at)
      }
      if (mundoRes.ok) {
        const j = await mundoRes.json()
        setMundo(j.data)
      }
    } catch (err) {
      console.error("[TabGeopolitica]", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 11, textAlign: "center" }}>
        Cargando noticias geopolíticas (BBC, Al Jazeera, Infobae, Ámbito...)
      </div>
    )
  }

  const snap = mundo ?? {}
  const items = feed?.items ?? []
  const filtered = items.filter((n) => {
    if (catFilter && n.category !== catFilter) return false
    if (countryFilter && n.country !== countryFilter) return false
    return true
  })
  const impacts = IMPACT_RULES.filter((r) => r.check(snap))

  function FilterBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
    return (
      <button
        onClick={onClick}
        style={{
          background: active ? "var(--bg-elev-2)" : "transparent",
          color: active ? (color ?? "var(--amber)") : "var(--text-mute)",
          border: `1px solid ${active ? (color ?? "var(--amber)") : "var(--border)"}`,
          padding: "2px 10px",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <div>
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>🌎 GEOPOLÍTICA &amp; CONTEXTO GLOBAL</span>
        {lastUpdate && (
          <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
            UPD {new Date(lastUpdate).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Key indicators */}
      <div style={{ padding: "3px 8px", background: "var(--bg-elev)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--bg-elev-2)" }}>
        Indicadores clave
      </div>
      <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "var(--bg-elev-2)", padding: 1 }}>
        {GEO_INDICATORS.map(({ key, label }) => (
          <GeoIndicatorCard key={key} nombre={key} label={label} data={snap[key] ?? null} />
        ))}
      </div>

      {/* Main content: news + impact panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 1, marginTop: 1 }}>
        {/* News feed */}
        <div>
          {/* Category filters */}
          <div style={{ padding: "4px 8px", display: "flex", gap: 4, flexWrap: "wrap", background: "var(--bg-elev)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            <FilterBtn active={catFilter === null} onClick={() => setCatFilter(null)}>Todas</FilterBtn>
            {CATS.map((c) => (
              <FilterBtn key={c} active={catFilter === c} onClick={() => setCatFilter(catFilter === c ? null : c)} color={CAT_COLORS[c]}>
                {c}
              </FilterBtn>
            ))}
          </div>
          {/* Country filters */}
          <div style={{ padding: "4px 8px", display: "flex", gap: 4, flexWrap: "wrap", background: "var(--bg-elev)", borderBottom: "1px solid var(--bg-elev-2)" }}>
            <span style={{ fontSize: 9, color: "var(--text-dim)", alignSelf: "center" }}>PAÍS:</span>
            <FilterBtn active={countryFilter === null} onClick={() => setCountryFilter(null)}>Todos</FilterBtn>
            {COUNTRIES.map((c) => (
              <FilterBtn key={c.key} active={countryFilter === c.key} onClick={() => setCountryFilter(countryFilter === c.key ? null : c.key)}>
                {c.label}
              </FilterBtn>
            ))}
          </div>

          <div style={{ maxHeight: 600, overflowY: "auto", padding: 1, background: "var(--bg-elev)" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 11 }}>
                {items.length === 0 ? "Cargando noticias..." : "Sin resultados para este filtro."}
              </div>
            ) : (
              filtered.map((n, i) => <NewsCard key={i} item={n} />)
            )}
          </div>
          <div style={{ padding: "3px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
            {filtered.length} noticias · BBC, Al Jazeera, France24, Infobae, Ámbito, Cronista
          </div>
        </div>

        {/* Impact panel */}
        <div>
          <div style={{ padding: "4px 8px", background: "var(--bg-elev)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--bg-elev-2)" }}>
            Impacto Argentina
          </div>
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {impacts.length === 0 ? (
              <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 11 }}>
                Sin alertas destacadas. Mercados en rango normal.
              </div>
            ) : (
              impacts.map((rule, i) => {
                const s = SENTIMENT_STYLE[rule.sentiment]
                return (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      borderLeft: `3px solid ${s.color}`,
                      background: "var(--bg)",
                      borderBottom: "1px solid var(--bg-elev-2)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 11, color: s.color }}>
                      {s.icon} {rule.title}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>
                      {rule.detail}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
