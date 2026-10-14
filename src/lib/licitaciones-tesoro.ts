/**
 * Parser de comunicados de resultado de las Licitaciones del Tesoro
 * (Secretaría de Finanzas, Ministerio de Economía).
 *
 * Funciones PURAS (sin red, sin fs): reciben HTML/texto y devuelven filas
 * normalizadas. El fetch vive en scripts/update-licitaciones-tesoro.ts.
 *
 * SUPUESTOS NO VERIFICADOS contra la fuente en vivo (ver PR):
 *  - El comunicado trae una tabla HTML con una fila por instrumento y columnas
 *    tipo "Instrumento / Vencimiento / Monto ofertado / Monto adjudicado"
 *    (alias configurables en COLUMN_ALIASES).
 *  - Montos en millones de VN en pesos, con formato AR ("1.234.567,89") o US.
 *  - Los totales (ofertado, adjudicado, vencimientos a cubrir) pueden venir en
 *    el texto del comunicado ("vencimientos ... por $X") y no en la tabla.
 *
 * Regla: nunca inventar. Campo que no se encuentra queda null y la licitación
 * se marca `incompleta: true` con la lista de `faltantes`.
 */

export type TipoInstrumento = "LECAP" | "BONCAP" | "CER" | "DUAL" | "DOLLAR_LINKED" | "TAMAR" | "OTRO"

export interface InstrumentoLicitado {
  nombre: string
  tipo: TipoInstrumento
  vencimiento: string | null // YYYY-MM-DD
  monto_ofertado: number | null
  monto_adjudicado: number | null
}

export interface Licitacion {
  fecha: string // YYYY-MM-DD (fecha de la licitación)
  fuente_url: string | null
  instrumentos: InstrumentoLicitado[]
  monto_ofertado_total: number | null
  monto_adjudicado_total: number | null
  vencimientos_a_cubrir: number | null
  /** adjudicado / vencimientos (1.0 = 100%). Calculado; null si falta algún insumo. */
  rollover: number | null
  incompleta: boolean
  faltantes: string[]
}

export type CampoColumna = "nombre" | "vencimiento" | "ofertado" | "adjudicado"

/** Alias (minúsculas, sin tildes) de encabezados por campo. Configurable por parámetro. */
export const COLUMN_ALIASES: Record<CampoColumna, string[]> = {
  nombre: ["instrumento", "titulo", "especie", "ticker", "descripcion"],
  vencimiento: ["vencimiento", "fecha de vencimiento", "vto"],
  ofertado: ["monto ofertado", "ofertado", "ofertas recibidas", "monto de ofertas"],
  adjudicado: ["monto adjudicado", "adjudicado", "monto aceptado", "valor nominal adjudicado"],
}

export interface ParseOptions {
  fecha?: string | null
  fuenteUrl?: string | null
  columnAliases?: Partial<Record<CampoColumna, string[]>>
}

// ---------- utilidades de texto ----------

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export function htmlATexto(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim()
}

/** "1.234.567,89" | "1,234,567.89" | "$ 1234" -> number; null si no hay número válido. */
export function parseMonto(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = raw.replace(/[^\d.,-]/g, "")
  if (!/\d/.test(s)) return null
  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")
  if (lastDot >= 0 && lastComma >= 0) {
    // el último separador es el decimal
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma >= 0) {
    s = (s.match(/,/g) ?? []).length > 1 || /,\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".")
  } else if (lastDot >= 0) {
    s = (s.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
}

function valida(y: string, mo: string, d: string): string | null {
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  const dt = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso
}

/** Acepta "dd/mm/yyyy", "dd-mm-yy", "yyyy-mm-dd" y "14 de octubre de 2026". */
export function parseFecha(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = normalizar(raw)
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return valida(m[1], m[2], m[3])
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) return valida(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1])
  m = s.match(/(\d{1,2}) de ([a-z]+)(?: de| del)? (\d{4})/)
  if (m && MESES[m[2]]) return valida(m[3], MESES[m[2]], m[1])
  return null
}

export function clasificarInstrumento(nombre: string): TipoInstrumento {
  const n = normalizar(nombre)
  if (/dollar[ -]?linked|\bdl\b|\bd\d{2}[a-z]\d\b/.test(n)) return "DOLLAR_LINKED"
  if (/dual/.test(n)) return "DUAL"
  if (/tamar/.test(n)) return "TAMAR"
  if (/\bcer\b|ajustable|\bx\d{2}[a-z]\d\b|\btzx|\bdicp|\bcuap/.test(n)) return "CER"
  if (/boncap/.test(n)) return "BONCAP"
  if (/lecap|letra.*capitaliz|\bs\d{2}[a-z]\d\b/.test(n)) return "LECAP"
  return "OTRO"
}

// ---------- tablas ----------

/** Extrae todas las tablas HTML como matrices de texto de celdas. */
export function extraerTablas(html: string): string[][][] {
  const tablas: string[][][] = []
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const filas: string[][] = []
    for (const tr of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const celdas = (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((c) => htmlATexto(c).replace(/\s+/g, " ").trim())
      if (celdas.length) filas.push(celdas)
    }
    if (filas.length) tablas.push(filas)
  }
  return tablas
}

function mapearColumnas(header: string[], aliases: Record<CampoColumna, string[]>): Partial<Record<CampoColumna, number>> {
  const out: Partial<Record<CampoColumna, number>> = {}
  header.forEach((h, i) => {
    const nh = normalizar(h)
    for (const campo of Object.keys(aliases) as CampoColumna[]) {
      if (out[campo] === undefined && aliases[campo].some((a) => nh === a || nh.includes(a))) out[campo] = i
    }
  })
  return out
}

/** Encuentra la tabla de instrumentos (con columna de nombre y de monto adjudicado u ofertado). */
export function parseTablaInstrumentos(
  html: string,
  aliasesParciales: ParseOptions["columnAliases"] = {},
): InstrumentoLicitado[] {
  const aliases = { ...COLUMN_ALIASES, ...aliasesParciales } as Record<CampoColumna, string[]>
  for (const tabla of extraerTablas(html)) {
    const cols = mapearColumnas(tabla[0], aliases)
    if (cols.nombre === undefined || (cols.adjudicado === undefined && cols.ofertado === undefined)) continue
    const celda = (fila: string[], campo: CampoColumna) => (cols[campo] === undefined ? null : fila[cols[campo]!] ?? null)
    return tabla
      .slice(1)
      .filter((f) => (celda(f, "nombre") ?? "").trim() !== "" && !/^total/.test(normalizar(celda(f, "nombre") ?? "")))
      .map((f) => ({
        nombre: celda(f, "nombre")!.trim(),
        tipo: clasificarInstrumento(celda(f, "nombre")!),
        vencimiento: parseFecha(celda(f, "vencimiento")),
        monto_ofertado: parseMonto(celda(f, "ofertado")),
        monto_adjudicado: parseMonto(celda(f, "adjudicado")),
      }))
  }
  return []
}

// ---------- totales en texto ----------

/** Busca un monto en los ~120 caracteres posteriores a la etiqueta. */
function montoTrasEtiqueta(texto: string, etiquetas: RegExp): number | null {
  const m = etiquetas.exec(texto)
  if (!m) return null
  const cola = texto.slice(m.index + m[0].length, m.index + m[0].length + 120)
  const n = cola.match(/\$?\s*(\d[\d.,]*)/)
  return n ? parseMonto(n[1]) : null
}

export function parseLicitacion(html: string, opts: ParseOptions = {}): Licitacion {
  const texto = htmlATexto(html)
  const instrumentos = parseTablaInstrumentos(html, opts.columnAliases)

  const suma = (campo: "monto_ofertado" | "monto_adjudicado") => {
    const vals = instrumentos.map((i) => i[campo])
    return vals.length > 0 && vals.every((v) => v !== null) ? (vals as number[]).reduce((a, b) => a + b, 0) : null
  }
  const ofertado = montoTrasEtiqueta(texto, /monto (?:total )?ofertado/i) ?? suma("monto_ofertado")
  const adjudicado = montoTrasEtiqueta(texto, /monto (?:total )?adjudicado/i) ?? suma("monto_adjudicado")
  const vencimientos = montoTrasEtiqueta(texto, /vencimientos?(?: a cubrir)?(?: por| de| ascend\w+ a)/i)

  const fecha = opts.fecha ?? parseFecha(texto.match(/licitaci[oó]n[^\n]{0,60}/i)?.[0] ?? "") ?? parseFecha(texto)
  const faltantes: string[] = []
  if (!fecha) faltantes.push("fecha")
  if (instrumentos.length === 0) faltantes.push("instrumentos")
  if (ofertado === null) faltantes.push("monto_ofertado_total")
  if (adjudicado === null) faltantes.push("monto_adjudicado_total")
  if (vencimientos === null) faltantes.push("vencimientos_a_cubrir")

  const rollover = adjudicado !== null && vencimientos !== null && vencimientos > 0 ? adjudicado / vencimientos : null
  return {
    fecha: fecha ?? "",
    fuente_url: opts.fuenteUrl ?? null,
    instrumentos,
    monto_ofertado_total: ofertado,
    monto_adjudicado_total: adjudicado,
    vencimientos_a_cubrir: vencimientos,
    rollover,
    incompleta: faltantes.length > 0,
    faltantes,
  }
}

/** Links del índice cuyo texto/href parecen resultados de licitación. */
export function extraerLinksComunicados(html: string, baseUrl: string): { url: string; texto: string }[] {
  const out = new Map<string, string>()
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const texto = htmlATexto(m[2]).replace(/\s+/g, " ")
    if (!/licitaci/i.test(`${texto} ${m[1]}`)) continue
    try {
      out.set(new URL(m[1], baseUrl).toString(), texto)
    } catch {
      /* href inválido: se ignora */
    }
  }
  return [...out].map(([url, texto]) => ({ url, texto }))
}

/** Mezcla por fecha: la licitación nueva reemplaza a la vieja de la misma fecha. Ordena desc. */
export function mergeLicitaciones(existentes: Licitacion[], nuevas: Licitacion[]): Licitacion[] {
  const mapa = new Map<string, Licitacion>()
  for (const l of [...existentes, ...nuevas]) if (l.fecha) mapa.set(l.fecha, l)
  return [...mapa.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
