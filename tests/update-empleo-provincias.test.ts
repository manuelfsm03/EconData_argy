import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  HEADER_ROW,
  HOJA_A_PROVINCIA,
  QUARTER_RE,
  construirProvincias,
  filaTotal,
  parsearHoja,
  ultimaColumnaConDato,
} from "../scripts/update-empleo-provincias.mjs"

// ── Helpers para construir hojas sintéticas con el mismo layout que el real:
// fila HEADER_ROW con etiquetas de trimestre ("1° Trim 2024", ...), columnas
// 0-1 de relleno (código/nombre de depto), fila "TOTAL" en la columna 1 con
// los valores agregados, y columnas vacías al final (igual que el archivo
// real, donde las últimas columnas del formato quedan sin etiqueta).

function filaConHeader(etiquetas: string[]): unknown[] {
  const row: unknown[] = ["", ""]
  row.push(...etiquetas, null, null)
  return row
}

function hojaSintetica(etiquetas: string[], valoresTotal: number[]): XLSX.WorkSheet {
  const rows: unknown[][] = []
  const totalRow = HEADER_ROW + 3
  // aoa_to_sheet recorta las filas 100% vacías de los extremos (y con eso
  // corre los índices) — se rellenan con una celda de relleno para que la
  // hoja arranque en la fila 0, igual que el archivo real (que trae título
  // y metadata en esas filas).
  for (let i = 0; i < totalRow; i += 1) rows[i] = ["relleno"]
  rows[HEADER_ROW] = filaConHeader(etiquetas)
  rows[totalRow] = ["", "TOTAL", ...valoresTotal, null, null]
  return XLSX.utils.aoa_to_sheet(rows)
}

test("QUARTER_RE reconoce las etiquetas de trimestre del BCRA/OEDE", () => {
  assert.ok(QUARTER_RE.test("1° Trim 2024"))
  assert.ok(QUARTER_RE.test("4°Trim2023"))
  assert.equal(QUARTER_RE.test("TOTAL"), false)
})

test("ultimaColumnaConDato ignora columnas vacías al final del header", () => {
  const header = filaConHeader(["1° Trim 2023", "2° Trim 2023"])
  // índice 2 y 3 llevan las etiquetas; 4 y 5 quedan null por el padding
  assert.equal(ultimaColumnaConDato(header), 3)
})

test("filaTotal encuentra la fila TOTAL sin importar la posición", () => {
  const rows = [[], ["", "otra cosa"], ["", "TOTAL", 100]]
  assert.equal(filaTotal(rows), 2)
})

test("filaTotal devuelve -1 si no hay fila TOTAL", () => {
  assert.equal(filaTotal([[], ["", "algo"]]), -1)
})

test("parsearHoja extrae la serie de la fila TOTAL respetando las etiquetas de trimestre", () => {
  const sheet = hojaSintetica(["1° Trim 2023", "2° Trim 2023"], [1000, 1100])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [
    { periodo: "2023-Q1", valor: 1000 },
    { periodo: "2023-Q2", valor: 1100 },
  ])
})

test("parsearHoja descarta valores no numéricos o no positivos", () => {
  const sheet = hojaSintetica(["1° Trim 2023", "2° Trim 2023"], [1000, 0])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [{ periodo: "2023-Q1", valor: 1000 }])
})

test("parsearHoja lanza si no encuentra la fila TOTAL", () => {
  const rows: unknown[][] = []
  rows[HEADER_ROW] = filaConHeader(["1° Trim 2023"])
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  assert.throws(() => parsearHoja(sheet), /TOTAL/)
})

test("construirProvincias suma 'Partidos de GBA' y 'Resto de Buenos Aires' en la provincia Buenos Aires", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    hojaSintetica(["1° Trim 2024"], [600]),
    "Partidos de GBA",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    hojaSintetica(["1° Trim 2024"], [400]),
    "Resto de Buenos Aires",
  )
  XLSX.utils.book_append_sheet(workbook, hojaSintetica(["1° Trim 2024"], [900]), "CABA")

  const provincias = construirProvincias(workbook)
  const buenosAires = provincias.find((p) => p.id === HOJA_A_PROVINCIA["Partidos de GBA"])
  assert.equal(buenosAires?.ultimo_valor, 1000)
})

test("construirProvincias calcula la variación interanual contra el mismo trimestre del año anterior", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    hojaSintetica(["1° Trim 2023", "1° Trim 2024"], [100, 110]),
    "CABA",
  )
  const [caba] = construirProvincias(workbook)
  assert.equal(caba.ultimo_periodo, "2024-Q1")
  assert.equal(caba.variacion_interanual, 0.1)
})

test("construirProvincias deja variación_interanual en null sin el mismo trimestre del año anterior", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica(["1° Trim 2024"], [100]), "CABA")
  const [caba] = construirProvincias(workbook)
  assert.equal(caba.variacion_interanual, null)
})

test("construirProvincias omite silenciosamente una hoja que no está en el workbook", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica(["1° Trim 2024"], [100]), "CABA")
  const provincias = construirProvincias(workbook)
  // No tira ni incluye provincias cuya hoja falta; sólo procesa la presente
  assert.equal(provincias.length, 1)
  assert.equal(provincias[0].id, HOJA_A_PROVINCIA["CABA"])
})
