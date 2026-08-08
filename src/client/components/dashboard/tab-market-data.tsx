"use client"

import { useBCRAData } from "@/client/hooks/use-bcra-data"
import { BBGLineChart } from "@/client/components/charts/bbg-line-chart"
import { BBGChartPanel } from "@/client/components/charts/bbg-chart-panel"

function fmtVal(v: unknown): string {
  if (v == null) return "-"
  return Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TabMarketData() {
  const rates = useBCRAData(["tc_minorista", "tc_mayorista", "badlar", "tm20", "depositos_30d"], "max")
  const reserves = useBCRAData(["reservas"], "max")
  const indices = useBCRAData(["cer", "uva"], "max")

  const latest = rates.data.length > 0 ? rates.data[rates.data.length - 1] : null
  const latestRes = reserves.data.length > 0 ? reserves.data[reserves.data.length - 1] : null
  const latestIdx = indices.data.length > 0 ? indices.data[indices.data.length - 1] : null

  const hasError = rates.error || reserves.error || indices.error

  return (
    <div>
      {/* Error banner */}
      {hasError && (
        <div style={{ 
          background: "#1a0a0a", 
          borderBottom: "1px solid var(--border-hi)",
          padding: "8px 12px",
          fontSize: "11px",
          color: "var(--negative)",
        }}>
          ⚠️ Error cargando datos del BCRA — verificá la conexión a la API
        </div>
      )}
      
      {/* Key metrics strip */}
      <div className="bbg-panel">
        <div className="bbg-panel-header">BCRA MARKET DATA — LIVE</div>
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              <th className="text-right">Valor</th>
              <th>Indicador</th>
              <th className="text-right">Valor</th>
              <th>Indicador</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "var(--bg)" }}>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>TC MINORISTA</td>
              <td className="text-right" style={{ color: "var(--text)", fontWeight: 600 }}>{fmtVal(latest?.tc_minorista)}</td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>BADLAR</td>
              <td className="text-right" style={{ color: "var(--positive)", fontWeight: 600 }}>{latest?.badlar ? fmtVal(latest.badlar) + "%" : "-"}</td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>RESERVAS</td>
              <td className="text-right" style={{ color: "var(--positive)", fontWeight: 600 }}>USD {fmtVal(latestRes?.reservas)}</td>
            </tr>
            <tr style={{ background: "var(--bg)" }}>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>TC MAYORISTA</td>
              <td className="text-right" style={{ color: "var(--text)", fontWeight: 600 }}>{fmtVal(latest?.tc_mayorista)}</td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>TM20</td>
              <td className="text-right" style={{ color: "#FFD700", fontWeight: 600 }}>{latest?.tm20 ? fmtVal(latest.tm20) + "%" : "-"}</td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>CER</td>
              <td className="text-right" style={{ color: "var(--text)", fontWeight: 600 }}>{fmtVal(latestIdx?.cer)}</td>
            </tr>
            <tr style={{ background: "var(--bg)" }}>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>SPREAD MIN/MAY</td>
              <td className="text-right" style={{ color: "var(--negative)", fontWeight: 600 }}>
                {latest?.tc_minorista && latest?.tc_mayorista
                  ? ((Number(latest.tc_minorista) / Number(latest.tc_mayorista) - 1) * 100).toFixed(2) + "%"
                  : "-"}
              </td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>DEP 30D</td>
              <td className="text-right" style={{ color: "#0068FF", fontWeight: 600 }}>{latest?.depositos_30d ? fmtVal(latest.depositos_30d) + "%" : "-"}</td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>UVA</td>
              <td className="text-right" style={{ color: "var(--text)", fontWeight: 600 }}>{fmtVal(latestIdx?.uva)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-3 gap-px mt-px" style={{ background: "#222222" }}>
        <BBGChartPanel title="TC MAYORISTA" loading={rates.loading} error={rates.error}>
          <BBGLineChart
            title="TIPO DE CAMBIO MAYORISTA (3M)"
            data={rates.data}
            lines={[{ key: "tc_mayorista", name: "TC Mayorista", color: "var(--text)" }]}
            yAxisLabel="ARS"
          />
        </BBGChartPanel>

        <BBGChartPanel title="BADLAR" loading={rates.loading} error={rates.error}>
          <BBGLineChart
            title="BADLAR BANCOS PRIVADOS (3M)"
            data={rates.data}
            lines={[{ key: "badlar", name: "BADLAR", color: "var(--amber)" }]}
            yAxisLabel="%"
            formatValue={(v) => v.toFixed(1) + "%"}
          />
        </BBGChartPanel>

        <BBGChartPanel title="RESERVAS" loading={reserves.loading} error={reserves.error}>
          <BBGLineChart
            title="RESERVAS INTERNACIONALES (3M)"
            data={reserves.data}
            lines={[{ key: "reservas", name: "Reservas", color: "var(--positive)" }]}
            yAxisLabel="MM USD"
          />
        </BBGChartPanel>
      </div>
    </div>
  )
}
