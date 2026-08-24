import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"

/**
 * /api/cripto — Datos de mercado de criptomonedas.
 *
 * Fuentes (todas sin key):
 *   - CoinGecko /api/v3/global         — market cap global, dominancia BTC
 *   - CoinGecko /api/v3/simple/price   — precios individuales BTC/ETH/SOL/...
 *   - Alternative.me /fng              — Fear & Greed Index (cripto)
 *   - CriptoyA /api/USDT/ARS           — USDT/ARS por exchange local
 */

// 2 min de caché — precios cripto cambian rápido
const CACHE = "public, s-maxage=120, stale-while-revalidate=240"

const COINS = "bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,tron,avalanche-2,chainlink"

interface CoinGeckoGlobal {
  data: {
    market_cap_percentage: Record<string, number>
    total_market_cap: Record<string, number>
    market_cap_change_percentage_24h_usd: number
  }
}

interface CoinGeckoPrice {
  [coinId: string]: {
    usd: number
    usd_24h_change?: number
    usd_market_cap?: number
  }
}

interface FearGreed {
  data: Array<{ value: string; value_classification: string; timestamp: string }>
}

interface CriptoYaExchange {
  ask: number
  bid: number
  totalAsk: number
  totalBid: number
  time: number
}

const COIN_META: Record<string, { symbol: string; nombre: string }> = {
  bitcoin:       { symbol: "BTC", nombre: "Bitcoin" },
  ethereum:      { symbol: "ETH", nombre: "Ethereum" },
  solana:        { symbol: "SOL", nombre: "Solana" },
  binancecoin:   { symbol: "BNB", nombre: "BNB" },
  ripple:        { symbol: "XRP", nombre: "XRP" },
  cardano:       { symbol: "ADA", nombre: "Cardano" },
  dogecoin:      { symbol: "DOGE", nombre: "Dogecoin" },
  tron:          { symbol: "TRX", nombre: "TRON" },
  "avalanche-2": { symbol: "AVAX", nombre: "Avalanche" },
  chainlink:     { symbol: "LINK", nombre: "Chainlink" },
}

export async function GET() {
  const [geckoGlobalRes, geckoPricesRes, fearGreedRes, criptoyaRes] = await Promise.allSettled([
    fetchRegistered("https://api.coingecko.com/api/v3/global", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
    fetchRegistered(`https://api.coingecko.com/api/v3/simple/price?ids=${COINS}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }),
    fetch("https://api.alternative.me/fng/?limit=1&format=json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    }),
    fetchRegistered("https://criptoya.com/api/USDT/ARS/0.1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    }),
  ])

  const global =
    geckoGlobalRes.status === "fulfilled" && geckoGlobalRes.value.ok
      ? ((await geckoGlobalRes.value.json()) as CoinGeckoGlobal).data
      : null

  const rawPrices: CoinGeckoPrice | null =
    geckoPricesRes.status === "fulfilled" && geckoPricesRes.value.ok
      ? await geckoPricesRes.value.json()
      : null

  const precios = rawPrices
    ? Object.entries(rawPrices).map(([id, v]) => ({
        id,
        symbol: COIN_META[id]?.symbol ?? id.toUpperCase(),
        nombre: COIN_META[id]?.nombre ?? id,
        precio_usd: v.usd,
        cambio_24h_pct: v.usd_24h_change ?? null,
        market_cap_usd: v.usd_market_cap ?? null,
      }))
    : null

  const fearGreedRaw: FearGreed | null =
    fearGreedRes.status === "fulfilled" && (fearGreedRes.value as Response).ok
      ? await (fearGreedRes.value as Response).json()
      : null

  const fearGreed = fearGreedRaw?.data?.[0]
    ? {
        valor: parseInt(fearGreedRaw.data[0].value, 10),
        clasificacion: fearGreedRaw.data[0].value_classification,
        timestamp: fearGreedRaw.data[0].timestamp,
      }
    : null

  const usdt: Record<string, CriptoYaExchange> | null =
    criptoyaRes.status === "fulfilled" && criptoyaRes.value.ok
      ? await criptoyaRes.value.json()
      : null

  return NextResponse.json(
    {
      // Market global
      btc_dominance: global?.market_cap_percentage?.btc ?? null,
      market_cap_usd: global?.total_market_cap?.usd ?? null,
      market_cap_change_24h: global?.market_cap_change_percentage_24h_usd ?? null,
      // Precios individuales
      precios,
      // Sentimiento
      fear_greed: fearGreed,
      // USDT/ARS por exchange local
      usdt_ars: usdt,
    },
    { headers: { "Cache-Control": CACHE } }
  )
}
