import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/bandas-cambiarias — Datos dinámicos para gráfico de bandas cambiarias
 *
 * Fuentes:
 *   - IPC mensual: apis.datos.gob.ar (INDEC, serie 145.3_INGNACUAL_DICI_M_38)
 *   - REM (Relevamiento Expectativas de Mercado): BCRA — bcra.gob.ar (scraping CSV/JSON)
 *   - BANDA_INICIAL: constante hardcodeada (actualizar si el BCRA la modifica)
 *
 * Response:
 *   {
 *     ipcHistorico: Record<"YYYY-MM", number>   // tasa mensual %
 *     remMediana: number[]                       // índice 0 = IPC feb 2025 en adelante
 *     remTop10: number[]
 *     bandaInicial: { date: string; inferior: number; superior: number }
 *     fuentes: Record<string, string>
 *   }
 */

import { NextResponse } from "next/server"
import { getCuratedDataset } from "@/server/sources/curated-registry"

export const runtime = "nodejs"

// ── Constantes que requieren update manual ────────────────────────────────────

// Valores iniciales de banda Fase 3 (14/04/2025). Actualizar si el BCRA los cambia.
const BANDA_INICIAL = { date: "2025-04-14", inferior: 1000, superior: 1400 }
const BANDA_POLICY = getCuratedDataset("bandas_cambiarias_policy")


// ── Cache ─────────────────────────────────────────────────────────────────────

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCached<T>(k: string): T | null {
  const e = _cache[k]
  return e && e.expiry > Date.now() ? (e.data as T) : null
}
function setCached(k: string, d: unknown, ttlSec: number) {
  _cache[k] = { data: d, expiry: Date.now() + ttlSec * 1000 }
}

// ── IPC desde datos.gob.ar ────────────────────────────────────────────────────
// Serie: 145.3_INGNACUAL_DICI_M_38 = variación mensual IPC nacional (base dic 2016)

async function fetchIPCHistorico(): Promise<Record<string, number>> {
  try {
    const url = "https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=24&sort=desc"
    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 }, // IPC se publica 1x/mes
    })
    if (!res.ok) return {}

    const json = await res.json()
    // La API devuelve: { data: [["YYYY-MM-DD", valor], ...] }
    const rows: [string, number | null][] = json.data ?? []
    const result: Record<string, number> = {}

    for (const [dateStr, val] of rows) {
      if (val == null) continue
      // dateStr viene como "YYYY-MM-DD", convertimos a "YYYY-MM"
      const monthKey = dateStr.slice(0, 7)
      result[monthKey] = parseFloat(val.toFixed(2))
    }

    return result
  } catch {
    return {}
  }
}

// ── REM desde BCRA ────────────────────────────────────────────────────────────
// El BCRA publica el REM como CSV en:
//   https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/REM/rem_cuadros.csv
// (URL exacta puede variar — ver también el JSON de la API pública del BCRA)

async function fetchREM(): Promise<{ mediana: number[]; top10: number[] } | null> {
  // Intento 1: BCRA API v4 estadísticas — serie de expectativas de inflación
  // Usamos la API pública del BCRA para series de expectativas
  try {
    const url = "https://api.bcra.gob.ar/estadisticas/v3.0/maestro/variables"
    const res = await fetchRegistered(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      // Si la API de variables existe, buscar series de expectativas de inflación
      const json = await res.json()
      // Buscar variables que correspondan a REM inflación
      const variables: { idVariable: number; descripcion: string }[] = json.results ?? []
      const remVar = variables.find((v) =>
        v.descripcion?.toLowerCase().includes("inflaci") &&
        v.descripcion?.toLowerCase().includes("expectat")
      )
      if (remVar) {
        const dataUrl = `https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/${remVar.idVariable}`
        const dataRes = await fetchRegistered(dataUrl, {
          headers: { "User-Agent": "PanelDeControl/2.0" },
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 86400 },
        })
        if (dataRes.ok) {
          const dataJson = await dataRes.json()
          const series: { fecha: string; valor: number }[] = dataJson.results ?? []
          if (series.length > 0) {
            const values = series.slice(0, 12).map((s) => parseFloat(s.valor.toFixed(2)))
            return { mediana: values, top10: [] }
          }
        }
      }
    }
  } catch { /* continúa al intento 2 */ }

  // Intento 2: CSV público del BCRA (rem_cuadros.csv)
  // La URL del archivo varía con cada publicación, se intenta con el patrón más reciente
  const now = new Date()
  const year = now.getFullYear()
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

  for (let mOffset = 0; mOffset <= 2; mOffset++) {
    const d = new Date(year, now.getMonth() - mOffset, 1)
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const y = d.getFullYear()
    const monthName = months[d.getMonth()]

    const candidateUrls = [
      `https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/REM/REM${m}${y}.xlsx`,
      `https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/REM/rem_${monthName.toLowerCase()}${y}.csv`,
      `https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/REM/REMcuadros${m}${y}.csv`,
    ]

    for (const url of candidateUrls) {
      try {
        const res = await fetchRegistered(url, {
          method: "HEAD",
          headers: { "User-Agent": "PanelDeControl/2.0" },
          signal: AbortSignal.timeout(4000),
        })
        if (res.ok && res.headers.get("content-type")?.includes("csv")) {
          const csvRes = await fetchRegistered(url, {
            headers: { "User-Agent": "PanelDeControl/2.0" },
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 86400 },
          })
          if (csvRes.ok) {
            const text = await csvRes.text()
            const parsed = parseREMCsv(text)
            if (parsed) return parsed
          }
        }
      } catch { /* continuar */ }
    }
  }

  // Intento 3: argentinadatos.com (si incorporan REM en el futuro)
  try {
    const res = await fetchRegistered("https://api.argentinadatos.com/v1/finanzas/rem/inflacion", {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json) && json.length > 0) {
        const mediana = json.slice(0, 12)
          .map((e: { mediana?: number; valor?: number }) => e.mediana ?? e.valor)
          .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value))
          .map((value: number) => parseFloat(value.toFixed(2)))
        const top10 = json.slice(0, 12)
          .map((e: { top10?: number }) => e.top10)
          .filter((value: unknown): value is number => typeof value === "number" && Number.isFinite(value))
          .map((value: number) => parseFloat(value.toFixed(2)))
        if (mediana.length === 0) return null
        return { mediana, top10 }
      }
    }
  } catch { /* source unavailable */ }

  return null
}

// Parser simple para CSV del BCRA con proyecciones de inflación
function parseREMCsv(csv: string): { mediana: number[]; top10: number[] } | null {
  try {
    const lines = csv.split("\n").filter((l) => l.trim())
    // Buscar línea con "mediana" o "inflación mensual"
    const medianaLineIdx = lines.findIndex((l) =>
      l.toLowerCase().includes("mediana") && l.toLowerCase().includes("inflaci")
    )
    const top10LineIdx = lines.findIndex((l) =>
      l.toLowerCase().includes("top 10") || l.toLowerCase().includes("top10")
    )

    if (medianaLineIdx === -1) return null

    const parseRow = (line: string): number[] =>
      line.split(/[,;]/)
        .slice(1) // saltar primera columna (label)
        .map((v) => parseFloat(v.replace(",", ".")))
        .filter((v) => !isNaN(v) && v > 0 && v < 30)
        .slice(0, 12)

    const mediana = parseRow(lines[medianaLineIdx])
    const top10 = top10LineIdx !== -1 ? parseRow(lines[top10LineIdx]) : []

    if (mediana.length === 0) return null
    return { mediana, top10 }
  } catch {
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const cacheKey = "bandas_cambiarias_v1"
  const cached = getCached<unknown>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached as object, cached: true })
  }

  // Fetch IPC y REM en paralelo
  const [ipcHistorico, remData] = await Promise.all([
    fetchIPCHistorico(),
    fetchREM(),
  ])

  if (!remData) {
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "REM BCRA no disponible", retryable: true } },
      { status: 502 },
    )
  }

  const result = {
    ipcHistorico,
    remMediana: remData.mediana,
    remTop10: remData.top10,
    completeness: remData.top10.length > 0 && Object.keys(ipcHistorico).length > 0 ? "complete" : "partial",
    warnings: [
      ...(remData.top10.length === 0 ? ["REM top-10 no disponible en la fuente observada"] : []),
      ...(Object.keys(ipcHistorico).length === 0 ? ["IPC histórico no disponible"] : []),
    ],
    bandaInicial: BANDA_INICIAL,
    fuentes: {
      ipc:    Object.keys(ipcHistorico).length > 0 ? "apis.datos.gob.ar (INDEC — serie 145.3_INGNACUAL_DICI_M_38)" : "no disponible",
      rem:    "BCRA (scraping automático)",
      banda:  BANDA_POLICY.reference,
    },
    curated: BANDA_POLICY,
    updated_at: new Date().toISOString(),
  }

  setCached(cacheKey, result, 3600 * 6) // 6h cache
  return NextResponse.json(result)
}
