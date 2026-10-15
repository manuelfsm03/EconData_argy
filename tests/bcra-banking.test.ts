import assert from "node:assert/strict"
import test from "node:test"

import {
  excelSerialToDate,
  lastDateInRow,
  parseBankingDateRange,
  parseBankingRows,
  parseCarteraRows,
  type BankingSheetRow,
} from "../src/server/sources/bcra-banking"
import { buildBankingApiUrl, buildMorosidadApiUrl } from "../src/client/lib/bcra-banking"

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

test("construye la query de morosidad explícita", () => {
  assert.equal(
    buildMorosidadApiUrl("2021-01-02", "2026-01-02"),
    "/api/bcra-data?endpoint=morosidad&desde=2021-01-02&hasta=2026-01-02",
  )
})

// ── Calidad de cartera (morosidad) ──────────────────────────────────────────
// Mismo layout repetido verificado contra el archivo real: la fila "En
// porcentaje" trae las fechas, la fila siguiente trae los valores — a
// distintos offsets por segmento (por eso el test fija filas puntuales, no
// un patrón genérico que podría desalinearse si BCRA reordena el anexo).

function carteraPorEntidadRows(): BankingSheetRow[] {
  const rows: BankingSheetRow[] = Array.from({ length: 80 }, () => [])
  rows[3] = ["En porcentaje", 44_927, 44_958]  // Sistema financiero
  rows[4] = ["Cartera irregular total", 6.06, 6.40]
  rows[18] = ["En porcentaje", 44_927, 44_958]  // Bancos privados
  rows[19] = ["Cartera irregular total", 5.5, 5.8]
  return rows
}

function carteraPorDeudorRows(): BankingSheetRow[] {
  const rows: BankingSheetRow[] = Array.from({ length: 103 }, () => [])
  rows[5] = ["En porcentaje", 44_927, 44_958]  // Total sector privado
  rows[6] = ["Cartera irregular total", 6.36, 6.71]
  rows[57] = ["En porcentaje", 44_927, 44_958]  // Familias
  rows[58] = ["Cartera irregular total", 10.61, 11.22]
  rows[101] = ["En porcentaje", 44_927, 44_958]  // Empresas
  rows[102] = ["Cartera irregular total", 2.85, 2.92]
  return rows
}

test("calidad de cartera: separa por entidad y por deudor en segmentos propios", () => {
  const { porEntidad, porDeudor } = parseCarteraRows(
    carteraPorEntidadRows(),
    carteraPorDeudorRows(),
    "2023-01-01",
    "2023-01-31",
  )
  const familias = porDeudor.find(s => s.segmento === "familias")
  assert.ok(familias)
  assert.equal(familias.serie.length, 1)
  assert.equal(familias.serie[0].valor, 10.61)

  const sistemaFinanciero = porEntidad.find(s => s.segmento === "sistema_financiero")
  assert.equal(sistemaFinanciero?.serie[0].valor, 6.06)
})

test("calidad de cartera respeta el rango de fechas igual que el balance", () => {
  const { porDeudor } = parseCarteraRows(
    carteraPorEntidadRows(),
    carteraPorDeudorRows(),
    "2023-02-01",
    "2023-02-28",
  )
  const empresas = porDeudor.find(s => s.segmento === "empresas")
  assert.deepEqual(empresas?.serie.map(p => p.valor), [2.92])
})

// ── Elegir el anexo más fresco entre español e inglés ───────────────────────
// El BCRA publica el mismo anexo en los dos idiomas pero no los actualiza al
// mismo ritmo (verificado en vivo 14/10/2026: español se quedó en mayo,
// inglés tenía julio) — por eso se bajan los dos y se usa el que tenga la
// fecha más reciente. `lastDateInRow` es la pieza que hace esa comparación
// posible: tiene que ignorar las columnas vacías al final de la fila de
// fechas (formato de Excel) en vez de asumir que la última columna es la
// más nueva.

test("lastDateInRow encuentra la fecha real aunque haya columnas vacías al final", () => {
  const row: BankingSheetRow = ["En porcentaje", 44_927, 44_958, null, null, null]
  assert.equal(lastDateInRow(row), "2023-02-01")
})

test("lastDateInRow no se engaña con basura no numérica al final", () => {
  const row: BankingSheetRow = ["En porcentaje", 44_927, "nota al pie", null]
  assert.equal(lastDateInRow(row), "2023-01-01")
})

test("lastDateInRow devuelve null ante una fila vacía o indefinida", () => {
  assert.equal(lastDateInRow(undefined), null)
  assert.equal(lastDateInRow(["En porcentaje"]), null)
})

test("calidad de cartera conserva null sin inventar un valor cuando falta el dato", () => {
  const rows = carteraPorDeudorRows()
  rows[58][1] = null
  const { porDeudor } = parseCarteraRows(carteraPorEntidadRows(), rows, "2023-01-01", "2023-01-01")
  assert.equal(porDeudor.find(s => s.segmento === "familias")?.serie[0].valor, null)
})
