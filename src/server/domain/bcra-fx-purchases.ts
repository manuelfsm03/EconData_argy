export type BcraPurchasePoint = {
  fecha: string
  monto: number
  acumulado_mensual: number
}

type RawBcraPoint = {
  fecha: string
  valor: number
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function buildBcraPurchaseSeries(points: RawBcraPoint[]): BcraPurchasePoint[] {
  const byDate = new Map<string, number>()
  for (const point of points) {
    if (!isIsoDate(point.fecha) || !Number.isFinite(point.valor)) continue
    byDate.set(point.fecha, point.valor)
  }

  let currentMonth = ""
  let monthlyTotal = 0
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fecha, monto]) => {
      const month = fecha.slice(0, 7)
      if (month !== currentMonth) {
        currentMonth = month
        monthlyTotal = 0
      }
      monthlyTotal += monto
      return { fecha, monto, acumulado_mensual: monthlyTotal }
    })
}

function extremeOrNull(values: number[], mode: "max" | "min"): number | null {
  if (values.length === 0) return null
  return mode === "max" ? Math.max(...values) : Math.min(...values)
}

export function summarizeBcraPurchases(rows: BcraPurchasePoint[], visibleLimit = 30) {
  const latest = rows.at(-1)
  if (!latest) {
    return {
      datos: [] as BcraPurchasePoint[],
      resumen: {
        fecha_corte: null,
        mes_actual: null,
        acumulado_anual: null,
        mayor_compra_periodo: null,
        mayor_venta_periodo: null,
      },
    }
  }

  const visible = rows.slice(-visibleLimit)
  const latestYear = latest.fecha.slice(0, 4)
  const latestMonth = latest.fecha.slice(0, 7)
  const annual = rows.filter(row => row.fecha.startsWith(latestYear))
  const monthly = rows.filter(row => row.fecha.startsWith(latestMonth))

  return {
    datos: visible,
    resumen: {
      fecha_corte: latest.fecha,
      mes_actual: monthly.at(-1)?.acumulado_mensual ?? null,
      acumulado_anual: annual.reduce((total, row) => total + row.monto, 0),
      mayor_compra_periodo: extremeOrNull(visible.filter(row => row.monto > 0).map(row => row.monto), "max"),
      mayor_venta_periodo: extremeOrNull(visible.filter(row => row.monto < 0).map(row => row.monto), "min"),
    },
  }
}
