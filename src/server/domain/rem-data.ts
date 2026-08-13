/**
 * REM — Relevamiento de Expectativas de Mercado (BCRA).
 *
 * Fuente única y estable: el acumulado histórico completo del BCRA, que trae
 * la hoja "Base de Datos Completa" (mediana de todos los participantes) y
 * "Base Completa TOP-10" (mediana de los 10 mejores pronosticadores), ambas
 * en formato largo: una fila por (fecha de encuesta, variable, referencia,
 * período). El link de "último informe" cambia de nombre cada mes y sólo
 * trae un resumen, por eso usamos el acumulado.
 *
 * Extraído a módulo compartido para que /api/rem y /api/bandas-cambiarias
 * usen la MISMA fuente en vez de que cada uno la reimplemente a su manera
 * (bandas-cambiarias tenía su propia cadena de 3 fuentes alternativas,
 * mucho más frágil que esto).
 */
import * as XLSX from "xlsx"

const REM_XLSX_URL = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/historico-relevamiento-expectativas-mercado.xlsx"

export async function fetchRemExcel(): Promise<Buffer> {
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  const res = await fetch(REM_XLSX_URL, { headers, signal: AbortSignal.timeout(20000), cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function limpiarNumero(x: unknown): number | null {
  if (x == null || x === "" || (typeof x === "string" && x.trim().toLowerCase() === "nan")) return null
  if (typeof x === "number") return isNaN(x) ? null : x
  const s = String(x).trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ── Series interanuales (12m/24m) — para /api/rem ──────────────────────────

export interface RemRow {
  fecha: string
  inflacion_12m: number | null
  inflacion_24m: number | null
  nucleo_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  tasa_real_12m: number | null
}

export interface RemParticipante {
  institucion: string
  inflacion_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
}

interface RemLongRow {
  fechaPronostico: Date
  variable: string
  referencia: string
  periodo: string
  mediana: number | null
}

function leerFilasLargo(buf: Buffer, hoja: string, colMediana: number): RemLongRow[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const ws = wb.Sheets[hoja]
  if (!ws) {
    console.error(`[rem-data] Hoja "${hoja}" no encontrada. Hojas disponibles: ${wb.SheetNames.join(", ")}`)
    return []
  }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

  const rows: RemLongRow[] = []
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i]
    if (!r || !(r[0] instanceof Date)) continue
    rows.push({
      fechaPronostico: r[0] as Date,
      variable: String(r[1] ?? ""),
      referencia: String(r[2] ?? ""),
      periodo: String(r[3] instanceof Date ? (r[3] as Date).toISOString() : r[3] ?? ""),
      mediana: limpiarNumero(r[colMediana]),
    })
  }
  return rows
}

/**
 * Series interanuales (inflación 12m/24m, dólar, tasa) — una fila por fecha
 * de encuesta, ya rolleadas ("Próx. 12 meses" / "Próx. 24 meses").
 */
export function parseRemExcel(buf: Buffer): { serie: RemRow[]; participantes: RemParticipante[] } {
  const rows = leerFilasLargo(buf, "Base de Datos Completa", 4)
  const fechasUnicas = [...new Set(rows.map((r) => r.fechaPronostico.getTime()))].sort((a, b) => a - b)

  function buscar(fechaMs: number, variable: string, refPrefix: string, periodo: string): number | null {
    const match = rows.find(
      (r) =>
        r.fechaPronostico.getTime() === fechaMs &&
        r.variable === variable &&
        r.referencia.startsWith(refPrefix) &&
        r.periodo === periodo,
    )
    return match?.mediana ?? null
  }

  const serie: RemRow[] = fechasUnicas.map((ms) => {
    const fecha = new Date(ms).toISOString().slice(0, 7)
    const inf12 = buscar(ms, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const inf24 = buscar(ms, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 24 meses")
    const nuc12 = buscar(ms, "Precios minoristas (IPC núcleo; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const usd12 = buscar(ms, "Tipo de cambio nominal", "$/USD", "Próx. 12 meses")
    const tasaVariables = [
      "Tasa de interés (TAMAR)", "Tasa de interés (BADLAR)", "Tasa de interés (LELIQ)",
      "Tasa de política monetaria (LELIQ)", "Tasa de política monetaria (Pase 7 días)",
      "Tasa de política monetaria (Lebac)",
    ]
    let tas12: number | null = null
    for (const v of tasaVariables) {
      tas12 = buscar(ms, v, "", "Próx. 12 meses")
      if (tas12 != null) break
    }
    let tasaReal: number | null = null
    if (tas12 != null && inf12 != null && inf12 > 0) {
      tasaReal = ((1 + tas12 / 100) / (1 + inf12 / 100) - 1) * 100
    }
    return { fecha, inflacion_12m: inf12, inflacion_24m: inf24, nucleo_12m: nuc12, dolar_12m: usd12, tasa_12m: tas12, tasa_real_12m: tasaReal }
  })

  return {
    serie: serie.filter((r) => r.inflacion_12m != null || r.dolar_12m != null).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    participantes: [],
  }
}

// ── Trayectoria mensual — para /api/bandas-cambiarias ──────────────────────

/**
 * Trayectoria de inflación mensual esperada (variable "var. % mensual") de
 * la ÚLTIMA encuesta disponible, mediana (todos los participantes) y top-10
 * (los 10 mejores pronosticadores, hoja separada). Cada encuesta suele traer
 * entre 6 y 12 meses hacia adelante — el llamador no debe asumir largo fijo.
 */
export function parseRemMensual(buf: Buffer): { mediana: number[]; top10: number[]; fechaEncuesta: string } | null {
  const filasGenerales = leerFilasLargo(buf, "Base de Datos Completa", 4)
  const filasTop10 = leerFilasLargo(buf, "Base Completa TOP-10", 5) // en esta hoja "Mediana" es la columna 5, no la 4

  const soloMensual = (rows: RemLongRow[]) =>
    rows.filter((r) => r.variable === "Precios minoristas (IPC nivel general; INDEC)" && r.referencia === "var. % mensual")

  const generales = soloMensual(filasGenerales)
  if (generales.length === 0) return null

  const ultimaFechaMs = Math.max(...generales.map((r) => r.fechaPronostico.getTime()))
  const top10 = soloMensual(filasTop10)

  const trayectoria = (rows: RemLongRow[]) =>
    rows
      .filter((r) => r.fechaPronostico.getTime() === ultimaFechaMs && r.mediana != null)
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
      .map((r) => r.mediana as number)

  const mediana = trayectoria(generales)
  const top10Valores = trayectoria(top10)

  if (mediana.length === 0) return null

  return {
    mediana,
    // Si por algún motivo la hoja TOP-10 no trae la misma última encuesta,
    // aproximamos como antes (mediana - 0.3) en vez de dejar el array vacío.
    top10: top10Valores.length === mediana.length ? top10Valores : mediana.map((v) => Math.max(0, v - 0.3)),
    fechaEncuesta: new Date(ultimaFechaMs).toISOString().slice(0, 10),
  }
}
