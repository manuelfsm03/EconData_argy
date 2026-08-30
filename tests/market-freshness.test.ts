import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import { chooseFreshPrice, gateMarketPrice } from "../src/server/domain/market-freshness"

const now = new Date("2026-08-25T15:00:00.000Z")

test("market price gate rejects missing, invalid, stale, and future observations", () => {
  assert.equal(gateMarketPrice("byma_data_open", null, now).freshness, "missing")
  assert.equal(gateMarketPrice("rava_market", "not-a-date", now).freshness, "invalid")
  assert.equal(gateMarketPrice("byma_data_open", "2026-08-19T13:29:59.000Z", now).freshness, "stale")
  assert.equal(gateMarketPrice("rava_market", "2026-08-25T15:00:01.000Z", now).freshness, "future")
  assert.equal(gateMarketPrice("db_local", "2026-08-25T14:45:00.000Z", now).accepted, true)
})

test("freshness max-age is source-specific and never accepts stale prices", () => {
  const byma = gateMarketPrice("byma_data_open", "2026-08-21T17:00:00.000Z", now)
  const rava = gateMarketPrice("rava_market", "2026-08-25T14:29:59.000Z", now)
  assert.equal(byma.accepted, true)
  assert.equal(rava.accepted, false)
  assert.equal(rava.freshness, "stale")
})

test("BYMA daily candles survive a non-trading weekend but expire after sessions", () => {
  const monday = new Date("2026-08-24T15:00:00.000Z")
  assert.equal(gateMarketPrice("byma_data_open", "2026-08-21T17:00:00.000Z", monday).freshness, "fresh")
  assert.equal(gateMarketPrice("byma_data_open", "2026-08-19T17:00:00.000Z", monday).freshness, "stale")
})

test("fresh fallback is labeled and stale primary never survives into the selected price", () => {
  const selected = chooseFreshPrice([
    { source: "byma_data_open", price: 100, asOf: "2026-08-19T12:00:00.000Z" },
    { source: "rava_market", price: 99, asOf: "2026-08-25T14:50:00.000Z" },
  ], now)

  assert.deepEqual(selected, {
    price: 99,
    asOf: "2026-08-25T14:50:00.000Z",
    source: "rava_market",
    sourceMode: "fallback",
    fallbackFrom: "byma_data_open",
    freshness: "fresh",
  })
})

test("no valid candidate returns no price and exposes the rejection status", () => {
  const selected = chooseFreshPrice([
    { source: "byma_data_open", price: 100, asOf: null },
    { source: "rava_market", price: 99, asOf: "2026-08-25T10:00:00.000Z" },
  ], now)

  assert.equal(selected.price, null)
  assert.equal(selected.asOf, null)
  assert.equal(selected.sourceMode, "unavailable")
  assert.equal(selected.freshness, "stale")
})

test("API and workspace consume the freshness contract instead of rendering stale numbers", () => {
  const route = readFileSync("src/app/api/bonos/route.ts", "utf8")
  const workspace = readFileSync("src/client/components/workspace/bonds-workspace.tsx", "utf8")

  assert.match(route, /chooseFreshPrice\(/)
  assert.match(route, /gateMarketPrice\(/)
  assert.match(route, /asOfFromDate\(bond\.updatedAt\)/)
  assert.match(route, /priceStatus: selected\.freshness/)
  assert.match(route, /priceSourceMode: selected\.sourceMode/)
  assert.match(workspace, /j\?\.data\?\.priceStatus === "fresh" \? j\.data\.precio : null/)
})
