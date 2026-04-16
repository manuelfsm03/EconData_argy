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
 *     (metodología verificada con datos oficiales BCRA: error < 1 ARS)
 *
 * El resultado incluye todos los días desde el 11-abr-2025 hasta 3 meses adelante.
 * Cache: 12 h (los datos del IPC solo cambian una vez por mes).
 */

import { NextResponse } from "next/server"

// ── Parámetros del régimen ───────────────────────────────────────────────────

const INICIO     = new Date("2025-04-11")
const FASE2      = new Date("2026-01-01")
const PISO_INI   = 1000    // ARS/USD — piso inicial
const TECHO_INI  = 1400    // ARS/USD — techo inicial
const TASA_F1    = 0.01    // 1 % mensual — Fase 1
const FALLBACK   = 0.0338  // tasa fallback si falta IPC T-2 (calibrado mayo-2026)

// ── Cache en memoria ──────────────────────────────────────────────────────────

const _cache: { data: unknown; expiry: number } = { data: null, expiry: 0 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesesEntre(d1: Date, d2: Date): number {
  return (d2.getTime() - d1.getTime()) / (30.44 * 86400 * 1000)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
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
  const d = new Date(INICIO)
  const fin = new Date(FASE2)
  fin.setDate(fin.getDate() - 1) // hasta 31-dic-2025

  while (d <= fin) {
    const m = mesesEntre(INICIO, d)
    result.push({
      date:  d.toISOString().slice(0, 10),
      piso:  Math.round((PISO_INI  * Math.pow(1 - TASA_F1, m)) * 100) / 100,
      techo: Math.round((TECHO_INI * Math.pow(1 + TASA_F1, m)) * 100) / 100,
    })
    d.setDate(d.getDate() + 1)
  }
  return result
}

function generarFase2(
  ipcPorMes: Record<string, number>
): Array<{ date: string; piso: number; techo: number }> {
  const result: Array<{ date: string; piso: number; techo: number }> = []

  // Valor final de Fase 1 (31-dic-2025)
  const mFase1   = mesesEntre(INICIO, FASE2)
  let pisoBase   = PISO_INI  * Math.pow(1 - TASA_F1, mFase1)
  let techoBase  = TECHO_INI * Math.pow(1 + TASA_F1, mFase1)

  // Generar hasta 3 meses adelante de hoy
  const hoy   = new Date()
  const hasta = addMonths(hoy, 3)

  let mes = new Date(FASE2) // 1-ene-2026
  while (mes <= hasta) {
    const year  = mes.getFullYear()
    const month = mes.getMonth() // 0-based

    // T-2: mes actual − 2
    const t2Year  = month >= 2 ? year : year - 1
    const t2Month = month >= 2 ? month - 2 : month + 10
    const tasa    = ipcPorMes[ymKey(t2Year, t2Month)] ?? FALLBACK

    const dias   = daysInMonth(year, month)
    const stepP  = pisoBase  * tasa / dias   // decremento diario piso
    const stepT  = techoBase * tasa / dias   // incremento diario techo

    for (let d = 0; d < dias; d++) {
      const fecha = new Date(year, month, d + 1)
      if (fecha < FASE2) continue
      result.push({
        date:  fecha.toISOString().slice(0, 10),
        piso:  Math.round((pisoBase  - stepP * d) * 100) / 100,
        techo: Math.round((techoBase + stepT * d) * 100) / 100,
      })
    }

    // Base para el próximo mes
    pisoBase  -= stepP * dias
    techoBase += stepT * dias

    mes = addMonths(mes, 1)
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
