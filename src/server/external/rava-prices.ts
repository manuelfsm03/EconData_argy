import { fetchRegistered } from "@/server/http/fetch-source"

export type RavaBondPrice = {
  precio: number
  tir: number | null
  nombre: string | null
  /** Duration modificada ("dm" en el payload de Rava). */
  dm: number | null
  /** Paridad ya expresada en porcentaje (Rava la publica como fracción). */
  paridad: number | null
  valorTecnico: number | null
  currentYield: number | null
  /** Fecha ISO de vencimiento tal como la publica Rava, sin normalizar. */
  vencimiento: string | null
  /** Fecha ISO de la cotización. */
  fecha: string | null
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

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
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
    const rawParidad = numberOrNull(row.paridad)
    prices.set(ticker, {
      precio,
      tir: Number.isFinite(rawTir) ? Number((rawTir * 100).toFixed(4)) : null,
      nombre: stringOrNull(row.nombre),
      dm: numberOrNull(row.dm),
      paridad: rawParidad !== null ? Number((rawParidad * 100).toFixed(4)) : null,
      valorTecnico: numberOrNull(row.valor_tecnico),
      currentYield: numberOrNull(row.current_yield),
      vencimiento: stringOrNull(row.vencimiento),
      fecha: stringOrNull(row.fecha),
    })
  }
  return prices
}

// ── Traer los precios ────────────────────────────────────────────────────────

/**
 * Caché en memoria de los precios de bonos de Rava.
 *
 * Vivía adentro del handler de /api/bonos, pero la calculadora también los
 * necesita: un instrumento CER cero cupón se valúa contra su valor técnico, y
 * el valor técnico sale de acá. Duplicar el fetch habría duplicado también el
 * caché, y con eso las dos rutas podrían llegar a mostrar precios de momentos
 * distintos para el mismo papel.
 */
let cache: { data: Map<string, RavaBondPrice>; expiry: number } | null = null

const TTL_MS = 300_000

export async function fetchRavaBondPrices(): Promise<Map<string, RavaBondPrice>> {
  if (cache && cache.expiry > Date.now()) return cache.data

  try {
    // fetchRegistered y no fetch pelado: es lo que da de alta la fuente en el
    // registro que alimenta el health por tarjeta. Con fetch común, Rava
    // desaparecería del panel de estado sin que nadie se entere.
    const response = await fetchRegistered("https://mercado.rava.com/api/prices/bonos", {
      headers: {
        "User-Agent": "Mozilla/5.0 PanelDeControl/2.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 300 },
    })
    if (!response.ok) return new Map()

    const prices = parseRavaBondPrices(await response.json())
    if (prices.size > 0) cache = { data: prices, expiry: Date.now() + TTL_MS }
    return prices
  } catch (error) {
    console.warn("[rava] fetch mercado.rava.com falló:", error)
    return new Map()
  }
}
