"use client"

import { useMemo } from "react"
import { useBCRAData } from "@/hooks/use-bcra-data"
import { BBGAreaChart } from "@/components/charts/bbg-area-chart"
import { BBGLineChart } from "@/components/charts/bbg-line-chart"
import { BBGChartPanel } from "@/components/charts/bbg-chart-panel"

export function TabPlazosFijos() {
  // Fetch all series needed for this tab
  const plazosFijos = useBCRAData(["plazos_fijos"], "max")
  const rates = useBCRAData(["badlar", "depositos_30d", "tm20"], "max")
  const deposits = useBCRAData(["depositos_cc", "cajas_ahorro", "plazos_fijos"], "max")
  const ipc = useBCRAData(["ipc_interanual"], "max")

  // Compute BADLAR/Dep30d ratio
  const ratioData = useMemo(() => {
    return rates.data
      .filter((d) => d.badlar && d.depositos_30d && Number(d.depositos_30d) !== 0)
      .map((d) => ({
        ...d,
        ratio: Number(d.badlar) / Number(d.depositos_30d),
      }))
  }, [rates.data])

  return (
    <div className="grid grid-cols-3 gap-px" style={{ background: "#222222" }}>
      {/* Row 1 */}
      <BBGChartPanel title="PLAZOS FIJOS PRIV ARS" loading={plazosFijos.loading} error={plazosFijos.error} source={plazosFijos.source}>
        <BBGAreaChart
          title="PLAZOS FIJOS PRIVADOS ARS — NIVEL"
          glossaryKey="TASA PLAZO FIJO"
          data={plazosFijos.data}
          areas={[{ key: "plazos_fijos", name: "Plazos Fijos", color: "var(--positive)" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="BADLAR VS DEP 30D" loading={rates.loading} error={rates.error} source={rates.source}>
        <BBGLineChart
          title="TASA BADLAR VS DEPOSITOS 30D"
          glossaryKey="BADLAR"
          data={rates.data}
          lines={[
            { key: "badlar", name: "BADLAR", color: "var(--amber)" },
            { key: "depositos_30d", name: "Dep 30d", color: "#0068FF" },
          ]}
          yAxisLabel="Tasa %"
          formatValue={(v) => v.toFixed(1) + "%"}
        />
      </BBGChartPanel>

      <BBGChartPanel title="TM20 VS BADLAR" loading={rates.loading} error={rates.error} source={rates.source}>
        <BBGLineChart
          title="TASA TM20 VS BADLAR"
          glossaryKey="TM20"
          data={rates.data}
          lines={[
            { key: "tm20", name: "TM20", color: "#FFD700" },
            { key: "badlar", name: "BADLAR", color: "var(--amber)" },
          ]}
          yAxisLabel="Tasa %"
          formatValue={(v) => v.toFixed(1) + "%"}
        />
      </BBGChartPanel>

      {/* Row 2 */}
      <BBGChartPanel title="COMPONENTES DEPOSITOS" loading={deposits.loading} error={deposits.error} source={deposits.source}>
        <BBGLineChart
          title="COMPONENTES DE DEPOSITOS"
          glossaryKey="COMPONENTES DEPOSITOS"
          data={deposits.data}
          lines={[
            { key: "depositos_cc", name: "Cta Cte", color: "var(--positive)" },
            { key: "cajas_ahorro", name: "Cajas Ahorro", color: "var(--amber)" },
            { key: "plazos_fijos", name: "Plazos Fijos", color: "#0068FF" },
          ]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="RATIO BADLAR/DEP30D" loading={rates.loading} error={rates.error}>
        <BBGLineChart
          title="RATIO BADLAR / DEPOSITOS 30D"
          glossaryKey="RATIO BADLAR"
          data={ratioData}
          lines={[{ key: "ratio", name: "BADLAR/Dep30d", color: "var(--negative)" }]}
          yAxisLabel="Ratio"
          formatValue={(v) => v.toFixed(2)}
        />
      </BBGChartPanel>

      <BBGChartPanel title="IPC INTERANUAL" loading={ipc.loading} error={ipc.error} source={ipc.source}>
        <BBGLineChart
          title="IPC — VARIACION INTERANUAL"
          glossaryKey="IPC INTERANUAL"
          data={ipc.data}
          lines={[{ key: "ipc_interanual", name: "IPC Interanual", color: "var(--negative)" }]}
          yAxisLabel="%"
          formatValue={(v) => v.toFixed(1) + "%"}
        />
      </BBGChartPanel>
    </div>
  )
}
