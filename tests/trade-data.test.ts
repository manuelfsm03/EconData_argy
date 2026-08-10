import assert from "node:assert/strict"
import test from "node:test"
import {
  MACRO_TRADE_SERIES_IDS,
  PARTNER_EXPORT_SERIES,
  parsePartnerExportPayload,
  tradeBalanceMatches,
} from "../src/lib/trade-data"

test("macro uses total imports instead of the residual-imports series", () => {
  assert.equal(MACRO_TRADE_SERIES_IDS.importaciones, "74.3_IIT_0_M_25")
  assert.notEqual(MACRO_TRADE_SERIES_IDS.importaciones, "74.3_IIR_0_M_23")
  assert.equal(tradeBalanceMatches(9054.98573695, 6861.13752743, 2193.8482095200006), true)
  assert.equal(tradeBalanceMatches(9054.98573695, 131.3873007, 2193.8482095200006), false)
})

test("partner exports preserve series order and never synthesize imports", () => {
  const row = ["2024-01-01", ...PARTNER_EXPORT_SERIES.map((_, index) => 1000 + index)]
  const parsed = parsePartnerExportPayload({ data: [row] })

  assert.equal(parsed.year, "2024")
  assert.equal(parsed.liveCount, PARTNER_EXPORT_SERIES.length)
  assert.equal(parsed.partners[0].nombre, "Brasil")
  assert.equal(parsed.partners[0].expo, 1000)
  assert.equal(parsed.partners.at(-1)?.nombre, "Italia")
  assert.equal(parsed.partners.at(-1)?.expo, 1009)
  assert.ok(parsed.partners.every((partner) => partner.impo === null && partner.saldo === null))
})

test("partial upstream responses stay partial instead of mixing live and fallback values", () => {
  const parsed = parsePartnerExportPayload({ data: [["2024-01-01", 13608.46, null]] })
  assert.equal(parsed.liveCount, 1)
  assert.equal(parsed.partners[0].expo, 13608.46)
  assert.equal(parsed.partners[1].expo, null)
})
