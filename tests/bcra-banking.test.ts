import assert from "node:assert/strict"
import test from "node:test"

import {
  excelSerialToDate,
  parseBankingDateRange,
  parseBankingRows,
  type BankingSheetRow,
} from "../src/server/sources/bcra-banking"
import { buildBankingApiUrl } from "../src/client/lib/bcra-banking"

function completeRows(): BankingSheetRow[] {
  const rows: BankingSheetRow[] = Array.from({ length: 46 }, () => [])
  rows[3] = ["En millones de pesos corrientes", 44_927, 44_958]
  rows[5] = ["Activo", 100, 200]
  rows[6] = ["Disponibilidades", 10, 20]
  rows[7] = ["Títulos públicos", 30, 60]
  rows[9] = ["Tenencia por cartera propia", 5, 10]
  rows[10] = ["Pases activos", 5, 10]
  rows[13] = ["Sector público", 5, 10]
  rows[14] = ["Sector privado", 40, 80]
  rows[28] = ["Pasivo", 80, 160]
  rows[29] = ["Depósitos", 60, 120]
  rows[30] = ["Sector público", 10, 20]
  rows[31] = ["Sector privado", 50, 100]
  rows[32] = ["Cuenta corriente", 15, 30]
  rows[33] = ["Caja de ahorros", 10, 20]
  rows[34] = ["Plazo fijo", 20, 40]
  rows[38] = ["Obligaciones con el BCRA", 2, 4]
  rows[39] = ["Obligaciones negociables", 3, 6]
  rows[40] = ["Líneas del exterior", 5, 10]
  rows[45] = ["Patrimonio neto", 20, 40]
  return rows
}

test("convierte seriales Excel a fechas UTC estables", () => {
  assert.equal(excelSerialToDate(44_927), "2023-01-01")
})

test("rechaza seriales Excel no finitos", () => {
  assert.equal(excelSerialToDate(Number.NaN), null)
})

test("filtra períodos por rango inclusivo", () => {
  const result = parseBankingRows(completeRows(), "2023-01-01", "2023-01-31")
  assert.deepEqual(result.map(row => row.fecha), ["2023-01-01"])
})

test("omite períodos sin activo total válido", () => {
  const rows = completeRows()
  rows[5][1] = null
  assert.deepEqual(parseBankingRows(rows, "2023-01-01", "2023-02-01").map(row => row.fecha), ["2023-02-01"])
})

test("conserva null cuando falta un componente del activo", () => {
  const rows = completeRows()
  rows[6][1] = null
  const [period] = parseBankingRows(rows, "2023-01-01", "2023-01-01")
  assert.equal(period.disponibilidades, null)
})

test("conserva cero real sin confundirlo con dato faltante", () => {
  const rows = completeRows()
  rows[6][1] = 0
  const [period] = parseBankingRows(rows, "2023-01-01", "2023-01-01")
  assert.equal(period.disponibilidades, 0)
})

test("no inventa otros activos cuando falta un componente", () => {
  const rows = completeRows()
  rows[14][1] = null
  const [period] = parseBankingRows(rows, "2023-01-01", "2023-01-01")
  assert.equal(period.otros_activos, null)
})

test("calcula otros activos sólo con todos los componentes", () => {
  const [period] = parseBankingRows(completeRows(), "2023-01-01", "2023-01-01")
  assert.equal(period.otros_activos, 15)
})

test("no inventa otros pasivos ni depósitos residuales cuando falta depósitos totales", () => {
  const rows = completeRows()
  rows[29][1] = null
  const [period] = parseBankingRows(rows, "2023-01-01", "2023-01-01")
  assert.equal(period.otros_pasivos, null)
  assert.equal(period.dep_otros_sectores, null)
})

test("expone el residual medido entre depósitos totales, públicos y privados", () => {
  const rows = completeRows()
  rows[29][1] = 65
  const [period] = parseBankingRows(rows, "2023-01-01", "2023-01-01")
  assert.equal(period.dep_otros_sectores, 5)

  const funding = [
    period.dep_priv_vista,
    period.dep_priv_plazo,
    period.dep_priv_otros,
    period.dep_pub,
    period.dep_otros_sectores,
    period.on_lineas_ext,
    period.oblig_bcra,
    period.otros_pasivos,
    period.pn,
  ]
  assert.ok(funding.every((value): value is number => value !== null))
  assert.ok(Math.abs(funding.reduce((sum, value) => sum + value, 0) - 100) <= 0.01)
})

test("rechaza fechas con formato ambiguo", () => {
  assert.throws(() => parseBankingDateRange("01/01/2023", "2023-02-01"), /YYYY-MM-DD/)
})

test("rechaza rangos invertidos", () => {
  assert.throws(() => parseBankingDateRange("2023-02-01", "2023-01-01"), /desde/)
})

test("construye la query de bancos explícita y sin endpoint allowlist", () => {
  assert.equal(
    buildBankingApiUrl("2021-01-02", "2026-01-02"),
    "/api/bcra-data?endpoint=bancos&desde=2021-01-02&hasta=2026-01-02",
  )
})
