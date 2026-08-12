import { fetchRegistered } from "@/server/http/fetch-source"
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
// Tasa de respaldo cuando falta el IPC T-2. Es el IPC de marzo 2026
// (0.033826), congelado como constante. NO es un valor neutro: si el IPC se
// atrasa, la banda se desliza a esa tasa y se aleja de la real todos los meses.
// Por eso su uso ahora sale declarado en `advertencias` de la respuesta.
const FALLBACK   = 0.0338

// ── Cache en memoria ──────────────────────────────────────────────────────────

interface RespuestaBandas {
  data: PuntoBanda[]
  meses_fase2: MesFase2[]
  ipc_meses_disponibles: string[]
  puntos_proyectados: number
  fallback_tasa: number
  advertencias: string[]
  updated_at: string
  source: string
}

const _cache: { payload: RespuestaBandas | null; expiry: number } = { payload: null, expiry: 0 }

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
    const res = await fetchRegistered(url, {
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

// Fase 1 termina el 31-dic-2025: es toda historia, nunca proyección.
function generarFase1(): PuntoBanda[] {
  const result: PuntoBanda[] = []

  // Iterar día a día desde el 11-abr-2025 hasta el 31-dic-2025 (inclusive)
  const finTS = FASE2_TS - 86400 * 1000 // 31-dic-2025

  let ts = INICIO_TS
  while (ts <= finTS) {
    const m = mesesEntre(INICIO_TS, ts)
    result.push({
      date:  new Date(ts).toISOString().slice(0, 10),
      piso:  Math.round((PISO_INI  * Math.pow(1 - TASA_F1, m)) * 100) / 100,
      techo: Math.round((TECHO_INI * Math.pow(1 + TASA_F1, m)) * 100) / 100,
      proyectado: false,
    })
    ts += 86400 * 1000 // +1 día
  }
  return result
}

/**
 * Cómo se deslizó cada mes de Fase 2 y de dónde salió la tasa.
 *
 * Existe para que el consumidor pueda distinguir un mes calculado con IPC real
 * de uno que cayó a la tasa de respaldo. Antes esa sustitución era muda: la
 * respuesta salía igual, y un IPC atrasado producía una banda equivocada que
 * nadie tenía forma de detectar desde afuera.
 */
export interface MesFase2 {
  /** Mes de la banda, "2026-08". */
  mes: string
  /** Tasa mensual de deslizamiento aplicada, en decimal. */
  tasa: number
  fuente: "ipc_t2" | "fallback"
  /** Mes T-2 del que debería salir la tasa, "2026-06". */
  ipc_mes: string
}

export interface PuntoBanda {
  date: string
  piso: number
  techo: number
  /**
   * true = la fecha todavía no llegó. La serie se extiende tres meses hacia
   * adelante, y sin esta marca el gráfico dibuja la proyección con la misma
   * línea que lo ya ocurrido.
   */
  proyectado: boolean
}

function esFutura(fecha: string, hoy: string): boolean {
  return fecha > hoy
}

function generarFase2(
  ipcPorMes: Record<string, number>,
  hoyISO: string,
): { puntos: PuntoBanda[]; meses: MesFase2[] } {
  const result: PuntoBanda[] = []
  const meses: MesFase2[] = []

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
    const t2Key   = ymKey(t2Year, t2Month)
    const ipcReal = ipcPorMes[t2Key]
    const tasa    = ipcReal ?? FALLBACK

    meses.push({
      mes: ymKey(year, month),
      tasa,
      fuente: ipcReal != null ? "ipc_t2" : "fallback",
      ipc_mes: t2Key,
    })

    const dias   = daysInMonth(year, month)
    const stepP  = pisoBase  * tasa / dias   // decremento diario piso
    const stepT  = techoBase * tasa / dias   // incremento diario techo

    for (let d = 0; d < dias; d++) {
      const date = new Date(Date.UTC(year, month, d + 1)).toISOString().slice(0, 10)
      result.push({
        date,
        piso:  Math.round((pisoBase  - stepP * d) * 100) / 100,
        techo: Math.round((techoBase + stepT * d) * 100) / 100,
        proyectado: esFutura(date, hoyISO),
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

  return { puntos: result, meses }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  // Se cachea la respuesta ENTERA y no sólo `data`: antes el hit de caché
  // devolvía los puntos sin `source` ni `ipc_meses_disponibles`, así que la
  // procedencia del dato desaparecía en la mitad de las requests.
  if (_cache.payload && _cache.expiry > Date.now()) {
    return NextResponse.json({ ..._cache.payload, cached: true })
  }

  const ipcPorMes = await fetchIPCMensual()
  const hoyISO    = new Date().toISOString().slice(0, 10)

  const fase1 = generarFase1()
  const fase2 = generarFase2(ipcPorMes, hoyISO)
  const data  = [...fase1, ...fase2.puntos]

  const conFallback = fase2.meses.filter((m) => m.fuente === "fallback")
  const proyectados = data.filter((p) => p.proyectado).length

  const payload: RespuestaBandas = {
    data,
    meses_fase2: fase2.meses,
    ipc_meses_disponibles: Object.keys(ipcPorMes).sort(),
    puntos_proyectados: proyectados,
    fallback_tasa: FALLBACK,
    // Vacío cuando todo se calculó con IPC real. Si trae algo, la banda de
    // esos meses no refleja la inflación observada y la UI tiene que decirlo.
    advertencias: conFallback.length
      ? [
          `${conFallback.length} mes(es) se deslizaron con la tasa de respaldo ` +
            `(${(FALLBACK * 100).toFixed(2)}% mensual) porque falta el IPC T-2: ` +
            conFallback.map((m) => `${m.mes} (esperaba IPC de ${m.ipc_mes})`).join(", ") +
            `. La banda de esos meses no refleja la inflación real.`,
        ]
      : [],
    updated_at: new Date().toISOString(),
    source: "INDEC vía datos.gob.ar (IPC T-2) + parámetros BCRA",
  }

  _cache.payload = payload
  _cache.expiry  = Date.now() + 12 * 3600 * 1000 // 12 h

  return NextResponse.json(payload)
}
