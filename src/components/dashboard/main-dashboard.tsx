"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { TabEconomia } from "./tab-economia"
import { TabMacro } from "./tab-macro"
import { TabDeuda } from "./tab-deuda"
import { TabMundo } from "./tab-mundo"
import { TabGeopolitica } from "./tab-geopolitica"
import { TabBonos } from "./tab-bonos"
import { TabTiposCambio } from "./tab-tipos-cambio"
import { TabAcciones } from "./tab-acciones"
import { TickerTape } from "./ticker-tape"
import { formatPercent, formatDate } from "@/lib/utils"

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

      {/* Main content */}
      <Tabs defaultValue="resumen" style={{ maxWidth: "100vw", overflow: "hidden" }}>
        <TabsList style={{ overflowX: "auto", overflowY: "hidden", whiteSpace: "nowrap", display: "flex", flexWrap: "nowrap", maxWidth: "100vw", width: "100%", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tipos-cambio">Tipos de Cambio</TabsTrigger>
          <TabsTrigger value="rofex">Rofex</TabsTrigger>
          <TabsTrigger value="inflacion">Inflacion</TabsTrigger>
          <TabsTrigger value="plazos-fijos">Plazos Fijos</TabsTrigger>
          <TabsTrigger value="depositos">Depositos</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="market-data">Market Data</TabsTrigger>
          <TabsTrigger value="arbitraje">Arbitraje</TabsTrigger>
          <TabsTrigger value="news">Noticias</TabsTrigger>
          <TabsTrigger value="bonos">Bonos</TabsTrigger>
          <TabsTrigger value="acciones">Acciones AR</TabsTrigger>
          <TabsTrigger value="economia">Economía AR</TabsTrigger>
          <TabsTrigger value="macro">Macro</TabsTrigger>
          <TabsTrigger value="deuda">Deuda</TabsTrigger>
          <TabsTrigger value="mundo">Mundo</TabsTrigger>
          <TabsTrigger value="geopolitica">Geopolítica</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        {/* ═══════════ RESUMEN ═══════════ */}
        <TabsContent value="resumen">
          <div className="flex flex-col md:flex-row gap-px" style={{ background: "#222222", maxWidth: "100%", overflow: "hidden" }}>
            {/* Left: Cotizaciones */}
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
                        <td style={{ color: "#FFA028", fontWeight: 600 }}>{row.ticker}</td>
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

            {/* Center: Brecha Cambiaria */}
            <div className="w-full md:w-[240px]" style={{ background: "#000000" }}>
              <div className="bbg-panel-header">Brecha Cambiaria</div>
              <table>
                <thead>
                  <tr>
                    <th>Par</th>
                    <th className="text-right">Brecha</th>
                  </tr>
                </thead>
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

            {/* Right: Key Metrics */}
            <div className="w-full md:w-[220px]" style={{ background: "#000000" }}>
              <div className="bbg-panel-header">Indicadores</div>
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "IPC MENSUAL", value: inflation[0]?.monthly != null ? fmtPct(inflation[0].monthly) : "-", color: "bbg-negative" },
                    { label: "IPC INTERANUAL", value: inflation[0]?.interannual != null ? fmtPct(inflation[0].interannual) : "-", color: "bbg-negative" },
                    { label: "IPC YTD", value: inflation[0]?.yearToDate != null ? fmtPct(inflation[0].yearToDate) : "-", color: "bbg-yellow" },
                    { label: "FECHA DATOS", value: latest?.date ? formatDate(latest.date) : "-", color: "bbg-muted" },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
                      <td style={{ color: "#FFA028" }}>{row.label}</td>
                      <td className={`text-right ${row.color}`}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart below panels */}
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
        </TabsContent>

        {/* ═══════════ TIPOS DE CAMBIO ═══════════ */}
        <TabsContent value="tipos-cambio">
          <TabTiposCambio />
        </TabsContent>

        {/* ═══════════ ROFEX ═══════════ */}
        <TabsContent value="rofex">
          <DataTable
            title="FUTUROS DE DOLAR — ROFEX/MATBA"
            data={rofex}
            columns={[
              { key: "position", header: "Posicion", render: (v) => <span style={{ color: "#FFA028", fontWeight: 600 }}>{String(v)}</span> },
              { key: "maturityLabel", header: "Vencimiento" },
              { key: "price", header: "Precio", numeric: true, render: (v) => <span style={{ color: "#FFFFFF" }}>{v != null ? fmtNum(v as number) : "-"}</span> },
              { key: "devaluation", header: "Dev. Imp.", numeric: true, render: (v) => {
                const val = v as number | null
                return <span className={valColor(val)}>{val != null ? fmtPct(val) : "-"}</span>
              }},
              { key: "monthlyDevaluation", header: "Dev. Mensual", numeric: true, render: (v) => {
                const val = v as number | null
                return <span className={valColor(val)}>{val != null ? fmtPct(val) : "-"}</span>
              }},
              { key: "tna", header: "TNA", numeric: true, render: (v) => {
                const val = v as number | null
                return <span style={{ color: "#FFD700" }}>{val != null ? fmtPct(val) : "-"}</span>
              }},
            ]}
          />
          {/* Futuros Coverage Calculator */}
          <div className="mt-px">
            <FuturosCalculator rofexData={rofex} spotA3500={latest?.a3500 ?? null} />
          </div>
        </TabsContent>

        {/* ═══════════ INFLACION ═══════════ */}
        <TabsContent value="inflacion">
          <div className="mb-px">
            <PriceChart
              title="INFLACION MENSUAL"
              data={inflation.slice().reverse().map((i) => ({
                date: i.date,
                monthly: i.monthly ? i.monthly * 100 : null,
              }))}
              series={[
                { key: "monthly", name: "IPC Mensual %", color: "#FF433D" },
              ]}
              height={200}
            />
          </div>
          <DataTable
            title="HISTORICO DE INFLACION"
            data={inflation}
            columns={[
              { key: "date", header: "Fecha", render: (v) => formatDate(v as string) },
              { key: "monthly", header: "Mensual", numeric: true, render: (v) => <span className="bbg-negative">{formatPercent(v as number)}</span> },
              { key: "interannual", header: "Interanual", numeric: true, render: (v) => <span style={{ color: "#FFA028" }}>{formatPercent(v as number)}</span> },
              { key: "yearToDate", header: "YTD", numeric: true, render: (v) => <span style={{ color: "#FFD700" }}>{formatPercent(v as number)}</span> },
              { key: "accumulated", header: "Acumulado", numeric: true, render: (v) => <span className="bbg-muted">{formatPercent(v as number)}</span> },
            ]}
          />
        </TabsContent>

        {/* ═══════════ PLAZOS FIJOS Y TASAS ═══════════ */}
        <TabsContent value="plazos-fijos">
          <TabPlazosFijos />
        </TabsContent>

        {/* ═══════════ DEPOSITOS Y CIRCULANTE ═══════════ */}
        <TabsContent value="depositos">
          <TabDepositos />
        </TabsContent>

        {/* ═══════════ RESERVAS / PASES ═══════════ */}
        <TabsContent value="reservas">
          <TabReservas />
        </TabsContent>

        {/* ═══════════ MARKET DATA ═══════════ */}
        <TabsContent value="market-data">
          <TabMarketData />
        </TabsContent>

        {/* ═══════════ ARBITRAJE ═══════════ */}
        <TabsContent value="arbitraje">
          <TabArbScanner />
        </TabsContent>


        {/* ═══════════ NOTICIAS ═══════════ */}
        <TabsContent value="news">
          <NewsFeed />
        </TabsContent>

        {/* ═══════════ BONOS ═══════════ */}
        <TabsContent value="bonos">
          <TabBonos />
        </TabsContent>

        {/* ═══════════ ACCIONES AR ═══════════ */}
        <TabsContent value="acciones">
          <TabAcciones />
        </TabsContent>

        {/* ═══════════ ECONOMÍA AR ═══════════ */}
        <TabsContent value="economia">
          <TabEconomia />
        </TabsContent>

        {/* ═══════════ MACRO ═══════════ */}
        <TabsContent value="macro">
          <TabMacro />
        </TabsContent>

        {/* ═══════════ DEUDA ═══════════ */}
        <TabsContent value="deuda">
          <TabDeuda />
        </TabsContent>

        {/* ═══════════ MUNDO ═══════════ */}
        <TabsContent value="mundo">
          <TabMundo />
        </TabsContent>

        {/* ═══════════ GEOPOLÍTICA ═══════════ */}
        <TabsContent value="geopolitica">
          <TabGeopolitica />
        </TabsContent>

        {/* ═══════════ STATUS ═══════════ */}
        <TabsContent value="status">
          <StatusCard
            scrapers={scraperStatus}
            onRefresh={triggerScrape}
            onRefreshAll={() => scraperStatus.forEach((s) => triggerScrape(s.source))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
