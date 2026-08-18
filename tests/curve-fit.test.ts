/**
 * Tests del ajuste de curva de rendimientos.
 *
 *   npx tsx --test tests/curve-fit.test.ts
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  ajustarPolinomio,
  gradoSugerido,
  muestrearCurva,
  residuos,
} from "../src/lib/curve-fit"

test("recupera exactamente una parábola conocida", () => {
  // y = 3 - 2x + 0.5x², sin ruido: el ajuste tiene que dar los coeficientes.
  const puntos = [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: 3 - 2 * x + 0.5 * x * x }))
  const ajuste = ajustarPolinomio(puntos, 2)

  assert.ok(ajuste)
  const [a, b, c] = ajuste.coeficientes
  assert.ok(Math.abs(a - 3) < 1e-9, `término independiente: ${a}`)
  assert.ok(Math.abs(b + 2) < 1e-9, `término lineal: ${b}`)
  assert.ok(Math.abs(c - 0.5) < 1e-9, `término cuadrático: ${c}`)
  assert.ok(Math.abs(ajuste.r2 - 1) < 1e-9, "sin ruido el R² tiene que dar 1")
})

test("una recta perfecta da R² igual a 1 con grado 1", () => {
  const puntos = [1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }))
  const ajuste = ajustarPolinomio(puntos, 1)
  assert.ok(ajuste)
  assert.ok(Math.abs(ajuste.r2 - 1) < 1e-9)
  assert.ok(Math.abs(ajuste.evaluar(10) - 21) < 1e-9)
})

test("no ajusta si hay menos x distintos que coeficientes", () => {
  // Tres bonos pero dos durations: una parábola necesita tres puntos distintos.
  const puntos = [
    { x: 2, y: 8 },
    { x: 2, y: 9 },
    { x: 5, y: 11 },
  ]
  assert.equal(ajustarPolinomio(puntos, 2), null)
  assert.ok(ajustarPolinomio(puntos, 1), "con grado 1 sí alcanza")
})

test("ignora los puntos con valores no finitos", () => {
  const puntos = [
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: Number.NaN, y: 7 },
    { x: 3, y: 7 },
    { x: 4, y: Number.POSITIVE_INFINITY },
  ]
  const ajuste = ajustarPolinomio(puntos, 1)
  assert.ok(ajuste)
  assert.ok(Math.abs(ajuste.evaluar(5) - 11) < 1e-9, "recta y = 2x + 1")
})

test("el residuo marca qué bono está barato y cuál caro", () => {
  // Cuatro bonos sobre una recta y uno que rinde 2 puntos más que sus pares.
  const enLaCurva = [1, 2, 4, 5].map((x) => ({ x, y: 5 + x }))
  const barato = { x: 3, y: 5 + 3 + 2 }
  const ajuste = ajustarPolinomio([...enLaCurva, barato], 1)
  assert.ok(ajuste)

  const conResiduo = residuos([...enLaCurva, barato], ajuste)
  const elBarato = conResiduo.find((p) => p.x === 3)
  assert.ok(elBarato)
  assert.ok(elBarato.residuo > 0.5, `el que rinde de más va arriba: ${elBarato.residuo}`)

  const otros = conResiduo.filter((p) => p.x !== 3)
  assert.ok(otros.every((p) => p.residuo < 0), "los demás quedan abajo de la curva")
})

test("el grado sugerido no llega nunca a interpolar", () => {
  // Con pocos bonos hay que quedarse en una recta.
  assert.equal(gradoSugerido(3), 1)
  assert.equal(gradoSugerido(4), 1)
  assert.equal(gradoSugerido(6), 2)
  assert.equal(gradoSugerido(8), 3)
  // Y nunca pasarse del techo, por más bonos que haya.
  assert.equal(gradoSugerido(40), 3)
  assert.equal(gradoSugerido(1), 1)
})

test("la curva muestreada arranca y termina donde se le pide", () => {
  const ajuste = ajustarPolinomio([1, 2, 3].map((x) => ({ x, y: x * x })), 2)
  assert.ok(ajuste)
  const curva = muestrearCurva(ajuste, 1, 5, 20)
  assert.equal(curva.length, 20)
  assert.ok(Math.abs(curva[0].x - 1) < 1e-12)
  assert.ok(Math.abs(curva[curva.length - 1].x - 5) < 1e-12)
  assert.ok(curva.every((p) => Number.isFinite(p.y)))
})

test("un rango vacío no devuelve curva", () => {
  const ajuste = ajustarPolinomio([1, 2, 3].map((x) => ({ x, y: x })), 1)
  assert.ok(ajuste)
  assert.deepEqual(muestrearCurva(ajuste, 3, 3), [])
})

test("aguanta la curva soberana real sin romperse", () => {
  // Duration y TIR de los siete hard dollar, tal como los muestra el screener.
  const curva = [
    { x: 1.48, y: 7.3 },
    { x: 1.9, y: 7.6 },
    { x: 5.02, y: 9.86 },
    { x: 1.94, y: 6.23 },
    { x: 5.11, y: 8.87 },
    { x: 5.62, y: 9.04 },
    { x: 4.29, y: 10.01 },
  ]
  const ajuste = ajustarPolinomio(curva, 2)
  assert.ok(ajuste)
  assert.ok(ajuste.r2 > 0.3, `la curva explica algo de la dispersión: R²=${ajuste.r2}`)
  // Con pendiente positiva, un plazo mayor tiene que rendir más que uno menor.
  assert.ok(ajuste.evaluar(5) > ajuste.evaluar(2))
})
