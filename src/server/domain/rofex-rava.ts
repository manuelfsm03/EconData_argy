type RavaDlrRow = {
  especie?: unknown       // endpoint /api/prices/rofex usa "especie" (ej. "DLR/AGO26")
  simbolo?: unknown       // endpoint /api/prices/arg usaba "simbolo" (compat)
  ultimo?: unknown
  cierre?: unknown        // precio de referencia cuando no hubo trades hoy
  fecha?: unknown
  vencimiento?: unknown   // fecha real de vencimiento del contrato (ISO)
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
  // Devaluación implícita contra DLR/SPOT (null si no hay spot en el feed)
  devaluation: number | null        // acumulada al vencimiento (%)
  monthlyDevaluation: number | null // tasa efectiva mensual (TEM %)
  tna: number | null                // tasa nominal anual (%)
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

  // Nombre del símbolo de una fila (especie en /rofex, simbolo en /arg legado)
  const symbolOf = (row: RavaDlrRow): string =>
    typeof row.especie === "string" ? row.especie.toUpperCase()
    : typeof row.simbolo === "string" ? row.simbolo.toUpperCase() : ""

  // Spot de referencia (DLR/SPOT) para calcular la devaluación implícita
  let spot: number | null = null
  for (const row of rows) {
    if (symbolOf(row) === "DLR/SPOT") {
      spot = positiveNumber(row.ultimo) ?? positiveNumber(row.cierre)
      break
    }
  }

  const result: RavaDlrFuture[] = []
  for (const row of rows) {
    // El símbolo viene en "especie" (/rofex) o "simbolo" (/arg, legado)
    const symbol = symbolOf(row)
    // Solo contratos estándar DLR/MESYY (excluye DLR/SPOT y los mini "…M")
    const match = symbol.match(/^DLR\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)(\d{2})$/)
    if (!match) continue

    const quoteDate = isoDate(row.fecha)
    if (!quoteDate) continue
    const quote = new Date(`${quoteDate}T00:00:00.000Z`)
    const ageDays = Math.floor((asOf.getTime() - quote.getTime()) / 86_400_000)
    if (ageDays < 0 || ageDays > maxStalenessDays) continue

    const monthIndex = MONTH_INDEX[match[1]]
    const year = 2000 + Number(match[2])
    // Preferir el vencimiento real del contrato; si no viene, derivar fin de mes
    const maturity = isoDate(row.vencimiento) ?? endOfMonth(year, monthIndex)
    if (maturity < asOfDate) continue

    const last = positiveNumber(row.ultimo)
    const bid = positiveNumber(row.preciocompra)
    const ask = positiveNumber(row.precioventa)
    const close = positiveNumber(row.cierre)
    // Prioridad: último operado → mid bid/ask → cierre de referencia
    const price = last
      ?? (bid !== null && ask !== null ? Number(((bid + ask) / 2).toFixed(2)) : null)
      ?? close
    if (price === null) continue

    // Devaluación implícita vs spot: acumulada, TNA y TEM (si hay spot válido)
    let devaluation: number | null = null
    let monthlyDevaluation: number | null = null
    let tna: number | null = null
    if (spot !== null && spot > 0) {
      const ratio = price / spot
      const days = Math.max(
        1,
        (new Date(`${maturity}T00:00:00.000Z`).getTime() - asOf.getTime()) / 86_400_000,
      )
      devaluation = Number(((ratio - 1) * 100).toFixed(2))
      tna = Number(((ratio - 1) * (365 / days) * 100).toFixed(2))
      monthlyDevaluation = Number(((Math.pow(ratio, 30 / days) - 1) * 100).toFixed(2))
    }

    result.push({
      symbol,
      label: `${match[1]} ${year}`,
      maturity,
      price,
      priceType: last === null && bid !== null && ask !== null ? "bid_ask_mid" : "last",
      quoteDate,
      devaluation,
      monthlyDevaluation,
      tna,
    })
  }

  return result.sort((left, right) => left.maturity.localeCompare(right.maturity))
}
