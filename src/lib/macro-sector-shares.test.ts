import assert from "node:assert/strict"
import test from "node:test"

import { toWeightedSectorShares } from "./macro-sector-shares"

test("converts sector indexes and base weights into shares of total value added", () => {
  assert.deepEqual(
    toWeightedSectorShares({ agro: 120, industria: 80 }, { agro: 5, industria: 15 }),
    { agro: 33.33, industria: 66.67 },
  )
})

test("preserves nulls and returns null shares when the weighted total is not positive", () => {
  assert.deepEqual(
    toWeightedSectorShares({ agro: null, industria: 0 }, { agro: 5, industria: 15 }),
    { agro: null, industria: null },
  )
})
