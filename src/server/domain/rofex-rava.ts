type RavaDlrRow = {
  simbolo?: unknown
  ultimo?: unknown
  fecha?: unknown
  preciocompra?: unknown
  precioventa?: unknown
}

export type RavaDlrFuture = {
  symbol: string
  label: string
  maturity: string
  price: number
  priceType: "last" | "bid_ask_mid"
  quoteDate: string
}

const MONTH_INDEX: Record<string, number> = {
  ENE: 0,
  FEB: 1,
  MAR: 2,
  ABR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AGO: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DIC: 11,
}

function positiveNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

function endOfMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)
}

export function parseRavaDlrFutures(
  rows: RavaDlrRow[],
  asOfDate: string,
  maxStalenessDays = 7,
): RavaDlrFuture[] {
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`)
  if (!Number.isFinite(asOf.getTime())) return []

  const result: RavaDlrFuture[] = []
  for (const row of rows) {
    const symbol = typeof row.simbolo === "string" ? row.simbolo.toUpperCase() : ""
    const match = symbol.match(/^DLR\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)(\d{2})$/)
    if (!match) continue

    const quoteDate = isoDate(row.fecha)
    if (!quoteDate) continue
    const quote = new Date(`${quoteDate}T00:00:00.000Z`)
    const ageDays = Math.floor((asOf.getTime() - quote.getTime()) / 86_400_000)
    if (ageDays < 0 || ageDays > maxStalenessDays) continue

    const monthIndex = MONTH_INDEX[match[1]]
    const year = 2000 + Number(match[2])
    const maturity = endOfMonth(year, monthIndex)
    if (maturity < asOfDate) continue

    const last = positiveNumber(row.ultimo)
    const bid = positiveNumber(row.preciocompra)
    const ask = positiveNumber(row.precioventa)
    const price = last ?? (bid !== null && ask !== null ? Number(((bid + ask) / 2).toFixed(2)) : null)
    if (price === null) continue

    result.push({
      symbol,
      label: `${match[1]} ${year}`,
      maturity,
      price,
      priceType: last !== null ? "last" : "bid_ask_mid",
      quoteDate,
    })
  }

  return result.sort((left, right) => left.maturity.localeCompare(right.maturity))
}
