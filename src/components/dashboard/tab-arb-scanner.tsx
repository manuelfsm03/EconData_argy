"use client"

import { useState, useEffect, useCallback } from "react"
import { BBGChartPanel } from "@/components/charts/bbg-chart-panel"

interface ArbOpportunity {
  id: string
  exchange: string
  type: "MEP" | "CCL" | "Crypto"
  buy: number
  sell: number
  spread: number
  spreadPercent: number
  updatedAt: string
}

// Mock arb data generator for demo
function generateArbData(): ArbOpportunity[] {
  const exchanges = [
    { name: "Apex", type: "MEP" as const },
    { name: "Rofex", type: "MEP" as const },
    { name: "Matba", type: "MEP" as const },
    { name: "IOL", type: "CCL" as const },
    { name: "Balanz", type: "CCL" as const },
    { name: "PPI", type: "CCL" as const },
    { name: "Binance", type: "Crypto" as const },
    { name: "Buenbit", type: "Crypto" as const },
    { name: "Lemon", type: "Crypto" as const },
    { name: "Ripio", type: "Crypto" as const },
  ]
  
  const now = new Date().toISOString()
  
  return exchanges.map((ex, i) => {
    const basePrice = ex.type === "MEP" ? 1180 : ex.type === "CCL" ? 1200 : 1220
    const volatility = ex.type === "Crypto" ? 20 : 8
    const buy = basePrice + (Math.random() - 0.5) * volatility
    const sell = buy + Math.random() * 5 + 1
    const spread = sell - buy
    const spreadPercent = (spread / buy) * 100
    
    return {
      id: `${ex.name}-${i}`,
      exchange: ex.name,
      type: ex.type,
      buy: Math.round(buy * 100) / 100,
      sell: Math.round(sell * 100) / 100,
      spread: Math.round(spread * 100) / 100,
      spreadPercent: Math.round(spreadPercent * 100) / 100,
      updatedAt: now,
    }
  })
}

function getSpreadColor(spreadPercent: number): string {
  if (spreadPercent >= 1.5) return "var(--negative)" // Red - high opportunity
  if (spreadPercent >= 1.0) return "var(--amber)" // Orange - medium
  if (spreadPercent >= 0.5) return "#FFD700" // Yellow - low
  return "var(--positive)" // Green - normal
}

function getSpreadBg(spreadPercent: number): string {
  if (spreadPercent >= 1.5) return "rgba(255, 67, 61, 0.15)"
  if (spreadPercent >= 1.0) return "rgba(255, 160, 40, 0.1)"
  if (spreadPercent >= 0.5) return "rgba(255, 215, 0, 0.1)"
  return "transparent"
}

export function TabArbScanner() {
  const [arbData, setArbData] = useState<ArbOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // In production, this would fetch from an API
      // For demo, generate mock data
      const data = generateArbData()
      setArbData(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching arb data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchData])

  const mepData = arbData.filter(d => d.type === "MEP")
  const cclData = arbData.filter(d => d.type === "CCL")
  const cryptoData = arbData.filter(d => d.type === "Crypto")

  const formatCurrency = (v: number) => 
    v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="grid grid-cols-3 gap-px" style={{ background: "#222222" }}>
      {/* MEP Panel */}
      <BBGChartPanel title="ARBITRAJE MEP" loading={loading} error={null}>
        <div className="p-2">
          <table style={{ width: "100%", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hi)" }}>
                <th style={{ textAlign: "left", padding: "4px", color: "var(--text-dim)" }}>Mercado</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Compra</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Venta</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {mepData.map((row, i) => (
                <tr 
                  key={row.id} 
                  style={{ 
                    background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
                    backgroundColor: getSpreadBg(row.spreadPercent),
                  }}
                >
                  <td style={{ padding: "4px", color: "var(--amber)", fontWeight: 600 }}>{row.exchange}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.buy)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.sell)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: getSpreadColor(row.spreadPercent), fontWeight: 600 }}>
                    {row.spreadPercent.toFixed(2)}%
                    {row.spreadPercent >= 1.5 && " 🔥"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BBGChartPanel>

      {/* CCL Panel */}
      <BBGChartPanel title="ARBITRAJE CCL" loading={loading} error={null}>
        <div className="p-2">
          <table style={{ width: "100%", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hi)" }}>
                <th style={{ textAlign: "left", padding: "4px", color: "var(--text-dim)" }}>Exchange</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Compra</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Venta</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {cclData.map((row, i) => (
                <tr 
                  key={row.id}
                  style={{ 
                    background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
                    backgroundColor: getSpreadBg(row.spreadPercent),
                  }}
                >
                  <td style={{ padding: "4px", color: "var(--amber)", fontWeight: 600 }}>{row.exchange}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.buy)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.sell)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: getSpreadColor(row.spreadPercent), fontWeight: 600 }}>
                    {row.spreadPercent.toFixed(2)}%
                    {row.spreadPercent >= 1.5 && " 🔥"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BBGChartPanel>

      {/* Crypto Panel */}
      <BBGChartPanel title="ARBITRAJE CRYPTO" loading={loading} error={null}>
        <div className="p-2">
          <table style={{ width: "100%", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-hi)" }}>
                <th style={{ textAlign: "left", padding: "4px", color: "var(--text-dim)" }}>Exchange</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Compra</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Venta</th>
                <th style={{ textAlign: "right", padding: "4px", color: "var(--text-dim)" }}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {cryptoData.map((row, i) => (
                <tr 
                  key={row.id}
                  style={{ 
                    background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
                    backgroundColor: getSpreadBg(row.spreadPercent),
                  }}
                >
                  <td style={{ padding: "4px", color: "var(--positive)", fontWeight: 600 }}>{row.exchange}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.buy)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: "var(--text)" }}>{formatCurrency(row.sell)}</td>
                  <td style={{ textAlign: "right", padding: "4px", color: getSpreadColor(row.spreadPercent), fontWeight: 600 }}>
                    {row.spreadPercent.toFixed(2)}%
                    {row.spreadPercent >= 1.5 && " 🔥"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BBGChartPanel>

      {/* Summary Panel */}
      <BBGChartPanel title="OPORTUNIDADES DESTACADAS" loading={loading} error={null}>
        <div className="p-2">
          {arbData
            .filter(d => d.spreadPercent >= 1.0)
            .sort((a, b) => b.spreadPercent - a.spreadPercent)
            .slice(0, 5)
            .map((row, i) => (
              <div 
                key={row.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px",
                  marginBottom: "4px",
                  background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
                  borderLeft: `3px solid ${getSpreadColor(row.spreadPercent)}`,
                }}
              >
                <div>
                  <span style={{ color: "var(--amber)", fontWeight: 600, fontSize: "12px" }}>{row.exchange}</span>
                  <span style={{ color: "var(--text-dim)", fontSize: "10px", marginLeft: "8px" }}>{row.type}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: getSpreadColor(row.spreadPercent), fontWeight: 600, fontSize: "14px" }}>
                    {row.spreadPercent.toFixed(2)}%
                  </div>
                  <div style={{ color: "var(--text-dim)", fontSize: "9px" }}>
                    ${formatCurrency(row.buy)} / ${formatCurrency(row.sell)}
                  </div>
                </div>
              </div>
            ))}
          {arbData.filter(d => d.spreadPercent >= 1.0).length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-dim)" }}>
              No hay oportunidades destacadas
              <br />
              <span style={{ fontSize: "10px" }}>(Spread &lt; 1.0%)</span>
            </div>
          )}
        </div>
      </BBGChartPanel>

      {/* Legend Panel */}
      <BBGChartPanel title="LEyenda" loading={false} error={null}>
        <div className="p-2" style={{ fontSize: "11px" }}>
          <div style={{ marginBottom: "8px", color: "var(--text-dim)" }}>Indicadores de Spread:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--negative)" }}>●</span>
              <span>&gt;= 1.5% Alta oportunidad 🔥</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--amber)" }}>●</span>
              <span>&gt;= 1.0% Oportunidad</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#FFD700" }}>●</span>
              <span>&gt;= 0.5% Moderado</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--positive)" }}>●</span>
              <span>&lt; 0.5% Normal</span>
            </div>
          </div>
          <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px solid var(--border-hi)", color: "var(--text-dim)", fontSize: "10px" }}>
            Actualización automática cada 30 segundos
            {lastUpdate && (
              <div>Última: {lastUpdate.toLocaleTimeString("es-AR")}</div>
            )}
          </div>
        </div>
      </BBGChartPanel>

      {/* Placeholder for future chart */}
      <BBGChartPanel title="HISTORICO SPREADS" loading={loading} error={null}>
        <div style={{ 
          height: "120px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          color: "var(--text-dim)",
          fontSize: "11px"
        }}>
          <div style={{ textAlign: "center" }}>
            <div>Gráfico histórico de spreads</div>
            <div style={{ fontSize: "10px", marginTop: "4px" }}>(Próximamente)</div>
          </div>
        </div>
      </BBGChartPanel>
    </div>
  )
}
