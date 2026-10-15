import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  alignStockAndRate,
  normalizeLabel,
  parsePasesStockRows,
  parsePasesStockWorkbook,
  toIsoDate,
} from "../src/server/sources/bcra-pases-stock"

/**
 * FIXTURE SINTETICO: el layout del Informe Monetario Diario real NO esta
 * verificado (sin acceso a red). Estas matrices imitan "fechas en filas,
 * series en columnas, encabezado en algun lugar de las primeras filas" y los
 * numeros son inventados SOLO para testear el parser. No son datos del BCRA.
 */
const FILAS_SINTETICAS: unknown[][] = [
  ["Informe Monetario Diario (SINTETICO)", null, null],
  ["Millones de pesos", null, null],
  ["Fecha", "Pases activos", "Pases pasivos para el BCRA"],
  ["03/02/2025", 100, 1_000],
  ["04/02/2025", 110, "2.500,5"],
  ["05/02/2025", null, 3_000],
  ["texto suelto", "x", "y"],
]

test("parser encuentra el encabezado, ignora filas basura y parsea fechas dd/mm/yyyy", () => {
  const s = parsePasesStockRows(FILAS_SINTETICAS, { label: /pases.*pasivos/i })
  assert.deepEqual(s, [
    { fecha: "2025-02-03", valor: 1_000 },
    { fecha: "2025-02-04", valor: 2_500.5 },
    { fecha: "2025-02-05", valor: 3_000 },
  ])
})

test("el encabezado de pases activos selecciona la otra columna (null se descarta)", () => {
  const s = parsePasesStockRows(FILAS_SINTETICAS, { label: /pases.*activos/i })
  assert.deepEqual(s.map(p => p.valor), [100, 110])
})

test("si el encabezado no existe devuelve [] en vez de inventar", () => {
  assert.deepEqual(parsePasesStockRows(FILAS_SINTETICAS, { label: /leliq/i }), [])
})

test("encabezado partido en dos filas se reconstruye", () => {
  const rows: unknown[][] = [
    [null, "Pases"],
    ["Fecha", "pasivos"],
    ["2025-02-03", 5],
  ]
  assert.deepEqual(parsePasesStockRows(rows, { label: /pases.*pasivos/i }), [{ fecha: "2025-02-03", valor: 5 }])
})

test("lee un XLSX real en memoria (workbook sintetico) con fechas serial de Excel", () => {
  const aoa = [["Fecha", "Pases pasivos"], [45_691, 7], [45_692, 9]] // 45691 = 2025-02-03
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "IMD")
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  const s = parsePasesStockWorkbook(buf, { label: /pases.*pasivos/i }, "IMD")
  assert.deepEqual(s, [{ fecha: "2025-02-03", valor: 7 }, { fecha: "2025-02-04", valor: 9 }])
})

test("toIsoDate y normalizeLabel", () => {
  assert.equal(toIsoDate("5/2/2025"), "2025-02-05")
  assert.equal(toIsoDate("2025-02-05T00:00:00"), "2025-02-05")
  assert.equal(toIsoDate("hola"), null)
  assert.equal(normalizeLabel("  Préstamos  Pásivos "), "prestamos pasivos")
})

test("alignStockAndRate une por fecha, deja null donde falta y no interpola", () => {
  const rows = alignStockAndRate(
    [{ fecha: "2025-02-03", valor: 10 }, { fecha: "2025-02-05", valor: 30 }],
    [{ fecha: "2025-02-03", valor: 29 }, { fecha: "2025-02-04", valor: 30 }],
  )
  assert.deepEqual(rows, [
    { fecha: "2025-02-03", stock: 10, tasa: 29 },
    { fecha: "2025-02-04", stock: null, tasa: 30 },
    { fecha: "2025-02-05", stock: 30, tasa: null },
  ])
})
