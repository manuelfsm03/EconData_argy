"use client"

import React, { useState, useEffect, useCallback } from "react"
import { LayoutDashboard, TrendingUp, Landmark, Newspaper, Settings, DollarSign, Globe, ChevronRight } from "lucide-react"
import { PriceChart } from "./price-chart"
import { StatusCard } from "./status-card"
import { NewsFeed } from "./news-feed"
import { DataTable } from "./data-table"
import { FuturosCalculator } from "./futuros-calculator"
import { TabPlazosFijos } from "./tab-plazos-fijos"
import { TabDepositos } from "./tab-depositos"
import { TabReservas } from "./tab-reservas"
import { TabMarketData } from "./tab-market-data"
import { TabArbScanner } from "./tab-arb-scanner"
import { EmaeView, BalanzaView } from "./tab-macro"
import { TabDeuda } from "./tab-deuda"
import { TabBonos } from "./tab-bonos"
import { TabTiposCambio } from "./tab-tipos-cambio"
import { TabAcciones } from "./tab-acciones"
import { TickerTape } from "./ticker-tape"
import { InflationView } from "./inflation-view"
import { FiscalSankeyView } from "./fiscal-sankey"
import { formatDate } from "@/lib/utils"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

// ── Navigation config ────────────────────────────────────────────────────────
type GroupId = "resumen" | "finanzas" | "macro" | "banco-central" | "noticias" | "status"

const NAV_GROUPS: {
  id: GroupId
  label: string
  icon: React.ReactNode
  tabs: { id: string; label: string; icon?: React.ReactNode }[]
}[] = [
  { id: "resumen", label: "Resumen", icon: <LayoutDashboard size={14} />, tabs: [] },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: <DollarSign size={14} />,
    tabs: [
      { id: "tipos-cambio", label: "Tipo de Cambio", icon: <DollarSign size={12} /> },
      { id: "rofex", label: "ROFEX", icon: <TrendingUp size={12} /> },
      { id: "renta-fija", label: "Renta Fija", icon: <Landmark size={12} /> },
      { id: "renta-variable", label: "Renta Variable", icon: <TrendingUp size={12} /> },
      { id: "arbitraje", label: "Arbitraje", icon: <ChevronRight size={12} /> },
    ],
  },
  {
    id: "macro",
    label: "Macro",
    icon: <TrendingUp size={14} />,
    tabs: [
      { id: "inflacion", label: "Inflación" },
      { id: "tcr", label: "T.C. Real" },
      { id: "emae", label: "EMAE" },
      { id: "fiscal", label: "Fiscal" },
      { id: "balanza", label: "Balanza Comercial" },
    ],
  },
  {
    id: "banco-central",
    label: "Banco Central",
    icon: <Landmark size={14} />,
    tabs: [
      { id: "plazos-fijos", label: "Plazos Fijos" },
      { id: "agregados-monetarios", label: "Agregados Monetarios" },
      { id: "reservas", label: "Reservas" },
    ],
  },
  {
    id: "noticias",
    label: "Noticias",
    icon: <Newspaper size={14} />,
    tabs: [],
  },
  { id: "status", label: "Status", icon: <Settings size={14} />, tabs: [] },
]

// Types
interface ExchangeRate {
  id: string
  date: string
  blue: number | null
  cclLibre: number | null
  cclControlado: number | null
  mepLibre: number | null
  mepControlado: number | null
  oficial: number | null
  mayorista: number | null
  a3500: number | null
  solidario: number | null
  cripto: number | null
}

interface LiveRates {
  success: boolean
  timestamp: string
  rates: Record<string, { compra: number; venta: number; nombre: string; actualizacion: string; variacion: number | null }>
  spreads: Record<string, number | null>
}

interface Inflation {
  id: string
  date: string
  monthly: number | null
  yearToDate: number | null
  interannual: number | null
  accumulated: number | null
}

interface RofexFuture {
  id: string
  date: string
  position: string
  maturityLabel: string | null
  price: number | null
  devaluation: number | null
  monthlyDevaluation: number | null
  tna: number | null
}

interface NewsItemData {
  id: string
  title: string
  link: string
  description: string | null
  source: string
  pubDate: string
  category: string | null
  isRead: boolean
}

interface ScraperStatus {
  name: string
  source: string
  lastRun: string | null
  status: "success" | "error" | "running" | "pending"
  recordsAdded?: number
  message?: string
}

// Helper: color a value based on sign
function valColor(val: number | null | undefined): string {
  if (val == null) return "bbg-muted"
  if (val > 0) return "bbg-positive"
  if (val < 0) return "bbg-negative"
  return "bbg-amber"
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "-"
  return val.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "-"
  const pct = val * 100
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(2)}%`
}

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: "nacional" | "internacional"
  onChange: (s: "nacional" | "internacional") => void
}) {
  return (
    <div style={{ padding: "6px 10px", background: "#080808", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 4 }}>
      {(["nacional", "internacional"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            padding: "3px 12px",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: scope === s ? 700 : 400,
            color: scope === s ? "#000000" : "#555",
            background: scope === s ? "#FFA028" : "transparent",
            border: "1px solid " + (scope === s ? "#FFA028" : "#333"),
            cursor: "pointer",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

export function Dashboard() {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [historicalRates, setHistoricalRates] = useState<ExchangeRate[]>([])
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null)
  const [inflation, setInflation] = useState<Inflation[]>([])
  const [rofex, setRofex] = useState<RofexFuture[]>([])
  const [news, setNews] = useState<NewsItemData[]>([])
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeGroup, setActiveGroup] = useState<GroupId>("resumen")
  const [subTabMap, setSubTabMap] = useState<Record<string, string>>({
    finanzas: "tipos-cambio",
    macro: "inflacion",
    "banco-central": "plazos-fijos",
    noticias: "feed",
  })
  const [rentaFijaScope, setRentaFijaScope] = useState<"nacional" | "internacional">("nacional")
  const [rentaVarScope, setRentaVarScope] = useState<"nacional" | "internacional">("nacional")

  const activeSubTab = subTabMap[activeGroup] ?? ""
  const currentGroup = NAV_GROUPS.find((g) => g.id === activeGroup)

  function handleGroupClick(id: GroupId) {
    setActiveGroup(id)
  }

  function handleSubTabClick(id: string) {
    setSubTabMap((prev) => ({ ...prev, [activeGroup]: id }))
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [ratesRes, histRes, liveRes, inflRes, rofexRes, newsRes, statusRes] = await Promise.all([
        fetch("/api/exchange-rates?limit=2"),
        fetch("/api/exchange-rates?limit=30"),
        fetch("/api/dolares"),
        fetch("/api/inflation?limit=12"),
        fetch("/api/rofex"),
        fetch("/api/news?limit=50"),
        fetch("/api/status"),
      ])

      if (ratesRes.ok) setExchangeRates(await ratesRes.json())
      if (histRes.ok) setHistoricalRates(await histRes.json())
      if (liveRes.ok) setLiveRates(await liveRes.json())
      if (inflRes.ok) setInflation(await inflRes.json())
      if (rofexRes.ok) setRofex(await rofexRes.json())
      if (newsRes.ok) setNews(await newsRes.json())
      if (statusRes.ok) setScraperStatus(await statusRes.json())
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const triggerScrape = async (source: string) => {
    try {
      await fetch(`/api/scrape/${source}`, { method: "POST" })
      fetchData()
    } catch (error) {
      console.error("Error triggering scrape:", error)
    }
  }

  const latest = exchangeRates[0]
  const prev = exchangeRates[1]

  // Build live rates object for display (compra + venta + variacion)
  const live = liveRates?.rates ? {
    blue: { compra: liveRates.rates.blue?.compra ?? null, venta: liveRates.rates.blue?.venta ?? null, variacion: liveRates.rates.blue?.variacion ?? null },
    cclLibre: { compra: liveRates.rates.contadoconliqui?.compra ?? null, venta: liveRates.rates.contadoconliqui?.venta ?? null, variacion: liveRates.rates.contadoconliqui?.variacion ?? null },
    mepLibre: { compra: liveRates.rates.bolsa?.compra ?? null, venta: liveRates.rates.bolsa?.venta ?? null, variacion: liveRates.rates.bolsa?.variacion ?? null },
    oficial: { compra: liveRates.rates.oficial?.compra ?? null, venta: liveRates.rates.oficial?.venta ?? null, variacion: liveRates.rates.oficial?.variacion ?? null },
    mayorista: { compra: liveRates.rates.mayorista?.compra ?? null, venta: liveRates.rates.mayorista?.venta ?? null, variacion: liveRates.rates.mayorista?.variacion ?? null },
    solidario: { compra: liveRates.rates.tarjeta?.compra ?? null, venta: liveRates.rates.tarjeta?.venta ?? null, variacion: liveRates.rates.tarjeta?.variacion ?? null },
    cripto: { compra: liveRates.rates.cripto?.compra ?? null, venta: liveRates.rates.cripto?.venta ?? null, variacion: liveRates.rates.cripto?.variacion ?? null },
    a3500: { compra: null as number | null, venta: null as number | null, variacion: null as number | null },
  } : null

  const now = new Date()
  const dateStr = now.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase()

  const chartData = historicalRates
    .slice()
    .reverse()
    .map((r) => ({
      date: r.date,
      blue: r.blue,
      ccl: r.cclLibre,
      mep: r.mepLibre,
      oficial: r.oficial,
    }))

  return (
    <div className="min-h-screen" style={{ background: "#000000", overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Bloomberg-style header bar */}
      <header className="flex items-center justify-between px-2 py-1" style={{ background: "#1a1a1a", borderBottom: "1px solid #333333" }}>
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-bold" style={{ color: "#FFA028" }}>
            PANEL DE CONTROL
          </span>
          <span className="text-[10px]" style={{ color: "#888888" }}>
            {dateStr}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isLoading && (
            <span className="text-[10px] animate-pulse-slow" style={{ color: "#FFA028" }}>
              LOADING...
            </span>
          )}
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: "#555555" }}>
              UPD {lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="text-[10px] px-2 py-0.5 uppercase tracking-wider cursor-pointer"
            style={{ color: "#0068FF", border: "1px solid #333333", background: "#0a0a0a" }}
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Ticker tape */}
      <TickerTape />

      {/* ── Primary nav — pills ─────────────────────────────────────────────── */}
      <div style={{ background: "#111111", borderBottom: "1px solid #1e1e1e", padding: "8px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content", margin: "0 auto", justifyContent: "center" }}>
          {NAV_GROUPS.map((group) => {
            const isActive = activeGroup === group.id
            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#FFA028" : "#888",
                  background: isActive ? "rgba(255,160,40,0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
                  borderRadius: 20,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {group.icon}
                {group.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Secondary nav — pills ───────────────────────────────────────────── */}
      {currentGroup && currentGroup.tabs.length > 0 && (
        <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "6px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", gap: 4, minWidth: "max-content", margin: "0 auto", justifyContent: "center" }}>
            {currentGroup.tabs.map((tab) => {
              const isActive = activeSubTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSubTabClick(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#ffffff" : "#555",
                    background: isActive ? "#1e1e1e" : "transparent",
                    border: isActive ? "1px solid #333" : "1px solid transparent",
                    borderRadius: 20,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.icon && tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div>
        {/* ═══ RESUMEN ═══ */}
        {activeGroup === "resumen" && (
          <>
            <div className="flex flex-col md:flex-row gap-px" style={{ background: "#222222" }}>
              {/* Cotizaciones */}
              <div className="flex-1 min-w-0" style={{ background: "#000000" }}>
                <div className="bbg-panel-header">Cotizaciones del Dia</div>
                <table>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th className="text-right">Compra</th>
                      <th className="text-right">Venta</th>
                      <th className="text-right">Spread</th>
                      <th className="text-right">Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { ticker: "BLUE", compra: live?.blue.compra, venta: live?.blue.venta ?? latest?.blue, variacion: live?.blue.variacion },
                      { ticker: "CCL", compra: live?.cclLibre.compra, venta: live?.cclLibre.venta ?? latest?.cclLibre, variacion: live?.cclLibre.variacion },
                      { ticker: "MEP", compra: live?.mepLibre.compra, venta: live?.mepLibre.venta ?? latest?.mepLibre, variacion: live?.mepLibre.variacion },
                      { ticker: "OFICIAL", compra: live?.oficial.compra, venta: live?.oficial.venta ?? latest?.oficial, variacion: live?.oficial.variacion },
                      { ticker: "MAYORISTA", compra: live?.mayorista.compra, venta: live?.mayorista.venta ?? latest?.mayorista, variacion: live?.mayorista.variacion },
                      { ticker: "A3500", compra: live?.a3500.compra, venta: live?.a3500.venta ?? latest?.a3500, variacion: live?.a3500.variacion },
                      { ticker: "SOLIDARIO", compra: live?.solidario.compra, venta: live?.solidario.venta ?? latest?.solidario, variacion: live?.solidario.variacion },
                      { ticker: "CRIPTO", compra: live?.cripto.compra, venta: live?.cripto.venta ?? latest?.cripto, variacion: live?.cripto.variacion },
                    ].map((row, i) => {
                      const spread = (row.compra != null && row.venta != null) ? ((row.venta - row.compra) / row.compra) * 100 : null
                      return (
                        <tr key={row.ticker} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
                          <td style={{ color: "#FFA028", fontWeight: 600 }}>
                            {row.ticker}
                          </td>
                          <td className="text-right" style={{ color: row.compra ? "#FFFFFF" : "#555555" }}>
                            {row.compra ? fmtNum(row.compra) : "-"}
                          </td>
                          <td className="text-right" style={{ color: row.venta ? "#FFFFFF" : "#555555", fontWeight: 600 }}>
                            {row.venta ? fmtNum(row.venta) : "-"}
                          </td>
                          <td className="text-right" style={{ color: spread != null ? "#888888" : "#555555" }}>
                            {spread != null ? spread.toFixed(2) + "%" : "-"}
                          </td>
                          <td className={`text-right ${valColor(row.variacion != null ? row.variacion / 100 : null)}`}>
                            {row.variacion != null ? (row.variacion > 0 ? "+" : "") + row.variacion.toFixed(2) + "%" : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Brecha */}
              <div className="w-full md:w-[240px]" style={{ background: "#000000" }}>
                <div className="bbg-panel-header" style={{ display: "flex", alignItems: "center" }}>
                  Brecha Cambiaria
                  <InfoTooltip text={GLOSSARY["BRECHA CAMBIARIA"].text} source={GLOSSARY["BRECHA CAMBIARIA"].source} url={GLOSSARY["BRECHA CAMBIARIA"].url} position="bottom" />
                </div>
                <table>
                  <thead><tr><th>Par</th><th className="text-right">Brecha</th></tr></thead>
                  <tbody>
                    {[
                      { par: "BLUE/OFIC", libre: live?.blue.venta ?? latest?.blue, oficial: live?.oficial.venta ?? latest?.oficial },
                      { par: "CCL/OFIC", libre: live?.cclLibre.venta ?? latest?.cclLibre, oficial: live?.oficial.venta ?? latest?.oficial },
                      { par: "MEP/OFIC", libre: live?.mepLibre.venta ?? latest?.mepLibre, oficial: live?.oficial.venta ?? latest?.oficial },
                      { par: "CRIPTO/OFIC", libre: live?.cripto.venta ?? latest?.cripto, oficial: live?.oficial.venta ?? latest?.oficial },
                      { par: "CCL/MAY", libre: live?.cclLibre.venta ?? latest?.cclLibre, oficial: live?.mayorista.venta ?? latest?.mayorista },
                      { par: "MEP/MAY", libre: live?.mepLibre.venta ?? latest?.mepLibre, oficial: live?.mayorista.venta ?? latest?.mayorista },
                    ].map((row, i) => {
                      const brecha = (row.libre && row.oficial) ? ((row.libre - row.oficial) / row.oficial) * 100 : null
                      return (
                        <tr key={row.par} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
                          <td style={{ color: "#FFA028" }}>{row.par}</td>
                          <td className={`text-right ${brecha != null ? (brecha > 50 ? "bbg-negative" : brecha > 20 ? "bbg-yellow" : "bbg-positive") : "bbg-muted"}`}>
                            {brecha != null ? brecha.toFixed(1) + "%" : "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Indicadores */}
              <div className="w-full md:w-[220px]" style={{ background: "#000000" }}>
                <div className="bbg-panel-header">Indicadores</div>
                <table>
                  <thead><tr><th>Indicador</th><th className="text-right">Valor</th></tr></thead>
                  <tbody>
                    {[
                      { label: "IPC MENSUAL", value: inflation[0]?.monthly != null ? fmtPct(inflation[0].monthly) : "-", color: "bbg-negative" },
                      { label: "IPC INTERANUAL", value: inflation[0]?.interannual != null ? fmtPct(inflation[0].interannual) : "-", color: "bbg-negative" },
                      { label: "IPC YTD", value: inflation[0]?.yearToDate != null ? fmtPct(inflation[0].yearToDate) : "-", color: "bbg-yellow" },
                      { label: "FECHA DATOS", value: latest?.date ? formatDate(latest.date) : "-", color: "bbg-muted" },
                    ].map((row, i) => (
                      <tr key={row.label} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
                        <td style={{ color: "#FFA028" }}>
                          {row.label}
                        </td>
                        <td className={`text-right ${row.color}`}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-px">
              <PriceChart
                title="EVOLUCION TIPOS DE CAMBIO (30D)"
                data={chartData}
                series={[
                  { key: "blue", name: "Blue", color: "#4AF6C3" },
                  { key: "ccl", name: "CCL", color: "#FFA028" },
                  { key: "mep", name: "MEP", color: "#FFD700" },
                  { key: "oficial", name: "Oficial", color: "#888888" },
                ]}
                height={250}
              />
            </div>
          </>
        )}

        {/* ═══ FINANZAS ═══ */}
        {activeGroup === "finanzas" && activeSubTab === "tipos-cambio" && <TabTiposCambio />}

        {activeGroup === "finanzas" && activeSubTab === "rofex" && (
          <>
            <DataTable
              title="FUTUROS DE DOLAR — ROFEX/MATBA"
              data={rofex}
              columns={[
                { key: "position", header: "Posicion", render: (v) => <span style={{ color: "#FFA028", fontWeight: 600 }}>{String(v)}</span> },
                { key: "maturityLabel", header: "Vencimiento" },
                { key: "price", header: "Precio", numeric: true, render: (v) => <span style={{ color: "#FFFFFF" }}>{v != null ? fmtNum(v as number) : "-"}</span> },
                { key: "devaluation", header: "Dev. Imp.", headerNode: <span style={{display:"flex",alignItems:"center",gap:2}}>Dev. Imp.<InfoTooltip text={GLOSSARY["DEV. IMP."].text} source={GLOSSARY["DEV. IMP."].source} url={GLOSSARY["DEV. IMP."].url} position="bottom" /></span>, numeric: true, render: (v) => { const val = v as number | null; return <span className={valColor(val)}>{val != null ? fmtPct(val) : "-"}</span> } },
                { key: "monthlyDevaluation", header: "Dev. Mensual", headerNode: <span style={{display:"flex",alignItems:"center",gap:2}}>Dev. Mensual<InfoTooltip text={GLOSSARY["DEV. MENSUAL"].text} source={GLOSSARY["DEV. MENSUAL"].source} url={GLOSSARY["DEV. MENSUAL"].url} position="bottom" /></span>, numeric: true, render: (v) => { const val = v as number | null; return <span className={valColor(val)}>{val != null ? fmtPct(val) : "-"}</span> } },
                { key: "tna", header: "TNA", headerNode: <span style={{display:"flex",alignItems:"center",gap:2}}>TNA<InfoTooltip text={GLOSSARY["TNA"].text} source={GLOSSARY["TNA"].source} url={GLOSSARY["TNA"].url} position="bottom" /></span>, numeric: true, render: (v) => { const val = v as number | null; return <span style={{ color: "#FFD700" }}>{val != null ? fmtPct(val) : "-"}</span> } },
              ]}
            />
            <div className="mt-px">
              <FuturosCalculator rofexData={rofex} spotA3500={latest?.a3500 ?? null} />
            </div>
          </>
        )}

        {activeGroup === "finanzas" && activeSubTab === "renta-fija" && (
          <>
            <ScopeToggle scope={rentaFijaScope} onChange={setRentaFijaScope} />
            {rentaFijaScope === "nacional" && <TabBonos />}
            {rentaFijaScope === "internacional" && <TabDeuda />}
          </>
        )}

        {activeGroup === "finanzas" && activeSubTab === "renta-variable" && (
          <>
            <ScopeToggle scope={rentaVarScope} onChange={setRentaVarScope} />
            {rentaVarScope === "nacional" && <TabAcciones />}
            {rentaVarScope === "internacional" && <TabMarketData />}
          </>
        )}

        {activeGroup === "finanzas" && activeSubTab === "arbitraje" && <TabArbScanner />}

        {/* ═══ MACRO ═══ */}
        {activeGroup === "macro" && activeSubTab === "inflacion" && <InflationView inflation={inflation} />}
        {activeGroup === "macro" && activeSubTab === "tcr" && (
          <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 11, letterSpacing: "0.1em" }}>
            TIPO DE CAMBIO REAL MULTILATERAL — PRÓXIMAMENTE
          </div>
        )}
        {activeGroup === "macro" && activeSubTab === "emae" && <EmaeView />}
        {activeGroup === "macro" && activeSubTab === "fiscal" && <FiscalSankeyView />}
        {activeGroup === "macro" && activeSubTab === "balanza" && <BalanzaView />}

        {/* ═══ BANCO CENTRAL ═══ */}
        {activeGroup === "banco-central" && activeSubTab === "plazos-fijos" && <TabPlazosFijos />}
        {activeGroup === "banco-central" && activeSubTab === "agregados-monetarios" && <TabDepositos />}
        {activeGroup === "banco-central" && activeSubTab === "reservas" && <TabReservas />}

        {/* ═══ NOTICIAS ═══ */}
        {activeGroup === "noticias" && <NewsFeed />}

        {/* ═══ STATUS ═══ */}
        {activeGroup === "status" && (
          <StatusCard
            scrapers={scraperStatus}
            onRefresh={triggerScrape}
            onRefreshAll={() => scraperStatus.forEach((s) => triggerScrape(s.source))}
          />
        )}
      </div>
    </div>
  )
}
