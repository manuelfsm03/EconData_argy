import assert from "node:assert/strict"
import test from "node:test"

import { DATA_CARD_CATALOG } from "../src/lib/card-catalog"
import { cbotUsdTon } from "../src/lib/agro"
import { parseRavaRosarioPrices } from "../src/server/external/rava-prices"

 test("Agro is available to the catalog and canvas through the canonical card registry", () => {
  const agro = DATA_CARD_CATALOG.find((card) => card.id === "agro")
  assert.ok(agro)
  assert.equal(agro.tab, "macro")
  assert.equal(agro.subtab, "agro")
  assert.ok(agro.endpoints.some((endpoint) => endpoint.path === "/api/agro-local"))
})

test("CBOT US cents per bushel convert explicitly to USD per tonne", () => {
  assert.equal(cbotUsdTon(1000, "ZS=F"), 367.44)
  assert.equal(cbotUsdTon(1000, "ZC=F"), 393.68)
  assert.equal(cbotUsdTon(null, "ZS=F"), null)
  assert.equal(cbotUsdTon(1000, "ZL=F"), null)
  assert.equal(cbotUsdTon(Number.NaN, "ZS=F"), null)
  assert.equal(cbotUsdTon(Number.POSITIVE_INFINITY, "ZS=F"), null)
  assert.equal(cbotUsdTon(1000, ""), null)
})

test("Rava parser keeps only finite positive Rosario quotes", () => {
  const parsed = parseRavaRosarioPrices({
    datos: [
      { especie: "Soja Rosario", ultimo: "351.25" },
      { especie: "MAIZ ROSARIO", ultimo: 192 },
      { especie: "TRIGO ROSARIO", ultimo: "not-a-number" },
      { especie: "TRIGO ROSARIO", ultimo: -1 },
      { especie: "Girasol Rosario", ultimo: 300 },
      { especie: "SOJA ROSARIO", ultimo: Number.POSITIVE_INFINITY },
      null,
      "malformed",
    ],
  })
  assert.deepEqual(parsed, { soja: 351.25, maiz: 192, trigo: null, girasol: null })
})

test("Rava parser fails closed for missing or malformed payloads", () => {
  assert.deepEqual(parseRavaRosarioPrices(null), { soja: null, maiz: null, trigo: null, girasol: null })
  assert.deepEqual(parseRavaRosarioPrices({ datos: [] }), { soja: null, maiz: null, trigo: null, girasol: null })
  assert.deepEqual(parseRavaRosarioPrices({ datos: [{ especie: "Soja Rosario", ultimo: 0 }] }), { soja: null, maiz: null, trigo: null, girasol: null })
})

test("unsupported Rosario grains remain explicitly unavailable", () => {
  const parsed = parseRavaRosarioPrices({ datos: [{ especie: "Girasol Rosario", ultimo: 300 }] })
  assert.equal(parsed.girasol, null)
})
