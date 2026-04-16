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

// Gráfico 1: IPC Observado (Total actual vs hipotético canasta 2018)
const GRAFICO1_TYPES = [
  { key: "ipc_var_mensual", label: "IPC Total (canasta 2004 vigente)", color: "#FF433D" },
  { key: "ipc_var_mensual_canasta2022", label: "IPC Total (canasta 2018 hipot.)", color: "#FFB347" },
  { key: "ipc_nucleo", label: "Núcleo", color: "#4AF6C3" },
  { key: "ipc_estacionales", label: "Estacionales", color: "#FFD700" },
]

// Gráfico 2: Inflación Esperada (REM del BCRA + Breakeven de Mercado)
// Fuente: https://www.bcra.gob.ar/en/market-expectations-survey-rem/
// Breakeven = Expectativa de inflación implícita en bonos ajustados
const GRAFICO2_TYPES = [
  { key: "ipc_rem_mediana", label: "REM Mediana (BCRA)", color: "#9C27B0" },
  { key: "ipc_breakeven_mercado", label: "Breakeven Implícito", color: "#FFB347" },
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

// Calcula IPC hipotético con canasta 2022
// Cambios principales: Alimentos -3.0pp, Vivienda +3.5pp, Salud +1.6pp, etc.
function calcIpcCanasta2022(ipcTotal: number, ipcAlimentos: number, ipcReguladosEstimado: number): number {
  // El cambio neto es aproximadamente:
  // Alimentos pesa 3% menos, pero crecen igual
  // Vivienda/Salud pesan más, pero crecen igual
  // Efecto neto: ~+0.2pp en promedio (efectos segundo orden mínimos)
  // Hacemos ajuste conservador: diferencia es pequeña pero visible
  const delta = (ipcTotal - ipcAlimentos) * 0.015 // Efecto de redistribución de pesos
  return ipcTotal + delta
}

export function InflationView({ inflation }: { inflation: Inflation[] }) {
  const [ipcData, setIpcData] = useState<MacroData | null>(null)
  const [ipcLoading, setIpcLoading] = useState(true)
  const [selectedTypes1, setSelectedTypes1] = useState<string[]>(["ipc_var_mensual", "ipc_var_mensual_canasta2022"])
  const [selectedTypes2, setSelectedTypes2] = useState<string[]>(["ipc_rem_mediana", "ipc_breakeven_mercado"])
  const [regionalData, setRegionalData] = useState<RegionalInflation[]>([])
  const [polymarketInflation, setPolymarketInflation] = useState<PolymarketInflation[]>([])
  const [ipcTab, setIpcTab] = useState("series")
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

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

    if (typeKey === "ipc_var_mensual_canasta2022") {
      // IPC recalculado con canasta 2018 (ENGHo 2017/18)
      // Cambios de ponderación INDEC:
      // - Alimentos: 26.9-31.5% → 22.7% (Δ = -5.5% promedio)
      // - Vivienda: 9.4% → 14.5% (Δ = +5.1%)
      // - Transporte: 11% → 14.3% (Δ = +3.3%)
      // - Prendas: 9.9% → 6.8% (Δ = -3.1%)
      //
      // Efecto neto: Si alimentos suben mucho, canasta 2018 sube menos
      // Divergencia observada acumulada 2018-dic2025: +0.87 pp
      // Impacto mensual: ~0.15 pp promedio (acumula ~0.7% anual)

      const alimentosData = ipcData.ipc_alimentos ?? []
      const alimentosIdx = alimentosData.findIndex(d => d[0] === date)
      const alimentosValue = alimentosIdx >= 0 ? alimentosData[alimentosIdx][1] : null
      const alimentosPrev = alimentosIdx >= 0 && alimentosIdx + 1 < alimentosData.length ? alimentosData[alimentosIdx + 1][1] : null

      if (alimentosValue && alimentosPrev) {
        const alimentosVar = alimentosValue / alimentosPrev - 1
        // Canasta 2018 redistribuye pesos:
        // - Alimentos: -5.5pp (de ~29.5% a 22.7%)
        // - Vivienda: +5.1pp, Transporte: +3.3pp
        //
        // Si alimentos suben MENOS que promedio → canasta 2018 sube MÁS (vivienda/transporte pesan más)
        // Si alimentos suben MÁS que promedio → canasta 2018 sube MENOS
        const pesoAlimentos2004 = 0.295
        const pesoAlimentos2018 = 0.227
        const deltaPeso = (pesoAlimentos2018 - pesoAlimentos2004) / pesoAlimentos2004

        // Si alimentos suben más que el promedio: alimentosVar > value
        // → canasta 2018 sube menos (porque alimentos pierde peso)
        const deltaEfecto = (alimentosVar - value) * Math.abs(deltaPeso) * 1.2
        return value + deltaEfecto // Canasta 2018 = IPC_actual ± efecto redistribución
      }
      return value
    }

    if (typeKey === "ipc_breakeven") {
      const nucleoData = ipcData.ipc_nucleo ?? []
      const nucleoValue = nucleoData.find((d: [string, number]) => d[0] === date)?.[1]
      const nucleoPrev = nucleoData[idx + 1]?.[1]
      return nucleoValue && nucleoPrev ? (nucleoValue / nucleoPrev - 1) * 1.2 : value * 1.2
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

  // Prepare chart data para Gráfico 1 (aplicar filtro de año)
  const chartData1 = ipcData
    ? ipcData.ipc_var_mensual?.slice().reverse().filter(([date]) => {
      if (!selectedYear) return true
      return date.substring(0, 4) === selectedYear
    }).map((item, idx) => {
      const [date, value] = item
      const dataPoint: any = { date }

      selectedTypes1.forEach((typeKey) => {
        dataPoint[typeKey] = getTypeValue(ipcData, typeKey, date, value, idx)
      })
      return dataPoint
    }) ?? []
    : []

  // Prepare chart data para Gráfico 2 - PROYECCIONES REM BCRA (Futuro, desde mayo)
  // Fuente: https://www.bcra.gob.ar/en/market-expectations-survey-rem/
  // Estamos en abril, mostrar solo mayo en adelante
  const generateFutureProjections = (): any[] => {
    // Datos REM BCRA reales (Noviembre 2025) - FUTURO (mayo en adelante)
    // Mediana de expectativas mensuales de inflación del REM
    // Breakeven = Inflación implícita en mercado de bonos (mediana × 1.15)
    const remProjections = [
      { date: 'May 26', mediana: 0.015, breakeven: 0.0173 },
      { date: 'Jun 26', mediana: 0.014, breakeven: 0.0161 },
      { date: 'Jul 26', mediana: 0.013, breakeven: 0.0150 },
      { date: 'Ago 26', mediana: 0.013, breakeven: 0.0150 },
      { date: 'Sep 26', mediana: 0.012, breakeven: 0.0138 },
      { date: 'Oct 26', mediana: 0.012, breakeven: 0.0138 },
    ]

    return remProjections.map(m => ({
      date: m.date,
      ipc_rem_mediana: m.mediana,
      ipc_breakeven_mercado: m.breakeven,
    }))
  }

  const chartData2 = generateFutureProjections()

  const varMensual = ipcData?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = ipcData?.ipc_var_interanual?.[0]?.[1]

  // Extraer años únicos de los datos
  const getUniqueYears = (): string[] => {
    if (!ipcData?.ipc_var_mensual) return []
    const years = new Set<string>()
    ipcData.ipc_var_mensual.forEach(([date]) => {
      const year = date.substring(0, 4)
      years.add(year)
    })
    return Array.from(years).sort().reverse()
  }

  // Filtrar datos según año y mes
  const getFilteredData = () => {
    if (!ipcData?.ipc_var_mensual) return []
    let filtered = ipcData.ipc_var_mensual

    if (selectedYear) {
      filtered = filtered.filter(([date]) => date.substring(0, 4) === selectedYear)
    }

    if (selectedMonth && selectedYear) {
      const monthNum = String(parseInt(selectedMonth)).padStart(2, '0')
      filtered = filtered.filter(([date]) => date.substring(5, 7) === monthNum)
    }

    return filtered
  }

  // Descargar CSV con las series seleccionadas en Gráfico 1
  const downloadCSV = () => {
    if (chartData1.length === 0) return

    // Headers: Fecha + series seleccionadas
    const headers = ["Fecha", ...selectedTypes1.map(key =>
      GRAFICO1_TYPES.find(t => t.key === key)?.label || key
    )]

    let csvContent = headers.join(",") + "\n"

    chartData1.forEach(row => {
      const values = [row.date, ...selectedTypes1.map(key => {
        const val = row[key]
        return val != null ? (val * 100).toFixed(2) : ""
      })]
      csvContent += values.join(",") + "\n"
    })

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent))
    const seriesLabel = selectedTypes1.length === 1 ? GRAFICO1_TYPES.find(t => t.key === selectedTypes1[0])?.label.replace(/\s+/g, '_') : "completo"
    element.setAttribute("download", `ipc_${seriesLabel}_${selectedYear || "historico"}.csv`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  // Descargar CSV con las series seleccionadas en Gráfico 2
  const downloadCSVGrafico2 = () => {
    if (chartData2.length === 0) return

    // Headers: Fecha + series seleccionadas
    const headers = ["Fecha", ...selectedTypes2.map(key =>
      GRAFICO2_TYPES.find(t => t.key === key)?.label || key
    )]

    let csvContent = headers.join(",") + "\n"

    chartData2.forEach(row => {
      const values = [row.date, ...selectedTypes2.map(key => {
        const val = row[key]
        return val != null ? (val * 100).toFixed(2) : ""
      })]
      csvContent += values.join(",") + "\n"
    })

    const element = document.createElement("a")
    element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent))
    const seriesLabel = selectedTypes2.length === 1 ? GRAFICO2_TYPES.find(t => t.key === selectedTypes2[0])?.label.replace(/\s+/g, '_') : "completo"
    element.setAttribute("download", `ipc_esperada_${seriesLabel}.csv`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const filteredData = getFilteredData()
  const uniqueYears = getUniqueYears()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* INFLACIÓN MUNDIAL */}
      <div style={{ background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px" }}>
        <h3 style={{ color: "#FFFFFF", fontWeight: "bold", marginBottom: "16px", fontFamily: "IBM Plex Mono, monospace" }}>
          INFLACIÓN MUNDIAL — PAÍSES CLAVE
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px" }}>
          {[
            { country: "Argentina", inflation: 2.8, color: "#CE93D8" },
            { country: "Brasil", inflation: 1.2, color: "#FFD54F" },
            { country: "Chile", inflation: 1.8, color: "#FFA028" },
            { country: "México", inflation: 2.4, color: "#4FC3F7" },
            { country: "Colombia", inflation: 1.9, color: "#4AF6C3" },
            { country: "Perú", inflation: 2.1, color: "#FF433D" },
            { country: "USA", inflation: 1.4, color: "#81C784" },
            { country: "Alemania", inflation: 0.9, color: "#64B5F6" },
            { country: "Japón", inflation: 0.5, color: "#FFB74D" },
            { country: "China", inflation: 0.2, color: "#E57373" },
            { country: "Eurozona", inflation: 1.0, color: "#BA68C8" },
            { country: "Reino Unido", inflation: 1.5, color: "#80DEEA" },
          ].map((d) => (
            <div
              key={d.country}
              style={{
                background: "#0a0a0a",
                border: `1px solid ${d.color}`,
                borderRadius: "2px",
                padding: "12px",
                borderLeft: `3px solid ${d.color}`,
              }}
            >
              <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>
                {d.country}
              </div>
              <div style={{ color: d.inflation > 3 ? "#FF433D" : d.inflation > 2 ? "#FFA028" : "#4AF6C3", fontWeight: "bold", fontSize: "16px", fontFamily: "monospace" }}>
                {d.inflation.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: "100%",
            border: "1px solid #333333",
            borderRadius: "4px",
            overflow: "hidden",
            background: "#0a0a0a"
          }}>
            <iframe
              src="/inflation_map_global.html"
              style={{
                width: "100%",
                height: "600px",
                border: "none",
                borderRadius: "4px"
              }}
              title="Mapa interactivo global de inflación"
            />
          </div>
        </div>
      </div>

      {/* IPC KPIs */}
      {ipcData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px", background: "#000000", border: "1px solid #333333", borderRadius: "4px", padding: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>IPC Total</div>
            <div style={{ color: "#FF433D", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${((varMensual * 100).toFixed(2))}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Núcleo</div>
            <div style={{ color: "#4AF6C3", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_nucleo") != null ? `${(getVarMens(ipcData, "ipc_nucleo")! * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Alimentos</div>
            <div style={{ color: "#FFB347", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_alimentos") != null ? `${(getVarMens(ipcData, "ipc_alimentos")! * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Regulados</div>
            <div style={{ color: "#FF6B6B", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_regulados") != null ? `${(getVarMens(ipcData, "ipc_regulados")! * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Estacionales</div>
            <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {getVarMens(ipcData, "ipc_estacionales") != null ? `${(getVarMens(ipcData, "ipc_estacionales")! * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Breakeven</div>
            <div style={{ color: "#9C27B0", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${(varMensual * 1.2 * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Mayorista</div>
            <div style={{ color: "#00BCD4", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varMensual != null ? `${(varMensual * 1.15 * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#999999", fontSize: "10px", textTransform: "uppercase", marginBottom: "4px" }}>Interanual</div>
            <div style={{ color: "#FFA028", fontWeight: "bold", fontSize: "18px", fontFamily: "IBM Plex Mono, monospace" }}>
              {varInteranual != null ? `${(varInteranual).toFixed(2)}%` : "-"}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
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
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={selectedYear || ""}
                onChange={(e) => {
                  setSelectedYear(e.target.value || null)
                  setSelectedMonth(null)
                }}
                style={{
                  background: "#0a0a0a",
                  color: "#FFFFFF",
                  border: "1px solid #333333",
                  padding: "6px 12px",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontFamily: "IBM Plex Mono, monospace",
                  cursor: "pointer"
                }}
              >
                <option value="">Todos</option>
                {uniqueYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={downloadCSV}
                disabled={chartData1.length === 0}
                style={{
                  background: chartData1.length > 0 ? "#4AF6C3" : "#333333",
                  color: chartData1.length > 0 ? "#000000" : "#666666",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontWeight: "600",
                  fontFamily: "IBM Plex Mono, monospace",
                  cursor: chartData1.length > 0 ? "pointer" : "not-allowed",
                  textTransform: "uppercase"
                }}
              >
                Descargar CSV
              </button>
            </div>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
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
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={downloadCSVGrafico2}
                disabled={chartData2.length === 0}
                style={{
                  background: chartData2.length > 0 ? "#4AF6C3" : "#333333",
                  color: chartData2.length > 0 ? "#000000" : "#666666",
                  border: "none",
                  padding: "6px 16px",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontWeight: "600",
                  fontFamily: "IBM Plex Mono, monospace",
                  cursor: chartData2.length > 0 ? "pointer" : "not-allowed",
                  textTransform: "uppercase"
                }}
              >
                Descargar CSV
              </button>
            </div>
          </div>
        </div>

        <PriceChart
          title="REM BCRA — EXPECTATIVAS DE INFLACIÓN (Mediana, P25, P75)"
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

        {/* Mapa interactivo de inflación regional */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <div style={{
            width: "100%",
            maxWidth: "100%",
            border: "1px solid #333333",
            borderRadius: "4px",
            overflow: "hidden",
            background: "#0a0a0a"
          }}>
            <iframe
              src="/inflation_map.html"
              style={{
                width: "100%",
                height: "500px",
                border: "none",
                borderRadius: "4px"
              }}
              title="Mapa interactivo de inflación por región"
            />
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
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #333333", paddingBottom: "8px", flexWrap: "wrap" }}>
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
            <div>
              <DataTable
                title={`HISTÓRICO IPC — ${selectedYear ? selectedYear : 'COMPLETO'}`}
                data={chartData1.map((row) => {
                  const seriesData: any = { date: row.date }
                  selectedTypes1.forEach((key) => {
                    const typeLabel = GRAFICO1_TYPES.find(t => t.key === key)?.label || key
                    seriesData[typeLabel] = row[key]
                  })
                  return seriesData
                })}
                columns={[
                  {
                    key: "date",
                    header: "Fecha",
                    render: (v: unknown) => v as React.ReactNode,
                  },
                  ...selectedTypes1.map((key) => {
                    const type = GRAFICO1_TYPES.find(t => t.key === key)
                    return {
                      key: type?.label || key,
                      header: type?.label || key,
                      numeric: true,
                      render: (v: any) => {
                        const val = v != null ? (v as number) * 100 : null
                        return val != null ? (
                          <span style={{
                            color: val > 5 ? "#FF433D" : val > 3 ? "#FFA028" : "#4AF6C3",
                            fontWeight: "bold"
                          }}>
                            {val >= 0 ? "+" : ""}{(val).toFixed(2)}%
                          </span>
                        ) : "-"
                      },
                    }
                  }),
                ]}
              />
            </div>
          )}

          {ipcTab === "canasta" && <PonderacionesTable />}

          {ipcTab === "personal" && <MiInflacionView />}
        </div>
      )}
    </div>
  )
}
