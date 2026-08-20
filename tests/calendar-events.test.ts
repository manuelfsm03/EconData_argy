import assert from "node:assert/strict"
import test from "node:test"
import { deriveBondCalendarEvents, todayInBuenosAires } from "../src/lib/calendar-events"

test("Buenos Aires cut-off is stable across the UTC date boundary", () => {
  assert.equal(todayInBuenosAires(new Date("2026-08-10T01:00:00.000Z")), "2026-08-09")
  assert.equal(todayInBuenosAires(new Date("2026-08-10T04:00:00.000Z")), "2026-08-10")
})

test("calendar uses only validated future cashflows and keeps them sorted", () => {
  const events = deriveBondCalendarEvents("2026-08-10")
  assert.ok(events.length > 0)
  assert.deepEqual(events.map((event) => event.paymentDate), [...events.map((event) => event.paymentDate)].sort())
  for (const event of events) {
    assert.ok(event.paymentDate >= "2026-08-10")
    assert.ok(event.source.trim().length > 0)
    assert.ok(Number.isFinite(event.coupon) && event.coupon >= 0)
    assert.ok(Number.isFinite(event.amortization) && event.amortization >= 0)
    assert.ok(event.residualBeforePayment > 0)
  }
})

test("GD30 effective dates follow weekends and loaded Argentine holidays", () => {
  // Se filtra POR TICKER además de por fecha. Buscar sólo por accrualDate
  // alcanzaba cuando GD30 era el único bono con esquema cargado, pero desde
  // que entraron los nueve del canje hay varios que devengan el mismo día
  // (AE38 también paga el 2027-01-09) y find() devolvía el primero de la lista,
  // no el que el test quería mirar.
  const events = deriveBondCalendarEvents("2026-08-10")
  const gd30 = events.filter((event) => event.ticker === "GD30")
  const january = gd30.find((event) => event.accrualDate === "2027-01-09")
  const july = gd30.find((event) => event.accrualDate === "2027-07-09")
  assert.equal(january?.paymentDate, "2027-01-11", "09/01/2027 cae sábado: cobra el lunes")
  assert.equal(july?.paymentDate, "2027-07-12", "09/07/2027 es feriado: cobra el lunes siguiente")
  assert.equal(january?.ticker, "GD30")
  assert.equal(july?.ticker, "GD30")
})
