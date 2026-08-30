export type MarketPriceFreshness = "fresh" | "stale" | "invalid" | "future" | "missing"

/** Maximum age accepted for a market price, by effective source. */
export const MARKET_PRICE_MAX_AGE_SECONDS = {
  // BYMA is a daily candle: the session date, rather than wall-clock age,
  // controls freshness. The generous bound only guards malformed old data.
  byma_data_open: 5 * 24 * 60 * 60,
  rava: 30 * 60,
  rava_market: 30 * 60,
  db_local: 30 * 60,
} as const

export type MarketPriceCandidate = {
  source: string
  price: number | null | undefined
  asOf: unknown
}

export type MarketPriceGate = {
  accepted: boolean
  freshness: MarketPriceFreshness
  asOf: string | null
  maxAgeSeconds: number
  reason: string
}

export type SelectedMarketPrice = {
  price: number | null
  asOf: string | null
  source: string
  sourceMode: "live" | "fallback" | "unavailable"
  fallbackFrom: string | null
  freshness: MarketPriceFreshness
}

function maxAgeFor(source: string): number {
  return MARKET_PRICE_MAX_AGE_SECONDS[source as keyof typeof MARKET_PRICE_MAX_AGE_SECONDS] ?? 30 * 60
}

function tradingDaysBetween(from: Date, to: Date): number {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1))
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  let days = 0
  while (cursor.getTime() < end) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/**
 * A market price is usable only when its observation timestamp is parseable,
 * not in the future, and inside the source's max-age window. This gate is
 * deliberately independent from transport/cache success: a 200 response or a
 * stale-if-error cache hit is not proof that the number is current.
 */
export function gateMarketPrice(source: string, asOf: unknown, now = new Date()): MarketPriceGate {
  const maxAgeSeconds = maxAgeFor(source)
  if (typeof asOf !== "string" || asOf.trim() === "") {
    return { accepted: false, freshness: "missing", asOf: null, maxAgeSeconds, reason: "PRICE_ASOF_MISSING" }
  }

  const timestamp = Date.parse(asOf)
  if (!Number.isFinite(timestamp)) {
    return { accepted: false, freshness: "invalid", asOf: null, maxAgeSeconds, reason: "PRICE_ASOF_INVALID" }
  }

  const normalizedAsOf = new Date(timestamp).toISOString()
  if (timestamp > now.getTime()) {
    return { accepted: false, freshness: "future", asOf: normalizedAsOf, maxAgeSeconds, reason: "PRICE_ASOF_FUTURE" }
  }

  const ageSeconds = (now.getTime() - timestamp) / 1000
  if (source === "byma_data_open" && tradingDaysBetween(new Date(timestamp), now) > 1) {
    return { accepted: false, freshness: "stale", asOf: normalizedAsOf, maxAgeSeconds, reason: "PRICE_SESSION_STALE" }
  }
  if (ageSeconds > maxAgeSeconds) {
    return { accepted: false, freshness: "stale", asOf: normalizedAsOf, maxAgeSeconds, reason: "PRICE_ASOF_STALE" }
  }

  return { accepted: true, freshness: "fresh", asOf: normalizedAsOf, maxAgeSeconds, reason: "PRICE_FRESH" }
}

function rejectionRank(freshness: MarketPriceFreshness): number {
  return { missing: 1, invalid: 2, future: 3, stale: 4, fresh: 5 }[freshness]
}

/**
 * Select the first valid candidate and label a lower-priority source as a
 * fallback. Rejected candidates never leak their price into the result.
 */
export function chooseFreshPrice(candidates: readonly MarketPriceCandidate[], now = new Date()): SelectedMarketPrice {
  let rejected: { source: string; gate: MarketPriceGate } | null = null

  for (const [index, candidate] of candidates.entries()) {
    const gate = gateMarketPrice(candidate.source, candidate.asOf, now)
    const numericPrice = typeof candidate.price === "number" && Number.isFinite(candidate.price) && candidate.price > 0
    if (gate.accepted && numericPrice) {
      return {
        price: candidate.price as number,
        asOf: gate.asOf,
        source: candidate.source,
        sourceMode: index === 0 ? "live" : "fallback",
        fallbackFrom: index === 0 ? null : candidates[0]?.source ?? null,
        freshness: "fresh",
      }
    }

    const effectiveGate = numericPrice
      ? gate
      : { ...gate, freshness: "invalid" as const, reason: "PRICE_INVALID" }
    if (!rejected || rejectionRank(effectiveGate.freshness) > rejectionRank(rejected.gate.freshness)) {
      rejected = { source: candidate.source, gate: effectiveGate }
    }
  }

  return {
    price: null,
    asOf: null,
    source: rejected?.source ?? "unavailable",
    sourceMode: "unavailable",
    fallbackFrom: null,
    freshness: rejected?.gate.freshness ?? "missing",
  }
}
