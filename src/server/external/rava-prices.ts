export type RavaBondPrice = {
  precio: number
  tir: number | null
}

export type RosarioGrainPrices = {
  soja: number | null
  maiz: number | null
  trigo: number | null
  girasol: null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function payloadRows(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload)
  if (!root || !Array.isArray(root.datos)) return []
  return root.datos.map(asRecord).filter((row): row is Record<string, unknown> => row !== null)
}

export function parseRavaRosarioPrices(payload: unknown): RosarioGrainPrices {
  const prices = new Map<string, number>()
  for (const row of payloadRows(payload)) {
    if (typeof row.especie !== "string") continue
    const value = positiveNumber(row.ultimo)
    if (value !== null) prices.set(row.especie.trim().toUpperCase(), value)
  }

  return {
    soja: prices.get("SOJA ROSARIO") ?? null,
    maiz: prices.get("MAIZ ROSARIO") ?? null,
    trigo: prices.get("TRIGO ROSARIO") ?? null,
    girasol: null,
  }
}

export function parseRavaBondPrices(payload: unknown): Map<string, RavaBondPrice> {
  const prices = new Map<string, RavaBondPrice>()
  for (const row of payloadRows(payload)) {
    if (typeof row.especie !== "string") continue
    const ticker = row.especie.trim().toUpperCase()
    const precio = positiveNumber(row.precio)
    if (!ticker || precio === null) continue

    const rawTir = typeof row.tir === "string" || typeof row.tir === "number"
      ? Number(row.tir)
      : Number.NaN
    prices.set(ticker, {
      precio,
      tir: Number.isFinite(rawTir) ? Number((rawTir * 100).toFixed(4)) : null,
    })
  }
  return prices
}
