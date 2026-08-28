import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  attachQuarterlyGdp,
  buildAnnualDebtHistory,
  parseDebtSheetRows,
  parseComposicionMoneda,
  parseComposicionLegislacion,
  parseServicioDeuda,
} from "../src/server/domain/debt-stock"

const debtRoute = readFileSync("src/app/api/deuda/route.ts", "utf8")

function serial(date: string): number {
  return 25569 + Date.parse(`${date}T00:00:00Z`) / 86_400_000
}

test("detects the official debt row dynamically and parses monthly values", () => {
  const dates = ["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01", "2025-05-01", "2025-06-01"]
  const rows: unknown[][] = [
    ["title"],
    [],
    ["", "", ...dates.map(serial)],
    ["", "A- DEUDA BRUTA ( I + II + III)", 460000.4, 461000.5, 462000.6, 463000.7, 0, "bad"],
  ]

  assert.deepEqual(parseDebtSheetRows(rows), [
    { date: "2025-01", deuda_usd: 460000 },
    { date: "2025-02", deuda_usd: 461001 },
    { date: "2025-03", deuda_usd: 462001 },
    { date: "2025-04", deuda_usd: 463001 },
  ])
})

test("uses the latest available GDP observation not later than each debt month", () => {
  const result = attachQuarterlyGdp(
    [
      { date: "2025-03", deuda_usd: 462000 },
      { date: "2025-05", deuda_usd: 468000 },
      { date: "2026-01", deuda_usd: 480000 },
    ],
    [
      ["2025-01-01", 700000],
      ["2025-04-01", 720000],
      ["2026-01-01", 800000],
    ],
  )

  assert.deepEqual(result, [
    { date: "2025-03", deuda_usd: 462000, deuda_pib: 66 },
    { date: "2025-05", deuda_usd: 468000, deuda_pib: 65 },
    { date: "2026-01", deuda_usd: 480000, deuda_pib: 60 },
  ])
})

test("preserves null without a prior GDP point and uses the latest month per year", () => {
  const monthly = attachQuarterlyGdp(
    [
      { date: "2024-12", deuda_usd: 450000 },
      { date: "2025-12", deuda_usd: 470000 },
      { date: "2026-03", deuda_usd: 483855 },
    ],
    [["2025-01-01", 700000]],
  )

  assert.equal(monthly[0].deuda_pib, null)
  assert.deepEqual(buildAnnualDebtHistory(monthly), [
    { anio: "2024", deuda_pib: null, deuda_usd: 450000 },
    { anio: "2025", deuda_pib: 67.1, deuda_usd: 470000 },
    { anio: "2026", deuda_pib: 69.1, deuda_usd: 483855 },
  ])
})

const dates6 = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"]

test("parseComposicionMoneda desglosa Pesos/Dólares/Euros/Otras (hoja A.3)", () => {
  // header con 6 seriales (idx 2-7) → lastCol=7; los valores van en idx 7
  const rows: unknown[][] = [
    ["title"],
    ["", "", ...dates6.map(serial)],
    ["Moneda local",      "Moneda local (1)",                 0, 0, 0, 0, 0, 462],
    ["Moneda extranjera", "Moneda extranjera",                0, 0, 0, 0, 0, 538],
    ["",                  "Deuda en dólares estadounidenses", 0, 0, 0, 0, 0, 407],
    ["",                  "Deuda en euros",                   0, 0, 0, 0, 0, 12],
  ]
  assert.deepEqual(parseComposicionMoneda(rows), [
    { nombre: "Pesos (moneda local)", pct: 46.2 },
    { nombre: "Dólares", pct: 40.7 },
    { nombre: "Euros", pct: 1.2 },
    { nombre: "Otras monedas", pct: 11.9 },
  ])
})

test("parseComposicionLegislacion arma Argentina vs Extranjera (hoja A.2)", () => {
  const rows: unknown[][] = [
    ["title"],
    ["", "", ...dates6.map(serial)],
    ["Legislación Argentina",  "I- LEGISLACIÓN ARGENTINA",  0, 0, 0, 0, 0, 665],
    ["Legislación extranjera", "II- LEGISLACIÓN EXTRANJERA", 0, 0, 0, 0, 0, 335],
  ]
  assert.deepEqual(parseComposicionLegislacion(rows), [
    { nombre: "Legislación argentina", pct: 66.5 },
    { nombre: "Legislación extranjera", pct: 33.5 },
  ])
})

test("composición devuelve [] si falta el encabezado de fechas o las categorías", () => {
  assert.deepEqual(parseComposicionMoneda([["x"], ["Moneda local", "", 100]]), [])
  assert.deepEqual(parseComposicionLegislacion([["", "", ...dates6.map(serial)]]), [])
})

test("parseServicioDeuda agrega pagos mensuales a total anual por moneda (hoja A.5)", () => {
  const dates = ["2025-01-01", "2025-02-01", "2025-03-01", "2026-01-01", "2026-02-01", "2026-03-01"]
  const rows: unknown[][] = [
    ["title"],
    ["", "", ...dates.map(serial)],
    ["", "TOTAL PAGADO POR MONEDA DE PAGO", 100, 100, 100, 200, 200, 200],
    ["", " - MONEDA NACIONAL",              60,  60,  60,  120, 120, 120],
    ["", " - MONEDA EXTRANJERA",            40,  40,  40,  80,  80,  80],
  ]
  assert.deepEqual(parseServicioDeuda(rows), [
    { anio: "2025", nacional: 180, extranjera: 120, total: 300 },
    { anio: "2026", nacional: 360, extranjera: 240, total: 600 },
  ])
})

test("parseServicioDeuda devuelve [] sin encabezado o sin filas de pago", () => {
  assert.deepEqual(parseServicioDeuda([["x"], ["", "TOTAL PAGADO POR MONEDA", 1]]), [])
})

test("debt route uses the live official workbook and drops the retired CSV", () => {
  assert.match(debtRoute, /datos-mensuales-de-la-deuda\/datos/)
  assert.match(debtRoute, /bolet[ií]n mensual de deuda/i)
  assert.doesNotMatch(debtRoute, /deuda-bruta\.csv/)
})
