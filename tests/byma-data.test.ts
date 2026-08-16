import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildBymaHistoryUrl, parseBymaCapInstruments, parseBymaHistory } from "../src/server/external/byma-data"
import { parseRavaStockQuote } from "../src/server/external/rava-stock"
import { findSourceForUrl } from "../src/server/sources/registry"

test("parses the last valid BYMA observation and previous close", () => {
  const quote = parseBymaHistory({
    s: "ok",
    t: [1_786_590_000, 1_786_676_400, 1_786_762_800],
    o: [0, 7_150, 6_900],
    h: [0, 7_170, 7_000],
    l: [0, 6_835, 6_800],
    c: [0, 6_850, 6_900],
    v: [0, 1_746_579, 0],
  }, "GGAL", "GGAL 24HS")

  assert.ok(quote)
  assert.equal(quote.lastPrice, 6_900)
  assert.equal(quote.previousClose, 6_850)
  assert.equal(quote.openPrice, 6_900)
  assert.equal(quote.volume, 0)
  assert.equal(quote.delayedMinutes, 20)
  assert.equal(quote.source, "byma_data_open")
  assert.equal(quote.change1D, (50 / 6_850) * 100)
})

test("rejects malformed, non-positive, and unavailable BYMA history", () => {
  assert.equal(parseBymaHistory(null, "GGAL", "GGAL 24HS"), null)
  assert.equal(parseBymaHistory({ s: "no_data" }, "GGAL", "GGAL 24HS"), null)
  assert.equal(parseBymaHistory({ s: "ok", t: [1], c: [0] }, "GGAL", "GGAL 24HS"), null)
  assert.equal(parseBymaHistory({ s: "ok", t: [null], c: [100] }, "GGAL", "GGAL 24HS"), null)
})

test("builds a bounded official BYMA history request", () => {
  const now = new Date("2026-08-16T12:00:00.000Z")
  const url = new URL(buildBymaHistoryUrl("AL30D 24HS", now))
  assert.equal(url.hostname, "open.bymadata.com.ar")
  assert.equal(url.searchParams.get("symbol"), "AL30D 24HS")
  assert.equal(url.searchParams.get("resolution"), "D")
  const from = Number(url.searchParams.get("from"))
  const to = Number(url.searchParams.get("to"))
  assert.equal(to - from, 15 * 24 * 60 * 60)
})

test("discovers active ARS LECAP/BONCAP instruments with 24hs settlement", () => {
  const payload = {
    data: [
      { symbol: "S15S6", maturityDate: "2026-09-15", denominationCcy: "ARS", settlementType: "2" },
      { symbol: "T15D6", maturityDate: "2026-12-15", denominationCcy: "ARS", settlementType: 2 },
      { symbol: "S15S6.SB", maturityDate: "2026-09-15", denominationCcy: "ARS", settlementType: "2" },
      { symbol: "S31L6", maturityDate: "2026-07-31", denominationCcy: "ARS", settlementType: "2" },
      { symbol: "S15S6D", maturityDate: "2026-09-15", denominationCcy: "USD", settlementType: "2" },
    ],
  }

  assert.deepEqual(parseBymaCapInstruments(payload, new Date("2026-08-16T12:00:00Z")), [
    { ticker: "S15S6", tipo: "LECAP", vencimiento: "2026-09-15" },
    { ticker: "T15D6", tipo: "BONCAP", vencimiento: "2026-12-15" },
  ])
})

test("BYMA Data is registered at the guarded HTTP boundary", () => {
  assert.equal(
    findSourceForUrl("https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/server-time").id,
    "byma_data_open",
  )
})

test("parses the current Rava markup only as a fallback", () => {
  const html = `
    <div class="p2-stat"><dt>Anterior</dt><dd>7.095,00</dd></div>
    <div class="p2-ret"><span class="p2-ret-label">Precio</span><span class="p2-ret-val">6.850,00</span></div>
  `
  assert.deepEqual(parseRavaStockQuote(html), { lastPrice: 6_850, previousClose: 7_095 })
  assert.equal(parseRavaStockQuote("<html>sin precio</html>"), null)
})

test("local equity and sovereign bond routes use BYMA Data instead of API Merval", () => {
  const equityRoute = readFileSync("src/app/api/acciones/route.ts", "utf8")
  const detailRoute = readFileSync("src/app/api/acciones/[ticker]/route.ts", "utf8")
  const bondRoute = readFileSync("src/app/api/bonos/route.ts", "utf8")

  for (const route of [equityRoute, detailRoute, bondRoute]) {
    assert.match(route, /fetchBymaQuotes/)
    assert.doesNotMatch(route, /api-merval-production|fetchMerval/)
  }
  assert.match(bondRoute, /currencySuffix:\s*"D"/)
})
