import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { mergeOfficialSeries } from "../src/server/domain/inequality-series"

const macroRoute = readFileSync("src/app/api/macro/route.ts", "utf8")

test("merges historical and official series at an explicit year boundary", () => {
  const merged = mergeOfficialSeries({
    historical: [
      ["2001-01-01", 50.1],
      ["2002-01-01", 49.2],
      ["2003-01-01", 99.9],
    ],
    official: [
      ["2003-07-01", 0.534],
      ["2004-01-01", 0.51],
    ],
    officialStartYear: 2003,
    officialScale: 100,
    decimals: 1,
  })

  assert.deepEqual(merged, [
    ["2001-01-01", 50.1],
    ["2002-01-01", 49.2],
    ["2003-07-01", 53.4],
    ["2004-01-01", 51],
  ])
})

test("drops invalid values, sorts dates, and lets official data win duplicates", () => {
  const merged = mergeOfficialSeries({
    historical: [
      ["2003-01-01", 45],
      ["2002-01-01", Number.NaN],
    ],
    official: [
      ["2004-01-01", 0.37],
      ["2004-01-01", 0.38],
      ["bad-date", 0.4],
    ],
    officialStartYear: 2004,
    officialScale: 100,
    decimals: 1,
  })

  assert.deepEqual(merged, [
    ["2003-01-01", 45],
    ["2004-01-01", 38],
  ])
})

test("macro detailed inequality endpoint uses official Gini and informal-employment series", () => {
  assert.match(macroRoute, /informalidad_indec:\s*"52\.1_ASDJ_0_0_37"/)
  assert.match(macroRoute, /getMultiserie\(\["gini_indec"\],\s*100\)/)
  assert.match(macroRoute, /getMultiserie\(\["informalidad_indec"\],\s*30\)/)
  assert.match(macroRoute, /Gini e informalidad: INDEC\/EPH/)
})
