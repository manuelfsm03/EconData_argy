import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { parseRavaDlrFutures } from "../src/server/domain/rofex-rava"

const routeSource = readFileSync("src/app/api/rofex/route.ts", "utf8")

test("keeps only canonical, live and recent DLR contracts (sin spot → métricas null)", () => {
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
      devaluation: null,
      monthlyDevaluation: null,
      tna: null,
    },
    {
      symbol: "DLR/SEP26",
      label: "SEP 2026",
      maturity: "2026-09-30",
      price: 1539.75,
      priceType: "bid_ask_mid",
      quoteDate: "2026-08-07",
      devaluation: null,
      monthlyDevaluation: null,
      tna: null,
    },
  ])
})

test("reads 'especie' (endpoint /rofex) and uses the real 'vencimiento'", () => {
  const rows = parseRavaDlrFutures([
    { especie: "DLR/SEP26", ultimo: "1575", fecha: "2026-08-11T00:00:00.000Z", vencimiento: "2026-09-30T00:00:00.000Z" },
  ], "2026-08-11", 7)

  assert.equal(rows.length, 1)
  assert.equal(rows[0].symbol, "DLR/SEP26")
  assert.equal(rows[0].maturity, "2026-09-30")
  assert.equal(rows[0].price, 1575)
})

test("computes implied devaluation, TNA and TEM against DLR/SPOT", () => {
  const rows = parseRavaDlrFutures([
    { especie: "DLR/SPOT", ultimo: "1500", fecha: "2026-08-11T00:00:00.000Z" },
    { especie: "DLR/SEP26", ultimo: "1575", fecha: "2026-08-11T00:00:00.000Z", vencimiento: "2026-09-30T00:00:00.000Z" },
  ], "2026-08-11", 7)

  assert.equal(rows.length, 1)
  const f = rows[0]
  // 1575 / 1500 = 1.05 → 5.00% acumulado
  assert.equal(f.devaluation, 5)
  // Anualizada y mensualizada: positivas; la TNA (anual) supera la acumulada a <1 año
  assert.ok(f.tna !== null && f.tna > 5, `tna esperada > 5, fue ${f.tna}`)
  assert.ok(f.monthlyDevaluation !== null && f.monthlyDevaluation > 0 && f.monthlyDevaluation < 5,
    `TEM esperada entre 0 y 5, fue ${f.monthlyDevaluation}`)
})

test("route uses Rava /rofex and computes spot-based metrics from the feed", () => {
  assert.match(routeSource, /mercado\.rava\.com\/api\/prices\/rofex/)
  assert.match(routeSource, /source: "rava"/)
  assert.match(routeSource, /devaluation: future\.devaluation/)
  assert.match(routeSource, /tna: future\.tna/)
  assert.doesNotMatch(routeSource, /apicem\.matbarofex\.com\.ar/)
  assert.doesNotMatch(routeSource, /Math\.min\(\.\.\.prices\)/)
})
