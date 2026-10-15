import { fetchRegistered } from "@/server/http/fetch-source"
import * as XLSX from "xlsx"

export type BankingSheetCell = number | string | null
export type BankingSheetRow = BankingSheetCell[]

export type BankingPeriod = {
  fecha: string
  disponibilidades: number | null
  inst_bcra: number | null
  titulos_pub: number | null
  cred_pub: number | null
  cred_priv: number | null
  otros_activos: number | null
  dep_priv_vista: number | null
  dep_priv_plazo: number | null
  dep_priv_otros: number | null
  dep_pub: number | null
  dep_otros_sectores: number | null
  on_lineas_ext: number | null
  oblig_bcra: number | null
  otros_pasivos: number | null
  pn: number | null
  activo_mm: number
}

// El BCRA publica el mismo anexo en español y en inglés, pero NO los
// actualiza al mismo ritmo — verificado en vivo (14/10/2026): el español
// llevaba desde el 24/7 sin tocarse (dato hasta mayo), mientras el inglés ya
// tenía dato hasta julio. En vez de hardcodear "el inglés es mejor" (puede
// invertirse el día de mañana), se bajan los dos en cada request y se usa el
// que tenga el dato más reciente — así queda al día solo, sin que haga falta
// venir a cambiar una URL a mano cuando el BCRA se atrase con uno de los dos.
const BANKING_WORKBOOK_URLS = {
  es: "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/InfBanc_Anexo.xlsx",
  en: "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/report-banks-annex.xlsx",
} as const

type WorkbookLang = keyof typeof BANKING_WORKBOOK_URLS

// Mismos offsets de fila en los dos idiomas (verificado hoja por hoja contra
// el archivo real) — sólo cambia el nombre de la hoja.
const SHEET_NAMES: Record<"balance" | "carteraEntidad" | "carteraDeudor", Record<WorkbookLang, string>> = {
  balance: { es: "Estado de Sit. Financiera", en: "Balance sheet" },
  carteraEntidad: { es: "Calidad de Cartera", en: "Portfolio quality" },
  carteraDeudor: { es: "Calidad de Cartera (por líneas)", en: "Portfolio quality (by line)" },
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function valueAt(row: BankingSheetRow | undefined, column: number): number | null {
  return finiteNumber(row?.[column])
}

function sumKnown(...values: Array<number | null>): number | null {
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null
}

function subtractKnown(base: number | null, ...values: Array<number | null>): number | null {
  return base !== null && values.every((value): value is number => value !== null)
    ? base - values.reduce((sum, value) => sum + value, 0)
    : null
}

function percent(value: number | null, total: number): number | null {
  return value === null ? null : Number(((value / total) * 100).toFixed(2))
}

export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

// La fila de fechas trae columnas vacías al final (formato de Excel, no es
// que falte el dato) — hay que recorrer desde el final buscando la última
// celda que sea realmente una fecha, no asumir que es la última columna.
export function lastDateInRow(row: BankingSheetRow | undefined): string | null {
  if (!row) return null
  for (let column = row.length - 1; column >= 1; column -= 1) {
    const serial = finiteNumber(row[column])
    if (serial === null) continue
    const fecha = excelSerialToDate(serial)
    if (fecha !== null) return fecha
  }
  return null
}

async function fetchWorkbook(url: string): Promise<XLSX.WorkBook> {
  const response = await fetchRegistered(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`BCRA banking workbook failed: ${response.status}`)
  return XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" })
}

function sheetToRows(sheet: XLSX.WorkSheet): BankingSheetRow[] {
  return XLSX.utils.sheet_to_json<BankingSheetRow>(sheet, { header: 1, defval: null, raw: true }) as BankingSheetRow[]
}

type FreshestWorkbook = { workbook: XLSX.WorkBook; lang: WorkbookLang; ultimaFecha: string | null }

/**
 * Baja el anexo en los dos idiomas y devuelve el que tenga el dato más
 * reciente (según la hoja de balance, que se publica con la misma cadencia
 * que las de cartera). Si uno de los dos falla la descarga, sigue con el
 * que sí respondió en vez de fallar entero — y si los dos responden pero
 * ninguno trae fecha reconocible, igual devuelve el primero que respondió
 * para que el error real salga más abajo, al parsear.
 */
async function fetchFreshestBankingWorkbook(): Promise<FreshestWorkbook> {
  const entries = Object.entries(BANKING_WORKBOOK_URLS) as [WorkbookLang, string][]
  const results = await Promise.allSettled(
    entries.map(async ([lang, url]): Promise<FreshestWorkbook> => {
      const workbook = await fetchWorkbook(url)
      const sheet = workbook.Sheets[SHEET_NAMES.balance[lang]]
      const ultimaFecha = sheet ? lastDateInRow(sheetToRows(sheet)[3]) : null
      return { workbook, lang, ultimaFecha }
    }),
  )

  const fulfilled = results
    .filter((result): result is PromiseFulfilledResult<FreshestWorkbook> => result.status === "fulfilled")
    .map((result) => result.value)

  if (fulfilled.length === 0) {
    const reasons = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => String(result.reason))
      .join(" · ")
    throw new Error(`BCRA banking workbook failed: ni la versión en español ni la en inglés respondieron (${reasons})`)
  }

  return fulfilled.reduce((best, current) => {
    if (best.ultimaFecha === null) return current
    if (current.ultimaFecha === null) return best
    return current.ultimaFecha > best.ultimaFecha ? current : best
  })
}

function assertISODate(value: string): void {
  if (!DATE_RE.test(value)) {
    throw new Error("Las fechas deben usar formato YYYY-MM-DD")
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Las fechas deben usar formato YYYY-MM-DD válido")
  }
}

export function parseBankingDateRange(desde: string, hasta: string): { desde: string; hasta: string } {
  assertISODate(desde)
  assertISODate(hasta)
  if (desde > hasta) throw new Error("desde no puede ser posterior a hasta")
  return { desde, hasta }
}

export function parseBankingRows(
  rows: BankingSheetRow[],
  desde: string,
  hasta: string,
): BankingPeriod[] {
  parseBankingDateRange(desde, hasta)
  const dateRow = rows[3] ?? []
  const periods: BankingPeriod[] = []

  for (let column = 1; column < dateRow.length; column += 1) {
    const serial = finiteNumber(dateRow[column])
    const fecha = serial === null ? null : excelSerialToDate(serial)
    if (fecha === null || fecha < desde || fecha > hasta) continue

    const activo = valueAt(rows[5], column)
    if (activo === null || activo <= 0) continue

    const disponibilidades = valueAt(rows[6], column)
    const instrumentosBCRA = sumKnown(valueAt(rows[9], column), valueAt(rows[10], column))
    const titulosPublicos = subtractKnown(valueAt(rows[7], column), instrumentosBCRA)
    const creditoPublico = valueAt(rows[13], column)
    const creditoPrivado = valueAt(rows[14], column)
    const otrosActivos = subtractKnown(
      activo,
      disponibilidades,
      instrumentosBCRA,
      titulosPublicos,
      creditoPublico,
      creditoPrivado,
    )

    const pasivo = valueAt(rows[28], column)
    const depositosTotales = valueAt(rows[29], column)
    const depositosPublicos = valueAt(rows[30], column)
    const depositosPrivados = valueAt(rows[31], column)
    const cuentaCorriente = valueAt(rows[32], column)
    const cajaAhorro = valueAt(rows[33], column)
    const plazoFijo = valueAt(rows[34], column)
    const vistaPrivada = sumKnown(cuentaCorriente, cajaAhorro)
    const otrosDepositosPrivados = subtractKnown(
      depositosPrivados,
      cuentaCorriente,
      cajaAhorro,
      plazoFijo,
    )
    const depositosOtrosSectores = subtractKnown(
      depositosTotales,
      depositosPublicos,
      depositosPrivados,
    )
    const onLineasExterior = sumKnown(valueAt(rows[39], column), valueAt(rows[40], column))
    const obligacionesBCRA = valueAt(rows[38], column)
    const otrosPasivos = subtractKnown(
      pasivo,
      depositosTotales,
      onLineasExterior,
      obligacionesBCRA,
    )

    periods.push({
      fecha,
      disponibilidades: percent(disponibilidades, activo),
      inst_bcra: percent(instrumentosBCRA, activo),
      titulos_pub: percent(titulosPublicos, activo),
      cred_pub: percent(creditoPublico, activo),
      cred_priv: percent(creditoPrivado, activo),
      otros_activos: percent(otrosActivos, activo),
      dep_priv_vista: percent(vistaPrivada, activo),
      dep_priv_plazo: percent(plazoFijo, activo),
      dep_priv_otros: percent(otrosDepositosPrivados, activo),
      dep_pub: percent(depositosPublicos, activo),
      dep_otros_sectores: percent(depositosOtrosSectores, activo),
      on_lineas_ext: percent(onLineasExterior, activo),
      oblig_bcra: percent(obligacionesBCRA, activo),
      otros_pasivos: percent(otrosPasivos, activo),
      pn: percent(valueAt(rows[45], column), activo),
      activo_mm: activo,
    })
  }

  return periods.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ── Calidad de cartera (morosidad) ────────────────────────────────────────────
// Mismo workbook que ya se descarga para el balance (InfBanc_Anexo.xlsx), dos
// hojas más que nadie leía: "Calidad de Cartera" (irregularidad por tipo de
// entidad) y "Calidad de Cartera (por líneas)" (irregularidad por tipo de
// deudor: privado total, familias, empresas). Mismo layout repetido: una fila
// "En porcentaje" con las fechas, la fila siguiente con los valores — por eso
// cada segmento se define por el índice de esas dos filas, verificado a mano
// contra el archivo real (no es un patrón que haya que adivinar de nuevo).

export type CarteraPeriod = { fecha: string; valor: number | null }
export type CarteraSerie = { segmento: string; label: string; serie: CarteraPeriod[] }

function parseCarteraSegment(
  rows: BankingSheetRow[],
  dateRow: number,
  valueRow: number,
  desde: string,
  hasta: string,
): CarteraPeriod[] {
  const fechas = rows[dateRow] ?? []
  const valores = rows[valueRow] ?? []
  const periods: CarteraPeriod[] = []
  for (let column = 1; column < fechas.length; column += 1) {
    const serial = finiteNumber(fechas[column])
    const fecha = serial === null ? null : excelSerialToDate(serial)
    if (fecha === null || fecha < desde || fecha > hasta) continue
    periods.push({ fecha, valor: valueAt(valores, column) })
  }
  return periods.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Hoja "Calidad de Cartera": cartera irregular total (%) por tipo de entidad.
const CARTERA_POR_ENTIDAD: { segmento: string; label: string; dateRow: number; valueRow: number }[] = [
  { segmento: "sistema_financiero", label: "Sistema financiero", dateRow: 3, valueRow: 4 },
  { segmento: "bancos_privados", label: "Bancos privados", dateRow: 18, valueRow: 19 },
  { segmento: "bancos_privados_nacionales", label: "Bancos privados nacionales", dateRow: 33, valueRow: 34 },
  { segmento: "bancos_privados_extranjeros", label: "Bancos privados extranjeros", dateRow: 48, valueRow: 49 },
  { segmento: "bancos_publicos", label: "Bancos públicos", dateRow: 63, valueRow: 64 },
  { segmento: "efnb", label: "Entidades financieras no bancarias (EFNB)", dateRow: 78, valueRow: 79 },
]

// Hoja "Calidad de Cartera (por líneas)": cartera irregular total (%) por
// tipo de deudor — el desglose "a familias" que 1816 cita seguido y que no
// está en la API de Monetarias del BCRA (sólo en este anexo).
const CARTERA_POR_DEUDOR: { segmento: string; label: string; dateRow: number; valueRow: number }[] = [
  { segmento: "sector_privado_total", label: "Total sector privado", dateRow: 5, valueRow: 6 },
  { segmento: "familias", label: "Familias", dateRow: 57, valueRow: 58 },
  { segmento: "empresas", label: "Empresas", dateRow: 101, valueRow: 102 },
]

export function parseCarteraRows(
  porEntidad: BankingSheetRow[],
  porDeudor: BankingSheetRow[],
  desde: string,
  hasta: string,
): { porEntidad: CarteraSerie[]; porDeudor: CarteraSerie[] } {
  parseBankingDateRange(desde, hasta)
  return {
    porEntidad: CARTERA_POR_ENTIDAD.map((seg) => ({
      segmento: seg.segmento,
      label: seg.label,
      serie: parseCarteraSegment(porEntidad, seg.dateRow, seg.valueRow, desde, hasta),
    })),
    porDeudor: CARTERA_POR_DEUDOR.map((seg) => ({
      segmento: seg.segmento,
      label: seg.label,
      serie: parseCarteraSegment(porDeudor, seg.dateRow, seg.valueRow, desde, hasta),
    })),
  }
}

export async function fetchCarteraQuality(desde: string, hasta: string) {
  parseBankingDateRange(desde, hasta)
  const { workbook, lang } = await fetchFreshestBankingWorkbook()
  const sheetEntidad = workbook.Sheets[SHEET_NAMES.carteraEntidad[lang]]
  const sheetDeudor = workbook.Sheets[SHEET_NAMES.carteraDeudor[lang]]
  if (!sheetEntidad || !sheetDeudor) {
    throw new Error("BCRA banking workbook is missing the Calidad de Cartera sheets")
  }

  const { porEntidad, porDeudor } = parseCarteraRows(sheetToRows(sheetEntidad), sheetToRows(sheetDeudor), desde, hasta)

  return {
    data: {
      por_entidad: porEntidad,
      por_deudor: porDeudor,
      ultima_fecha: porEntidad[0]?.serie.at(-1)?.fecha ?? null,
    },
    updated_at: new Date().toISOString(),
    source: `BCRA — ${BANKING_WORKBOOK_URLS[lang].split("/").at(-1)} (${lang}) · ${SHEET_NAMES.carteraEntidad[lang]}`,
  }
}

export async function fetchBankingBalance(desde: string, hasta: string) {
  parseBankingDateRange(desde, hasta)
  const { workbook, lang } = await fetchFreshestBankingWorkbook()
  const sheet = workbook.Sheets[SHEET_NAMES.balance[lang]]
  if (!sheet) throw new Error("BCRA banking workbook is missing the balance sheet")

  const serie = parseBankingRows(sheetToRows(sheet), desde, hasta)

  return {
    data: {
      serie,
      ultima_fecha: serie.at(-1)?.fecha ?? null,
      n_periodos: serie.length,
    },
    updated_at: new Date().toISOString(),
    source: `BCRA — ${BANKING_WORKBOOK_URLS[lang].split("/").at(-1)} (${lang}) · ${SHEET_NAMES.balance[lang]}`,
  }
}
