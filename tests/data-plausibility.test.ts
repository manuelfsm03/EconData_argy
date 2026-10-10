import assert from "node:assert/strict"
import test from "node:test"

import { assessAgreement, assessPlausibility, PLAUSIBILITY_RULES } from "../src/lib/data-plausibility"

test("un valor dentro de rango es plausible", () => {
  const r = assessPlausibility("ipc_var_mensual", 3.2)
  assert.equal(r.status, "plausible")
  assert.equal(r.value, 3.2)
})

test("un valor fuera de rango es implausible, con el rango citado en la razón", () => {
  const r = assessPlausibility("ipc_var_mensual", 9999)
  assert.equal(r.status, "implausible")
  assert.match(r.reason, /9999/)
  assert.match(r.reason, /60/)
})

test("un negativo fuera del piso también es implausible (no sólo techos)", () => {
  const r = assessPlausibility("riesgo_pais_bps", -50)
  assert.equal(r.status, "implausible")
})

test("sin regla cargada, el resultado es unknown, no un falso plausible", () => {
  const r = assessPlausibility("metrica_que_no_existe", 42)
  assert.equal(r.status, "unknown")
})

test("sin valor numérico, el resultado es unknown", () => {
  assert.equal(assessPlausibility("emae", null).status, "unknown")
  assert.equal(assessPlausibility("emae", undefined).status, "unknown")
  assert.equal(assessPlausibility("emae", Number.NaN).status, "unknown")
})

test("todas las reglas cargadas tienen min < max y una razón no vacía", () => {
  for (const rule of Object.values(PLAUSIBILITY_RULES)) {
    assert.ok(rule.min < rule.max, `${rule.metric}: min debe ser menor que max`)
    assert.ok(rule.reason.length > 10, `${rule.metric}: la razón tiene que explicar algo, no ser un placeholder`)
  }
})

test("el catálogo de reglas no incluye nada de renta fija/bonos", () => {
  // No es casualidad: la capa de veracidad se construyó explícitamente
  // dejando afuera bonos/TIR/CER, que es área de otra persona del equipo.
  const prohibido = /tir|cer|paridad|bono|lecap|lecer|boncer/i
  for (const rule of Object.values(PLAUSIBILITY_RULES)) {
    assert.doesNotMatch(rule.metric, prohibido)
    assert.doesNotMatch(rule.label, prohibido)
  }
})

test("dos fuentes de acuerdo (blue vs oficial, brecha chica) quedan 'agree'", () => {
  const r = assessAgreement({ valueA: 1535, valueB: 1540, maxDeltaPct: 150, reason: "blue vs oficial" })
  assert.equal(r.status, "agree")
  assert.ok(r.deltaPct !== null && r.deltaPct < 1)
})

test("dos fuentes muy desacopladas (ej. error de unidades) quedan 'disagree'", () => {
  const r = assessAgreement({ valueA: 1535, valueB: 15.35, maxDeltaPct: 20, reason: "error de unidades" })
  assert.equal(r.status, "disagree")
})

test("sin uno de los dos valores, el acuerdo es unknown, no un falso agree", () => {
  assert.equal(assessAgreement({ valueA: null, valueB: 100, maxDeltaPct: 10, reason: "x" }).status, "unknown")
  assert.equal(assessAgreement({ valueA: 0, valueB: 100, maxDeltaPct: 10, reason: "x" }).status, "unknown")
})
