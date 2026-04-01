/**
 * TabMundo — Mercados globales
 *
 * API: /api/mundo (Yahoo Finance chart API, sin auth)
 *
 * Portado de EconData_argy/js/components/sections/economia/SeccionMundo.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { BBGLineChart } from "../charts/bbg-line-chart"

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "4px 10px", fontSize: 10, background: active === t.key ? "#1a1a1a" : "transparent",
            color: active === t.key ? "#FFA028" : "#555", border: "none",
            borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ElectricidadMundialView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/mundo?endpoint=electricidad")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de electricidad...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = [
    { key: "China",                  name: "China",     color: "#FF433D" },
    { key: "United States",          name: "EE.UU.",    color: "#4FC3F7" },
    { key: "India",                  name: "India",     color: "#FFA028" },
    { key: "European Union (27)",    name: "UE-27",     color: "#4AF6C3" },
    { key: "Brazil",                 name: "Brasil",    color: "#FFD54F" },
    { key: "Argentina",              name: "Argentina", color: "#CE93D8" },
  ]

  return (
    <div>
      <BBGLineChart
        title="GENERACIÓN DE ELECTRICIDAD POR PAÍS (TWh)"
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel="TWh"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: Our World in Data — Ember / Energy Institute Statistical Review · Licencia CC BY 4.0
      </div>
    </div>
  )
}

function PetroleoView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/mundo?endpoint=petroleo")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando datos de petróleo...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const lines = [
    { key: "United States",          name: "EE.UU.",    color: "#4FC3F7" },
    { key: "Russia",                 name: "Rusia",     color: "#FF433D" },
    { key: "Saudi Arabia",           name: "Arabia S.",  color: "#FFA028" },
    { key: "Canada",                 name: "Canadá",     color: "#4AF6C3" },
    { key: "China",                  name: "China",      color: "#FFD54F" },
    { key: "Argentina",              name: "Argentina",  color: "#CE93D8" },
  ]

  return (
    <div>
      <BBGLineChart
        title="PRODUCCIÓN DE PETRÓLEO CRUDO (millones bbl/día)"
        data={data}
        lines={lines}
        enableLineToggle
        height={320}
        yAxisLabel="mbbl/d"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: Our World in Data — BP Statistical Review of World Energy · Licencia CC BY 4.0
      </div>
    </div>
  )
}

function MacroComparadaView() {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [indicador, setIndicador] = useState("gdp_growth")

  useEffect(() => {
    fetch("/api/mundo?endpoint=macro_comparada")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando macro comparada...</div>
  if (!data || data.length === 0) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Sin datos disponibles.</div>

  const indicadores = [
    { key: "gdp_growth", label: "Crecimiento PIB (%)" },
    { key: "inflation", label: "Inflación (%)" },
    { key: "unemployment", label: "Desempleo (%)" },
  ]

  const lines = [
    { key: "Argentina",    name: "Argentina",   color: "#CE93D8" },
    { key: "Brazil",       name: "Brasil",      color: "#FFD54F" },
    { key: "Chile",        name: "Chile",       color: "#FFA028" },
    { key: "Colombia",     name: "Colombia",    color: "#4AF6C3" },
    { key: "Mexico",       name: "México",      color: "#4FC3F7" },
  ]

  return (
    <div>
      <div style={{ padding: "4px 8px", background: "#0a0a0a", marginBottom: 8, borderBottom: "1px solid #111" }}>
        <select
          value={indicador}
          onChange={(e) => setIndicador(e.target.value)}
          style={{
            background: "#111",
            border: "1px solid #1a1a1a",
            color: "#FFA028",
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {indicadores.map((ind) => (
            <option key={ind.key} value={ind.key}>{ind.label}</option>
          ))}
        </select>
      </div>

      <BBGLineChart
        title={`AMÉRICA LATINA — ${indicadores.find(i => i.key === indicador)?.label || "Indicador"}`}
        data={data}
        lines={lines}
        enableLineToggle
        height={300}
        yAxisLabel="%"
        defaultRange="all"
      />
      <div style={{ padding: "4px 10px", fontSize: 8, color: "#333", borderTop: "1px solid #111" }}>
        Fuente: World Bank Open Data · Licencia CC BY 4.0
      </div>
    </div>
  )
}

interface QuoteResult {
  precio: number
  variacion_pct: number
  ticker: string
}

type Snapshot = Record<string, QuoteResult | null>

const GRUPOS: Record<string, string[]> = {
  Índices: ["sp500", "nasdaq", "dow", "merval", "vix"],
  Commodities: ["soja", "maiz", "trigo", "petroleo", "oro"],
  FX: ["eurusd", "usdbrl", "usdcny", "dxy"],
  "Renta Fija / Crypto": ["us10y", "brent", "bitcoin", "ethereum"],
}

const TICKER_LABELS: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq: "NASDAQ",
  dow: "DOW",
  merval: "MERVAL",
  vix: "VIX",
  soja: "SOJA",
  maiz: "MAÍZ",
  trigo: "TRIGO",
  petroleo: "WTI",
  oro: "ORO",
  eurusd: "EUR/USD",
  usdbrl: "USD/BRL",
  usdcny: "USD/CNY",
  dxy: "DXY",
  us10y: "US 10Y",
  brent: "BRENT",
  bitcoin: "BTC",
  ethereum: "ETH",
}

function QuoteCard({
  nombre,
  data,
  selected,
  onClick,
}: {
  nombre: string
  data: QuoteResult | null
  selected: boolean
  onClick: () => void
}) {
  const isPositive = (data?.variacion_pct ?? 0) >= 0
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "#0d0d0d" : "#060606",
        border: `1px solid ${selected ? "#FFA028" : "#1a1a1a"}`,
        padding: "8px 10px",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 80,
        flex: "1 1 80px",
      }}
    >
      <div style={{ fontSize: 9, color: selected ? "#FFA028" : "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {TICKER_LABELS[nombre] ?? nombre.toUpperCase()}
      </div>
      <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: "#fff" }}>
        {data?.precio != null ? data.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: data?.variacion_pct == null ? "#555" : isPositive ? "#4AF6C3" : "#FF433D",
          marginTop: 2,
        }}
      >
        {data?.variacion_pct != null
          ? `${isPositive ? "+" : ""}${data.variacion_pct.toFixed(2)}%`
          : "—"}
      </div>
    </button>
  )
}

export function TabMundo() {
  const [mundoTab, setMundoTab] = useState("mercados")
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [selectedTicker, setSelectedTicker] = useState("sp500")
  const [historico, setHistorico] = useState<[string, number][] | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/mundo")
      if (!res.ok) return
      const j = await res.json()
      setSnapshot(j.data)
      setLastUpdate(j.updated_at)
    } catch (err) {
      console.error("[TabMundo snapshot]", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistorico = useCallback(async (ticker: string, period = "1y") => {
    setHistLoading(true)
    try {
      const res = await fetch(`/api/mundo?ticker=${ticker}&hist=${period}`)
      if (!res.ok) return
      const j = await res.json()
      setHistorico(j.data)
    } catch {
      // fail silently
    } finally {
      setHistLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const interval = setInterval(fetchSnapshot, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchSnapshot])

  useEffect(() => {
    fetchHistorico(selectedTicker)
  }, [selectedTicker, fetchHistorico])

  if (loading) {
    return <div style={{ padding: 24, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando mercados...</div>
  }

  const label = TICKER_LABELS[selectedTicker] ?? selectedTicker.toUpperCase()
  const selectedData = snapshot?.[selectedTicker]

  return (
    <div>
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>MERCADOS MUNDIALES — YAHOO FINANCE / OWID</span>
        {lastUpdate && mundoTab === "mercados" && (
          <span style={{ color: "#444", fontWeight: 400 }}>
            UPD {new Date(lastUpdate).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      <SubTabs tabs={[
        { key: "mercados", label: "Mercados" },
        { key: "energia", label: "Electricidad" },
        { key: "petroleo", label: "Petróleo" },
        { key: "macro", label: "Macro Comparada" },
      ]}
        active={mundoTab} onChange={setMundoTab} />
      {mundoTab === "energia" && <ElectricidadMundialView />}
      {mundoTab === "petroleo" && <PetroleoView />}
      {mundoTab === "macro" && <MacroComparadaView />}
      {mundoTab === "mercados" && (<>

      {/* Groups */}
      {Object.entries(GRUPOS).map(([grupo, tickers]) => (
        <div key={grupo} style={{ marginBottom: 1 }}>
          <div style={{ padding: "3px 8px", background: "#0a0a0a", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
            {grupo}
          </div>
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "#111", padding: 1, overflowX: "auto" }}>
            {tickers.map((t) => (
              <QuoteCard
                key={t}
                nombre={t}
                data={snapshot?.[t] ?? null}
                selected={selectedTicker === t}
                onClick={() => setSelectedTicker(t)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Historical series */}
      <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1 }}>
        <div style={{ padding: "4px 8px", background: "#0d0d0d", borderBottom: "1px solid #111", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>
          {label} — Serie histórica (1 año) ·{" "}
          {selectedData?.precio != null ? selectedData.precio.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}{" "}
          <span style={{ color: (selectedData?.variacion_pct ?? 0) >= 0 ? "#4AF6C3" : "#FF433D" }}>
            {selectedData?.variacion_pct != null
              ? `${(selectedData.variacion_pct) >= 0 ? "+" : ""}${selectedData.variacion_pct.toFixed(2)}%`
              : ""}
          </span>
        </div>
        {histLoading ? (
          <div style={{ padding: 16, color: "#555", fontSize: 11, textAlign: "center" }}>Cargando histórico...</div>
        ) : historico && historico.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "left", borderBottom: "1px solid #111" }}>Fecha</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #111" }}>Precio</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #111" }}>Var % (vs anterior)</th>
                </tr>
              </thead>
              <tbody>
                {historico
                  .slice()
                  .reverse()
                  .slice(0, 30)
                  .map(([d, v], i, arr) => {
                    const prev = arr[i + 1]?.[1]
                    const chg = prev && prev !== 0 ? ((v - prev) / prev) * 100 : null
                    return (
                      <tr key={d} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#888" }}>{d}</td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                          {v.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right", fontFamily: "monospace", color: chg == null ? "#555" : chg >= 0 ? "#4AF6C3" : "#FF433D" }}>
                          {chg != null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 12, color: "#555", fontSize: 11 }}>Sin datos históricos disponibles.</div>
        )}
      </div>
      </>)}
    </div>
  )
}
