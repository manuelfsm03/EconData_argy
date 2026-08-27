export type DebtPoint = {
  date: string
  deuda_usd: number
}

export type DebtPointWithGdp = DebtPoint & {
  deuda_pib: number | null
}

export type QuarterlyGdpPoint = [date: string, value: number]

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function excelSerialToMonth(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 25569) return null
  const date = new Date(Math.round((serial - 25569) * 86_400_000))
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString().slice(0, 7)
}

export function parseDebtSheetRows(rows: unknown[][]): DebtPoint[] {
  let dateRowIndex = -1

  for (let index = 0; index < Math.min(25, rows.length); index += 1) {
    const dateCount = rows[index].filter(
      value => typeof value === "number" && value > 40_000 && value < 55_000,
    ).length
    if (dateCount >= 6) {
      dateRowIndex = index
      break
    }
  }

  if (dateRowIndex < 0) return []

  const debtRow = rows
    .slice(dateRowIndex + 1, dateRowIndex + 5)
    .find(row => row.slice(0, 4).some(value =>
      typeof value === "string" && /DEUDA\s+BRUTA/i.test(value),
    ))
  if (!debtRow) return []

  const dateRow = rows[dateRowIndex]
  const points: DebtPoint[] = []
  for (let index = 2; index < dateRow.length; index += 1) {
    const serial = dateRow[index]
    const value = debtRow[index]
    if (!isFinitePositive(serial) || !isFinitePositive(value)) continue
    const date = excelSerialToMonth(serial)
    if (!date) continue
    points.push({ date, deuda_usd: Math.round(value) })
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export function attachQuarterlyGdp(
  debtPoints: DebtPoint[],
  gdpPoints: QuarterlyGdpPoint[],
): DebtPointWithGdp[] {
  const validGdp = gdpPoints
    .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isFinitePositive(value))
    .sort(([a], [b]) => a.localeCompare(b))

  return debtPoints
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(point => {
      const cutoff = `${point.date}-01`
      let latest: number | null = null
      for (const [date, value] of validGdp) {
        if (date > cutoff) break
        latest = value
      }
      return {
        ...point,
        deuda_pib: latest === null
          ? null
          : Number(((point.deuda_usd / latest) * 100).toFixed(1)),
      }
    })
}

// ── Composición de la deuda (hojas A.2 legislación / A.3 moneda) ───────────────

export type Composicion = { nombre: string; pct: number }

/**
 * Ubica la fila de encabezado de fechas (≥6 seriales Excel entre 40k y 55k) y
 * devuelve su índice más la última columna con fecha (el mes más reciente).
 */
function findDateHeader(rows: unknown[][]): { rowIndex: number; lastCol: number } | null {
  for (let i = 0; i < Math.min(25, rows.length); i += 1) {
    const serialCols: number[] = []
    rows[i].forEach((value, idx) => {
      if (typeof value === "number" && value > 40_000 && value < 55_000) serialCols.push(idx)
    })
    if (serialCols.length >= 6) return { rowIndex: i, lastCol: serialCols[serialCols.length - 1] }
  }
  return null
}

/** Primer valor numérico en `col` cuya etiqueta (en `labelCol`) matchea `pattern`. */
function rowValueByLabel(rows: unknown[][], col: number, labelCol: number, pattern: RegExp): number | null {
  for (const row of rows) {
    const label = row[labelCol]
    if (typeof label === "string" && pattern.test(label)) {
      const v = row[col]
      if (typeof v === "number" && Number.isFinite(v)) return v
    }
  }
  return null
}

/**
 * Composición por moneda desde la hoja A.3 ("Por moneda y tasa").
 * Desglosa Pesos (moneda local) · Dólares · Euros · Otras monedas.
 */
export function parseComposicionMoneda(rows: unknown[][]): Composicion[] {
  const hdr = findDateHeader(rows)
  if (!hdr) return []
  const col = hdr.lastCol
  // Categorías de primer nivel: etiqueta en la columna 0
  const local = rowValueByLabel(rows, col, 0, /moneda local/i)
  const extranjera = rowValueByLabel(rows, col, 0, /moneda extranjera/i)
  if (local == null || extranjera == null) return []
  // Sub-monedas dentro de "extranjera": etiqueta en la columna 1
  const usd = rowValueByLabel(rows, col, 1, /d[oó]lar/i) ?? 0
  const eur = rowValueByLabel(rows, col, 1, /euro/i) ?? 0
  const otras = extranjera - usd - eur
  const total = local + extranjera
  if (total <= 0) return []
  const raw: Array<{ nombre: string; value: number }> = [
    { nombre: "Pesos (moneda local)", value: local },
    { nombre: "Dólares", value: usd },
    { nombre: "Euros", value: eur },
    { nombre: "Otras monedas", value: otras },
  ]
  return raw
    .filter(p => p.value > 0)
    .map(p => ({ nombre: p.nombre, pct: Number(((p.value / total) * 100).toFixed(1)) }))
}

/**
 * Composición por legislación desde la hoja A.2 ("Por legislación y situación").
 * Argentina vs Extranjera — el mejor proxy de "acreedor" del boletín oficial
 * (el workbook no publica desglose por acreedor propiamente dicho).
 */
export function parseComposicionLegislacion(rows: unknown[][]): Composicion[] {
  const hdr = findDateHeader(rows)
  if (!hdr) return []
  const col = hdr.lastCol
  const arg = rowValueByLabel(rows, col, 0, /legislaci[oó]n argentina/i)
  const ext = rowValueByLabel(rows, col, 0, /legislaci[oó]n extranjera/i)
  if (arg == null || ext == null) return []
  const total = arg + ext
  if (total <= 0) return []
  return [
    { nombre: "Legislación argentina", pct: Number(((arg / total) * 100).toFixed(1)) },
    { nombre: "Legislación extranjera", pct: Number(((ext / total) * 100).toFixed(1)) },
  ]
}

export function buildAnnualDebtHistory(points: DebtPointWithGdp[]): Array<{
  anio: string
  deuda_pib: number | null
  deuda_usd: number
}> {
  const latestByYear = new Map<string, DebtPointWithGdp>()
  for (const point of points.slice().sort((a, b) => a.date.localeCompare(b.date))) {
    latestByYear.set(point.date.slice(0, 4), point)
  }

  return Array.from(latestByYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, point]) => ({
      anio,
      deuda_pib: point.deuda_pib,
      deuda_usd: point.deuda_usd,
    }))
}
