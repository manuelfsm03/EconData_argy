import assert from "node:assert/strict"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  HEADER_ROW,
  HOJA_A_PROVINCIA,
  construirProvincias,
  filaTotal,
  parsearHoja,
  ultimaColumnaConAnio,
} from "../scripts/update-establecimientos-provincias.mjs"

// Mismo problema de aoa_to_sheet que en los otros tests de este portal: las
// filas enteramente vacías de los extremos se recortan y correrían los
// índices — se rellenan para que la hoja arranque en la fila 0.

function hojaSintetica(anios: number[], valoresTotal: number[]): XLSX.WorkSheet {
  const rows: unknown[][] = []
  for (let i = 0; i < HEADER_ROW; i += 1) rows[i] = ["relleno"]
  rows[HEADER_ROW] = [null, "Ramas de actividad", ...anios]
  rows[HEADER_ROW + 1] = [null, "TOTAL", ...valoresTotal]
  return XLSX.utils.aoa_to_sheet(rows)
}

test("ultimaColumnaConAnio ignora columnas vacías al final del header", () => {
  const header = [null, "Ramas de actividad", 2022, 2023, 2024, null, null]
  assert.equal(ultimaColumnaConAnio(header), 4)
})

test("filaTotal busca la etiqueta TOTAL en la columna 1", () => {
  const rows = [[], [null, "otra cosa"], [null, "TOTAL", 100]]
  assert.equal(filaTotal(rows), 2)
})

test("filaTotal devuelve -1 si no hay fila TOTAL", () => {
  assert.equal(filaTotal([[], [null, "algo"]]), -1)
})

test("parsearHoja extrae la serie anual de la fila TOTAL", () => {
  const sheet = hojaSintetica([2022, 2023, 2024], [1000, 1050, 1100])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [
    { anio: 2022, valor: 1000 },
    { anio: 2023, valor: 1050 },
    { anio: 2024, valor: 1100 },
  ])
})

test("parsearHoja descarta valores no numéricos o no positivos", () => {
  const sheet = hojaSintetica([2022, 2023], [1000, 0])
  const serie = parsearHoja(sheet)
  assert.deepEqual(serie, [{ anio: 2022, valor: 1000 }])
})

test("parsearHoja lanza si no encuentra la fila TOTAL", () => {
  const rows: unknown[][] = []
  for (let i = 0; i < HEADER_ROW; i += 1) rows[i] = ["relleno"]
  rows[HEADER_ROW] = [null, "Ramas de actividad", 2022]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  assert.throws(() => parsearHoja(sheet), /TOTAL/)
})

test("construirProvincias suma 'Partidos de GBA' y 'Resto de Buenos Aires' en Buenos Aires", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([2024], [600]), "Partidos de GBA")
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([2024], [400]), "Resto de Buenos Aires")
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([2024], [900]), "Capital Federal")

  const provincias = construirProvincias(workbook)
  const buenosAires = provincias.find((p) => p.id === HOJA_A_PROVINCIA["Partidos de GBA"])
  assert.equal(buenosAires?.ultimo_valor, 1000)
})

test("construirProvincias toma el último año de la serie como ultimo_anio/ultimo_valor", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([2022, 2023, 2024], [100, 110, 120]), "Capital Federal")
  const [caba] = construirProvincias(workbook)
  assert.equal(caba.ultimo_anio, 2024)
  assert.equal(caba.ultimo_valor, 120)
})

test("construirProvincias omite silenciosamente una hoja que no está en el workbook", () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, hojaSintetica([2024], [100]), "Capital Federal")
  const provincias = construirProvincias(workbook)
  assert.equal(provincias.length, 1)
  assert.equal(provincias[0].id, HOJA_A_PROVINCIA["Capital Federal"])
})
