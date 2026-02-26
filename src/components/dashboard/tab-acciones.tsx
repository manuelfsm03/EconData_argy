"use client"

/**
 * TabAcciones — Screener de acciones argentinas (Merval)
 * Inspirado en estilo Bloomberg/Perplexity Terminal
 *
 * Sub-tabs:
 *   - Screener: tabla por categorías
 *   - Peer Comparison: tabla comparativa por sector
 *   - Detalle: gráfico histórico + info de una acción
 *   - Noticias: noticias por ticker
 */

import { useState, useEffect, useCallback } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────
interface StockQuote {
  ticker: string
  category: string
  lastPrice: number | null
  closePrice: number | null
  openPrice: number | null
  change1D: number | null
  volume: number | null
  bid: number | null
  ask: number | null
}

interface StockDetail {
  ticker: string
  yfSymbol: string
  lastPrice: number | null
  closePrice: number | null
  change1D: number | null
  change1DPct: number | null
  high52w: number | null
  low52w: number | null
  volume: number | null
  avgVolume: number | null
  currency: string
  history: Array<{ date: string; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null }>
}

interface NewsItem {
  id: string
  ticker: string
  title: string
  url: string
  source: string
  date: string
  snippet?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—"
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"
}
function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—"
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B"
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M"
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K"
  return v.toFixed(0)
}
function changeColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v > 0 ? "#4AF6C3" : v < 0 ? "#FF433D" : "#888"
}

// ── SubTabs ───────────────────────────────────────────────────────────────────
function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222" }}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? "#0d0d0d" : "transparent",
          color: active === t.key ? "#FFA028" : "#555",
          border: "none",
          borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
          padding: "6px 14px", fontSize: 10,
          textTransform: "uppercase", letterSpacing: 1, cursor: "pointer",
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ── Screener view ─────────────────────────────────────────────────────────────
type SortKey = "ticker" | "lastPrice" | "change1D" | "volume"
type SortDir = "asc" | "desc"

function ScreenerCategory({ cat, stocks, onSelect }: {
  cat: string; stocks: StockQuote[]; onSelect: (t: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>("change1D")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [collapsed, setCollapsed] = useState(false)

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("desc") }
  }

  const sorted = [...stocks].sort((a, b) => {
    if (sortKey === "ticker") {
      return sortDir === "asc" ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)
    }
    const va = (a[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)) as number
    const vb = (b[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)) as number
    return sortDir === "asc" ? va - vb : vb - va
  })

  const positives = stocks.filter((s) => (s.change1D ?? 0) > 0).length
  const negatives = stocks.filter((s) => (s.change1D ?? 0) < 0).length

  function SortTh({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) {
    return (
      <th onClick={() => handleSort(k)} style={{
        padding: "3px 8px", fontSize: 9, color: sortKey === k ? "#FFA028" : "#555",
        textAlign: align, cursor: "pointer", borderBottom: "1px solid #1a1a1a",
        userSelect: "none", whiteSpace: "nowrap",
      }}>
        {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    )
  }

  return (
    <div style={{ marginBottom: 1 }}>
      {/* Category header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          padding: "5px 10px", background: "#0d0d0d",
          borderBottom: "1px solid #1a1a1a", borderLeft: "3px solid #FFA028",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 10, color: "#FFA028", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{cat}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#4AF6C3" }}>{positives}↑</span>
          <span style={{ fontSize: 9, color: "#FF433D" }}>{negatives}↓</span>
          <span style={{ fontSize: 9, color: "#555" }}>{collapsed ? "▼" : "▲"}</span>
        </div>
      </div>

      {!collapsed && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <SortTh k="ticker" label="Ticker" align="left" />
              <SortTh k="lastPrice" label="Último" />
              <SortTh k="change1D" label="Var 1D%" />
              <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #1a1a1a" }}>Cierre ant.</th>
              <SortTh k="volume" label="Volumen" />
              <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #1a1a1a" }}>Bid / Ask</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock, i) => (
              <tr
                key={stock.ticker}
                onClick={() => onSelect(stock.ticker)}
                style={{
                  background: i % 2 === 0 ? "#060606" : "#080808",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0d0d0d")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#060606" : "#080808")}
              >
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "#FFA028" }}>{stock.ticker}</td>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 600, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                  {stock.lastPrice != null ? fmtNum(stock.lastPrice, 2) : "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: changeColor(stock.change1D), textAlign: "right", fontFamily: "monospace" }}>
                  {fmtPct(stock.change1D)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#888", textAlign: "right", fontFamily: "monospace" }}>
                  {stock.closePrice != null ? fmtNum(stock.closePrice, 2) : "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#666", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtVol(stock.volume)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 10, color: "#555", textAlign: "right", fontFamily: "monospace" }}>
                  {stock.bid != null && stock.ask != null
                    ? `${fmtNum(stock.bid, 1)} / ${fmtNum(stock.ask, 1)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ScreenerView({ onSelect }: { onSelect: (t: string) => void }) {
  const [data, setData] = useState<Record<string, StockQuote[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/acciones")
      .then((r) => r.json())
      .then((j) => { setData(j.data?.byCategory ?? {}); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>Cargando cotizaciones del Merval...</div>
  if (error) return <div style={{ padding: 16, color: "#FF433D", fontSize: 11 }}>Error: {error}</div>

  const allStocks = Object.values(data).flat()
  const filteredData = search
    ? { "Resultados": allStocks.filter((s) => s.ticker.includes(search.toUpperCase())) }
    : data

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "6px 8px", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="Buscar ticker..."
          style={{
            background: "#111", border: "1px solid #333", color: "#ccc",
            padding: "4px 8px", fontSize: 11, width: 150, borderRadius: 2,
            outline: "none",
          }}
        />
        <span style={{ fontSize: 9, color: "#555" }}>{allStocks.length} instrumentos · Haz click en un ticker para ver detalle</span>
        <button onClick={load} style={{
          marginLeft: "auto", fontSize: 9, padding: "3px 8px",
          background: "transparent", border: "1px solid #333", color: "#666", cursor: "pointer",
        }}>↻ Actualizar</button>
      </div>

      {Object.entries(filteredData).map(([cat, stocks]) => (
        <ScreenerCategory key={cat} cat={cat} stocks={stocks} onSelect={onSelect} />
      ))}

      <div style={{ padding: "4px 8px", fontSize: 9, color: "#333", borderTop: "1px solid #111" }}>
        Precios: api-merval (24hs) · Variación vs cierre anterior · Click en ticker para ver detalle + gráfico
      </div>
    </div>
  )
}

// ── Peer Comparison ───────────────────────────────────────────────────────────
function PeerComparison() {
  const [data, setData] = useState<Record<string, StockQuote[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string>("")

  useEffect(() => {
    fetch("/api/acciones")
      .then((r) => r.json())
      .then((j) => {
        const d = j.data?.byCategory ?? {}
        setData(d)
        if (!selectedCat && Object.keys(d).length > 0) setSelectedCat(Object.keys(d)[0])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedCat])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando...</div>

  const stocks = data[selectedCat] ?? []
  const withData = stocks.filter((s) => s.lastPrice != null)

  // Median
  const prices = withData.map((s) => s.lastPrice!).sort((a, b) => a - b)
  const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null

  const changes = withData.map((s) => s.change1D ?? 0).sort((a, b) => a - b)
  const medianChange = changes.length > 0 ? changes[Math.floor(changes.length / 2)] : null

  return (
    <div>
      {/* Category selector */}
      <div style={{ display: "flex", gap: 2, padding: "6px 8px", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap" }}>
        {Object.keys(data).map((cat) => (
          <button key={cat} onClick={() => setSelectedCat(cat)} style={{
            fontSize: 9, padding: "3px 8px",
            background: selectedCat === cat ? "#FFA028" : "transparent",
            color: selectedCat === cat ? "#000" : "#666",
            border: `1px solid ${selectedCat === cat ? "#FFA028" : "#333"}`,
            cursor: "pointer", borderRadius: 2,
            maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{cat}</button>
        ))}
      </div>

      {selectedCat && (
        <>
          {/* Median banner */}
          {medianPrice != null && (
            <div style={{ padding: "6px 12px", background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 24 }}>
              <div style={{ fontSize: 9, color: "#555" }}>
                Mediana precio: <span style={{ color: "#FFA028", fontFamily: "monospace" }}>{fmtNum(medianPrice)}</span>
              </div>
              {medianChange != null && (
                <div style={{ fontSize: 9, color: "#555" }}>
                  Mediana var 1D: <span style={{ color: changeColor(medianChange), fontFamily: "monospace" }}>{fmtPct(medianChange)}</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: "#555" }}>{withData.length} instrumentos</div>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Ticker", "Último Px", "Var 1D%", "Cierre ant.", "Volumen", "vs Mediana 1D"].map((h, i) => (
                  <th key={h} style={{
                    padding: "4px 8px", fontSize: 9, color: "#555",
                    textAlign: i === 0 ? "left" : "right",
                    borderBottom: "1px solid #1a1a1a",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withData
                .sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0))
                .map((stock, i) => {
                  const vsMedian = medianChange != null && stock.change1D != null
                    ? stock.change1D - medianChange : null

                  return (
                    <tr key={stock.ticker} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                      <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "#FFA028" }}>{stock.ticker}</td>
                      <td style={{ padding: "5px 8px", fontSize: 11, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                        {fmtNum(stock.lastPrice)}
                      </td>
                      <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: changeColor(stock.change1D), textAlign: "right", fontFamily: "monospace" }}>
                        {fmtPct(stock.change1D)}
                      </td>
                      <td style={{ padding: "5px 8px", fontSize: 11, color: "#888", textAlign: "right", fontFamily: "monospace" }}>
                        {fmtNum(stock.closePrice)}
                      </td>
                      <td style={{ padding: "5px 8px", fontSize: 11, color: "#666", textAlign: "right", fontFamily: "monospace" }}>
                        {fmtVol(stock.volume)}
                      </td>
                      <td style={{ padding: "5px 8px", fontSize: 11, fontFamily: "monospace", textAlign: "right",
                        color: vsMedian == null ? "#555" : vsMedian > 0 ? "#4AF6C3" : "#FF433D" }}>
                        {vsMedian != null ? (vsMedian >= 0 ? "+" : "") + vsMedian.toFixed(2) + "%" : "—"}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── Stock Detail ──────────────────────────────────────────────────────────────
type HistRange = "1m" | "3m" | "6m" | "1y" | "max"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DetailTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const close = payload.find((p: { dataKey: string }) => p.dataKey === "close")?.value
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #333", padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: "#666", fontSize: 9, marginBottom: 4 }}>{label}</div>
      {close != null && <div style={{ color: "#FFA028", fontFamily: "monospace" }}>Cierre: {fmtNum(close)}</div>}
    </div>
  )
}

function StockDetailView({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [range, setRange] = useState<HistRange>("3m")
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState<"chart" | "news">("chart")

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/acciones/${ticker}?range=${range}`)
      .then((r) => r.json())
      .then((j) => { setDetail(j.data ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker, range])

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/noticias/${ticker}?limit=10`)
      .then((r) => r.json())
      .then((j) => setNews(j.data ?? []))
      .catch(() => {})
  }, [ticker])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando {ticker}...</div>
  if (!detail) return <div style={{ padding: 16, color: "#FF433D", fontSize: 11 }}>No se pudo cargar {ticker}</div>

  return (
    <div style={{ background: "#060606", border: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", borderBottom: "1px solid #1a1a1a" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#FFA028" }}>{detail.ticker}</span>
            <span style={{ fontSize: 24, fontFamily: "monospace", fontWeight: 700, color: "#fff" }}>
              {detail.lastPrice != null ? fmtNum(detail.lastPrice, 2) : "—"}
            </span>
            <span style={{ fontSize: 14, fontFamily: "monospace", color: changeColor(detail.change1DPct) }}>
              {fmtPct(detail.change1DPct)}
              {detail.change1D != null && <span style={{ fontSize: 11, marginLeft: 4 }}>({detail.change1D >= 0 ? "+" : ""}{fmtNum(detail.change1D, 2)})</span>}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            {detail.high52w && <span style={{ fontSize: 9, color: "#555" }}>52W H: <span style={{ color: "#4AF6C3" }}>{fmtNum(detail.high52w)}</span></span>}
            {detail.low52w && <span style={{ fontSize: 9, color: "#555" }}>52W L: <span style={{ color: "#FF433D" }}>{fmtNum(detail.low52w)}</span></span>}
            {detail.volume && <span style={{ fontSize: 9, color: "#555" }}>Vol: <span style={{ color: "#888" }}>{fmtVol(detail.volume)}</span></span>}
            <span style={{ fontSize: 9, color: "#555" }}>{detail.currency}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      {/* Panel toggle */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a" }}>
        {[{ k: "chart", l: "Gráfico" }, { k: "news", l: `Noticias (${news.length})` }].map(({ k, l }) => (
          <button key={k} onClick={() => setActivePanel(k as "chart" | "news")} style={{
            background: activePanel === k ? "#0d0d0d" : "transparent",
            color: activePanel === k ? "#FFA028" : "#555",
            border: "none", borderBottom: activePanel === k ? "2px solid #FFA028" : "2px solid transparent",
            padding: "5px 14px", fontSize: 10, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {activePanel === "chart" && (
        <div>
          {/* Range selector */}
          <div style={{ display: "flex", gap: 2, padding: "5px 8px", background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
            {(["1m", "3m", "6m", "1y", "max"] as HistRange[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} style={{
                fontSize: 9, padding: "2px 8px",
                background: range === r ? "#FFA028" : "transparent",
                color: range === r ? "#000" : "#666",
                border: `1px solid ${range === r ? "#FFA028" : "#333"}`,
                cursor: "pointer", borderRadius: 2,
              }}>{r.toUpperCase()}</button>
            ))}
          </div>

          {/* Chart */}
          <div style={{ padding: "8px 4px 4px 0" }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={detail.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#333" }} tickLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(d) => {
                    try { return new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) } catch { return d }
                  }}
                />
                <YAxis tick={{ fill: "#555", fontSize: 8 }} axisLine={{ stroke: "#333" }} tickLine={false}
                  width={48} tickFormatter={(v) => fmtNum(v, 0)}
                  domain={["auto", "auto"]}
                />
                {detail.closePrice && (
                  <ReferenceLine y={detail.closePrice} stroke="#333" strokeDasharray="4 2"
                    label={{ value: "Cierre", fill: "#444", fontSize: 8, position: "insideTopLeft" }}
                  />
                )}
                <Tooltip content={<DetailTooltip />} />
                <Line type="monotone" dataKey="close" name="Precio" stroke="#FFA028" dot={false} strokeWidth={1.5} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activePanel === "news" && (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {news.length === 0 ? (
            <div style={{ padding: 16, color: "#555", fontSize: 11, textAlign: "center" }}>
              No se encontraron noticias recientes para {ticker}
            </div>
          ) : (
            news.map((n) => (
              <div key={n.id} style={{ padding: "10px 12px", borderBottom: "1px solid #111" }}>
                <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "#ccc", textDecoration: "none", fontSize: 12, lineHeight: 1.4 }}>
                  {n.title}
                </a>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: "#FFA028" }}>{n.source}</span>
                  <span style={{ fontSize: 9, color: "#444" }}>
                    {new Date(n.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                {n.snippet && <div style={{ fontSize: 10, color: "#666", marginTop: 4, lineHeight: 1.4 }}>{n.snippet}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function TabAcciones() {
  const [activeTab, setActiveTab] = useState("screener")
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const handleSelect = (ticker: string) => {
    setSelectedTicker(ticker)
    setActiveTab("detalle")
  }

  return (
    <div>
      <div className="bbg-panel-header">MERCADO DE CAPITALES ARGENTINO — ACCIONES</div>
      <SubTabs
        tabs={[
          { key: "screener", label: "Screener" },
          { key: "peer", label: "Peer Comparison" },
          { key: "detalle", label: selectedTicker ? `Detalle: ${selectedTicker}` : "Detalle" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "screener" && <ScreenerView onSelect={handleSelect} />}
      {activeTab === "peer" && <PeerComparison />}
      {activeTab === "detalle" && (
        selectedTicker
          ? <StockDetailView ticker={selectedTicker} onClose={() => { setSelectedTicker(null); setActiveTab("screener") }} />
          : <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11 }}>
              Seleccioná un ticker desde el Screener para ver el detalle
            </div>
      )}
    </div>
  )
}
