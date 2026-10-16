"use client"

/**
 * Gráfico del informe semanal. Reusa los componentes del dashboard
 * (BBGLineChart / BBGAreaChart) sin tocarlos: acá solo se les pasa la serie ya
 * extraída (src/lib/informe/extractores.ts) con el rango completo y sin los
 * controles interactivos, para que el informe se vea igual en pantalla y en
 * "Imprimir -> PDF".
 *
 * Importante: defaultRange="all" es obligatorio. Los gráficos filtran por
 * defecto el último mes contando desde HOY, y eso vaciaría series con datos
 * anteriores.
 */

import { BBGAreaChart } from "@/client/components/charts/bbg-area-chart"
import { BBGLineChart } from "@/client/components/charts/bbg-line-chart"
import { formatearValor, type ResultadoSerie } from "@/lib/informe/extractores"

export function InformeChart({ titulo, serie }: { titulo: string; serie: ResultadoSerie }) {
  const formatValue = (v: number) => formatearValor(v, serie.formato)

  if (serie.tipo === "area") {
    return (
      <BBGAreaChart
        title={titulo}
        data={serie.filas}
        areas={serie.series.map((s) => ({ key: s.key, name: s.name, color: s.color }))}
        stacked={serie.apilado}
        yAxisLabel={serie.etiquetaY}
        height={190}
        formatValue={formatValue}
        enableDateRange={false}
        defaultRange="all"
      />
    )
  }

  return (
    <BBGLineChart
      title={titulo}
      data={serie.filas}
      lines={serie.series.map((s) => ({ key: s.key, name: s.name, color: s.color, dashed: s.dashed, yAxisId: s.eje }))}
      yAxisLabel={serie.etiquetaY}
      height={190}
      formatValue={formatValue}
      enableDateRange={false}
      enableLineToggle={false}
      defaultRange="all"
    />
  )
}
