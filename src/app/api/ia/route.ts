import { fetchRegistered } from "@/server/http/fetch-source"
import { unavailableNumeric } from "@/server/numeric/manifest"
/**
 * /api/ia — IA Statistics & Benchmarks
 * Fuentes:
 *   - Hugging Face Hub API (modelos trending)
 *   - Papers with Code Leaderboards (benchmarks)
 *   - Datos públicos de rendimiento de LLMs (curados ago-2025)
 *
 * Modelos cubiertos: Claude 3.5/3.7 Sonnet, GPT-4o, o3 mini,
 *   Gemini 2.0 Flash, Gemini 2.5 Pro, Llama 3.1 405B, Llama 3.3 70B, Mistral Large 2
 * benchmarks_verified: false = estimación; open_source: true = modelo de código abierto
 */

import { NextRequest, NextResponse } from "next/server"

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


async function fetchHuggingFaceTrending(): Promise<
  Array<{
    id: string
    downloads: number
    likes: number
    tags: string[]
  }>
> {
  const cacheKey = "hf_trending"
  const cached = getCache<
    Array<{
      id: string
      downloads: number
      likes: number
      tags: string[]
    }>
  >(cacheKey)
  if (cached) return cached

  try {
    const res = await fetchRegistered(
      "https://huggingface.co/api/models?search=gpt&sort=downloads&direction=-1&limit=20",
      {
        headers: { "User-Agent": "PanelDeControl/2.0" },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) throw new Error(`HF API ${res.status}`)

    const data = (await res.json()) as Array<{
      id: string
      downloads: number
      likes: number
      tags: string[]
    }>

    const result = data.slice(0, 15).map((m) => ({
      id: m.id,
      downloads: m.downloads,
      likes: m.likes,
      tags: m.tags || [],
    }))

    setCache(cacheKey, result, 3600 * 6) // 6h cache
    return result
  } catch (error) {
    console.error("[HF Trending]", error)
    return []
  }
}

async function fetchLLMBenchmarks(): Promise<unknown[]> {
  // No se sirve una tabla numérica sin una fuente registrada y asOf verificable.
  return []
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") ?? "benchmarks"

  try {
    if (endpoint === "trending") {
      const data = await fetchHuggingFaceTrending()
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "Hugging Face Hub API",
      })
    }

    if (endpoint === "benchmarks") {
      const data = await fetchLLMBenchmarks()
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "unavailable",
        numeric: unavailableNumeric("benchmark source is not registered with asOf metadata"),
      })
    }

    return NextResponse.json(
      { error: "Usar ?endpoint=benchmarks|trending" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[/api/ia]", error)
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Fuente de IA no disponible", retryable: true }, numeric: unavailableNumeric("IA source request failed") },
      { status: 503 }
    )
  }
}
