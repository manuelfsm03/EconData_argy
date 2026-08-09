import assert from "node:assert/strict"
import test from "node:test"

import { parseFirstProbability, parseVolumeString } from "../src/server/sources/polymarket-parser"

test("parses the live Gamma API numeric and string payload shapes", () => {
  assert.equal(parseFirstProbability('["0.0445", "0.9555"]'), 4)
  assert.equal(parseFirstProbability([0.62, 0.38]), 62)
  assert.equal(parseVolumeString(23765.787375), 23765.787375)
  assert.equal(parseVolumeString("273856.72294"), 273856.72294)
})

test("falls back safely for malformed market values", () => {
  assert.equal(parseFirstProbability("not-json"), 50)
  assert.equal(parseVolumeString(undefined), 0)
})
