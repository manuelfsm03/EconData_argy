import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { extraerVencimientos, calcularRollover } from "../src/server/external/tesoro-licitaciones"

// Fixture SINTETICO (texto inventado, no es una nota real). Ver tests/fixtures.
const FIXTURE = readFileSync("tests/fixtures/licitacion-rollover.SINTETICO.txt", "utf8")

test("extrae vencimientos a cubrir del fixture sintetico", () => {
  assert.equal(extraerVencimientos(FIXTURE, "ARS", "billones"), 8)
})

test("formato es-AR con miles y decimales", () => {
  const t = "Los vencimientos del período ascienden a $ 1.234,5 millones."
  assert.equal(extraerVencimientos(t, "ARS", "millones"), 1234.5)
})

test("sin mencion de vencimientos devuelve null (no inventa)", () => {
  assert.equal(extraerVencimientos("Se adjudicó $ 6,00 billones.", "ARS", "billones"), null)
})

test("moneda o unidad distinta al adjudicado devuelve null", () => {
  const t = "Vencimientos a cubrir por USD 500 millones."
  assert.equal(extraerVencimientos(t, "ARS", "millones"), null)
  assert.equal(extraerVencimientos(t, "USD", "billones"), null)
  assert.equal(extraerVencimientos(t, "USD", "millones"), 500)
})

test("rollover = adjudicado / vencimientos * 100", () => {
  assert.equal(calcularRollover(6, 8), 75)
  assert.equal(calcularRollover(9, 8), 112.5)
})

test("rollover null si falta algun insumo o vencimientos <= 0", () => {
  assert.equal(calcularRollover(null, 8), null)
  assert.equal(calcularRollover(6, null), null)
  assert.equal(calcularRollover(6, 0), null)
})
