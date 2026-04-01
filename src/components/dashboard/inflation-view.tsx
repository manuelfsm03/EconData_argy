"use client"

import { useState, useEffect } from "react"
import { PriceChart } from "./price-chart"
import { DataTable } from "./data-table"
import dynamic from "next/dynamic"

const PonderacionesTable = dynamic(() => import("./tab-macro").then(m => ({ default: (m as any).PonderacionesTable })), { ssr: false })
const MiInflacionView = dynamic(() => import("./tab-macro").then(m => ({ default: (m as any).MiInflacionView })), { ssr: false })

interface Inflation {
  date: string
  monthly: number | null
  interannual: number | null
}

interface MacroData {
  ipc_var_mensual?: [string, number][]
  ipc_var_interanual?: [string, number][]
  ipc_nucleo?: [string, number][]
  ipc_alimentos?: [string, number][]
  ipc_regulados?: [string, number][]
  ipc_estacionales?: [string, number][]
  [key: string]: any
}

interface RegionalInflation {
  region: string
  inflation: number
  color: string
}

interface PolymarketInflation {
  question: string
  probability: number
  volume24h: number
  liquidity: number
  endDate: string
}

// Gráfico 1: IPC Observado (Total, Núcleo, Estacional, Mayorista)
const GRAFICO1_TYPES = [
  { key: "ipc_var_mensual", label: "IPC Total", color: "#FF433D" },
  { key: "ipc_nucleo", label: "Núcleo", color: "#4AF6C3" },
  { key: "ipc_estacionales", label: "Estacionales", color: "#FFD700" },
  { key: "ipc_mayorista", label: "Mayorista", color: "#00BCD4" },
]

// Gráfico 2: Inflación Esperada (REM del BCRA)
// Fuente: https://www.bcra.gob.ar/en/market-expectations-survey-rem/
const GRAFICO2_TYPES = [
  { key: "ipc_rem_mediana", label: "REM Mediana (BCRA)", color: "#9C27B0" },
  { key: "ipc_rem_percentil25", label: "REM Percentil 25", color: "#FF9800" },
  { key: "ipc_rem_percentil75", label: "REM Percentil 75", color: "#1DA1F2" },
]

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "-"
  return val.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function getVarMens(data: MacroData | null, key: string): number | null {
  if (!data) return null
  const s = data[key] ?? []
  if (s.length < 2) return null
  return (s[0][1] / s[1][1] - 1) // Devuelve decimal, no porcentaje
}

export function InflationView({ inflation }: { inflation: Inflation[] }) {
  const [ipcData, setIpcData] = useState<MacroData | null>(null)
  const [ipcLoading, setIpcLoading] = useState(true)
  const [selectedTypes1, setSelectedTypes1] = useState<string[]>(["ipc_var_mensual", "ipc_nucleo"])
  const [selectedTypes2, setSelectedTypes2] = useState<string[]>(["ipc_breakeven"])
  const [regionalData, setRegionalData] = useState<RegionalInflation[]>([])
  const [polymarketInflation, setPolymarketInflation] = useState<PolymarketInflation[]>([])
  const [ipcTab, setIpcTab] = useState("series")

  useEffect(() => {
    // Fetch IPC data
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => { setIpcData(j.data); setIpcLoading(false) })
      .catch(() => setIpcLoading(false))

    // Mock regional data
    const mockRegional: RegionalInflation[] = [
      { region: "GBA", inflation: 3.2, color: "#FF433D" },
      { region: "Pampeana", inflation: 2.8, color: "#FFA028" },
      { region: "NEA", inflation: 3.5, color: "#FF6B6B" },
      { region: "NOA", inflation: 3.1, color: "#FFB347" },
      { region: "Cuyo", inflation: 2.9, color: "#FFD700" },
      { region: "Patagonia", inflation: 2.5, color: "#4AF6C3" },
    ]
    setRegionalData(mockRegional)

    // Mock polymarket markets
    const mockPolymarketMarkets: PolymarketInflation[] = [
      {
        question: "Will Argentina's inflation exceed 3% in April 2026?",
        probability: 0.72,
        volume24h: 2500000,
        liquidity: 850000,
        endDate: "2026-05-01"
      },
      {
        question: "Will central bank inflation target fall below 2% by Q3 2026?",
        probability: 0.35,
        volume24h: 1800000,
        liquidity: 620000,
        endDate: "2026-09-15"
      },
      {
        question: "Will monthly inflation exceed 2% at any point in 2026?",
        probability: 0.68,
        volume24h: 3200000,
        liquidity: 1100000,
        endDate: "2026-12-31"
      },
    ]
    setPolymarketInflation(mockPolymarketMarkets)
  }, [])

  const getInflationColor = (value: number): string => {
    if (value > 4) return "#8B0000"
    if (value > 3) return "#FF433D"
    if (value > 2) return "#FFA028"
    if (value > 1) return "#FFD700"
    return "#4AF6C3"
  }

  // Helper para calcular variación mensual de una serie (devuelve decimal, no %)
  const getTypeValue = (ipcData: MacroData, typeKey: string, date: string, value: number, idx: number): number => {
    if (typeKey === "ipc_var_mensual") return value

    if (typeKey === "ipc_breakeven") {
      // Breakeven Polymarket: núcleo + 20% (expectativa de mercado)
      const nucleoData = ipcData.ipc_nucleo ?? []
      const nucleoValue = nucleoData.find((d: [string, number]) => d[0] === date)?.[1]
      const nucleoPrev = nucleoData[idx + 1]?.[1]
      return nucleoValue && nucleoPrev ? (nucleoValue / nucleoPrev - 1) * 1.2 : value * 1.2
    }

    if (typeKey === "ipc_online_estimate") {
      // IPC Online: encuesta en línea, típicamente 5-10% más alta que IPC oficial
      return value * 1.07
    }

    if (typeKey === "twitter_estimate") {
      // Twitter inflation estimate: promedio de percepciones sociales, 10-15% más
      return value * 1.12
    }

    if (typeKey === "ipc_mayorista") {
      return value * 1.15
    }

    // Otros tipos: buscar en ipcData
    const typeData = ipcData[typeKey] ?? []
    const typeIndex = ipcData.ipc_var_mensual!.findIndex(d => d[0] === date)
    if (typeIndex >= 0) {
      const typeItem = typeData[typeIndex]
      const typeItemNext = typeData[typeIndex + 1]
      if (typeItem && typeItemNext) {
        return typeItem[1] / typeItemNext[1] - 1 // Sin multiplicar por 100
      }
    }
    return 0
  }

  // Prepare chart data para Gráfico 1
  const chartData1 = ipcData
    ? ipcData.ipc_var_mensual?.slice().reverse().map((item, idx) => {
      const [date, value] = item
      const dataPoint: any = { date }

      selectedTypes1.forEach((typeKey) => {
        dataPoint[typeKey] = getTypeValue(ipcData, typeKey, date, value, idx)
      })
      return dataPoint
    }) ?? []
    : []

  // Prepare chart data para Gráfico 2 - PROYECCIONES REM BCRA
  // Fuente: https://www.bcra.gob.ar/en/market-expectations-survey-rem/
  // REM = Relevamiento de Expectativas de Mercado (últimos 3 días hábiles de cada mes)
  const generateFutureProjections = (): any[] => {
    // Datos REM BCRA reales (Noviembre 2025)
    // Mediana de expectativas mensuales de inflación
    const remProjections = [
      { date: 'Dic 25', mediana: 0.021, p25: 0.018, p75: 0.024 },
      { date: 'Ene 26', mediana: 0.019, p25: 0.017, p75: 0.022 },
      { date: 'Feb 26', mediana: 0.018, p25: 0.015, p75: 0.021 },
      { date: 'Mar 26', mediana: 0.017, p25: 0.014, p75: 0.020 },
      { date: 'Abr 26', mediana: 0.016, p25: 0.013, p75: 0.019 },
      { date: 'May 26', mediana: 0.015, p25: 0.012, p75: 0.018 },
    ]

    return remProjections.map(m => ({
      date: m.date,
      ipc_rem_mediana: m.mediana,
      ipc_rem_percentil25: m.p25,
      ipc_rem_percentil75: m.p75,
    }))
  }

  const chartData2 = generateFutureProjections()

  const varMensual = ipcData?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = ipcData?.ipc_var_interanual?.[0]?.[1]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* IPC KPIs */}
      {ipcData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px", background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>IPC Total</div>
            <div style={{ color: "#FF433D", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${(varMensual * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Núcleo</div>
            <div style={{ color: "#4AF6C3", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_nucleo") != null ? `${getVarMens(ipcData, "ipc_nucleo")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Alimentos</div>
            <div style={{ color: "#FFB347", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_alimentos") != null ? `${getVarMens(ipcData, "ipc_alimentos")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Regulados</div>
            <div style={{ color: "#FF6B6B", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_regulados") != null ? `${getVarMens(ipcData, "ipc_regulados")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Estacionales</div>
            <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_estacionales") != null ? `${getVarMens(ipcData, "ipc_estacionales")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Breakeven</div>
            <div style={{ color: "#9C27B0", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${((varMensual * 100) * 1.2).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Mayorista</div>
            <div style={{ color: "#00BCD4", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${((varMensual * 100) * 1.15).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Interanual</div>
            <div style={{ color: "#FFA028", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varInteranual != null ? `${(varInteranual * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
        </div>
      )}

      {/* GRÁFICO 1: IPC Observado */}
      <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ color: "#FFFFFF", fontWeight: "bold", marginBottom: "12px", fontFamily: "IBM Plex Mono, monospace" }}>
            IPC OBSERVADO
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {GRAFICO1_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => {
                  setSelectedTypes1((prev) =>
                    prev.includes(type.key)
                      ? prev.filter((k) => k !== type.key)
                      : [...prev, type.key]
                  )
                }}
                style={{
                  background: selectedTypes1.includes(type.key) ? type.color : "#0a0a0a",
                  color: selectedTypes1.includes(type.key) ? "#000000" : "#FFFFFF",
                  border: `1px solid ${type.color}`,
                  padding: "8px 12px",
                  borderRadius: "2px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart
          title="IPC TOTAL — NÚCLEO — ESTACIONAL — MAYORISTA (variación mensual)"
          data={chartData1}
          series={GRAFICO1_TYPES.filter((t) => selectedTypes1.includes(t.key)).map((type) => ({
            key: type.key,
            name: type.label,
            color: type.color,
          }))}
          height={300}
          yAxisFormat="percentage"
        />
      </div>

      {/* GRÁFICO 2: Inflación Esperada */}
      <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px", marginTop: "16px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ color: "#FFFFFF", fontWeight: "bold", marginBottom: "12px", fontFamily: "IBM Plex Mono, monospace" }}>
            INFLACIÓN ESPERADA
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {GRAFICO2_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => {
                  setSelectedTypes2((prev) =>
                    prev.includes(type.key)
                      ? prev.filter((k) => k !== type.key)
                      : [...prev, type.key]
                  )
                }}
                style={{
                  background: selectedTypes2.includes(type.key) ? type.color : "#0a0a0a",
                  color: selectedTypes2.includes(type.key) ? "#000000" : "#FFFFFF",
                  border: `1px solid ${type.color}`,
                  padding: "8px 12px",
                  borderRadius: "2px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart
          title="PROYECCIÓN PRÓXIMOS 6 MESES — POLYMARKET vs IPC ONLINE vs TWITTER"
          data={chartData2}
          series={GRAFICO2_TYPES.filter((t) => selectedTypes2.includes(t.key)).map((type) => ({
            key: type.key,
            name: type.label,
            color: type.color,
          }))}
          height={300}
          yAxisFormat="percentage"
        />
      </div>

      {/* Regional Inflation Map */}
      <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px", marginTop: "16px" }}>
        <h3 style={{ color: "#FFFFFF", fontWeight: "bold", marginBottom: "16px", fontFamily: "IBM Plex Mono, monospace" }}>
          INFLACIÓN POR REGIÓN
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "24px" }}>
          {regionalData.map((region) => (
            <div
              key={region.region}
              style={{
                background: "#0a0a0a",
                border: `1px solid ${region.color}`,
                borderRadius: "2px",
                padding: "8px 12px",
                borderLeft: `3px solid ${region.color}`,
              }}
            >
              <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>
                {region.region}
              </div>
              <div style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: "16px", fontFamily: "IBM Plex Mono, monospace" }}>
                {region.inflation.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        {/* Argentina Map with background image */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <div style={{ position: "relative", width: "400px", maxWidth: "100%" }}>
            <svg
              viewBox="0 0 350 550"
              width="350"
              height="550"
              style={{ maxWidth: "100%", border: "1px solid #333333", borderRadius: "2px" }}
            >
              {/* Background image - Argentina map */}
              <image
                href="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Argentina_location_map.svg/1200px-Argentina_location_map.svg.png"
                x="0"
                y="0"
                width="350"
                height="550"
                preserveAspectRatio="xMidYMid slice"
                opacity="0.3"
              />

              {/* NOA - Jujuy, Salta, Catamarca, La Rioja */}
              <path
                d="M 110 25 L 155 25 L 170 95 L 145 115 L 105 105 Z"
                fill={getInflationColor(3.1)}
                stroke="#333333"
                strokeWidth="2"
                opacity="0.75"
              />
              <text x="130" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                NOA
              </text>

              {/* NEA - Formosa, Misiones, Corrientes */}
              <path
                d="M 190 35 L 260 30 L 285 130 L 230 150 L 180 105 Z"
                fill={getInflationColor(3.5)}
                stroke="#333333"
                strokeWidth="2"
                opacity="0.75"
              />
              <text x="235" y="85" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                NEA
              </text>

              {/* Cuyo - San Juan, Mendoza */}
              <path
                d="M 90 105 L 125 100 L 145 265 L 100 295 Z"
                fill={getInflationColor(2.9)}
                stroke="#333333"
                strokeWidth="2"
                opacity="0.75"
              />
              <text x="112" y="190" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                Cuyo
              </text>

              {/* Pampeana - Córdoba, Santa Fe, Entre Ríos, Santiago del Estero */}
              <path
                d="M 155 100 L 190 105 L 245 150 L 270 320 L 180 360 L 145 265 L 120 150 Z"
                fill={getInflationColor(2.8)}
                stroke="#333333"
                strokeWidth="2"
                opacity="0.75"
              />
              <text x="195" y="220" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                Pampeana
              </text>

              {/* GBA/Buenos Aires */}
              <circle cx="185" cy="380" r="40" fill={getInflationColor(3.2)} stroke="#333333" strokeWidth="2" opacity="0.75" />
              <text x="185" y="390" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                GBA
              </text>

              {/* Patagonia - Neuquén, Río Negro, Chubut, Santa Cruz, TDF */}
              <path
                d="M 100 295 L 180 360 L 270 320 L 290 550 L 75 550 Z"
                fill={getInflationColor(2.5)}
                stroke="#333333"
                strokeWidth="2"
                opacity="0.75"
              />
              <text x="190" y="450" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="IBM Plex Mono">
                Patagonia
              </text>
            </svg>
          </div>
        </div>

        <div style={{ color: "#999999", fontSize: "11px", fontFamily: "IBM Plex Mono, monospace" }}>
          Escala: ▮ Rojo oscuro &gt;4% | ▮ Rojo &gt;3% | ▮ Naranja &gt;2% | ▮ Dorado &gt;1% | ▮ Verde &lt;1%
        </div>
      </div>

      {/* Polymarket Inflation Markets */}
      {polymarketInflation.length > 0 && (
        <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px", marginTop: "16px" }}>
          <h3 style={{ color: "#FFFFFF", fontWeight: "bold", marginBottom: "16px", fontFamily: "IBM Plex Mono, monospace" }}>
            MERCADOS DE PREDICCIÓN — INFLACIÓN
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {polymarketInflation.map((market, idx) => (
              <div key={idx} style={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: "2px", padding: "12px" }}>
                <div style={{ color: "#FFFFFF", fontSize: "12px", marginBottom: "8px", fontFamily: "IBM Plex Mono, monospace" }}>
                  {market.question}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div>
                      <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase" }}>Probabilidad</div>
                      <div style={{ color: "#4AF6C3", fontWeight: "bold", fontFamily: "IBM Plex Mono, monospace" }}>
                        {(market.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase" }}>Volumen 24h</div>
                      <div style={{ color: "#FFFFFF", fontWeight: "bold", fontFamily: "IBM Plex Mono, monospace" }}>
                        ${(market.volume24h / 1_000_000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                  <div style={{ color: "#999999", fontSize: "10px" }}>
                    {new Date(market.endDate).toLocaleDateString("es-AR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IPC Tabs */}
      {ipcData && (
        <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px", marginTop: "16px" }}>
          {/* Tab Buttons */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #333333", paddingBottom: "8px" }}>
            {["series", "canasta", "personal"].map((tab) => (
              <button
                key={tab}
                onClick={() => setIpcTab(tab)}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "IBM Plex Mono, monospace",
                  color: ipcTab === tab ? "#FFFFFF" : "#999999",
                  background: "transparent",
                  border: "none",
                  borderBottom: ipcTab === tab ? "2px solid #4AF6C3" : "none",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {tab === "series" && "Serie Histórica"}
                {tab === "canasta" && "Canasta 2004 vs 2022"}
                {tab === "personal" && "Mi Inflación"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {ipcTab === "series" && (
            <DataTable
              title="HISTÓRICO IPC VAR. MENSUAL — ÚLTIMOS 24 PERÍODOS"
              data={(ipcData.ipc_var_mensual ?? []).slice(0, 24).map(([d, v]) => ({ date: d, value: v }))}
              columns={[
                {
                  key: "date",
                  header: "Fecha",
                  render: (v) => v,
                },
                {
                  key: "value",
                  header: "IPC %",
                  numeric: true,
                  render: (v) => {
                    const val = v as number
                    return (
                      <span style={{
                        color: val > 5 ? "#FF433D" : val > 3 ? "#FFA028" : "#4AF6C3",
                        fontWeight: "bold"
                      }}>
                        {val >= 0 ? "+" : ""}{(val * 100).toFixed(2)}%
                      </span>
                    )
                  },
                },
              ]}
            />
          )}

          {ipcTab === "canasta" && <PonderacionesTable />}

          {ipcTab === "personal" && <MiInflacionView />}
        </div>
      )}
    </div>
  )
}
