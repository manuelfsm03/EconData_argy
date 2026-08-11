import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  parseRavaBondPrices,
  parseRavaRosarioPrices,
} from "../src/server/external/rava-prices"

const agroRoute = readFileSync("src/app/api/agro-local/route.ts", "utf8")
const bondRoute = readFileSync("src/app/api/bonos/route.ts", "utf8")

test("parses only exact Rosario grain rows and keeps unavailable sunflower null", () => {
  const parsed = parseRavaRosarioPrices({
    datos: [
      { especie: "SOJA", ultimo: "1180.0" },
      { especie: "SOJA ROSARIO", ultimo: "339.0" },
      { especie: "MAIZ ROSARIO", ultimo: "183.0" },
      { especie: "TRIGO ROSARIO", ultimo: "216.0" },
      { especie: "SOJA ROSARIO FUT", ultimo: "345.0" },
    ],
  })

  assert.deepEqual(parsed, { soja: 339, maiz: 183, trigo: 216, girasol: null })
})

test("rejects malformed, non-positive, and non-finite grain values", () => {
  assert.deepEqual(
    parseRavaRosarioPrices({
      datos: [
        { especie: "SOJA ROSARIO", ultimo: "0" },
        { especie: "MAIZ ROSARIO", ultimo: "NaN" },
        { especie: "TRIGO ROSARIO", ultimo: "-20" },
      ],
    }),
    { soja: null, maiz: null, trigo: null, girasol: null },
  )
  assert.deepEqual(parseRavaRosarioPrices(null), {
    soja: null,
    maiz: null,
    trigo: null,
    girasol: null,
  })
})

test("parses ARS and D bond species into one validated map", () => {
  const prices = parseRavaBondPrices({
    datos: [
      { especie: "GD30", precio: "88700", tir: "0.060654" },
      { especie: "GD30D", precio: "58", tir: "0.062169" },
      { especie: "BROKEN", precio: "-1", tir: "nope" },
      { especie: "", precio: "12" },
    ],
  })

  assert.deepEqual(prices.get("GD30"), { precio: 88700, tir: 6.0654 })
  assert.deepEqual(prices.get("GD30D"), { precio: 58, tir: 6.2169 })
  assert.equal(prices.has("BROKEN"), false)
  assert.equal(prices.has(""), false)
})

test("routes use Rava JSON endpoints and never the retired HTML sources", () => {
  assert.match(agroRoute, /mercado\.rava\.com\/api\/prices\/indices/)
  assert.doesNotMatch(agroRoute, /bcr\.com\.ar\/es\/mercados/)
  assert.match(bondRoute, /mercado\.rava\.com\/api\/prices\/bonos/)
  assert.doesNotMatch(bondRoute, /www\.rava\.com\/perfil/)
})
