import assert from "node:assert/strict"
import test from "node:test"

import { liquidacion24hs, mesesCapitalizacion, metricasCap, pagoFinalDesdeEmision, valorTecnico } from "../src/lib/cap-math"
import { CAP_TERMINOS, terminosDe } from "../src/server/domain/cap-terminos"
import { parseBymaCapQuotes } from "../src/server/external/byma-data"

const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const cerca = (actual: number | null | undefined, esperado: number, tol: number, que: string) => {
  assert.ok(actual != null && Math.abs(actual - esperado) <= tol, `${que}: ${actual} vs ${esperado}`)
}

test("cada pago final del catálogo sale de 100·(1+TEM)^meses 30/360 US desde la emisión", () => {
  for (const t of CAP_TERMINOS) {
    cerca(pagoFinalDesdeEmision(t.temEmision, t.emision, t.vencimiento), t.pagoFinal, 1e-5, t.ticker)
  }
})

test("los meses de capitalización respetan la regla del día 31 de 30/360 US", () => {
  // Emisión un 31: el día 31 pasa a 30 (T15E7, 31/01/2025 → 15/01/2027).
  cerca(mesesCapitalizacion(fecha("2025-01-31"), fecha("2027-01-15")), 23.5, 1e-9, "T15E7")
  // Vencimiento un 31 con emisión un 15: el 31 NO se recorta (T31Y7).
  cerca(mesesCapitalizacion(fecha("2025-12-15"), fecha("2027-05-31")), 17 + 16 / 30, 1e-9, "T31Y7")
})

test("métricas de S30S6 coinciden con el cálculo a mano", () => {
  const s30s6 = terminosDe("S30S6")
  assert.ok(s30s6)
  const m = metricasCap(117, s30s6, fecha("2026-09-22"))
  assert.ok(m)
  assert.equal(m.dias, 8)
  cerca(m.tem, 1.727585, 1e-5, "TEM")
  cerca(m.tea, 23.16991, 1e-4, "TEA")
  cerca(m.durationMac, 8 / 365, 1e-12, "duration")
  cerca(m.durationMod, 0.01779477, 1e-7, "duration modificada")
  cerca(m.valorTecnico, 116.75512, 1e-4, "valor técnico")
  cerca(m.paridad, 100.209738, 1e-4, "paridad")
})

test("la TNA es TEM × 12, no la TEA mensualizada", () => {
  const m = metricasCap(117, terminosDe("S30S6")!, fecha("2026-09-22"))!
  cerca(m.tna, m.tem * 12, 1e-12, "TNA")
  assert.ok(Math.abs(m.tna - 21.021463) > 0.2, "la TNA no puede salir de la TEA")
})

test("el valor técnico no capitaliza más allá del pago final", () => {
  const t = terminosDe("S30S6")!
  assert.equal(valorTecnico(t, fecha("2026-12-31")), t.pagoFinal)
})

test("sin precio, sin pago final o ya vencido devuelve null en vez de un número inventado", () => {
  const t = terminosDe("S30S6")!
  assert.equal(metricasCap(null, t, fecha("2026-09-22")), null)
  assert.equal(metricasCap(0, t, fecha("2026-09-22")), null)
  assert.equal(metricasCap(-5, t, fecha("2026-09-22")), null)
  assert.equal(metricasCap(117, { ...t, pagoFinal: 0 }, fecha("2026-09-22")), null)
  assert.equal(metricasCap(117, t, fecha("2026-09-30")), null)
})

test("la liquidación 24 hs es el día hábil siguiente, con el día de Buenos Aires", () => {
  // Lunes 12:00 en Buenos Aires → martes.
  assert.equal(liquidacion24hs(new Date("2026-09-21T15:00:00Z")).toISOString().slice(0, 10), "2026-09-22")
  // Viernes → lunes.
  assert.equal(liquidacion24hs(new Date("2026-09-25T15:00:00Z")).toISOString().slice(0, 10), "2026-09-28")
  // Lunes 22:00 en Buenos Aires ya es martes en UTC: sigue siendo lunes acá.
  assert.equal(liquidacion24hs(new Date("2026-09-22T01:00:00Z")).toISOString().slice(0, 10), "2026-09-22")
})

const PANEL = {
  data: [
    { symbol: "S30S6", settlementType: "1", denominationCcy: "ARS", maturityDate: "2026-09-30", trade: 116.9, previousClosingPrice: 116.8, tradeHour: "14:01:00" },
    { symbol: "S30S6", settlementType: "2", denominationCcy: "ARS", maturityDate: "2026-09-30", trade: 117, settlementPrice: 117, previousClosingPrice: 116.917, tradeHour: "14:05:49" },
    { symbol: "T15E7", settlementType: "2", denominationCcy: "ARS", maturityDate: "2027-01-15", trade: 0, settlementPrice: 0, previousClosingPrice: 149.515, tradeHour: "" },
    { symbol: "S30S6D", settlementType: "2", denominationCcy: "USD", maturityDate: "2026-09-30", trade: 0.08 },
    { symbol: "TO26", settlementType: "2", denominationCcy: "ARS", maturityDate: "2026-10-19", trade: 106.1 },
    { symbol: "S15Y6", settlementType: "2", denominationCcy: "ARS", maturityDate: "2026-05-15", trade: 100 },
  ],
}

test("el panel de BYMA da precio de 24 hs y descarta CI, dólares, vencidos y otros bonos", () => {
  const quotes = parseBymaCapQuotes(PANEL, new Date("2026-09-21T17:10:00Z"))
  assert.deepEqual(quotes.map((q) => q.ticker), ["S30S6", "T15E7"])

  const [s30s6, t15e7] = quotes
  assert.equal(s30s6.tipo, "LECAP")
  assert.equal(s30s6.precio, 117)
  assert.equal(s30s6.asOf, "2026-09-21T17:05:49.000Z")
  cerca(s30s6.change1D, (117 / 116.917 - 1) * 100, 1e-12, "variación")

  // Sin operaciones hoy: cierre anterior, fechado en la rueda previa.
  assert.equal(t15e7.tipo, "BONCAP")
  assert.equal(t15e7.precio, 149.515)
  assert.equal(t15e7.change1D, null)
  assert.equal(t15e7.asOf, "2026-09-18T20:00:00.000Z")
})

test("todo capitalizable que BYMA cotiza y tiene condiciones de emisión calcula rendimiento", () => {
  // El bug que esto cubre: el screener mostraba precio y TEM vacía para todas
  // las LECAP porque el rendimiento se leía de una DB en vez de calcularse.
  const quotes = parseBymaCapQuotes(PANEL, new Date("2026-09-21T17:10:00Z"))
  const liquidacion = fecha("2026-09-22")
  for (const quote of quotes) {
    const t = terminosDe(quote.ticker)
    assert.ok(t, `${quote.ticker} cotiza y no tiene condiciones de emisión`)
    const m = metricasCap(quote.precio, t, liquidacion)
    assert.ok(m && Number.isFinite(m.tem) && Number.isFinite(m.durationMod) && Number.isFinite(m.paridad), `${quote.ticker} sin métricas`)
  }
})
