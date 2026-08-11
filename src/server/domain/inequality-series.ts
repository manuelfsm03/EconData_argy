export type DatedSeriesPoint = [date: string, value: number]

type MergeOfficialSeriesInput = {
  historical: DatedSeriesPoint[]
  official: DatedSeriesPoint[]
  officialStartYear: number
  officialScale?: number
  decimals?: number
}

function validYear(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const year = Number(date.slice(0, 4))
  return Number.isInteger(year) ? year : null
}

export function mergeOfficialSeries({
  historical,
  official,
  officialStartYear,
  officialScale = 1,
  decimals = 2,
}: MergeOfficialSeriesInput): DatedSeriesPoint[] {
  const merged = new Map<string, number>()

  for (const [date, value] of historical) {
    const year = validYear(date)
    if (year === null || year >= officialStartYear || !Number.isFinite(value)) continue
    merged.set(date, value)
  }

  for (const [date, value] of official) {
    const year = validYear(date)
    if (year === null || year < officialStartYear || !Number.isFinite(value)) continue
    const scaled = Number((value * officialScale).toFixed(decimals))
    merged.set(date, scaled)
  }

  return Array.from(merged.entries()).sort(([a], [b]) => a.localeCompare(b))
}
