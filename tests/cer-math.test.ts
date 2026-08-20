/**
 * Tests de la tasa real de los instrumentos CER.
 *
 *   npx tsx --test tests/cer-math.test.ts
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  diasEntre,
  esCeroCupon,
  precioDadaTasaReal,
  tasaRealCeroCupon,
} from "../src/lib/cer-math"

// ── Quién entra al cálculo y quién no ────────────────────────────────────────

test("reconoce los cero cupón por el 0% del nombre oficial", () => {
  assert.ok(esCeroCupon("TZXD8", "BONCER 2028 $ 0% (TZXD8)"))
  assert.ok(esCeroCupon("X30N6", "LECER $ 0% Vto. 30.11.2026 (X30N6)"))
  assert.ok(esCeroCupon("TZXA7", "Bono del Tesoro Nacional 2027 $ 0% Aj. por CER (TZXA7)"))
})

test("reconoce los TZX2x, que son cero cupón aunque el nombre corto no lo diga", () => {
  // Nombre oficial: "BONO DEL TESORO NACIONAL EN PESOS CERO CUPÓN CON AJUSTE
  // POR CER", confirmado en el llamado a licitación del Ministerio.
  assert.ok(esCeroCupon("TZX27", "Boncer $ 2027 Ajustado por CER (TZX27)"))
  assert.ok(esCeroCupon("TZX28", "Boncer $ 2028 Ajustado por CER (TZX28)"))
})

test("deja afuera a los BONCER con cupón", () => {
  // Para estos hace falta el cronograma del prospecto: la fórmula de cero
  // cupón les daría un rendimiento más bajo del real, porque no ve los cupones.
  assert.ok(!esCeroCupon("TX26", "BONCER (canje 2020) 2026 $ ajustado por CER 2% (Ley Argentina)"))
  assert.ok(!esCeroCupon("TX31", "BONCER 2031 $ 2,50% (TX31)"))
  assert.ok(!esCeroCupon("DICP", "DISCOUNT PESOS CER + 5,83% (DICP)"))
  assert.ok(!esCeroCupon("PARP", "PAR PESOS CER + 1,77% (PARP)"))
})

test("deja afuera a los duales, que ni siquiera son sólo CER", () => {
  assert.ok(!esCeroCupon("TXMD8", "Bono DUAL 2028 $ CER/TAMAR+ 3% (TXMD8)"))
})

test("sin nombre no inventa: no calcula", () => {
  assert.ok(!esCeroCupon("XXXXX", null))
  assert.ok(!esCeroCupon("XXXXX", ""))
})

// ── La tasa real ─────────────────────────────────────────────────────────────

test("reproduce la tasa real publicada para TZX27", () => {
  // Caso de referencia: ecovalores publicaba paridad 93,33% y TIR 8,35% + CER
  // para TZX27, a 315 días del vencimiento del 30/06/2027.
  const vt = 100
  const precio = 93.33
  const r = tasaRealCeroCupon(precio, vt, 315)
  assert.ok(r)
  assert.ok(Math.abs(r.tasaReal - 8.35) < 0.05, `dio ${r.tasaReal.toFixed(3)}%, esperaba ~8,35%`)
  assert.ok(Math.abs(r.paridad - 93.33) < 1e-9)
})

test("el CER base no aparece por ningún lado", () => {
  /**
   * La misma tasa real tiene que salir con cualquier nivel de CER, porque en la
   * fórmula el CER se cancela. Se simula el mismo bono con dos coeficientes de
   * ajuste distintos: precio y valor técnico se mueven juntos, la tasa no.
   */
  const base = tasaRealCeroCupon(93.33, 100, 315)
  const ajustado = tasaRealCeroCupon(93.33 * 7.21, 100 * 7.21, 315)
  assert.ok(base && ajustado)
  assert.ok(Math.abs(base.tasaReal - ajustado.tasaReal) < 1e-9)
})

test("comprar bajo la par da tasa positiva y sobre la par, negativa", () => {
  const barato = tasaRealCeroCupon(90, 100, 365)
  const caro = tasaRealCeroCupon(110, 100, 365)
  assert.ok(barato && caro)
  assert.ok(Math.abs(barato.tasaReal - 11.111) < 0.001, `${barato.tasaReal}`)
  assert.ok(caro.tasaReal < 0, "sobre la par el rendimiento real es negativo")
})

test("a un año exacto, la tasa es la diferencia directa", () => {
  const r = tasaRealCeroCupon(100, 110, 365)
  assert.ok(r)
  assert.ok(Math.abs(r.tasaReal - 10) < 1e-9)
})

test("no calcula sobre datos que no tienen sentido", () => {
  assert.equal(tasaRealCeroCupon(0, 100, 300), null, "precio cero")
  assert.equal(tasaRealCeroCupon(-5, 100, 300), null, "precio negativo")
  assert.equal(tasaRealCeroCupon(90, 0, 300), null, "sin valor técnico")
  assert.equal(tasaRealCeroCupon(90, 100, 0), null, "vence hoy")
  assert.equal(tasaRealCeroCupon(90, 100, -10), null, "ya vencido")
  assert.equal(tasaRealCeroCupon(Number.NaN, 100, 300), null, "precio no numérico")
})

// ── Ida y vuelta ─────────────────────────────────────────────────────────────

test("precio y tasa son inversas exactas", () => {
  const vt = 407.92
  const dias = 315
  for (const objetivo of [-2, 0, 3.5, 8.35, 25]) {
    const precio = precioDadaTasaReal(objetivo, vt, dias)
    assert.ok(precio, `sin precio para ${objetivo}%`)
    const vuelta = tasaRealCeroCupon(precio, vt, dias)
    assert.ok(vuelta)
    assert.ok(
      Math.abs(vuelta.tasaReal - objetivo) < 1e-9,
      `${objetivo}% volvió como ${vuelta.tasaReal}`,
    )
  }
})

test("más tasa exigida, menos precio", () => {
  const caro = precioDadaTasaReal(5, 100, 365)
  const barato = precioDadaTasaReal(15, 100, 365)
  assert.ok(caro && barato && barato < caro)
})

// ── Conteo de días ───────────────────────────────────────────────────────────

test("cuenta los días de fecha a fecha", () => {
  assert.equal(diasEntre(new Date("2026-08-19"), new Date("2027-06-30")), 315)
  assert.equal(diasEntre(new Date("2026-08-19"), new Date("2026-08-20")), 1)
  assert.equal(diasEntre(new Date("2026-08-19"), new Date("2026-08-19")), 0)
})

test("un año bisiesto cuenta 366 días", () => {
  assert.equal(diasEntre(new Date("2028-01-01"), new Date("2029-01-01")), 366)
})
