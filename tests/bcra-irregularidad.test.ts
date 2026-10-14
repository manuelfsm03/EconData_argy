import assert from "node:assert/strict"
import test from "node:test"

import {
  MoraParseError,
  celdaAPeriodo,
  parseIrregularidadRows,
  parseIrregularidadWorkbook,
  type MoraRow,
} from "../src/server/sources/bcra-irregularidad"

// FIXTURE SINTETICO DE TEST: los numeros NO son datos del BCRA, solo ejercitan el parser.
function fixtureSintetico(escala = 1): MoraRow[] {
  return [
    ["Titulo de prueba (fixture sintetico)"],
    ["Serie", 45_292, 45_323, 45_352], // serial Excel: 2024-01, 2024-02, 2024-03
    ["Irregularidad de la cartera de financiaciones", null, null, null],
    ["Total sector privado", 1 * escala, 2 * escala, 3 * escala],
    ["Familias", 4 * escala, 5 * escala, null],
    ["Empresas", 6 * escala, 7 * escala, 8 * escala],
    ["Otra seccion", 9, 9, 9],
  ]
}

test("celdaAPeriodo entiende serial Excel, ISO y mes-abreviado", () => {
  assert.equal(celdaAPeriodo(45_292), "2024-01")
  assert.equal(celdaAPeriodo("2024-03"), "2024-03")
  assert.equal(celdaAPeriodo("mar-24"), "2024-03")
  assert.equal(celdaAPeriodo("03/2024"), "2024-03")
  assert.equal(celdaAPeriodo(new Date(Date.UTC(2024, 5, 15))), "2024-06")
  assert.equal(celdaAPeriodo("texto"), null)
  assert.equal(celdaAPeriodo(12), null)
})

test("parsea total, familias y empresas por etiqueta y omite celdas vacias", () => {
  const r = parseIrregularidadRows(fixtureSintetico())
  assert.deepEqual(r.series.familias, [
    { periodo: "2024-01", valor: 4 },
    { periodo: "2024-02", valor: 5 },
  ])
  assert.equal(r.series.empresas?.length, 3)
  assert.equal(r.series.total_privado?.at(-1)?.valor, 3)
  assert.match(r.filas_origen.familias ?? "", /Familias/)
})

test("escala auto: valores en fraccion se convierten a porcentaje", () => {
  const r = parseIrregularidadRows(fixtureSintetico(0.01))
  assert.equal(r.series.total_privado?.[0].valor, 1)
  assert.equal(r.series.empresas?.[2].valor, 8)
})

test("falla cerrado si no hay fechas o no hay filas de irregularidad", () => {
  assert.throws(() => parseIrregularidadRows([["a", "b"], ["c", 1]]), MoraParseError)
  assert.throws(
    () => parseIrregularidadRows([["x", 45_292, 45_323, 45_352], ["Depositos", 1, 2, 3]]),
    /irregularidad/,
  )
})

test("workbook: usa la primera hoja que parsea", () => {
  const r = parseIrregularidadWorkbook({ Otra: [["nada"]], "Calidad de cartera": fixtureSintetico() })
  assert.equal(r.hoja, "Calidad de cartera")
  assert.throws(() => parseIrregularidadWorkbook({ A: [["nada"]] }), MoraParseError)
})
