import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { PESO_BOND_TICKERS } from "../src/server/domain/peso-bonds"

const bondRoute = readFileSync("src/app/api/bonos/route.ts", "utf8")

test("peso bond ticker list has no duplicates and is all uppercase", () => {
  const unique = new Set(PESO_BOND_TICKERS)
  assert.equal(unique.size, PESO_BOND_TICKERS.length)
  for (const ticker of PESO_BOND_TICKERS) {
    assert.equal(ticker, ticker.toUpperCase())
    assert.ok(ticker.length > 0)
  }
})

test("peso bond ticker list includes the CER/DUAL/LECER families and excludes provincial debt", () => {
  assert.ok(PESO_BOND_TICKERS.includes("TXMJ0"))
  assert.ok(PESO_BOND_TICKERS.includes("TX26"))
  assert.ok(PESO_BOND_TICKERS.includes("TZX26"))
  assert.ok(PESO_BOND_TICKERS.includes("X15Y6"))
  assert.ok(PESO_BOND_TICKERS.includes("DICP"))

  const provincial = ["CO3D7", "COD7", "PBA28", "PMA28"]
  for (const ticker of provincial) {
    assert.equal(PESO_BOND_TICKERS.includes(ticker as (typeof PESO_BOND_TICKERS)[number]), false)
  }
})

test("?tipo=pesos reuses the existing Rava bonds endpoint, no new external source", () => {
  assert.match(bondRoute, /tipoParam === "pesos"/)
  assert.match(bondRoute, /PESO_BOND_TICKERS\.map/)
  // El branch de pesos tiene que resolver contra el mismo fetch cacheado que ya usan
  // los bonos hard-dollar, no pegarle a un dominio nuevo.
  const pesosBranch = bondRoute.slice(
    bondRoute.indexOf('tipoParam === "pesos"'),
    bondRoute.indexOf('tipoParam === "lecap"'),
  )
  assert.match(pesosBranch, /fetchRavaBondPrices\(\)/)
  assert.doesNotMatch(pesosBranch, /https?:\/\//)
})
