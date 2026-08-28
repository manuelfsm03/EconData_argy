/**
 * news-search.ts — Retrieval léxico (BM25) sobre el corpus de noticias.
 *
 * Es la mitad "R" (retrieval) de un RAG, hecha SIN API key: rankea las noticias
 * por relevancia a una consulta usando Okapi BM25, el algoritmo estándar de los
 * buscadores antes/junto a los embeddings. Cuando haya una key de embeddings/LLM,
 * la capa de generación ("G") se enchufa encima de este mismo retrieval.
 *
 * Por qué BM25 y no "incluye la palabra":
 *  - Pondera por frecuencia del término en el documento (TF) con saturación.
 *  - Penaliza términos comunes vía IDF (un "el"/"the" no aporta; "cepo" sí).
 *  - Normaliza por largo del documento (títulos cortos no quedan en desventaja).
 */

// Stopwords ES + EN (mínimas, alto impacto). No pretende ser exhaustiva.
const STOPWORDS = new Set([
  // español
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a",
  "y", "o", "u", "e", "en", "por", "para", "con", "sin", "sobre", "entre", "que",
  "se", "su", "sus", "lo", "le", "les", "es", "son", "fue", "ser", "como", "más",
  "mas", "pero", "no", "si", "sí", "ya", "muy", "este", "esta", "esto", "ese",
  "esa", "esos", "esas", "hay", "han", "ha", "he", "the", "of",
  // inglés
  "a", "an", "and", "or", "in", "on", "for", "to", "with", "without", "of",
  "is", "are", "was", "were", "be", "as", "by", "that", "this", "these", "those",
  "it", "its", "at", "from", "but", "not", "no", "yes", "has", "have", "had",
])

/** Normaliza: minúsculas + quita acentos (inflación → inflacion). */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // quita marcas diacríticas combinantes
}

/** Tokeniza a palabras alfanuméricas ≥2 chars, sin stopwords. */
export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

export interface NewsDoc {
  id: string
  title: string
  description: string | null
  source: string
  pubDate: string
  link: string
  category?: string
  region?: string
}

export interface RankedNews extends NewsDoc {
  score: number
  matched: string[]   // términos de la consulta que aparecen en el documento
}

const K1 = 1.5   // saturación de TF
const B = 0.75   // normalización por largo de documento

/**
 * Rankea documentos por relevancia BM25 a la consulta. Devuelve solo los que
 * matchean al menos un término, ordenados por score desc, hasta `limit`.
 */
export function rankNewsByRelevance(docs: NewsDoc[], query: string, limit = 20): RankedNews[] {
  const queryTerms = Array.from(new Set(tokenizar(query)))
  if (queryTerms.length === 0 || docs.length === 0) return []

  // Tokenizar cada doc una vez (título pesa como el cuerpo; se concatena)
  const tokenized = docs.map((d) => tokenizar(`${d.title} ${d.description ?? ""}`))
  const N = docs.length
  const avgdl = tokenized.reduce((sum, t) => sum + t.length, 0) / N || 1

  // Document frequency por término de la consulta
  const df = new Map<string, number>()
  for (const term of queryTerms) {
    let count = 0
    for (const toks of tokenized) if (toks.includes(term)) count++
    df.set(term, count)
  }

  // IDF (formulación BM25, siempre positiva con el +1)
  const idf = new Map<string, number>()
  for (const term of queryTerms) {
    const n = df.get(term) ?? 0
    idf.set(term, Math.log(1 + (N - n + 0.5) / (n + 0.5)))
  }

  const ranked: RankedNews[] = []
  for (let i = 0; i < docs.length; i++) {
    const toks = tokenized[i]
    const dl = toks.length || 1
    let score = 0
    const matched: string[] = []
    for (const term of queryTerms) {
      const f = toks.filter((t) => t === term).length
      if (f === 0) continue
      matched.push(term)
      const num = f * (K1 + 1)
      const den = f + K1 * (1 - B + B * (dl / avgdl))
      score += (idf.get(term) ?? 0) * (num / den)
    }
    if (matched.length > 0) {
      ranked.push({ ...docs[i], score: Number(score.toFixed(4)), matched })
    }
  }

  ranked.sort((a, b) => b.score - a.score)
  return ranked.slice(0, limit)
}
