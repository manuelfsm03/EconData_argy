/**
 * /api/news-search — Búsqueda inteligente sobre las noticias (retrieval BM25).
 *
 * Es la capa "R" (retrieval) de un RAG financiero, sin API key: toma el corpus
 * en vivo de /api/rss-news y lo rankea por relevancia a la consulta con BM25
 * (ver src/server/domain/news-search.ts).
 *
 * Query params:
 *   ?q=<consulta>   — texto libre (ej. "dólar cepo", "riesgo país")
 *   ?limit=<n>      — máximo de resultados (default 20, tope 50)
 *
 * La capa "G" (respuesta generada por un LLM sobre estos resultados) se enchufa
 * acá cuando exista una API key de LLM; hoy devolvemos el retrieval crudo.
 */

import { NextRequest, NextResponse } from "next/server"
import { rankNewsByRelevance, type NewsDoc } from "@/server/domain/news-search"

export const runtime = "nodejs"

// Reusa el corpus ya cacheado de /api/rss-news (no reimplementa el fetch de feeds)
async function fetchCorpus(origin: string): Promise<NewsDoc[]> {
  const res = await fetch(`${origin}/api/rss-news`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`rss-news ${res.status}`)
  const items = await res.json()
  return Array.isArray(items) ? (items as NewsDoc[]) : []
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 50)

  if (!q) {
    return NextResponse.json(
      { error: "Falta el parámetro de búsqueda ?q=", data: [] },
      { status: 400 },
    )
  }

  try {
    const corpus = await fetchCorpus(origin)
    const results = rankNewsByRelevance(corpus, q, limit)
    return NextResponse.json({
      query: q,
      total: results.length,
      corpusSize: corpus.length,
      data: results,
      updated_at: new Date().toISOString(),
      metodo: "BM25 (retrieval léxico, sin LLM)",
    })
  } catch (error) {
    console.error("[/api/news-search]", error)
    return NextResponse.json(
      { error: "No se pudo buscar en las noticias", detail: String(error), data: [] },
      { status: 502 },
    )
  }
}
