import { bcraOfficialApi } from "@/server/sources/bcra-official-api"

export type BCRAPoint = { fecha: string; valor: number }
export type RawBCRAPoint = { fecha?: unknown; valor?: unknown }
export type ReservePeriod = {
  fecha: string
  brutas: number
  netas: number | null
  encajes: number | null
  swap_china: null
}

export function normalizeBCRAPoints(points: RawBCRAPoint[]): BCRAPoint[] {
  return points
    .filter((point): point is { fecha: string; valor: number } =>
      typeof point.fecha === "string"
      && typeof point.valor === "number"
      && Number.isFinite(point.valor),
    )
    .map(point => ({ fecha: point.fecha, valor: point.valor }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function buildReserveSeries(series: {
  brutas: BCRAPoint[]
  var75: BCRAPoint[]
  efectivoME: BCRAPoint[]
  cuentasME: BCRAPoint[]
}): ReservePeriod[] {
  const byDate = (points: BCRAPoint[]) => new Map(points.map(point => [point.fecha, point.valor]))
  const var75 = byDate(series.var75)
  const efectivoME = byDate(series.efectivoME)
  const cuentasME = byDate(series.cuentasME)

  return [...series.brutas]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(point => {
      const baseNeta = var75.get(point.fecha)
      const efectivo = efectivoME.get(point.fecha)
      const cuentas = cuentasME.get(point.fecha)
      const hasMeasuredComponents = baseNeta !== undefined && efectivo !== undefined && cuentas !== undefined
      const encajes = hasMeasuredComponents ? efectivo + cuentas : null
      return {
        fecha: point.fecha,
        brutas: point.valor,
        netas: hasMeasuredComponents ? baseNeta - efectivo - cuentas : null,
        encajes,
        swap_china: null,
      }
    })
}

export function latestMeasuredNetReserves(rows: ReservePeriod[]): ReservePeriod | null {
  return [...rows].reverse().find(row => row.netas !== null) ?? null
}

export async function fetchAllBCRAPoints(
  idVariable: number,
  desde: string,
  hasta: string,
): Promise<BCRAPoint[]> {
  const pageSize = 3_000
  const all: BCRAPoint[] = []

  for (let offset = 0; offset < 60_000; offset += pageSize) {
    const page = await bcraOfficialApi.getSeriesData(idVariable, desde, hasta, pageSize, offset)
    all.push(...normalizeBCRAPoints(page))
    if (page.length < pageSize) break
  }

  return all.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function fetchReserveSeries(desde: string, hasta: string): Promise<ReservePeriod[]> {
  const [brutas, var75, efectivoME, cuentasME] = await Promise.all([
    fetchAllBCRAPoints(1, desde, hasta),
    fetchAllBCRAPoints(75, desde, hasta),
    fetchAllBCRAPoints(1200, desde, hasta),
    fetchAllBCRAPoints(1243, desde, hasta),
  ])
  return buildReserveSeries({ brutas, var75, efectivoME, cuentasME })
}
