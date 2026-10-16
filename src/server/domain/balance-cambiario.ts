/**
 * balance-cambiario.ts — parser puro del Balance Cambiario del BCRA
 * ("Evolución del Mercado de Cambios y Balance Cambiario").
 *
 * SUPUESTO NO VERIFICADO contra la fuente en vivo: el anexo es un XLS con
 * conceptos (oferta/demanda de divisas por sector) en filas y meses en
 * columnas, valores en millones de USD. El parser NO depende de posiciones
 * fijas: detecta la fila de encabezado de períodos y toma como conceptos las
 * filas siguientes con etiqueta de texto y valores numéricos. Si el BCRA
 * cambia el layout (p. ej. años y meses en dos filas distintas) lanza un
 * error explícito en vez de inventar datos.
 *
 * Sin I/O: recibe la matriz de filas (XLSX.utils.sheet_to_json header:1).
 */

export type Celda = string | number | Date | null | undefined
export type Matriz = Celda[][]

export interface SerieBalance {
  periodo: string // YYYY-MM
  valor: number
}

export interface ConceptoBalance {
  id: string
  etiqueta: string
  nivel: number // sangría detectada en la etiqueta (0 = sin sangría)
  categoria: string | null // sector detectado por heurística sobre la etiqueta
  ultimo_periodo: string | null
  ultimo_valor: number | null
  series: SerieBalance[]
}

export interface BalanceParseado {
  periodos: string[]
  conceptos: ConceptoBalance[]
  fila_encabezado: number
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
}

/** Categorías de sector detectadas por heurística sobre la etiqueta (orden = prioridad). */
export const CATEGORIAS: { id: string; patron: RegExp }[] = [
  { id: "formacion_activos_externos", patron: /formacion de activos externos|atesoramiento/ },
  { id: "personas_humanas", patron: /personas humanas|personas fisicas/ },
  { id: "energia", patron: /energi|petroleo|combustible|\bgas\b/ },
  { id: "agro", patron: /agro|cereal|oleaginos|granos/ },
  { id: "sector_real", patron: /sector real|bienes y servicios|mercader/ },
  { id: "deuda_financiera", patron: /deuda|prestamos financieros|endeudamiento/ },
  { id: "inversion_directa", patron: /inversion(es)? directa/ },
]

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export function slug(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

export function detectarCategoria(etiqueta: string): string | null {
  const n = normalizar(etiqueta)
  return CATEGORIAS.find(c => c.patron.test(n))?.id ?? null
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Convierte una celda a "YYYY-MM" o null si no es un período mensual reconocible. */
export function parsearPeriodo(celda: Celda): string | null {
  if (celda instanceof Date) {
    if (isNaN(celda.getTime())) return null
    // +12 h para absorber el corrimiento de zona horaria que introduce xlsx
    const d = new Date(celda.getTime() + 12 * 3600 * 1000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
  }
  if (typeof celda === "number") {
    // Serial de Excel (30000 ~ 1982, 60000 ~ 2064); fuera de rango no es una fecha
    if (celda < 30000 || celda > 60000) return null
    const d = new Date(Math.round((celda - 25569) * 86400 * 1000) + 12 * 3600 * 1000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
  }
  if (typeof celda !== "string") return null
  const t = normalizar(celda).replace(/\./g, "")
  let m = t.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${pad(+m[2])}`
  m = t.match(/^([a-z]+)[\s\-/]+(\d{2}|\d{4})$/)
  if (m && MESES[m[1]]) {
    const anio = m[2].length === 2 ? 2000 + +m[2] : +m[2]
    return `${anio}-${pad(MESES[m[1]])}`
  }
  return null
}

/** Convierte una celda a número; null si es vacía, "s/d", guión, etc. */
export function parsearNumero(celda: Celda): number | null {
  if (typeof celda === "number") return Number.isFinite(celda) ? celda : null
  if (typeof celda !== "string") return null
  const t = celda.trim()
  if (!t || /^(s\/d|n\/d|n\.d\.|-+|\.\.+)$/i.test(t)) return null
  // "1.234,5" (es-AR) o "1234.5"
  const limpio = /,\d{1,3}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "")
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

export function parsearBalanceCambiario(filas: Matriz, minPeriodos = 6): BalanceParseado {
  // 1. Fila de encabezado: la primera con al menos `minPeriodos` períodos mensuales
  let filaEnc = -1
  let columnas: { col: number; periodo: string }[] = []
  for (let r = 0; r < filas.length; r++) {
    const cols: { col: number; periodo: string }[] = []
    ;(filas[r] ?? []).forEach((celda, col) => {
      const p = parsearPeriodo(celda)
      if (p) cols.push({ col, periodo: p })
    })
    if (cols.length >= minPeriodos) { filaEnc = r; columnas = cols; break }
  }
  if (filaEnc < 0) {
    throw new Error(`No se encontró fila de encabezado con >= ${minPeriodos} períodos mensuales (layout cambió?)`)
  }

  // 2. Conceptos: filas debajo del encabezado con etiqueta de texto y >= 3 valores numéricos
  const usados = new Map<string, number>()
  const conceptos: ConceptoBalance[] = []
  for (let r = filaEnc + 1; r < filas.length; r++) {
    const fila = filas[r] ?? []
    const celdaEtiqueta = fila
      .slice(0, Math.max(1, columnas[0].col))
      .find(c => typeof c === "string" && c.trim() !== "")
    if (typeof celdaEtiqueta !== "string") continue
    const etiqueta = celdaEtiqueta.trim()
    const series: SerieBalance[] = []
    for (const { col, periodo } of columnas) {
      const valor = parsearNumero(fila[col])
      if (valor !== null) series.push({ periodo, valor })
    }
    if (series.length < 3) continue
    let id = slug(etiqueta) || `fila_${r}`
    const veces = (usados.get(id) ?? 0) + 1
    usados.set(id, veces)
    if (veces > 1) id = `${id}_${veces}`
    const ultimo = series.at(-1) ?? null
    conceptos.push({
      id,
      etiqueta,
      nivel: Math.floor((celdaEtiqueta.length - celdaEtiqueta.trimStart().length) / 2),
      categoria: detectarCategoria(etiqueta),
      ultimo_periodo: ultimo?.periodo ?? null,
      ultimo_valor: ultimo?.valor ?? null,
      series,
    })
  }
  if (conceptos.length === 0) throw new Error("Encabezado encontrado pero sin filas de conceptos numéricas")

  return { periodos: columnas.map(c => c.periodo), conceptos, fila_encabezado: filaEnc }
}
