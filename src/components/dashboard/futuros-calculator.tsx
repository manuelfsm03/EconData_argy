"use client"

import { useState, useMemo } from "react"

interface RofexPosition {
  position: string
  maturityLabel: string | null
  price: number | null
  devaluation: number | null
  monthlyDevaluation: number | null
  tna: number | null
}

interface FuturosCalculatorProps {
  rofexData: RofexPosition[]
  spotA3500: number | null
}

function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return "-"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "-"
  return (v * 100).toFixed(2) + "%"
}

function valColor(v: number | null | undefined): string {
  if (v == null) return "#555555"
  if (v > 0) return "#4AF6C3"
  if (v < 0) return "#FF433D"
  return "#FFA028"
}

export function FuturosCalculator({ rofexData, spotA3500 }: FuturosCalculatorProps) {
  const [usdAmount, setUsdAmount] = useState(100000)
  const [commissionPct, setCommissionPct] = useState(0.5)
  const [guaranteePct, setGuaranteePct] = useState(20)
  const [customSpot, setCustomSpot] = useState<number | undefined>(undefined)

  const spot = customSpot ?? spotA3500 ?? 0

  // Calculate coverage simulation for each Rofex position
  const simulations = useMemo(() => {
    if (!spot || spot === 0) return []

    return rofexData
      .filter((r) => r.price != null && r.price > 0)
      .map((r) => {
        const futurePrice = r.price!
        const contracts = Math.floor(usdAmount / 1000) // 1 contract = 1000 USD
        const notionalUSD = contracts * 1000
        const notionalARS = notionalUSD * spot

        // Devaluation implied
        const devImpl = (futurePrice / spot - 1)

        // Monthly devaluation
        const monthlyDev = r.monthlyDevaluation ?? 0

        // TNA & CFT (already from Rofex data or computed)
        const tna = r.tna ?? 0
        // CFT = (1 + TNA)^(days/365) - 1, approximate with TNA * 1.05
        const cft = tna * 1.05

        // Guarantee per USD
        const guaranteePerUSD = futurePrice * (guaranteePct / 100)
        const totalGuaranteeARS = guaranteePerUSD * notionalUSD
        const totalGuaranteeUSD = totalGuaranteeARS / spot

        // Commission
        const commissionARS = notionalARS * (commissionPct / 100)

        // Simulation: if spot at maturity equals futures price
        // P&L = (futurePrice - spot) * notionalUSD (for long hedge)
        const pnlARS = (futurePrice - spot) * notionalUSD
        const pnlUSD = pnlARS / futurePrice
        // Coverage cost = commission + (futures premium * contracts)
        const coverageCostARS = commissionARS + (futurePrice - spot) * notionalUSD
        const coverageCostPct = coverageCostARS / notionalARS

        return {
          position: r.position,
          maturity: r.maturityLabel || r.position,
          futurePrice,
          devImpl,
          monthlyDev,
          tna,
          cft,
          guaranteePerUSD,
          totalGuaranteeARS,
          totalGuaranteeUSD,
          contracts,
          notionalUSD,
          notionalARS,
          commissionARS,
          pnlARS,
          pnlUSD,
          coverageCostARS,
          coverageCostPct,
        }
      })
  }, [rofexData, spot, usdAmount, commissionPct, guaranteePct])

  return (
    <div>
      {/* Input panel */}
      <div className="bbg-panel mb-px">
        <div className="bbg-panel-header">SIMULADOR DE COBERTURA — FUTUROS ROFEX</div>
        <div className="flex gap-6 p-3" style={{ background: "#0a0a0a" }}>
          <div className="flex items-center gap-2">
            <label style={{ color: "#FFA028", fontSize: "10px", fontWeight: 600 }}>USD AMOUNT:</label>
            <input
              type="number"
              value={usdAmount}
              onChange={(e) => setUsdAmount(Number(e.target.value) || 0)}
              className="text-right"
              style={{
                background: "#000000", border: "1px solid #333333", color: "#FFFFFF",
                padding: "3px 8px", fontSize: "11px", fontFamily: "inherit",
                width: "120px", fontWeight: 600,
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ color: "#FFA028", fontSize: "10px", fontWeight: 600 }}>COMISION %:</label>
            <input
              type="number"
              step="0.1"
              value={commissionPct}
              onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
              className="text-right"
              style={{
                background: "#000000", border: "1px solid #333333", color: "#FFFFFF",
                padding: "3px 8px", fontSize: "11px", fontFamily: "inherit",
                width: "80px", fontWeight: 600,
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ color: "#FFA028", fontSize: "10px", fontWeight: 600 }}>GARANTIA %:</label>
            <input
              type="number"
              step="1"
              value={guaranteePct}
              onChange={(e) => setGuaranteePct(Number(e.target.value) || 0)}
              className="text-right"
              style={{
                background: "#000000", border: "1px solid #333333", color: "#FFFFFF",
                padding: "3px 8px", fontSize: "11px", fontFamily: "inherit",
                width: "80px", fontWeight: 600,
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ color: "#FFA028", fontSize: "10px", fontWeight: 600 }}>SPOT A3500:</label>
            <input
              type="number"
              step="0.01"
              value={customSpot ?? spot}
              onChange={(e) => setCustomSpot(Number(e.target.value) || undefined)}
              className="text-right"
              style={{
                background: "#000000", border: "1px solid #333333", color: "#FFFFFF",
                padding: "3px 8px", fontSize: "11px", fontFamily: "inherit",
                width: "100px", fontWeight: 600,
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: "#555555", fontSize: "10px" }}>CONTRATOS: {Math.floor(usdAmount / 1000)}</span>
            <span style={{ color: "#555555", fontSize: "10px" }}>|</span>
            <span style={{ color: "#555555", fontSize: "10px" }}>NOCIONAL: USD {fmtNum(Math.floor(usdAmount / 1000) * 1000, 0)}</span>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="bbg-panel">
        <div className="bbg-panel-header">COBERTURA POR POSICION</div>
        <div className="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Posicion</th>
                <th className="text-right">Cotizacion</th>
                <th className="text-right">Dev. Impl.</th>
                <th className="text-right">Dev. Mens.</th>
                <th className="text-right">TNA</th>
                <th className="text-right">CFT</th>
                <th className="text-right">Gtia x USD</th>
                <th className="text-right">Gtia Nec. ARS</th>
                <th className="text-right">Gtia Nec. USD</th>
                <th className="text-right">P&L ARS</th>
                <th className="text-right">P&L USD</th>
                <th className="text-right">Costo Cob.</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map((sim, i) => (
                <tr key={sim.position} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
                  <td style={{ color: "#FFA028", fontWeight: 700 }}>{sim.position}</td>
                  <td className="text-right" style={{ color: "#FFFFFF", fontWeight: 600 }}>{fmtNum(sim.futurePrice)}</td>
                  <td className="text-right" style={{ color: valColor(sim.devImpl), fontWeight: 600 }}>{fmtPct(sim.devImpl)}</td>
                  <td className="text-right" style={{ color: valColor(sim.monthlyDev), fontWeight: 600 }}>{fmtPct(sim.monthlyDev)}</td>
                  <td className="text-right" style={{ color: "#FFD700", fontWeight: 600 }}>{fmtPct(sim.tna)}</td>
                  <td className="text-right" style={{ color: "#FFD700", fontWeight: 600 }}>{fmtPct(sim.cft)}</td>
                  <td className="text-right" style={{ color: "#FFFFFF", fontWeight: 600 }}>{fmtNum(sim.guaranteePerUSD)}</td>
                  <td className="text-right" style={{ color: "#FFFFFF", fontWeight: 600 }}>{fmtNum(sim.totalGuaranteeARS, 0)}</td>
                  <td className="text-right" style={{ color: "#0068FF", fontWeight: 600 }}>{fmtNum(sim.totalGuaranteeUSD, 0)}</td>
                  <td className="text-right" style={{ color: valColor(sim.pnlARS), fontWeight: 600 }}>{fmtNum(sim.pnlARS, 0)}</td>
                  <td className="text-right" style={{ color: valColor(sim.pnlUSD), fontWeight: 600 }}>{fmtNum(sim.pnlUSD, 0)}</td>
                  <td className="text-right" style={{ color: valColor(sim.coverageCostPct), fontWeight: 600 }}>{fmtPct(sim.coverageCostPct)}</td>
                </tr>
              ))}
              {simulations.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ color: "#555555", textAlign: "center", padding: "20px" }}>
                    {spot === 0 ? "NO SPOT RATE AVAILABLE" : "NO ROFEX POSITIONS AVAILABLE"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "6px 12px", borderTop: "1px solid #111111", fontSize: "9px", color: "#555555" }}>
          FORMULA: DEV. IMPL = (FUTURO/SPOT - 1) | GTIA X USD = FUTURO * GTIA% | P&L = (FUTURO - SPOT) * NOCIONAL
        </div>
      </div>
    </div>
  )
}
