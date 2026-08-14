import assert from "node:assert/strict"
import test from "node:test"

import { recentObservedValues } from "../src/client/lib/series-values"

test("summary values use the latest observation for each series instead of the last merged date", () => {
  const rows = [
    { date: "2026-08-10", reservas: 41_500, tamar: 22.5 },
    { date: "2026-08-11", reservas: 41_700 },
    { date: "2026-08-12", tamar: 23.2, badlar: 21 },
  ]

  assert.deepEqual(recentObservedValues(rows, "reservas", 2), [41_700, 41_500])
  assert.deepEqual(recentObservedValues(rows, "tamar", 1), [23.2])
  assert.deepEqual(recentObservedValues(rows, "badlar", 1), [21])
})

test("summary values reject null and non-finite placeholders", () => {
  const rows = [
    { date: "2026-08-10", reservas: 41_500 },
    { date: "2026-08-11", reservas: Number.NaN },
    { date: "2026-08-12", reservas: null },
  ]

  assert.deepEqual(recentObservedValues(rows, "reservas", 2), [41_500])
  assert.deepEqual(recentObservedValues(rows, "missing", 1), [])
})
