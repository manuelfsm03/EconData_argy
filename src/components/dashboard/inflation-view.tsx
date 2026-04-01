"use client"

import { useState, useEffect } from "react"
import { PriceChart } from "./price-chart"
import { DataTable } from "./data-table"

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

const INFLACION_TYPES = [
  { key: "ipc_var_mensual", label: "IPC Total", color: "#FF433D" },
  { key: "ipc_nucleo", label: "Núcleo", color: "#4AF6C3" },
  { key: "ipc_alimentos", label: "Alimentos", color: "#FFB347" },
  { key: "ipc_regulados", label: "Regulados", color: "#FF6B6B" },
  { key: "ipc_estacionales", label: "Estacionales", color: "#FFD700" },
]

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "-"
  return val.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function getVarMens(data: MacroData | null, key: string): number | null {
  if (!data) return null
  const s = data[key] ?? []
  if (s.length < 2) return null
  return ((s[0][1] / s[1][1] - 1) * 100)
}

export function InflationView({ inflation }: { inflation: Inflation[] }) {
  const [ipcData, setIpcData] = useState<MacroData | null>(null)
  const [ipcLoading, setIpcLoading] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["ipc_var_mensual", "ipc_nucleo"])
  const [regionalData, setRegionalData] = useState<RegionalInflation[]>([])
  const [polymarketInflation, setPolymarketInflation] = useState<PolymarketInflation[]>([])

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

  // Prepare chart data with selected types
  const chartData = ipcData
    ? ipcData.ipc_var_mensual?.slice().reverse().map((item) => {
      const [date, value] = item
      const dataPoint: any = { date }
      selectedTypes.forEach((typeKey) => {
        const typeData = ipcData[typeKey] ?? []
        const typeValue = typeData.find((d: [string, number]) => d[0] === date)
        if (typeValue) {
          dataPoint[typeKey] = ((typeValue[1] / (typeData.find((d: [string, number], i: number) =>
            ipcData.ipc_var_mensual!.indexOf(item) === ipcData.ipc_var_mensual!.findIndex((it: [string, number]) => it[0] === date) && i ===
            ipcData.ipc_var_mensual!.findIndex((it: [string, number]) => it[0] === date) + 1)?.[1] ?? typeValue[1]) - 1) * 100) || value
        }
      })
      return dataPoint
    }) ?? []
    : []

  const varMensual = ipcData?.ipc_var_mensual?.[0]?.[1]
  const varInteranual = ipcData?.ipc_var_interanual?.[0]?.[1]

  return (
    <div className="space-y-4">
      {/* IPC KPIs */}
      {ipcData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-900 border border-slate-700 rounded p-4">
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">IPC Mensual</div>
            <div className="text-white font-bold text-lg" style={{ color: "#FF433D" }}>
              {varMensual != null ? `${(varMensual * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Núcleo</div>
            <div className="text-white font-bold text-lg" style={{ color: "#4AF6C3" }}>
              {getVarMens(ipcData, "ipc_nucleo") != null ? `${getVarMens(ipcData, "ipc_nucleo")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Alimentos</div>
            <div className="text-white font-bold text-lg" style={{ color: "#FFB347" }}>
              {getVarMens(ipcData, "ipc_alimentos") != null ? `${getVarMens(ipcData, "ipc_alimentos")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Regulados</div>
            <div className="text-white font-bold text-lg" style={{ color: "#FF6B6B" }}>
              {getVarMens(ipcData, "ipc_regulados") != null ? `${getVarMens(ipcData, "ipc_regulados")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Estacionales</div>
            <div className="text-white font-bold text-lg" style={{ color: "#FFD700" }}>
              {getVarMens(ipcData, "ipc_estacionales") != null ? `${getVarMens(ipcData, "ipc_estacionales")!.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs uppercase mb-1">Interanual</div>
            <div className="text-white font-bold text-lg" style={{ color: "#FFA028" }}>
              {varInteranual != null ? `${(varInteranual * 100).toFixed(2)}%` : "-"}
            </div>
          </div>
        </div>
      )}

      {/* Inflación Segmentada Chart */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4">
        <div className="mb-4">
          <h3 className="text-white font-bold mb-3">Segmentar por tipo</h3>
          <div className="flex flex-wrap gap-2">
            {INFLACION_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => {
                  setSelectedTypes((prev) =>
                    prev.includes(type.key)
                      ? prev.filter((k) => k !== type.key)
                      : [...prev, type.key]
                  )
                }}
                style={{
                  background: selectedTypes.includes(type.key) ? type.color : "#1e293b",
                  color: selectedTypes.includes(type.key) ? "#000" : "#fff",
                  border: `2px solid ${type.color}`,
                }}
                className="px-3 py-1 rounded text-sm font-semibold transition"
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <PriceChart
          title="INFLACION MENSUAL POR TIPO"
          data={chartData}
          series={INFLACION_TYPES.filter((t) => selectedTypes.includes(t.key)).map((type) => ({
            key: type.key,
            name: type.label,
            color: type.color,
          }))}
          height={300}
        />
      </div>

      {/* Regional Inflation Map */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4">
        <h3 className="text-white font-bold mb-4">INFLACION POR REGION</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {regionalData.map((region) => (
            <div
              key={region.region}
              className="bg-slate-800 border border-slate-700 rounded p-3"
              style={{ borderLeftColor: region.color, borderLeftWidth: "3px" }}
            >
              <div className="text-slate-400 text-xs uppercase">{region.region}</div>
              <div className="text-white font-bold text-lg">{region.inflation.toFixed(1)}%</div>
            </div>
          ))}
        </div>

        {/* Argentina Map - Simplified realistic version */}
        <div className="flex justify-center mb-4">
          <svg viewBox="0 0 300 450" width="250" height="400" className="max-w-full">
            {/* Jujuy/Salta (NOA) */}
            <path d="M 100 20 L 130 20 L 140 60 L 120 80 L 90 70 Z" fill={getInflationColor(3.1)} stroke="#fff" strokeWidth="1" />
            <text x="115" y="50" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">NOA</text>

            {/* Formosa/Misiones (NEA) */}
            <path d="M 180 30 L 220 40 L 230 100 L 190 90 L 180 60 Z" fill={getInflationColor(3.5)} stroke="#fff" strokeWidth="1" />
            <text x="205" y="65" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">NEA</text>

            {/* Catamarca/La Rioja */}
            <path d="M 90 90 L 130 85 L 145 140 L 100 145 Z" fill={getInflationColor(3.1)} stroke="#fff" strokeWidth="1" />

            {/* San Juan/Mendoza (Cuyo) */}
            <path d="M 70 140 L 110 145 L 120 220 L 75 230 Z" fill={getInflationColor(2.9)} stroke="#fff" strokeWidth="1" />
            <text x="90" y="185" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">Cuyo</text>

            {/* Córdoba/Entre Ríos/Santa Fe (Pampeana) */}
            <path d="M 140 130 L 200 125 L 220 240 L 160 260 L 120 240 Z" fill={getInflationColor(2.8)} stroke="#fff" strokeWidth="1" />
            <text x="170" y="180" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Pampeana</text>

            {/* GBA/Buenos Aires */}
            <ellipse cx="160" cy="290" rx="35" ry="45" fill={getInflationColor(3.2)} stroke="#fff" strokeWidth="1" />
            <text x="160" y="295" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">GBA</text>

            {/* La Pampa/sur Buenos Aires */}
            <path d="M 100 290 L 190 280 L 200 340 L 110 360 Z" fill={getInflationColor(2.8)} stroke="#fff" strokeWidth="1" />

            {/* Patagonia (Neuquén, Río Negro, Chubut, Santa Cruz) */}
            <path d="M 110 360 L 210 340 L 220 440 L 100 450 Z" fill={getInflationColor(2.5)} stroke="#fff" strokeWidth="1" />
            <text x="155" y="400" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Patagonia</text>
          </svg>
        </div>

        <div className="text-slate-400 text-xs">
          Escala: Rojo oscuro &gt;4% | Rojo &gt;3% | Naranja &gt;2% | Dorado &gt;1% | Verde &lt;1%
        </div>
      </div>

      {/* Polymarket Inflation Markets */}
      {polymarketInflation.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded p-4">
          <h3 className="text-white font-bold mb-4">MERCADOS DE PREDICCION - INFLACION</h3>
          <div className="space-y-2">
            {polymarketInflation.map((market, idx) => (
              <div key={idx} className="bg-slate-800 border border-slate-700 rounded p-3">
                <div className="text-slate-300 text-sm mb-2">{market.question}</div>
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-slate-400">Probabilidad</div>
                      <div className="text-white font-bold" style={{ color: "#4AF6C3" }}>
                        {(market.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Volumen 24h</div>
                      <div className="text-white font-bold">${(market.volume24h / 1_000_000).toFixed(1)}M</div>
                    </div>
                  </div>
                  <div className="text-slate-400">{new Date(market.endDate).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical IPC Table */}
      {ipcData && (
        <DataTable
          title="HISTORICO IPC VAR. MENSUAL"
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
    </div>
  )
}
