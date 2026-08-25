import assert from "node:assert/strict"
import test from "node:test"
import { INSTRUMENTOS_BONOS, getInstrumentoBono } from "../src/lib/bond-instrument-catalog"
import { ESQUEMAS, construirCashflows } from "../src/lib/bond-schedule"

test("PR76 enumera los 11 instrumentos objetivo con ticker oficial y convención", () => {
  assert.deepEqual(
    INSTRUMENTOS_BONOS.map((instrumento) => instrumento.ticker),
    ["GD30", "AL30", "GD29", "AL29", "GD35", "AL35", "GD41", "AL41", "AE38", "GD38", "S30S6"],
  )

  for (const instrumento of INSTRUMENTOS_BONOS) {
    assert.ok(instrumento.fuentePrimaria.length > 0, instrumento.ticker)
    assert.ok(instrumento.dayCount.length > 0, instrumento.ticker)
    assert.ok(instrumento.frecuencia.length > 0, instrumento.ticker)
    assert.ok(instrumento.decision.length > 0, instrumento.ticker)
  }
})

test("los 10 bonos soberanos hard-dollar habilitados tienen cashflows completos", () => {
  const habilitados = INSTRUMENTOS_BONOS.filter((instrumento) => instrumento.estado === "habilitado")
  assert.equal(habilitados.length, 10)
  assert.equal(ESQUEMAS.length, 10)

  for (const instrumento of habilitados) {
    const esquema = getInstrumentoBono(instrumento.ticker)?.esquema
    if (!esquema) throw new Error(`missing schema for ${instrumento.ticker}`)
    const cashflows = construirCashflows(esquema)
    assert.ok(cashflows.length > 0, instrumento.ticker)
    assert.equal(esquema.filas.at(-1)?.fecha, instrumento.vencimiento)
    assert.equal(cashflows.at(-1)!.fechaPago.toISOString().slice(0, 10) >= instrumento.vencimiento, true)
    assert.ok(Math.abs(cashflows.reduce((sum, cf) => sum + cf.amortizacion, 0) - 100) < 0.01, instrumento.ticker)
  }
})

test("S30S6 queda explícitamente excluido de TEA hasta tener base de cashflow verificable", () => {
  const instrumento = getInstrumentoBono("S30S6")
  assert.ok(instrumento)
  assert.equal(instrumento.estado, "excluido")
  assert.equal(instrumento.esquema, undefined)
  assert.match(instrumento.decision, /TEA|cashflow|verific/i)
})

test("GD38 completa el universo hard-dollar con la misma convención oficial del canje", () => {
  const instrumento = getInstrumentoBono("GD38")
  assert.ok(instrumento)
  assert.equal(instrumento.estado, "habilitado")
  assert.equal(instrumento.dayCount, "30/360 US")
  assert.equal(instrumento.frecuencia, "semestral")
  assert.equal(instrumento.vencimiento, "2038-01-09")
})
