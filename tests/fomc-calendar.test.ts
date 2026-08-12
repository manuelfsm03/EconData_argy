import assert from "node:assert/strict"
import test from "node:test"

import { FOMC_MEETINGS_2026, fomcMeetingsFrom } from "../src/server/domain/fomc-calendar"

test("hay exactamente 8 reuniones FOMC en 2026, ordenadas cronológicamente", () => {
  assert.equal(FOMC_MEETINGS_2026.length, 8)
  const fechas = FOMC_MEETINGS_2026.map((m) => m.fecha)
  assert.deepEqual(fechas, [...fechas].sort())
})

test("cada reunión tiene fechaInicio antes de fecha y ambas en 2026", () => {
  for (const m of FOMC_MEETINGS_2026) {
    assert.ok(m.fechaInicio < m.fecha)
    assert.ok(m.fecha.startsWith("2026-"))
    assert.equal(m.tipo, "FOMC")
    assert.ok(m.descripcion.length > 0)
  }
})

test("las 4 reuniones con proyecciones económicas son marzo, junio, septiembre y diciembre", () => {
  const conProyecciones = FOMC_MEETINGS_2026.filter((m) => m.proyecciones).map((m) => m.fecha)
  assert.deepEqual(conProyecciones, ["2026-03-18", "2026-06-17", "2026-09-16", "2026-12-09"])
})

test("fomcMeetingsFrom filtra reuniones pasadas sin mutar la lista original", () => {
  const futuras = fomcMeetingsFrom("2026-08-12")
  assert.equal(futuras.length, 3)
  assert.equal(futuras[0].fecha, "2026-09-16")
  assert.equal(FOMC_MEETINGS_2026.length, 8)
})
