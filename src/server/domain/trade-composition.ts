type CsvRow = Record<string, string>
type ChartRow = Record<string, string | number | null>

const ICA_EXPO_FIELDS = [
  ["Prod. Primarios", "ica_exportacion_productos_primarios"],
  ["MOA", "ica_exportacion_manufacturas_origen_agropecuario"],
  ["MOI", "ica_exportacion_manufacturas_origen_industrial"],
  ["Combustibles", "ica_exportacion_combustible_energia"],
] as const

const ICA_IMPO_FIELDS = [
  ["Bs. Capital", "ica_importaciones_bienes_capital"],
  ["Bs. Intermedios", "ica_importaciones_bienes_intermedios"],
  ["Combustibles", "ica_importaciones_combustibles_lubricantes"],
  ["P&A Bs. Capital", "ica_importaciones_piezas_accesorios_bienes_capital"],
  ["Bs. Consumo", "ica_importaciones_bienes_consumo"],
  ["Vehículos", "ica_importaciones_vehiculos_automotores_pasajeros"],
  ["Resto", "ica_importaciones_resto"],
] as const

function parseObservedNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null
}

function validDate(raw: string | undefined): raw is string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const parsed = new Date(`${raw}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
}

function mapIcaRows(rows: CsvRow[], fields: ReadonlyArray<readonly [string, string]>): ChartRow[] {
  return rows
    .filter(row => validDate(row.indice_tiempo))
    .map(row => {
      const output: ChartRow = { date: row.indice_tiempo }
      for (const [label, field] of fields) output[label] = parseObservedNumber(row[field])
      return output
    })
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
}

export function buildIcaTradeComposition(rows: CsvRow[]) {
  return {
    unidad: "USD millones" as const,
    frecuencia: "mensual" as const,
    expo: {
      series: mapIcaRows(rows, ICA_EXPO_FIELDS),
      categorias: ICA_EXPO_FIELDS.map(([label]) => label),
    },
    impo: {
      series: mapIcaRows(rows, ICA_IMPO_FIELDS),
      categorias: ICA_IMPO_FIELDS.map(([label]) => label),
    },
  }
}

export function buildSitcShareComposition(rows: CsvRow[], valueColumn: string) {
  const byYear = new Map<string, ChartRow>()
  const categories = new Set<string>()

  for (const row of rows) {
    if (row.geocodigoFundar !== "ARG" || !/^\d{4}$/.test(row.year ?? "")) continue
    const category = row.sitc_product_name_es?.trim()
    const value = parseObservedNumber(row[valueColumn])
    if (!category || value === null) continue
    const date = `${row.year}-01-01`
    const output = byYear.get(date) ?? { date }
    output[category] = value
    byYear.set(date, output)
    categories.add(category)
  }

  return {
    unidad: "% del total" as const,
    frecuencia: "anual" as const,
    series: [...byYear.values()].sort((left, right) => String(left.date).localeCompare(String(right.date))),
    categorias: [...categories],
  }
}
