/**
 * INDEC XLS Parser — Para archivos XLS del INDEC
 * Descarga XLS en runtime, parsea en memoria, cachea 24h
 */

const XLSX = require("xlsx")

const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

export async function fetchINDECXLS(
  url: string,
  cacheKey: string,
  sheetIndex = 0,
  dateColIndex = 0,
  dataColIndices = [1, 2, 3, 4, 5],
  cacheTTL = 86400 // 24h
): Promise<[string, number][][]> {
  const cached = getCache<[string, number][][]>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`INDEC XLS fetch failed: ${res.status}`)

    const buffer = await res.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })

    if (!workbook.SheetNames[sheetIndex]) {
      throw new Error(`Sheet index ${sheetIndex} not found`)
    }

    const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 0 }) as Record<string, unknown>[]

    // Convertir a formato [fecha, valor][][]
    const result: [string, number][][] = dataColIndices.map(() => [])

    for (const row of rows) {
      const dateVal = Object.values(row)[dateColIndex]
      if (!dateVal) continue

      const dateStr = String(dateVal).trim()

      for (let i = 0; i < dataColIndices.length; i++) {
        const colIdx = dataColIndices[i]
        const val = Object.values(row)[colIdx]
        const numVal = parseFloat(String(val ?? ""))
        if (!isNaN(numVal)) {
          result[i].push([dateStr, numVal])
        }
      }
    }

    // Sort descending by date (newer first)
    for (const series of result) {
      series.sort((a, b) => {
        // Try numeric sort if dates are years
        const aNum = parseFloat(a[0])
        const bNum = parseFloat(b[0])
        if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum
        // Otherwise lexicographic sort (ISO dates)
        return b[0].localeCompare(a[0])
      })
    }

    setCache(cacheKey, result, cacheTTL)
    return result
  } catch (error) {
    console.error(`[INDEC XLS] Error fetching ${url}:`, error)
    return []
  }
}

/**
 * Extrae datos de patentamientos del INDEC XLS
 * URL: https://www.indec.gob.ar/ftp/cuadros/economia/cuadros_indices_patentamientos.xls
 *
 * Las columnas del archivo contienen:
 * 0: Período (fecha)
 * 1: Automóviles
 * 2: Utilitarios
 * 3: Otros (motos, vehículos especiales)
 * 4: Total patentamientos
 */
export async function fetchPatentamientos(): Promise<{
  automoviles: [string, number][]
  utilitarios: [string, number][]
  otros: [string, number][]
  total: [string, number][]
}> {
  const cacheKey = "indec_patentamientos"
  const cached = getCache<{
    automoviles: [string, number][]
    utilitarios: [string, number][]
    otros: [string, number][]
    total: [string, number][]
  }>(cacheKey)
  if (cached) return cached

  const url = "https://www.indec.gob.ar/ftp/cuadros/economia/cuadros_indices_patentamientos.xls"
  const series = await fetchINDECXLS(url, cacheKey, 0, 0, [1, 2, 3, 4])

  const result = {
    automoviles: series[0] ?? [],
    utilitarios: series[1] ?? [],
    otros: series[2] ?? [],
    total: series[3] ?? [],
  }

  setCache(cacheKey, result, 86400)
  return result
}
