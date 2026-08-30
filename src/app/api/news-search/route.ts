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
import { loadRssNewsCorpus } from "@/server/domain/rss-news-corpus"
import { fetchRegistered } from "@/server/http/fetch-source"

export const runtime = "nodejs"

// Comparte la misma política de fuentes y normalización sin hacer un self-fetch HTTP.
async function fetchCorpus(): Promise<NewsDoc[]> {
  const corpus = await loadRssNewsCorpus(async (feed) => {
    const response = await fetchRegistered(feed.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "LaPizarra/1.0" },
    })
    return response.ok ? response.text() : null
  })
  if (corpus.feedsSucceeded === 0) throw new Error("SOURCE_UNAVAILABLE")
  if (corpus.items.length === 0) throw new Error("SOURCE_BAD_RESPONSE")
  return corpus.items
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 50)

  if (!q) {
    return NextResponse.json(
      { error: "Falta el parámetro de búsqueda ?q=", data: [] },
      { status: 400 },
    )
  }

  try {
    const corpus = await fetchCorpus()
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
