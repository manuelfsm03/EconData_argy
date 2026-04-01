"use client"

import { useState, useEffect } from "react"
import { PriceChart } from "./price-chart"
import { DataTable } from "./data-table"

interface Inflation {
  date: string
  monthly: number | null
  interannual: number | null
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

export function InflationView({ inflation }: { inflation: Inflation[] }) {
  const [regionalData, setRegionalData] = useState<RegionalInflation[]>([])
  const [polymarketInflation, setPolymarketInflation] = useState<PolymarketInflation[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  useEffect(() => {
    // Mock regional data (in production, fetch from /api/macro?endpoint=ipc_regional)
    const mockRegional: RegionalInflation[] = [
      { region: "GBA", inflation: 3.2, color: "#FF433D" },
      { region: "Pampeana", inflation: 2.8, color: "#FFA028" },
      { region: "NEA", inflation: 3.5, color: "#FF6B6B" },
      { region: "NOA", inflation: 3.1, color: "#FFB347" },
      { region: "Cuyo", inflation: 2.9, color: "#FFD700" },
      { region: "Patagonia", inflation: 2.5, color: "#4AF6C3" },
    ]
    setRegionalData(mockRegional)

    // Mock polymarket inflation markets
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

  return (
    <div className="space-y-4">
      {/* Inflación Mensual Chart */}
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

      {/* Regional Inflation Map */}
      <div className="bg-slate-900 border border-slate-700 rounded p-4">
        <h3 className="text-white font-bold mb-4">INFLACION POR REGION (Última medición)</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {regionalData.map((region) => (
            <div
              key={region.region}
              className="bg-slate-800 border border-slate-700 rounded p-3 cursor-pointer hover:border-slate-600"
              onClick={() => setSelectedRegion(region.region)}
              style={{ borderLeftColor: region.color, borderLeftWidth: "3px" }}
            >
              <div className="text-slate-400 text-xs uppercase">{region.region}</div>
              <div className="text-white font-bold text-lg">{region.inflation.toFixed(1)}%</div>
            </div>
          ))}
        </div>

        {/* Argentina Map SVG - Simplified */}
        <div className="mt-6 flex justify-center">
          <svg viewBox="0 0 200 400" width="200" height="400" className="mb-4">
            {/* GBA - Buenos Aires region */}
            <rect x="70" y="150" width="60" height="50" fill={getInflationColor(3.2)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="100" y="180" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">GBA</text>

            {/* Pampeana */}
            <rect x="40" y="210" width="120" height="80" fill={getInflationColor(2.8)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="100" y="260" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Pampeana</text>

            {/* NEA */}
            <rect x="120" y="50" width="70" height="80" fill={getInflationColor(3.5)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="155" y="95" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">NEA</text>

            {/* NOA */}
            <rect x="40" y="50" width="70" height="80" fill={getInflationColor(3.1)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="75" y="95" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">NOA</text>

            {/* Cuyo */}
            <rect x="50" y="130" width="40" height="50" fill={getInflationColor(2.9)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="70" y="160" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">Cuyo</text>

            {/* Patagonia */}
            <rect x="60" y="300" width="80" height="90" fill={getInflationColor(2.5)} opacity="0.8" stroke="#fff" strokeWidth="1" />
            <text x="100" y="350" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Patagonia</text>
          </svg>
        </div>

        <div className="text-slate-400 text-xs mt-2">
          Colores: Rojo oscuro &gt;4% | Rojo &gt;3% | Naranja &gt;2% | Dorado &gt;1% | Verde &lt;1%
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
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-slate-400 text-xs">Probabilidad</div>
                      <div className="text-white font-bold text-lg" style={{ color: "#4AF6C3" }}>
                        {(market.probability * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Volumen 24h</div>
                      <div className="text-white font-bold">${(market.volume24h / 1_000_000).toFixed(1)}M</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Liquidez</div>
                      <div className="text-white font-bold">${(market.liquidity / 1_000_000).toFixed(1)}M</div>
                    </div>
                  </div>
                  <div className="text-slate-400 text-xs">{new Date(market.endDate).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Inflation Table */}
      <DataTable
        title="HISTORICO DE INFLACION"
        data={inflation}
        columns={[
          {
            key: "date",
            header: "Fecha",
            render: (v) => new Date(v as string).toLocaleDateString("es-AR")
          },
          {
            key: "monthly",
            header: "Mensual",
            numeric: true,
            render: (v) => {
              const val = v as number | null
              return <span style={{ color: "#FF433D" }}>{val != null ? `${(val * 100).toFixed(2)}%` : "-"}</span>
            }
          },
          {
            key: "interannual",
            header: "Interanual",
            numeric: true,
            render: (v) => {
              const val = v as number | null
              return <span style={{ color: "#FFA028" }}>{val != null ? `${(val * 100).toFixed(2)}%` : "-"}</span>
            }
          },
        ]}
      />
    </div>
  )
}
