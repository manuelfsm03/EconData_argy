import assert from "node:assert/strict"
import test from "node:test"

import { REM_PUBLICACIONES_2026, remPublicacionesFrom } from "../src/server/domain/bcra-calendar"
import { deriveBcraCalendarEvents } from "../src/lib/calendar-events"

test("hay 11 publicaciones REM confirmadas para 2026, ordenadas cronológicamente", () => {
  assert.equal(REM_PUBLICACIONES_2026.length, 11)
  const fechas = REM_PUBLICACIONES_2026.map((p) => p.fecha)
  assert.deepEqual(fechas, [...fechas].sort())
  for (const p of REM_PUBLICACIONES_2026) {
    assert.ok(p.fecha.startsWith("2026-"))
    assert.ok(p.descripcion.length > 0)
  }
})

test("no hay fecha de diciembre 2026 inventada (el calendario oficial no la publica todavía)", () => {
  const diciembre = REM_PUBLICACIONES_2026.filter((p) => p.fecha.startsWith("2026-12"))
  assert.equal(diciembre.length, 0)
})

test("remPublicacionesFrom filtra publicaciones pasadas sin mutar la lista original", () => {
  const futuras = remPublicacionesFrom("2026-08-17")
  assert.equal(futuras.length, 3)
  assert.deepEqual(futuras.map((p) => p.fecha), ["2026-09-04", "2026-10-06", "2026-11-05"])
  assert.equal(REM_PUBLICACIONES_2026.length, 11)
})

test("deriveBcraCalendarEvents produce eventos AR con fuente e impacto consistentes", () => {
  const events = deriveBcraCalendarEvents("2026-08-17")
  assert.equal(events.length, 3)
  for (const event of events) {
    assert.equal(event.kind, "bcra")
    assert.equal(event.country, "AR")
    assert.equal(event.ticker, "REM")
    assert.equal(event.impact, "high")
    assert.ok(event.source.includes("BCRA"))
    assert.ok(event.paymentDate >= "2026-08-17")
  }
})
