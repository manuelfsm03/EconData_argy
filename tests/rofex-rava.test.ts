import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { parseRavaDlrFutures } from "../src/server/domain/rofex-rava"

const routeSource = readFileSync("src/app/api/rofex/route.ts", "utf8")

test("keeps only canonical, live and recent DLR contracts", () => {
  const rows = parseRavaDlrFutures([
    { simbolo: "DLR/AGO26", ultimo: "1511", fecha: "2026-08-10T00:00:00.000Z", preciocompra: "1511", precioventa: "1514" },
    { simbolo: "DLR/SEP26", ultimo: "", fecha: "2026-08-07T00:00:00.000Z", preciocompra: "1539", precioventa: "1540.5" },
    { simbolo: "DLR/AGO26M", ultimo: "1513", fecha: "2026-08-10T00:00:00.000Z", preciocompra: "1510", precioventa: "1513" },
    { simbolo: "DLR/JUL26", ultimo: "1488.5", fecha: "2026-07-31T00:00:00.000Z", preciocompra: "1488", precioventa: "1488.5" },
    { simbolo: "DLR/ABR27", ultimo: "1765", fecha: "2026-07-01T00:00:00.000Z", preciocompra: "1746", precioventa: "1748" },
  ], "2026-08-11", 7)

  assert.deepEqual(rows, [
    {
      symbol: "DLR/AGO26",
      label: "AGO 2026",
      maturity: "2026-08-31",
      price: 1511,
      priceType: "last",
      quoteDate: "2026-08-10",
    },
    {
      symbol: "DLR/SEP26",
      label: "SEP 2026",
      maturity: "2026-09-30",
      price: 1539.75,
      priceType: "bid_ask_mid",
      quoteDate: "2026-08-07",
    },
  ])
})

test("route uses Rava and does not manufacture spot-based metrics", () => {
  assert.match(routeSource, /mercado\.rava\.com\/api\/prices\/arg/)
  assert.match(routeSource, /source: "rava"/)
  assert.match(routeSource, /devaluation: null/)
  assert.match(routeSource, /tna: null/)
  assert.doesNotMatch(routeSource, /apicem\.matbarofex\.com\.ar/)
  assert.doesNotMatch(routeSource, /Math\.min\(\.\.\.prices\)/)
})
