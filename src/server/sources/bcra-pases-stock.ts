import * as XLSX from "xlsx"
import { fetchRegistered } from "@/server/http/fetch-source"

/**
 * Stock (saldo) de PASES / REPO del BCRA — NO VERIFICADO contra el archivo real.
 * ---------------------------------------------------------------------------
 * Contexto: la API estadisticas v4 del BCRA expone la TASA de pases
 * (variables 9 y 10, ver BCRA_VARIABLE_MAPPING) pero en este repo no hay
 * evidencia (ni codigo, ni fixtures, ni mapping) de una variable de SALDO de
 * pases. El catalogo vivo (/api/bcra-balance) es dinamico y no se pudo
 * inspeccionar sin red. Por eso NO se inventa un idVariable: el saldo se lee
 * del Informe Monetario Diario (IMD) del BCRA, un XLS.
 *
 * Lo que NO esta verificado (alguien con red debe confirmarlo):
 *  1. La URL real del XLS del IMD  -> se configura por env BCRA_IMD_XLS_URL.
 *  2. El nombre de la hoja         -> env BCRA_IMD_SHEET (default: primera hoja).
 *  3. El texto de la columna de pases (pasivos / activos) -> env
 *     BCRA_IMD_PASIVOS_LABEL / BCRA_IMD_ACTIVOS_LABEL (regex, sin acentos,
 *     case-insensitive).
 *  4. Que el archivo tenga fechas en filas y series en columnas.
 *  5. La unidad (se asume millones de pesos, como el resto del IMD).
 * Si algo no matchea, el parser devuelve [] y la ruta responde "degraded":
 * nunca rellena con numeros inventados.
 */

export type StockPoint = { fecha: string; valor: number }

export type ParserOpts = {
  /** Regex (sobre texto normalizado) que identifica el encabezado de la columna. */
  label: RegExp
  /** Indice de la columna de fechas (default 0). */
  dateCol?: number
  /** Cuantas filas desde arriba se revisan buscando el encabezado (default 40). */
  headerScanRows?: number
}

export const PASES_STOCK_CONFIG = {
  url: () => process.env.BCRA_IMD_XLS_URL ?? "",
  sheet: () => process.env.BCRA_IMD_SHEET ?? "",
  labelPasivos: () => new RegExp(process.env.BCRA_IMD_PASIVOS_LABEL ?? "pases.*pasivos|pasivos.*pases", "i"),
  labelActivos: () => new RegExp(process.env.BCRA_IMD_ACTIVOS_LABEL ?? "pases.*activos|activos.*pases", "i"),
}

/** Minusculas y sin acentos, para comparar encabezados. */
export function normalizeLabel(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Convierte serial de Excel, Date, dd/mm/yyyy o ISO a YYYY-MM-DD (o null). */
export function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === "number" && Number.isFinite(v) && v > 20_000 && v < 80_000) {
    // Serial de Excel (sistema 1900): 25569 = 1970-01-01
    return new Date(Math.round((v - 25_569) * 86_400_000)).toISOString().slice(0, 10)
  }
  const s = String(v ?? "").trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  return null
}

/**
 * Parser puro: recibe la hoja como matriz (filas x columnas) y devuelve la
 * serie [fecha, valor] de la columna cuyo encabezado matchea `label`.
 * Fila de encabezado = primera fila (dentro de headerScanRows) con una celda
 * que matchee. Los encabezados partidos en varias filas se concatenan hacia
 * arriba (hasta 2 filas) para tolerar celdas combinadas.
 */
export function parsePasesStockRows(rows: unknown[][], opts: ParserOpts): StockPoint[] {
  const dateCol = opts.dateCol ?? 0
  const scan = Math.min(opts.headerScanRows ?? 40, rows.length)

  let headerRow = -1
  let valueCol = -1
  for (let r = 0; r < scan && valueCol < 0; r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < row.length; c++) {
      if (c === dateCol) continue
      const text = [rows[r - 2]?.[c], rows[r - 1]?.[c], row[c]].map(normalizeLabel).join(" ")
      if (opts.label.test(text)) { headerRow = r; valueCol = c; break }
    }
  }
  if (valueCol < 0) return []

  const byDate = new Map<string, number>()
  for (let r = headerRow + 1; r < rows.length; r++) {
    const fecha = toIsoDate(rows[r]?.[dateCol])
    const raw = rows[r]?.[valueCol]
    const valor = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? "").replace(/\./g, "").replace(",", "."))
    if (!fecha || !Number.isFinite(valor)) continue
    byDate.set(fecha, valor)
  }
  return [...byDate.entries()]
    .map(([fecha, valor]) => ({ fecha, valor }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Parsea un XLS/XLSX (buffer) usando la hoja configurada o la primera. */
export function parsePasesStockWorkbook(buffer: ArrayBuffer | Uint8Array, opts: ParserOpts, sheet?: string): StockPoint[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true })
  const name = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0]
  if (!name) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: null })
  return parsePasesStockRows(rows, opts)
}

/** Descarga el IMD (host registrado como bcra_imd) y devuelve el stock. */
export async function fetchPasesStock(lado: "pasivos" | "activos"): Promise<StockPoint[]> {
  const url = PASES_STOCK_CONFIG.url()
  if (!url) return []
  const res = await fetchRegistered(url, { headers: { "User-Agent": "PanelDeControl/2.0" } })
  if (!res.ok) throw new Error(`BCRA IMD fetch failed: ${res.status}`)
  const label = lado === "pasivos" ? PASES_STOCK_CONFIG.labelPasivos() : PASES_STOCK_CONFIG.labelActivos()
  return parsePasesStockWorkbook(await res.arrayBuffer(), { label }, PASES_STOCK_CONFIG.sheet() || undefined)
}

export type RepoAlignedRow = { fecha: string; stock: number | null; tasa: number | null }

/**
 * Alinea stock y tasa por fecha (union de fechas; null donde falta uno).
 * La tasa es diaria y el stock tambien, pero los feriados/publicaciones
 * pueden diferir: no se interpola, se deja null (el grafico corta la linea).
 */
export function alignStockAndRate(stock: StockPoint[], tasa: StockPoint[]): RepoAlignedRow[] {
  const s = new Map(stock.map(p => [p.fecha, p.valor]))
  const t = new Map(tasa.map(p => [p.fecha, p.valor]))
  return [...new Set([...s.keys(), ...t.keys()])]
    .sort()
    .map(fecha => ({ fecha, stock: s.get(fecha) ?? null, tasa: t.get(fecha) ?? null }))
}
