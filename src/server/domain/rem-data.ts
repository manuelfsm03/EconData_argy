import * as XLSX from "xlsx"

function limpiarNumero(value: unknown): number | null {
  if (value == null || value === "" || (typeof value === "string" && value.trim().toLowerCase() === "nan")) return null
  if (typeof value === "number") return Number.isNaN(value) ? null : value
  const parsed = Number.parseFloat(String(value).trim().replace(/\./g, "").replace(",", "."))
  return Number.isNaN(parsed) ? null : parsed
}

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

type RemLongRow = {
  fechaPronostico: Date
  variable: string
  referencia: string
  periodo: string
  mediana: number | null
}

export function parseRemExcel(buf: Buffer): { serie: RemRow[]; participantes: RemParticipante[] } {
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets["Base de Datos Completa"]
  if (!sheet) return { serie: [], participantes: [] }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]

  const rows: RemLongRow[] = []
  for (let index = 2; index < raw.length; index += 1) {
    const row = raw[index]
    if (!row || !(row[0] instanceof Date)) continue
    rows.push({
      fechaPronostico: row[0],
      variable: String(row[1] ?? ""),
      referencia: String(row[2] ?? ""),
      periodo: String(row[3] ?? ""),
      mediana: limpiarNumero(row[4]),
    })
  }

  const dates = [...new Set(rows.map((row) => row.fechaPronostico.getTime()))].sort((left, right) => left - right)
  function findValue(date: number, variable: string, referencePrefix: string, period: string): number | null {
    return rows.find((row) =>
      row.fechaPronostico.getTime() === date && row.variable === variable &&
      row.referencia.startsWith(referencePrefix) && row.periodo === period
    )?.mediana ?? null
  }

  const serie = dates.map((date) => {
    const inflacion12 = findValue(date, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const inflacion24 = findValue(date, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 24 meses")
    const nucleo12 = findValue(date, "Precios minoristas (IPC núcleo; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const dolar12 = findValue(date, "Tipo de cambio nominal", "$/USD", "Próx. 12 meses")
    const tasaVariables = [
      "Tasa de interés (TAMAR)", "Tasa de interés (BADLAR)", "Tasa de interés (LELIQ)",
      "Tasa de política monetaria (LELIQ)", "Tasa de política monetaria (Pase 7 días)",
      "Tasa de política monetaria (Lebac)",
    ]
    let tasa12: number | null = null
    for (const variable of tasaVariables) {
      tasa12 = findValue(date, variable, "", "Próx. 12 meses")
      if (tasa12 != null) break
    }
    const tasaReal12 = tasa12 != null && inflacion12 != null && inflacion12 > 0
      ? ((1 + tasa12 / 100) / (1 + inflacion12 / 100) - 1) * 100
      : null
    return {
      fecha: new Date(date).toISOString().slice(0, 7),
      inflacion_12m: inflacion12,
      inflacion_24m: inflacion24,
      nucleo_12m: nucleo12,
      dolar_12m: dolar12,
      tasa_12m: tasa12,
      tasa_real_12m: tasaReal12,
    }
  })

  return {
    serie: serie.filter((row) => row.inflacion_12m != null || row.dolar_12m != null)
      .sort((left, right) => left.fecha.localeCompare(right.fecha)),
    participantes: [],
  }
}
