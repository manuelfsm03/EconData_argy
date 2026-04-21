"use client"

import { useBCRAData } from "@/hooks/use-bcra-data"
import { BBGAreaChart } from "@/components/charts/bbg-area-chart"
import { BBGDataTable } from "@/components/charts/bbg-data-table"
import { BBGChartPanel } from "@/components/charts/bbg-chart-panel"

export function TabReservas() {
  const reservas = useBCRAData(["reservas"], "max")
  const baseMon = useBCRAData(["base_monetaria"], "max")
  const circulacion = useBCRAData(["circulacion"], "max")
  const prestamos = useBCRAData(["prestamos_privado"], "max")

  const hasError = reservas.error || baseMon.error || circulacion.error || prestamos.error

  return (
    <div className="grid grid-cols-3 gap-px" style={{ background: "#222222" }}>
      {hasError && (
        <div className="col-span-3" style={{ 
          background: "#1a0a0a", 
          borderBottom: "1px solid var(--border-hi)",
          padding: "8px 12px",
          fontSize: "11px",
          color: "var(--negative)",
        }}>
          ⚠️ Error cargando datos del BCRA — verificá la conexión a la API
        </div>
      )}
      
      {/* Row 1: Charts */}
      <BBGChartPanel title="RESERVAS BCRA" loading={reservas.loading} error={reservas.error} source={reservas.source}>
        <BBGAreaChart
          title="RESERVAS BCRA — NIVEL"
          glossaryKey="RESERVAS"
          data={reservas.data}
          areas={[{ key: "reservas", name: "Reservas", color: "var(--positive)" }]}
          yAxisLabel="MM USD"
        />
      </BBGChartPanel>

      <BBGChartPanel title="BASE MONETARIA" loading={baseMon.loading} error={baseMon.error} source={baseMon.source}>
        <BBGAreaChart
          title="BASE MONETARIA — NIVEL"
          glossaryKey="BASE MONETARIA"
          data={baseMon.data}
          areas={[{ key: "base_monetaria", name: "Base Monetaria", color: "var(--amber)" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="CIRCULACION MONETARIA" loading={circulacion.loading} error={circulacion.error} source={circulacion.source}>
        <BBGAreaChart
          title="CIRCULACION MONETARIA — NIVEL"
          glossaryKey="CIRCULACION MONETARIA"
          data={circulacion.data}
          areas={[{ key: "circulacion", name: "Circulación", color: "#FFD700" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      {/* Row 2: Chart + Tables */}
      <BBGChartPanel title="PRESTAMOS PRIV" loading={prestamos.loading} error={prestamos.error} source={prestamos.source}>
        <BBGAreaChart
          title="PRESTAMOS AL SECTOR PRIVADO"
          glossaryKey="PRESTAMOS PRIVADO"
          data={prestamos.data}
          areas={[{ key: "prestamos_privado", name: "Préstamos", color: "#0068FF" }]}
          yAxisLabel="MM ARS"
        />
      </BBGChartPanel>

      <BBGChartPanel title="TABLA RESERVAS" loading={reservas.loading} error={reservas.error}>
        <BBGDataTable
          title="ULTIMOS 10 DIAS — RESERVAS"
          data={reservas.data}
          columns={[{ key: "reservas", header: "Reservas USD", format: "currency", currency: "USD" }]}
          maxRows={10}
        />
      </BBGChartPanel>

      <BBGChartPanel title="TABLA PRESTAMOS" loading={prestamos.loading} error={prestamos.error}>
        <BBGDataTable
          title="ULTIMOS 10 DIAS — PRESTAMOS PRIV"
          data={prestamos.data}
          columns={[{ key: "prestamos_privado", header: "Préstamos ARS", format: "currency", currency: "ARS" }]}
          maxRows={10}
        />
      </BBGChartPanel>
    </div>
  )
}
