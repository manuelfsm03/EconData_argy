import assert from "node:assert/strict"
import test from "node:test"
import { parseTestOutput } from "../scripts/ci-test-parser.mjs"

test("parses Node TAP # totals and rejects skips", () => {
  const result = parseTestOutput("1..2\n# tests 2\n# pass 2\n# skipped 0\n")
  assert.deepEqual(result, { testCounts: [2], skippedCounts: [0], totalTests: 2, totalSkipped: 0 })
})

test("parses Node20 informational totals and aggregates suites", () => {
  const result = parseTestOutput("ℹ tests 11\nℹ skipped 0\nℹ tests 6\nℹ skipped 1\n")
  assert.deepEqual(result, { testCounts: [11, 6], skippedCounts: [0, 1], totalTests: 17, totalSkipped: 1 })
})

test("does not treat test names or pass counts as totals", () => {
  const result = parseTestOutput("# Subtest: tests 999\n# pass 4\n# tests 4\n# skipped 0\n")
  assert.deepEqual(result, { testCounts: [4], skippedCounts: [0], totalTests: 4, totalSkipped: 0 })
})
