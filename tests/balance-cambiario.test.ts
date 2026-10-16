import assert from "node:assert/strict"
import test from "node:test"

import {
  detectarCategoria,
  parsearBalanceCambiario,
  parsearNumero,
  parsearPeriodo,
  type Matriz,
} from "../src/server/domain/balance-cambiario"

/**
 * FIXTURE SINTÉTICO — NO son datos del BCRA. Valores inventados solo para
 * ejercitar el parser; imita la estructura SUPUESTA (conceptos en filas,
 * meses en columnas). La estructura real debe validarse en la primera corrida.
 */
const SINTETICO: Matriz = [
  ["Balance cambiario (FIXTURE SINTETICO)", null, null, null, null, null, null, null],
  ["En millones de USD", null, null, null, null, null, null, null],
  ["Concepto", "ene-24", "feb-24", "mar-24", "abr-24", "may-24", "jun-24", "jul-24"],
  ["Personas humanas", 1, 2, 3, 4, 5, 6, "s/d"],
  ["  Formación de activos externos", "1,5", 2, 3, 4, 5, 6, 7],
  ["Energía", 10, 20, 30, 40, 50, 60, 70],
  ["Agro", 1000, 1100, 1200, null, 1400, 1500, 1600],
  ["Concepto corto", 1, 2, null, null, null, null, null], // < 3 valores: se descarta
  [null, 1, 2, 3, 4, 5, 6, 7], // sin etiqueta: se descarta
  ["Energía", 1, 1, 1, 1, 1, 1, 1], // etiqueta duplicada: id con sufijo
]

test("parsearPeriodo reconoce meses en español, ISO, Date y serial Excel", () => {
  assert.equal(parsearPeriodo("ene-24"), "2024-01")
  assert.equal(parsearPeriodo("Sep 2023"), "2023-09")
  assert.equal(parsearPeriodo("2024-03"), "2024-03")
  assert.equal(parsearPeriodo("2024-03-31"), "2024-03")
  assert.equal(parsearPeriodo(new Date(Date.UTC(2024, 4, 1))), "2024-05")
  assert.equal(parsearPeriodo(45292), "2024-01") // 2024-01-01
  assert.equal(parsearPeriodo("Concepto"), null)
  assert.equal(parsearPeriodo(12), null)
})

test("parsearNumero maneja coma decimal, s/d y guiones", () => {
  assert.equal(parsearNumero("1.234,5"), 1234.5)
  assert.equal(parsearNumero("1234.5"), 1234.5)
  assert.equal(parsearNumero("s/d"), null)
  assert.equal(parsearNumero("-"), null)
  assert.equal(parsearNumero(null), null)
  assert.equal(parsearNumero(7), 7)
})

test("detectarCategoria clasifica por etiqueta y deja null lo desconocido", () => {
  assert.equal(detectarCategoria("Personas humanas"), "personas_humanas")
  assert.equal(detectarCategoria("Formación de activos externos"), "formacion_activos_externos")
  assert.equal(detectarCategoria("Energía"), "energia")
  assert.equal(detectarCategoria("Sector agro"), "agro")
  assert.equal(detectarCategoria("Otros misceláneos"), null)
})

test("parsea el fixture sintético: períodos, conceptos y filtros", () => {
  const r = parsearBalanceCambiario(SINTETICO)
  assert.equal(r.fila_encabezado, 2)
  assert.equal(r.periodos.length, 7)
  assert.equal(r.periodos[0], "2024-01")
  assert.equal(r.periodos.at(-1), "2024-07")
  assert.deepEqual(r.conceptos.map(c => c.id), [
    "personas_humanas", "formacion_de_activos_externos", "energia", "agro", "energia_2",
  ])
  const pers = r.conceptos[0]
  assert.equal(pers.series.length, 6) // "s/d" omitido, no rellenado
  assert.equal(pers.ultimo_periodo, "2024-06")
  assert.equal(pers.ultimo_valor, 6)
  const fae = r.conceptos[1]
  assert.equal(fae.nivel, 1)
  assert.equal(fae.categoria, "formacion_activos_externos")
  assert.equal(fae.series[0].valor, 1.5)
  assert.equal(r.conceptos[3].series.length, 6) // el null de abr-24 no se inventa
})

test("falla explícito si cambia el layout (sin encabezado de períodos)", () => {
  assert.throws(() => parsearBalanceCambiario([["a", "b"], ["x", 1]]), /encabezado/)
})
