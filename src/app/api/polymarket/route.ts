/**
 * /api/polymarket — Prediction Markets
 * Fuente: Polymarket Gamma API (público, sin auth)
 * Docs: https://docs.polymarket.com/quickstart/reference/endpoints
 *
 * Endpoints:
 *   GET /api/polymarket?category=politics   — Mercados políticos
 *   GET /api/polymarket?category=economics  — Mercados económicos
 *   GET /api/polymarket?category=crypto     — Mercados crypto
 */

import { NextRequest, NextResponse } from "next/server"
import { parseFirstProbability, parseVolumeString } from "@/server/sources/polymarket-parser"

// Cache en memoria
const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface PolymarketSummary {
  question: string
  slug: string
  probability: number
  volume24h: number
  liquidity: number
  category: string
  endDate: string
}

// Mapeo de categorías para filtrar
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: ["election", "president", "congress", "senator", "governor", "vote", "campaign", "democrat", "republican", "prime minister", "parliament"],
  economics: ["inflation", "fed", "interest rate", "recession", "gdp", "stock", "s&p", "unemployment", "crypto", "bitcoin", "ethereum"],
  geopolitics: ["china", "taiwan", "russia", "ukraine", "iran", "israel", "war", "conflict", "peace", "military", "sanctions", "korea"],
  argentina: ["argentina", "peso", "milei", "ars", "devaluation", "devaluación", "cepo", "dólar", "dolar", "inflación argentina", "argentina inflation", "argentina cpi"],
}

function categorizeMarket(question: string): string {
  const lower = question.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category
    }
  }
  return "other"
}

async function fetchPolymarketMarkets(
  category: string
): Promise<PolymarketSummary[]> {
  const cacheKey = `polymarket_${category}`
  const cached = getCache(cacheKey)
  if (cached) return cached as PolymarketSummary[]

  try {
    // Para Argentina, usar búsqueda específica
    const apiUrl = category === "argentina"
      ? "https://gamma-api.polymarket.com/markets?search=argentina&limit=50&active=true"
      : "https://gamma-api.polymarket.com/markets?limit=200"
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "PanelDeControl/2.0",
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 300 },
    })

    if (!res.ok) throw new Error(`Gamma API ${res.status}`)

    const allMarkets = (await res.json()) as Array<{
      question: string
      slug: string
      outcomePrices?: string | Array<string | number>
      volume24hr?: string | number
      liquidity?: string | number
      endDate?: string
    }>

    // Filtrar y transformar mercados
    const filtered = allMarkets
      .map((m) => {
        const cat = categorizeMarket(m.question)
        const prob = parseFirstProbability(m.outcomePrices)
        return {
          question: m.question,
          slug: m.slug || "",
          probability: prob,
          volume24h: parseVolumeString(m.volume24hr),
          liquidity: parseVolumeString(m.liquidity),
          category: cat,
          endDate: m.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }
      })
      .filter((m) => (category === "all" ? true : m.category === category))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 50)

    setCache(cacheKey, filtered, 900) // 15 min cache
    return filtered
  } catch (error) {
    console.error("[Polymarket API]", error)
    // Fallback a datos vacíos si falla
    return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category") ?? "politics"

  try {
    const markets = await fetchPolymarketMarkets(category)

    return NextResponse.json({
      data: markets,
      category,
      updated_at: new Date().toISOString(),
      source: "Polymarket Gamma API — gamma-api.polymarket.com",
      cache_ttl: 900,
    })
  } catch (error) {
    console.error("[/api/polymarket]", error)
    return NextResponse.json(
      { error: "Error al obtener mercados de predicción", detail: String(error) },
      { status: 500 }
    )
  }
}
