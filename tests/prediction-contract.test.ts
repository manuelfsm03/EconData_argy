import assert from "node:assert/strict"
import test from "node:test"

import {
  describirCondicion,
  validarPrediccion,
  resolverPrediccion,
  puntosPorPrediccion,
  type Prediccion,
  type PrediccionInput,
} from "../src/lib/prediction-contract"

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
function input(over: Partial<PrediccionInput>): PrediccionInput {
  return {
    activo: "GD30", tipoActivo: "bono", tesis: "sube", metrica: "precio",
    operador: "mayor_igual", objetivo: 100, objetivoMax: null,
    horizonte: "30 días", fechaResolucion: "2099-01-01T00:00:00Z",
    ...over,
  }
}

// ── describirCondicion ──────────────────────────────────────────────────────
test("describirCondicion refleja cada operador", () => {
  assert.match(describirCondicion(pred({ operador: "mayor_igual", objetivo: 100 })), /≥ 100/)
  assert.match(describirCondicion(pred({ operador: "menor_igual", objetivo: 80 })), /≤ 80/)
  assert.match(describirCondicion(pred({ operador: "sube" })), /sube vs 90/)
  assert.match(describirCondicion(pred({ operador: "baja" })), /baja vs 90/)
  assert.match(describirCondicion(pred({ operador: "rango", objetivo: 80, objetivoMax: 120 })), /entre 80.*y 120/)
})

// ── validarPrediccion ───────────────────────────────────────────────────────
test("validarPrediccion acepta una entrada válida", () => {
  assert.equal(validarPrediccion(input({})), null)
  assert.equal(validarPrediccion(input({ operador: "sube", objetivo: null })), null)
})

test("validarPrediccion rechaza entradas inválidas", () => {
  assert.match(validarPrediccion(input({ activo: "  " }))!, /activo/i)
  assert.match(validarPrediccion(input({ tesis: "" }))!, /tesis/i)
  assert.match(validarPrediccion(input({ fechaResolucion: "" }))!, /fecha/i)
  assert.match(validarPrediccion(input({ fechaResolucion: "2000-01-01T00:00:00Z" }))!, /futura/i)
  assert.match(validarPrediccion(input({ operador: "menor_igual", objetivo: null }))!, /objetivo/i)
  assert.match(validarPrediccion(input({ operador: "rango", objetivo: 10, objetivoMax: null }))!, /rango|máximo/i)
})

// ── resolverPrediccion (los 5 operadores) ───────────────────────────────────
const ahora = "2026-03-01T00:00:00Z" // posterior al vencimiento

test("resolverPrediccion evalúa cada operador", () => {
  assert.equal(resolverPrediccion(pred({ operador: "mayor_igual", objetivo: 100 }), 105, "f", ahora).estado, "acertada")
  assert.equal(resolverPrediccion(pred({ operador: "mayor_igual", objetivo: 100 }), 95, "f", ahora).estado, "errada")
  assert.equal(resolverPrediccion(pred({ operador: "menor_igual", objetivo: 100 }), 95, "f", ahora).estado, "acertada")
  assert.equal(resolverPrediccion(pred({ operador: "sube", valorEntrada: 90 }), 91, "f", ahora).estado, "acertada")
  assert.equal(resolverPrediccion(pred({ operador: "baja", valorEntrada: 90 }), 89, "f", ahora).estado, "acertada")
  assert.equal(resolverPrediccion(pred({ operador: "baja", valorEntrada: 90 }), 91, "f", ahora).estado, "errada")
  assert.equal(resolverPrediccion(pred({ operador: "rango", objetivo: 80, objetivoMax: 120 }), 100, "f", ahora).estado, "acertada")
  assert.equal(resolverPrediccion(pred({ operador: "rango", objetivo: 80, objetivoMax: 120 }), 130, "f", ahora).estado, "errada")
})

test("resolverPrediccion guarda valor, fecha y fuente", () => {
  const r = resolverPrediccion(pred({}), 105, "yahoo", ahora)
  assert.equal(r.valorResolucion, 105)
  assert.equal(r.fuente, "yahoo")
  assert.equal(r.fechaResuelta, ahora)
})

test("resolverPrediccion no toca si aún no vence o ya está resuelta", () => {
  // antes del vencimiento
  const antes = resolverPrediccion(pred({}), 105, "f", "2026-01-15T00:00:00Z")
  assert.equal(antes.estado, "abierta")
  // ya resuelta
  const ya = resolverPrediccion(pred({ estado: "acertada" }), 0, "f", ahora)
  assert.equal(ya.estado, "acertada")
})

// ── puntosPorPrediccion ─────────────────────────────────────────────────────
test("puntosPorPrediccion premia acertar y penaliza poco errar", () => {
  const acertada = puntosPorPrediccion(pred({ estado: "acertada" }))
  assert.ok(acertada > 10, `acertada deberia dar > 10, dio ${acertada}`)
  assert.equal(puntosPorPrediccion(pred({ estado: "errada" })), -5)
  assert.equal(puntosPorPrediccion(pred({ estado: "abierta" })), 0)
  assert.equal(puntosPorPrediccion(pred({ estado: "anulada" })), 0)
})
