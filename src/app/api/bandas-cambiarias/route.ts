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

/**
 * Punto de anclaje del régimen de bandas cambiarias (Fase 1).
 *
 * Estos valores son CORRECTOS: el BCRA estableció $1.000 / $1.400 el 14/04/2025
 * y NO los modificó como ancla. Lo que cambió fue la tasa de deslizamiento:
 *
 *   Fase 1 (14-abr-2025 → 31-dic-2025)
 *     Piso:  $1.000 → −1 % mensual (se ensancha hacia abajo)
 *     Techo: $1.400 → +1 % mensual (se ensancha hacia arriba)
 *
 *   Fase 2 (1-ene-2026 en adelante)
 *     Ambas bandas se deslizan al ritmo del IPC T-2 publicado por INDEC.
 *     Metodología: /api/bcra-bands (endpoint de máxima precisión, día a día).
 *
 * IMPORTANTE: este endpoint (bandas-cambiarias) sirve el anchor como referencia
 * para el gráfico IPC+REM. Para la BANDA PRECISA calculada día a día, consumir
 * /api/bcra-bands, que aplica la tasa correcta por Fase.
 *
 * TODO: si el BCRA modifica el ancla (implantando un nuevo régimen), actualizar:
 *   - date: fecha de vigencia del nuevo régimen
 *   - inferior / superior: nuevos valores de piso y techo en ARS/USD
 *   - CURATED_DATASETS.bandas_cambiarias_policy en curated-registry.ts
 */
const BANDA_INICIAL = { date: "2025-04-14", inferior: 1000, superior: 1400 }

/**
 * Tasa de deslizamiento Fase 1 (1% mensual, simétrica).
 * Solo se incluye en la respuesta para que el frontend evite hardcodearla.
 * Para Fase 2, usar /api/bcra-bands (tasa IPC T-2, dinámica).
 */
const CRAWLING_PEG_FASE1_MENSUAL = 0.01   // 1 % mensual — Comunicado BCRA 11/04/2025

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
    /**
     * Tasa de deslizamiento diario para el período Fase 1 (abr-2025 → dic-2025).
     * Fase 2 (ene-2026 en adelante) usa IPC T-2: consultar /api/bcra-bands.
     */
    crawlingPegFase1Mensual: CRAWLING_PEG_FASE1_MENSUAL,
    bandaEndpointPreciso: "/api/bcra-bands",
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
