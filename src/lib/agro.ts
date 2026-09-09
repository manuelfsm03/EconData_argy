const CBOT_BUSHELS_PER_TON: Readonly<Record<string, number>> = {
  "ZS=F": 36.744,
  "ZC=F": 39.368,
  "ZW=F": 36.744,
}

/** Convert a CBOT quote in US cents per bushel to USD per metric tonne. */
export function cbotUsdTon(priceUscPerBushel: number | null | undefined, ticker: string): number | null {
  const factor = CBOT_BUSHELS_PER_TON[ticker]
  if (priceUscPerBushel == null || factor == null || !Number.isFinite(priceUscPerBushel)) return null
  return Number((priceUscPerBushel * factor / 100).toFixed(2))
}
