export type DebtPoint = {
  date: string
  deuda_usd: number
}

export type DebtPointWithGdp = DebtPoint & {
  deuda_pib: number | null
}

export type QuarterlyGdpPoint = [date: string, value: number]

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function excelSerialToMonth(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 25569) return null
  const date = new Date(Math.round((serial - 25569) * 86_400_000))
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 7)
}

export function parseDebtSheetRows(rows: unknown[][]): DebtPoint[] {
  let dateRowIndex = -1

  for (let index = 0; index < Math.min(25, rows.length); index += 1) {
    const dateCount = rows[index].filter(
      value => typeof value === "number" && value > 40_000 && value < 55_000,
    ).length
    if (dateCount >= 6) {
      dateRowIndex = index
      break
    }
  }

  if (dateRowIndex < 0) return []

  const debtRow = rows
    .slice(dateRowIndex + 1, dateRowIndex + 5)
    .find(row => row.slice(0, 4).some(value =>
      typeof value === "string" && /DEUDA\s+BRUTA/i.test(value),
    ))
  if (!debtRow) return []

  const dateRow = rows[dateRowIndex]
  const points: DebtPoint[] = []
  for (let index = 2; index < dateRow.length; index += 1) {
    const serial = dateRow[index]
    const value = debtRow[index]
    if (!isFinitePositive(serial) || !isFinitePositive(value)) continue
    const date = excelSerialToMonth(serial)
    if (!date) continue
    points.push({ date, deuda_usd: Math.round(value) })
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export function attachQuarterlyGdp(
  debtPoints: DebtPoint[],
  gdpPoints: QuarterlyGdpPoint[],
): DebtPointWithGdp[] {
  const validGdp = gdpPoints
    .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isFinitePositive(value))
    .sort(([a], [b]) => a.localeCompare(b))

  return debtPoints
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(point => {
      const cutoff = `${point.date}-01`
      let latest: number | null = null
      for (const [date, value] of validGdp) {
        if (date > cutoff) break
        latest = value
      }
      return {
        ...point,
        deuda_pib: latest === null
          ? null
          : Number(((point.deuda_usd / latest) * 100).toFixed(1)),
      }
    })
}

export function buildAnnualDebtHistory(points: DebtPointWithGdp[]): Array<{
  anio: string
  deuda_pib: number | null
  deuda_usd: number
}> {
  const latestByYear = new Map<string, DebtPointWithGdp>()
  for (const point of points.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    latestByYear.set(point.date.slice(0, 4), point)
  }

  return Array.from(latestByYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, point]) => ({
      anio,
      deuda_pib: point.deuda_pib,
      deuda_usd: point.deuda_usd,
    }))
}
