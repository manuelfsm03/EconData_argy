/**
 * /api/bandas-cambiarias — Datos dinámicos para gráfico de bandas cambiarias
 *
 * Fuentes:
 *   - IPC mensual: apis.datos.gob.ar (INDEC, serie 145.3_INGNACUAL_DICI_M_38)
 *   - REM (Relevamiento Expectativas de Mercado): Excel histórico oficial BCRA
 *   - BANDA_INICIAL: constante hardcodeada (actualizar si el BCRA la modifica)
 *
 * Response:
 *   {
 *     ipcHistorico: Record<"YYYY-MM", number>   // tasa mensual %
 *     remPeriodos: string[]                      // período YYYY-MM-DD de cada observación
 *     remMediana: number[]                       // alineada por índice con remPeriodos
 *     remTop10: number[]
 *     bandaInicial: { date: string; inferior: number; superior: number }
 *     fuentes: Record<string, string>
 *   }
 */

import { NextResponse } from "next/server"
import { fetchRemExcel, parseRemMensual, type RemMensual } from "@/server/domain/rem-data"
import { fetchRegistered } from "@/server/http/fetch-source"
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
// Comparte fetch y parser con /api/rem. La admisión de red sigue pasando por
// fetchRegistered dentro de rem-data y los faltantes permanecen explícitos.
async function fetchREM(): Promise<RemMensual | null> {
  try {
    return parseRemMensual(await fetchRemExcel())
  } catch {
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  const cacheKey = "bandas_cambiarias_v2"
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
    remPeriodos: remData.periodos,
    remMediana: remData.mediana,
    remTop10: remData.top10,
    remFechaEncuesta: remData.fechaEncuesta,
    completeness: remData.top10.length === remData.mediana.length && Object.keys(ipcHistorico).length > 0 ? "complete" : "partial",
    warnings: [
      ...(remData.top10.length !== remData.mediana.length ? ["REM top-10 incompleto en la fuente observada"] : []),
      ...(Object.keys(ipcHistorico).length === 0 ? ["IPC histórico no disponible"] : []),
    ],
    bandaInicial: BANDA_INICIAL,
    fuentes: {
      ipc:    Object.keys(ipcHistorico).length > 0 ? "apis.datos.gob.ar (INDEC — serie 145.3_INGNACUAL_DICI_M_38)" : "no disponible",
      rem:    "BCRA — Excel histórico oficial",
      banda:  BANDA_POLICY.reference,
    },
    curated: BANDA_POLICY,
    updated_at: new Date().toISOString(),
  }

  setCached(cacheKey, result, 3600 * 6) // 6h cache
  return NextResponse.json(result)
}
