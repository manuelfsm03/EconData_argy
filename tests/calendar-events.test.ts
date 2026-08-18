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
  const events = deriveBondCalendarEvents("2026-08-10")
  // Desambiguar por ticker: ESQUEMAS ya tiene 9 bonos y más de uno puede
  // devengar el 9-jul/9-ene (feriados que corren varios soberanos HD a la vez).
  const january = events.find((event) => event.accrualDate === "2027-01-09" && event.ticker === "GD30")
  const july = events.find((event) => event.accrualDate === "2027-07-09" && event.ticker === "GD30")
  assert.equal(january?.paymentDate, "2027-01-11")
  assert.equal(july?.paymentDate, "2027-07-12")
  assert.equal(january?.ticker, "GD30")
  assert.equal(july?.ticker, "GD30")
})
