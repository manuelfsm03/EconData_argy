/**
 * /api/bandas-cambiarias — Datos dinámicos para gráfico de bandas cambiarias
 *
 * Fuentes:
 *   - IPC mensual: apis.datos.gob.ar (INDEC, serie 145.3_INGNACUAL_DICI_M_38)
 *   - REM (Relevamiento Expectativas de Mercado): BCRA, Excel histórico oficial
 *     (compartido con /api/rem vía @/server/domain/rem-data)
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
import { fetchRemExcel, parseRemMensual } from "@/server/domain/rem-data"

export const runtime = "nodejs"

// ── Constantes que requieren update manual ────────────────────────────────────

// Valores iniciales de banda Fase 3 (14/04/2025). Actualizar si el BCRA los cambia.
const BANDA_INICIAL = { date: "2025-04-14", inferior: 1000, superior: 1400 }

// REM de respaldo (actualizar mensualmente si el scraping falla)
// Fuente: BCRA REM publicación Marzo 2025. Índice 0 = IPC feb 2025 (aplica a banda abr 2025)
const REM_MEDIANA_FALLBACK = [2.4, 2.5, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0, 2.0, 1.9, 1.9, 1.8]
const REM_TOP10_FALLBACK   = [2.1, 2.1, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.5, 1.4]

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
    const res = await fetch(url, {
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
// Antes esto intentaba 3 fuentes alternativas (API de variables del BCRA,
// adivinar el nombre del CSV mensual, argentinadatos.com) y caía al fallback
// hardcodeado de marzo 2025 apenas fallaba alguna. Ahora reusa la MISMA fuente
// estable que ya usa /api/rem con éxito (ver @/server/domain/rem-data) — un
// solo Excel confiable en vez de tres intentos frágiles.

async function fetchREM(): Promise<{ mediana: number[]; top10: number[] } | null> {
  try {
    const buf = await fetchRemExcel()
    return parseRemMensual(buf)
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

  const remMediana = remData?.mediana ?? REM_MEDIANA_FALLBACK
  const remTop10   = remData?.top10   ?? REM_TOP10_FALLBACK

  const result = {
    ipcHistorico,
    remMediana,
    remTop10,
    bandaInicial: BANDA_INICIAL,
    fuentes: {
      ipc:    Object.keys(ipcHistorico).length > 0 ? "apis.datos.gob.ar (INDEC — serie 145.3_INGNACUAL_DICI_M_38)" : "no disponible",
      rem:    remData ? "BCRA (scraping automático)" : "fallback hardcodeado — actualizar con próximo REM",
      banda:  "BCRA — Resolución 14/04/2025 (constante hardcodeada)",
    },
    updated_at: new Date().toISOString(),
  }

  setCached(cacheKey, result, 3600 * 6) // 6h cache
  return NextResponse.json(result)
}
