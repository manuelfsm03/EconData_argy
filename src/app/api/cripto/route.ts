import { NextResponse } from "next/server"

// Datos de cripto cambian por minutos; 2 min de caché es suficiente
const CACHE = "public, s-maxage=120, stale-while-revalidate=240"

interface CoinGeckoGlobal {
  data: {
    market_cap_percentage: Record<string, number>
    total_market_cap: Record<string, number>
    market_cap_change_percentage_24h_usd: number
  }
}

interface CriptoYaExchange {
  ask: number
  bid: number
  totalAsk: number
  totalBid: number
  time: number
}

export async function GET() {
  const [geckoRes, criptoyaRes] = await Promise.allSettled([
    fetch("https://api.coingecko.com/api/v3/global", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    }),
    fetch("https://criptoya.com/api/USDT/ARS/0.1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    }),
  ])

  const global =
    geckoRes.status === "fulfilled" && geckoRes.value.ok
      ? ((await geckoRes.value.json()) as CoinGeckoGlobal).data
      : null

  const usdt: Record<string, CriptoYaExchange> | null =
    criptoyaRes.status === "fulfilled" && criptoyaRes.value.ok
      ? await criptoyaRes.value.json()
      : null

  return NextResponse.json(
    {
      btc_dominance: global?.market_cap_percentage?.btc ?? null,
      market_cap_usd: global?.total_market_cap?.usd ?? null,
      market_cap_change_24h: global?.market_cap_change_percentage_24h_usd ?? null,
      usdt_ars: usdt,
    },
    { headers: { "Cache-Control": CACHE } }
  )
}
