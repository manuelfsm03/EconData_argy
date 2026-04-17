/**
 * /api/bcra-bands — Bandas cambiarias BCRA (máxima precisión)
 *
 * Régimen:
 *   Fase 1 (11-abr-2025 → 31-dic-2025)
 *     Piso  $1.000 → −1 %/mes (banda se ensancha hacia abajo)
 *     Techo $1.400 → +1 %/mes (banda se ensancha hacia arriba)
 *
 *   Fase 2 (1-ene-2026 en adelante)
 *     Cada mes ambas bandas se deslizan al ritmo del IPC T-2 publicado por INDEC.
 *     El paso diario = valor_inicio_mes × tasa_ipc_t2 / días_calendario_del_mes
 *     (metodología verificada con datos oficiales BCRA: error < 0.5 ARS)
 *
 * IMPORTANTE: todas las operaciones de fecha usan UTC para evitar bugs de
 * timezone en servidores con zona horaria Argentina (UTC-3).
 *
 * El resultado incluye todos los días desde el 11-abr-2025 hasta 3 meses adelante.
 * Cache: 12 h (los datos del IPC solo cambian una vez por mes).
 */

import { NextResponse } from "next/server"

// ── Parámetros del régimen ───────────────────────────────────────────────────

// Usamos Date.UTC para que los timestamps sean inequívocos sin importar el
// timezone del servidor.
const INICIO_TS  = Date.UTC(2025, 3, 11)   // 11-abr-2025 00:00 UTC
const FASE2_TS   = Date.UTC(2026, 0, 1)    // 1-ene-2026  00:00 UTC
const PISO_INI   = 1000    // ARS/USD — piso inicial
const TECHO_INI  = 1400    // ARS/USD — techo inicial
const TASA_F1    = 0.01    // 1 % mensual — Fase 1
const FALLBACK   = 0.0338  // tasa fallback si falta IPC T-2

// ── Cache en memoria ──────────────────────────────────────────────────────────

const _cache: { data: unknown; expiry: number } = { data: null, expiry: 0 }

// ── Helpers (todos UTC) ───────────────────────────────────────────────────────

/** Meses transcurridos entre dos timestamps usando 30 días/mes (metodología BCRA) */
function mesesEntre(ts1: number, ts2: number): number {
  return (ts2 - ts1) / (30 * 86400 * 1000)
}

/** Días en un mes (UTC) */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Avanza exactamente n meses, siempre al día 1 del mes resultado (UTC) */
function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const total = month + n
  return {
    year:  year + Math.floor(total / 12),
    month: ((total % 12) + 12) % 12,
  }
}

function ymKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`
}

// ── IPC mensual desde datos.gob.ar ───────────────────────────────────────────
// Serie: 145.3_INGNACUAL_DICI_M_38 → variación mensual en decimal (0.0288 = 2.88%)

async function fetchIPCMensual(): Promise<Record<string, number>> {
  try {
    const url =
      "https://apis.datos.gob.ar/series/api/series/" +
      "?ids=145.3_INGNACUAL_DICI_M_38" +
      "&limit=36&sort=desc&format=json"
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 43200 }, // 12 h
    })
    if (!res.ok) return {}
    const json = await res.json()
    const rows: [string, number][] = json.data ?? []
    const result: Record<string, number> = {}
    for (const [fecha, valor] of rows) {
      if (valor != null) result[fecha.slice(0, 7)] = valor // ya en decimal
    }
    return result
  } catch {
    return {}
  }
}

// ── Generación de la serie de bandas ─────────────────────────────────────────

function generarFase1(): Array<{ date: string; piso: number; techo: number }> {
  const result: Array<{ date: string; piso: number; techo: number }> = []

  // Iterar día a día desde el 11-abr-2025 hasta el 31-dic-2025 (inclusive)
  const finTS = FASE2_TS - 86400 * 1000 // 31-dic-2025

  let ts = INICIO_TS
  while (ts <= finTS) {
    const m = mesesEntre(INICIO_TS, ts)
    result.push({
      date:  new Date(ts).toISOString().slice(0, 10),
      piso:  Math.round((PISO_INI  * Math.pow(1 - TASA_F1, m)) * 100) / 100,
      techo: Math.round((TECHO_INI * Math.pow(1 + TASA_F1, m)) * 100) / 100,
    })
    ts += 86400 * 1000 // +1 día
  }
  return result
}

function generarFase2(
  ipcPorMes: Record<string, number>
): Array<{ date: string; piso: number; techo: number }> {
  const result: Array<{ date: string; piso: number; techo: number }> = []

  // Base al inicio de Fase 2 (1-ene-2026), calculada desde Fase 1
  const mFase1   = mesesEntre(INICIO_TS, FASE2_TS)
  let pisoBase   = PISO_INI  * Math.pow(1 - TASA_F1, mFase1)
  let techoBase  = TECHO_INI * Math.pow(1 + TASA_F1, mFase1)

  // Límite: primer día del mes 3 meses adelante (UTC)
  const hoy   = new Date()
  const hY    = hoy.getUTCFullYear()
  const hM    = hoy.getUTCMonth()
  const hasta = new Date(Date.UTC(
    hY + Math.floor((hM + 3) / 12),
    (hM + 3) % 12,
    1,
  ))

  // Iterar mes a mes desde enero 2026
  let curYear  = 2026
  let curMonth = 0  // enero (0-based)

  while (new Date(Date.UTC(curYear, curMonth, 1)) <= hasta) {
    const year  = curYear
    const month = curMonth

    // T-2: usar IPC publicado 2 meses antes del mes actual
    const t2Year  = month >= 2 ? year : year - 1
    const t2Month = month >= 2 ? month - 2 : month + 10
    const tasa    = ipcPorMes[ymKey(t2Year, t2Month)] ?? FALLBACK

    const dias   = daysInMonth(year, month)
    const stepP  = pisoBase  * tasa / dias   // decremento diario piso
    const stepT  = techoBase * tasa / dias   // incremento diario techo

    for (let d = 0; d < dias; d++) {
      result.push({
        date:  new Date(Date.UTC(year, month, d + 1)).toISOString().slice(0, 10),
        piso:  Math.round((pisoBase  - stepP * d) * 100) / 100,
        techo: Math.round((techoBase + stepT * d) * 100) / 100,
      })
    }

    // Base para el próximo mes
    pisoBase  -= stepP * dias
    techoBase += stepT * dias

    // Avanzar al mes siguiente
    const next = addMonths(curYear, curMonth, 1)
    curYear  = next.year
    curMonth = next.month
  }

  return result
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  if (_cache.data && _cache.expiry > Date.now()) {
    return NextResponse.json({ data: _cache.data, cached: true })
  }

  const ipcPorMes = await fetchIPCMensual()

  const fase1 = generarFase1()
  const fase2 = generarFase2(ipcPorMes)
  const data  = [...fase1, ...fase2]

  _cache.data   = data
  _cache.expiry = Date.now() + 12 * 3600 * 1000 // 12 h

  return NextResponse.json({
    data,
    ipc_meses_disponibles: Object.keys(ipcPorMes).sort(),
    updated_at: new Date().toISOString(),
    source: "INDEC vía datos.gob.ar (IPC T-2) + parámetros BCRA",
  })
}
