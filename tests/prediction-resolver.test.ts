import assert from "node:assert/strict"
import test from "node:test"

import { resolveOpenPredictions, type ValorFetcher } from "../src/server/domain/prediction-resolver"
import type { Prediccion } from "../src/lib/prediction-contract"

function pred(over: Partial<Prediccion>): Prediccion {
  return {
    id: "p1", autorId: "u1", activo: "GD30", tipoActivo: "bono", tesis: "t",
    metrica: "precio", operador: "mayor_igual", objetivo: 100, objetivoMax: null,
    valorEntrada: 90, fechaEntrada: "2026-01-01T00:00:00Z",
    horizonte: "30 días", fechaResolucion: "2026-02-01T00:00:00Z",
    estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
    ...over,
  }
}

const ahora = "2026-03-01T00:00:00Z" // posterior a fechaResolucion

test("resuelve una predicción vencida como ACERTADA", async () => {
  const fetchValor: ValorFetcher = async () => ({ valor: 105, fuente: "test" })
  const { predicciones, resueltas } = await resolveOpenPredictions([pred({})], fetchValor, ahora)
  assert.equal(resueltas, 1)
  assert.equal(predicciones[0].estado, "acertada")
  assert.equal(predicciones[0].valorResolucion, 105)
  assert.equal(predicciones[0].fuente, "test")
})

test("resuelve como ERRADA cuando no se cumple", async () => {
  const fetchValor: ValorFetcher = async () => ({ valor: 95, fuente: "test" })
  const { predicciones, resueltas } = await resolveOpenPredictions([pred({})], fetchValor, ahora)
  assert.equal(resueltas, 1)
  assert.equal(predicciones[0].estado, "errada")
})

test("no toca predicciones que todavía no vencieron", async () => {
  const fetchValor: ValorFetcher = async () => ({ valor: 105, fuente: "test" })
  const futura = pred({ fechaResolucion: "2027-01-01T00:00:00Z" })
  const { predicciones, resueltas } = await resolveOpenPredictions([futura], fetchValor, ahora)
  assert.equal(resueltas, 0)
  assert.equal(predicciones[0].estado, "abierta")
})

test("si no hay valor observado, la deja abierta", async () => {
  const fetchValor: ValorFetcher = async () => null
  const { predicciones, resueltas } = await resolveOpenPredictions([pred({})], fetchValor, ahora)
  assert.equal(resueltas, 0)
  assert.equal(predicciones[0].estado, "abierta")
})

test("no re-resuelve una ya resuelta", async () => {
  const fetchValor: ValorFetcher = async () => ({ valor: 200, fuente: "test" })
  const yaAcertada = pred({ estado: "acertada", valorResolucion: 105, fuente: "orig" })
  const { predicciones, resueltas } = await resolveOpenPredictions([yaAcertada], fetchValor, ahora)
  assert.equal(resueltas, 0)
  assert.equal(predicciones[0].valorResolucion, 105)
  assert.equal(predicciones[0].fuente, "orig")
})

test("opera sobre una lista mixta y cuenta solo las resueltas", async () => {
  const fetchValor: ValorFetcher = async (p) => (p.activo === "SINVALOR" ? null : { valor: 105, fuente: "test" })
  const lista = [
    pred({ id: "a" }),                                        // vence → acertada
    pred({ id: "b", fechaResolucion: "2027-01-01T00:00:00Z" }), // futura → abierta
    pred({ id: "c", activo: "SINVALOR" }),                   // sin valor → abierta
    pred({ id: "d", estado: "errada" }),                     // ya resuelta → intacta
  ]
  const { resueltas } = await resolveOpenPredictions(lista, fetchValor, ahora)
  assert.equal(resueltas, 1)
})
