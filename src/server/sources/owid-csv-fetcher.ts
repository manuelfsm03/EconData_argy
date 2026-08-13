import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * OWID CSV Fetcher — Genérico para CSVs de Our World in Data
 * Parsea CSVs, filtra por países/columnas, cachea 24h
 */

const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface OWIDRow {
  [key: string]: string | number | null
}

export async function fetchOWIDCSV(
  url: string,
  cacheKey: string,
  countries: string[],
  columns: string[],
  cacheTTL = 86400 // 24h default
): Promise<Record<string, Record<string, [string, number][]>>> {
  const cached = getCache<Record<string, Record<string, [string, number][]>>>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(30000), // CSVs grandes
    })
    if (!res.ok) throw new Error(`OWID CSV fetch failed: ${res.status}`)

    const text = await res.text()
    const lines = text.split("\n").filter((l) => l.trim())
    if (lines.length < 2) return {}

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""))

    // Encontrar índices de columnas
    const entityIdx = headers.indexOf("Entity") !== -1 ? headers.indexOf("Entity") : headers.indexOf("country")
    const yearIdx = headers.indexOf("Year") !== -1 ? headers.indexOf("Year") : headers.indexOf("year")
    const colIndices = columns.map((c) => headers.indexOf(c))

    // Parsear filas
    const result: Record<string, Record<string, [string, number][]>> = {}
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i]
        .split(",")
        .map((v) => v.trim().replace(/^"|"$/g, ""))

      const entity = vals[entityIdx]
      const year = vals[yearIdx]
      if (!entity || !year || !countries.includes(entity)) continue

      if (!result[entity]) result[entity] = {}
      for (let j = 0; j < columns.length; j++) {
        const col = columns[j]
        const val = parseFloat(vals[colIndices[j]])
        if (isNaN(val)) continue
        if (!result[entity][col]) result[entity][col] = []
        result[entity][col].push([year, val])
      }
    }

    // Sort por año desc
    for (const entity of Object.keys(result)) {
      for (const col of Object.keys(result[entity])) {
        result[entity][col].sort((a, b) => Number(b[0]) - Number(a[0]))
      }
    }

    setCache(cacheKey, result, cacheTTL)
    return result
  } catch (error) {
    console.error(`[OWID CSV] Error fetching ${url}:`, error)
    return {}
  }
}
