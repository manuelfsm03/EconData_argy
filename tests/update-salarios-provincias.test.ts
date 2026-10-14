import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  HEADER_ROW,
  HOJA_A_PROVINCIA,
  construirProvincias,
  excelSerialAPeriodo,
  filaTotal,
  parsearHoja,
  ultimaColumnaConFecha,
} from "../scripts/update-salarios-provincias.mjs"

// Mismo problema que en update-empleo-provincias.test.ts: aoa_to_sheet
// recorta las filas enteramente vacías de los extremos, corriendo los
// índices — se rellenan con una celda de relleno para que la hoja arranque
// en la fila 0, igual que el archivo real (título + subtítulo en esas filas).

function hojaSintetica(fechasSeriales: number[], valoresTotal: number[]): XLSX.WorkSheet {
  const rows: unknown[][] = []
  for (let i = 0; i < HEADER_ROW; i += 1) rows[i] = ["relleno"]
  rows[HEADER_ROW] = ["Rama de Actividad", null, ...fechasSeriales]
  rows[HEADER_ROW + 1] = ["Total", null, ...valoresTotal]
  return XLSX.utils.aoa_to_sheet(rows)
}

test("excelSerialAPeriodo convierte un serial de Excel a YYYY-MM", () => {
  assert.equal(excelSerialAPeriodo(44_927), "2023-01")
})

test("excelSerialAPeriodo devuelve null ante valores no numéricos", () => {
  assert.equal(excelSerialAPeriodo("nota al pie"), null)
  assert.equal(excelSerialAPeriodo(null), null)
  assert.equal(excelSerialAPeriodo(Number.NaN), null)
})

test("ultimaColumnaConFecha ignora columnas vacías al final del header", () => {
  const header = ["Rama de Actividad", null, 44_927, 44_958, null, null]
  assert.equal(ultimaColumnaConFecha(header), 3)
})

test("filaTotal busca la etiqueta en la columna 0 (no la 1, a diferencia del empleo)", () => {
  const rows = [[], ["algo", "otra cosa"], ["Total", null, 100]]
  assert.equal(filaTotal(rows), 2)
})

test("filaTotal devuelve -1 si no hay fila Total", () => {
  assert.equal(filaTotal([[], ["algo"]]), -1)
})

test("parsearHoja extrae la serie mensual de la fila Total", () => {
  const sheet = hojaSintetica([44_927, 44_958], [500_000, 520_000])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [
    { periodo: "2023-01", valor: 500_000 },
    { periodo: "2023-02", valor: 520_000 },
  ])
})

test("parsearHoja descarta valores no numéricos o no positivos", () => {
  const sheet = hojaSintetica([44_927, 44_958], [500_000, 0])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [{ periodo: "2023-01", valor: 500_000 }])
})

test("parsearHoja lanza si no encuentra la fila Total", () => {
  const rows: unknown[][] = []
  for (let i = 0; i < HEADER_ROW; i += 1) rows[i] = ["relleno"]
  rows[HEADER_ROW] = ["Rama de Actividad", null, 44_927]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  assert.throws(() => parsearHoja(sheet), /Total/)
})

test("construirProvincias promedia 'GBA' y 'Resto Pcia. Bs. As.' para Buenos Aires", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([44_927], [600_000]), "GBA")
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([44_927], [400_000]), "Resto Pcia. Bs. As.")
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([44_927], [900_000]), "CABA")

  const provincias = construirProvincias(workbook)
  const buenosAires = provincias.find((p) => p.id === HOJA_A_PROVINCIA["GBA"])
  assert.equal(buenosAires?.ultimo_valor, 500_000)
})

test("construirProvincias calcula la variación interanual contra el mismo mes del año anterior", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    hojaSintetica([44_927, 44_927 + 365], [500_000, 600_000]),
    "CABA",
  )
  const [caba] = construirProvincias(workbook)
  assert.equal(caba.ultimo_periodo, "2024-01")
  assert.equal(caba.variacion_interanual, 0.2)
})

test("construirProvincias deja variación_interanual en null sin el mismo mes del año anterior", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([44_927], [500_000]), "CABA")
  const [caba] = construirProvincias(workbook)
  assert.equal(caba.variacion_interanual, null)
})

test("construirProvincias omite silenciosamente una hoja que no está en el workbook", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([44_927], [500_000]), "CABA")
  const provincias = construirProvincias(workbook)
  assert.equal(provincias.length, 1)
  assert.equal(provincias[0].id, HOJA_A_PROVINCIA["CABA"])
})
