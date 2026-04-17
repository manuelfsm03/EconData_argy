"use client"

import { useBCRAData } from "@/hooks/use-bcra-data"
import { BBGAreaChart } from "@/components/charts/bbg-area-chart"
import { BBGLineChart } from "@/components/charts/bbg-line-chart"
import { BBGChartPanel } from "@/components/charts/bbg-chart-panel"

export function TabDepositos() {
  const depositosCC = useBCRAData(["depositos_cc"], "max")
  const cajasAhorro = useBCRAData(["cajas_ahorro"], "max")
  const plazosFijos = useBCRAData(["plazos_fijos"], "max")
  const components = useBCRAData(["depositos_cc", "cajas_ahorro", "plazos_fijos"], "max")
  const baseMon = useBCRAData(["base_monetaria"], "max")
  const circulante = useBCRAData(["circulacion"], "max")
  const prestamos = useBCRAData(["prestamos_privado"], "max")
  const m2 = useBCRAData(["m2_privado_yoy"], "max")

  return (
    <div className="grid grid-cols-3 gap-px" style={{ background: "#222222" }}>
      {/* Row 1 */}
      <BBGChartPanel title="DEPOSITOS CTA CTE" loading={depositosCC.loading} error={depositosCC.error} source={depositosCC.source}>
        <BBGAreaChart
          title="DEPOSITOS CUENTA CORRIENTE — NIVEL"
          glossaryKey="DEPOSITOS CC"
          data={depositosCC.data}
          areas={[{ key: "depositos_cc", name: "Cta Corriente", color: "#4AF6C3" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="CAJAS DE AHORRO" loading={cajasAhorro.loading} error={cajasAhorro.error} source={cajasAhorro.source}>
        <BBGAreaChart
          title="CAJAS DE AHORRO — NIVEL"
          glossaryKey="CAJAS DE AHORRO"
          data={cajasAhorro.data}
          areas={[{ key: "cajas_ahorro", name: "Cajas Ahorro", color: "#FFA028" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="PLAZOS FIJOS" loading={plazosFijos.loading} error={plazosFijos.error} source={plazosFijos.source}>
        <BBGAreaChart
          title="PLAZOS FIJOS — NIVEL"
          glossaryKey="TASA PLAZO FIJO"
          data={plazosFijos.data}
          areas={[{ key: "plazos_fijos", name: "Plazos Fijos", color: "#0068FF" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      {/* Row 2 */}
      <BBGChartPanel title="COMPONENTES DEPOSITOS" loading={components.loading} error={components.error} source={components.source}>
        <BBGLineChart
          title="COMPONENTES DE DEPOSITOS"
          glossaryKey="COMPONENTES DEPOSITOS"
          data={components.data}
          lines={[
            { key: "depositos_cc", name: "Cta Cte", color: "#4AF6C3" },
            { key: "cajas_ahorro", name: "Cajas Ahorro", color: "#FFA028" },
            { key: "plazos_fijos", name: "Plazos Fijos", color: "#0068FF" },
          ]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="BASE MONETARIA" loading={baseMon.loading} error={baseMon.error} source={baseMon.source}>
        <BBGAreaChart
          title="BASE MONETARIA — NIVEL"
          glossaryKey="BASE MONETARIA"
          data={baseMon.data}
          areas={[{ key: "base_monetaria", name: "Base Monetaria", color: "#FFD700" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="CIRCULACION MONETARIA" loading={circulante.loading} error={circulante.error} source={circulante.source}>
        <BBGAreaChart
          title="CIRCULACION MONETARIA — NIVEL"
          glossaryKey="CIRCULACION MONETARIA"
          data={circulante.data}
          areas={[{ key: "circulacion", name: "Circulación", color: "#FF433D" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      {/* Row 3 */}
      <BBGChartPanel title="PRESTAMOS PRIV" loading={prestamos.loading} error={prestamos.error} source={prestamos.source}>
        <BBGAreaChart
          title="PRESTAMOS AL SECTOR PRIVADO — NIVEL"
          glossaryKey="PRESTAMOS PRIVADO"
          data={prestamos.data}
          areas={[{ key: "prestamos_privado", name: "Préstamos Priv.", color: "#4AF6C3" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="M2 PRIVADO YOY" loading={m2.loading} error={m2.error} source={m2.source}>
        <BBGLineChart
          title="M2 PRIVADO — YOY"
          glossaryKey="M2"
          data={m2.data}
          lines={[{ key: "m2_privado_yoy", name: "M2 Priv YoY", color: "#FFA028" }]}
          yAxisLabel="%"
          formatValue={(v) => v.toFixed(1) + "%"}
          showZeroLine
        />
      </BBGChartPanel>

      {/* Empty placeholder for 3rd column */}
      <div style={{ background: "#000000" }} />
    </div>
  )
}
