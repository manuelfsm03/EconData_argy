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

const BANKING_WORKBOOK_URL =
  "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/InfBanc_Anexo.xlsx"
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

export async function fetchBankingBalance(desde: string, hasta: string) {
  parseBankingDateRange(desde, hasta)
  const response = await fetch(BANKING_WORKBOOK_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`BCRA banking workbook failed: ${response.status}`)

  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" })
  const sheet = workbook.Sheets["Estado de Sit. Financiera"]
  if (!sheet) throw new Error("BCRA banking workbook is missing Estado de Sit. Financiera")

  const rows = XLSX.utils.sheet_to_json<BankingSheetRow>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as BankingSheetRow[]
  const serie = parseBankingRows(rows, desde, hasta)

  return {
    data: {
      serie,
      ultima_fecha: serie.at(-1)?.fecha ?? null,
      n_periodos: serie.length,
    },
    updated_at: new Date().toISOString(),
    source: "BCRA — InfBanc_Anexo.xlsx · Estado de Sit. Financiera",
  }
}
