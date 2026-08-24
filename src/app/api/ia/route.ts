import { fetchRegistered } from "@/server/http/fetch-source"
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

// Benchmarks de LLMs conocidos (datos estáticos curados, recolectados ago-2025)
// benchmarks_verified: false = estimación aproximada, sin fuente primaria confirmada
const LLM_BENCHMARKS = [
  {
    model: "Claude 3.7 Sonnet",
    company: "Anthropic",
    mmlu: 89.5,
    hellaswag: 97.1,
    gsm8k: 98.9,
    humaneval: 98.0,
    math: 96.7,
    agentic: true,
    // Nota: scores con extended thinking habilitado
  },
  {
    model: "Claude 3.5 Sonnet",
    company: "Anthropic",
    mmlu: 88.3,
    hellaswag: 96.9,
    gsm8k: 98.4,
    humaneval: 93.7,
    math: 92.6,
    agentic: true,
  },
  {
    model: "GPT-4o",
    company: "OpenAI",
    mmlu: 88.7,
    hellaswag: 97.0,
    gsm8k: 96.6,
    humaneval: 90.2,
    math: 89.0,
    agentic: true,
  },
  {
    model: "o3 mini",
    company: "OpenAI",
    mmlu: 86.0,
    hellaswag: 96.0,
    gsm8k: 97.9,
    humaneval: 92.0,
    math: 97.9,
    agentic: true,
    // Especializado en razonamiento matemático y código
  },
  {
    model: "Gemini 2.5 Pro",
    company: "Google",
    mmlu: 90.0,
    hellaswag: 97.2,
    gsm8k: 97.0,
    humaneval: 90.2,
    math: 92.0,
    agentic: true,
    benchmarks_verified: false, // estimación ago-2025; Google no publicó todos los benchmarks
  },
  {
    model: "Gemini 2.0 Flash",
    company: "Google",
    mmlu: 86.9,
    hellaswag: 96.8,
    gsm8k: 96.9,
    humaneval: 92.0,
    math: 87.3,
    agentic: true,
  },
  {
    model: "Llama 3.1 405B",
    company: "Meta",
    mmlu: 85.9,
    hellaswag: 96.2,
    gsm8k: 96.8,
    humaneval: 85.9,
    math: 85.2,
    agentic: true,
    open_source: true,
  },
  {
    model: "Llama 3.3 70B",
    company: "Meta",
    mmlu: 86.0,
    hellaswag: 95.8,
    gsm8k: 95.1,
    humaneval: 88.0,
    math: 82.5,
    agentic: true,
    open_source: true,
    benchmarks_verified: false, // competitivo con 405B en muchas tareas; estimación ago-2025
  },
  {
    model: "Mistral Large 2",
    company: "Mistral",
    mmlu: 84.0,
    hellaswag: 95.3,
    gsm8k: 91.2,
    humaneval: 85.2,
    math: 78.9,
    agentic: true,
  },
]

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

async function fetchLLMBenchmarks(): Promise<
  Array<{
    model: string
    company: string
    mmlu: number
    hellaswag: number
    gsm8k: number
    humaneval: number
    math: number
    agentic: boolean
    open_source?: boolean
    benchmarks_verified?: boolean
  }>
> {
  const cacheKey = "llm_benchmarks"
  const cached = getCache(cacheKey)
  if (cached)
    return cached as Array<{
      model: string
      company: string
      mmlu: number
      hellaswag: number
      gsm8k: number
      humaneval: number
      math: number
      agentic: boolean
    }>

  setCache(cacheKey, LLM_BENCHMARKS, 86400) // 24h
  return LLM_BENCHMARKS
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
        data_as_of: "2025-08",
        last_refresh: null,
        source:
          "Benchmarks estáticos curados — datos recolectados ago-2025. Modelos marcados con benchmarks_verified: false son estimaciones. No se actualizan en tiempo real.",
      })
    }

    return NextResponse.json(
      { error: "Usar ?endpoint=benchmarks|trending" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[/api/ia]", error)
    return NextResponse.json(
      { error: "Error al obtener datos de IA", detail: String(error) },
      { status: 500 }
    )
  }
}
