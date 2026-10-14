/**
 * Parser de la serie "irregularidad del crédito al sector privado" (BCRA).
 *
 * Funciones puras (sin red, sin fs): reciben las filas de una hoja Excel y
 * devuelven series mensuales del ratio de cartera irregular para el total
 * privado, familias y empresas. Solo series agregadas del sistema financiero;
 * NO usa la Central de Deudores (consultas por CUIT/CUIL).
 *
 * SUPUESTO NO VERIFICADO contra la fuente en vivo: el layout exacto del
 * archivo del BCRA. Por eso el parser busca por ETIQUETAS (no por índices de
 * fila fijos): una fila de fechas, un rótulo "irregular" y sub-filas
 * "familias" / "empresas" / "total". Si no encuentra la estructura, falla
 * en lugar de inventar valores.
 */

export type MoraCell = number | string | Date | null | undefined
export type MoraRow = MoraCell[]

export type MoraSerieId = "total_privado" | "familias" | "empresas"

export type MoraPoint = { periodo: string; valor: number }

export type MoraParsed = {
  series: Partial<Record<MoraSerieId, MoraPoint[]>>
  /** Rótulo original de la fila usada por cada serie (trazabilidad). */
  filas_origen: Partial<Record<MoraSerieId, string>>
}

export type MoraParseOptions = {
  /** "auto": si todos los valores son <= 1 se interpretan como fracción (x100). */
  escala?: "porcentaje" | "fraccion" | "auto"
  /** Cantidad máxima de filas después del rótulo de sección donde buscar sub-filas. */
  ventanaSeccion?: number
}

export class MoraParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MoraParseError"
  }
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function yyyymm(anio: number, mes: number): string | null {
  if (anio < 1990 || anio > 2100 || mes < 1 || mes > 12) return null
  return `${anio}-${String(mes).padStart(2, "0")}`
}

/** Convierte una celda de encabezado a "YYYY-MM" (serial Excel, Date, "2024-03", "mar-24", "03/2024"). */
export function celdaAPeriodo(cell: MoraCell): string | null {
  if (cell == null || cell === "") return null
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? null : yyyymm(cell.getUTCFullYear(), cell.getUTCMonth() + 1)
  }
  if (typeof cell === "number") {
    // Rango de seriales Excel razonable: 1990-01 a 2100.
    if (!Number.isFinite(cell) || cell < 32_874 || cell > 73_050) return null
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000)
    return yyyymm(d.getUTCFullYear(), d.getUTCMonth() + 1)
  }
  const t = normalizar(cell)
  let m = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(t)
  if (m) return yyyymm(Number(m[1]), Number(m[2]))
  m = /^(\d{1,2})[-/](\d{4})$/.exec(t)
  if (m) return yyyymm(Number(m[2]), Number(m[1]))
  m = /^([a-z]{3})[a-z]*[-/ .](\d{2}|\d{4})$/.exec(t)
  if (m && MESES[m[1]]) {
    const y = Number(m[2])
    return yyyymm(y < 100 ? 2000 + y : y, MESES[m[1]])
  }
  return null
}

function aNumero(cell: MoraCell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null
  if (typeof cell !== "string") return null
  const limpio = cell.replace("%", "").trim()
  if (!limpio || !/^-?[\d.,]+$/.test(limpio)) return null
  // "1,23" -> 1.23 ; "1.234,5" -> 1234.5
  const n = limpio.includes(",") ? Number(limpio.replace(/\./g, "").replace(",", ".")) : Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** Primera fila con al menos 3 celdas interpretables como período mensual. */
export function encontrarFilaFechas(rows: MoraRow[]): { fila: number; columnas: { col: number; periodo: string }[] } | null {
  for (let i = 0; i < rows.length; i += 1) {
    const columnas: { col: number; periodo: string }[] = []
    const row = rows[i] ?? []
    for (let c = 0; c < row.length; c += 1) {
      const periodo = celdaAPeriodo(row[c])
      if (periodo) columnas.push({ col: c, periodo })
    }
    if (columnas.length >= 3) return { fila: i, columnas }
  }
  return null
}

function etiquetaDe(row: MoraRow | undefined): string {
  // La etiqueta está en alguna de las 2 primeras columnas de texto.
  for (let c = 0; c < 2; c += 1) {
    const v = row?.[c]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function esSeccionIrregular(label: string): boolean {
  const n = normalizar(label)
  return /irregular/.test(n) && !/previsi/.test(n)
}

function clasificarSubfila(label: string): MoraSerieId | null {
  const n = normalizar(label)
  if (/familia|hogar|individu|personas humanas|consumo/.test(n)) return "familias"
  if (/empresa|personas juridicas|comercial|corporativ/.test(n)) return "empresas"
  if (/total|sector privado|privad/.test(n)) return "total_privado"
  return null
}

export function parseIrregularidadRows(rows: MoraRow[], opts: MoraParseOptions = {}): MoraParsed {
  const ventana = opts.ventanaSeccion ?? 8
  const fechas = encontrarFilaFechas(rows)
  if (!fechas) throw new MoraParseError("No se encontró una fila de fechas mensuales en la hoja")

  const brutas: Partial<Record<MoraSerieId, { label: string; row: MoraRow }>> = {}

  for (let i = fechas.fila + 1; i < rows.length; i += 1) {
    const label = etiquetaDe(rows[i])
    if (!label || !esSeccionIrregular(label)) continue

    // El propio rótulo puede ser la serie total (si tiene datos) o solo un título.
    const nums = fechas.columnas.filter(({ col }) => aNumero(rows[i]?.[col]) !== null).length
    const propio = clasificarSubfila(label)
    if (nums > 0) {
      const id: MoraSerieId = propio ?? "total_privado"
      if (!brutas[id]) brutas[id] = { label, row: rows[i] }
    }
    for (let j = i + 1; j <= Math.min(i + ventana, rows.length - 1); j += 1) {
      const sub = etiquetaDe(rows[j])
      if (!sub) continue
      if (esSeccionIrregular(sub)) break
      const id = clasificarSubfila(sub)
      const tieneDatos = fechas.columnas.some(({ col }) => aNumero(rows[j]?.[col]) !== null)
      if (id && tieneDatos && !brutas[id]) brutas[id] = { label: `${label} > ${sub}`, row: rows[j] }
    }
  }

  const ids = Object.keys(brutas) as MoraSerieId[]
  if (ids.length === 0) throw new MoraParseError("No se encontraron filas de irregularidad del crédito")

  const valoresCrudos = ids.flatMap((id) =>
    fechas.columnas.map(({ col }) => aNumero(brutas[id]!.row[col])).filter((v): v is number => v !== null),
  )
  const escala = opts.escala ?? "auto"
  const factor =
    escala === "fraccion" || (escala === "auto" && valoresCrudos.length > 0 && Math.max(...valoresCrudos.map(Math.abs)) <= 1)
      ? 100
      : 1

  const series: MoraParsed["series"] = {}
  const filas_origen: MoraParsed["filas_origen"] = {}
  for (const id of ids) {
    const puntos: MoraPoint[] = []
    for (const { col, periodo } of fechas.columnas) {
      const v = aNumero(brutas[id]!.row[col])
      if (v === null) continue
      puntos.push({ periodo, valor: Math.round(v * factor * 1000) / 1000 })
    }
    puntos.sort((a, b) => a.periodo.localeCompare(b.periodo))
    if (puntos.length > 0) {
      series[id] = puntos
      filas_origen[id] = brutas[id]!.label
    }
  }
  if (Object.keys(series).length === 0) throw new MoraParseError("Las filas de irregularidad no tienen valores numéricos")
  return { series, filas_origen }
}

/** Elige, entre varias hojas, la primera que parsea; devuelve el nombre de la hoja usada. */
export function parseIrregularidadWorkbook(
  hojas: Record<string, MoraRow[]>,
  opts: MoraParseOptions = {},
): MoraParsed & { hoja: string } {
  const errores: string[] = []
  const relevante = (n: string) => Number(/irregul|mora|calidad|cartera/.test(normalizar(n)))
  // Primero las hojas cuyo nombre sugiere el tema.
  const nombres = Object.keys(hojas).sort((a, b) => relevante(b) - relevante(a))
  for (const nombre of nombres) {
    try {
      return { ...parseIrregularidadRows(hojas[nombre], opts), hoja: nombre }
    } catch (e) {
      errores.push(`${nombre}: ${(e as Error).message}`)
    }
  }
  throw new MoraParseError(`Ninguna hoja con irregularidad del crédito (${errores.length} hojas probadas)`)
}
