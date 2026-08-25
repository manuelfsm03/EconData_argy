import assert from "node:assert/strict"
import test from "node:test"
import { CALENDAR_COVERAGE_REGISTRY, PENDING_CALENDAR_SOURCES } from "../src/lib/calendar-coverage"
import { deriveMarketCalendarEvents } from "../src/lib/calendar-events"
import { eventsToICS } from "../src/lib/ics-export"

test("coverage registry uses unique source-country identities and traceable dates", () => {
  const keys = Object.keys(CALENDAR_COVERAGE_REGISTRY)
  assert.equal(new Set(keys).size, keys.length)
  for (const [key, coverage] of Object.entries(CALENDAR_COVERAGE_REGISTRY)) {
    assert.ok(key.includes(":"), `${key} must identify kind and country`)
    assert.ok(coverage.scope.trim(), `${key} needs a scope`)
    if (coverage.status !== "official") assert.ok(coverage.limitation, `${key} needs an explicit limitation`)
  }
})

test("events carry country-specific coverage and preserve source limitations", () => {
  const events = deriveMarketCalendarEvents("2026-08-24")
  assert.ok(events.length > 0)
  for (const event of events) {
    assert.ok(event.coverage)
    assert.equal(event.coverage?.status, event.kind === "earnings" ? "estimated" : "official")
    assert.equal(event.coverage?.source, event.source)
    if (event.coverage?.status === "official") assert.match(event.coverage.verifiedAt ?? "", /^2026-08-(12|16|17|20|25)$/)
    assert.ok(event.coverage?.scope)
  }
  const mexico = events.find((event) => event.kind === "latam_cpi" && event.country === "MX")
  assert.match(mexico?.coverage?.limitation ?? "", /una tabla anual|fecha siguiente/)
  const eurozone = events.find((event) => event.kind === "intl_cpi" && event.country === "EU")
  assert.match(eurozone?.coverage?.limitation ?? "", /septiembre/)
})

test("unsupported coverage has distinct stable identities and no synthetic dates", () => {
  assert.deepEqual(PENDING_CALENDAR_SOURCES.map((source) => source.id), ["treasury", "sp500"])
  assert.deepEqual(PENDING_CALENDAR_SOURCES.map((source) => source.name), ["Licitaciones del Tesoro", "Earnings — S&P 500 (resto)"])
  assert.ok(PENDING_CALENDAR_SOURCES.every((source) => source.statusLabel === "Pendiente" && source.items.length > 0))
  assert.equal(deriveMarketCalendarEvents("2026-08-24").some((event) => ["treasury", "sp500"].includes((event as { kind: string }).kind)), false)
})

test("canonical cut-off has 249 events across 19 coverage keys and ICS stays in parity", () => {
  const events = deriveMarketCalendarEvents("2026-08-27")
  assert.equal(events.length, 249)
  assert.equal(new Set(events.map((event) => `${event.kind}:${event.country}`)).size, 19)
  assert.ok(events.every((event) => event.paymentDate >= "2026-08-27"))
  assert.ok(events.every((event) => event.kind !== "earnings" || event.confirmado === false))

  const gd38 = events.filter((event) => event.kind === "bono" && event.ticker === "GD38")
  assert.equal(gd38.length, 23)
  assert.ok(gd38.every((event) => event.source.includes("IF-2020-53778419-APN-UGSDPE#MEC") && event.coverage?.verifiedAt === "2026-08-25"))

  const ics = eventsToICS(events)
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, events.length)
  assert.equal((ics.match(/UID:/g) ?? []).length, events.length)
  assert.match(ics, /DTSTART;VALUE=DATE:20260827|DTSTART;VALUE=DATE:2026/)
})
