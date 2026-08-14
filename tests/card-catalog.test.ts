import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { CARD_CATEGORIES, DATA_CARD_CATALOG, searchDataCards } from "../src/lib/card-catalog"

const macroUi = readFileSync("src/client/components/dashboard/tab-macro.tsx", "utf8")

test("the data-card registry has unique ids and safe internal endpoints", () => {
  assert.ok(DATA_CARD_CATALOG.length >= 30)
  assert.equal(new Set(DATA_CARD_CATALOG.map((card) => card.id)).size, DATA_CARD_CATALOG.length)

  for (const card of DATA_CARD_CATALOG) {
    assert.ok(card.title.length > 0)
    assert.ok(card.endpoints.length > 0)
    assert.ok(card.defaultW >= card.minW)
    assert.ok(card.defaultH >= card.minH)
    for (const endpoint of card.endpoints) assert.match(endpoint.path, /^\/api\/[a-z0-9-]+(?:\?.*)?$/)
  }
})

test("every category is represented and search covers titles plus keywords", () => {
  for (const category of CARD_CATEGORIES) {
    assert.ok(DATA_CARD_CATALOG.some((card) => card.category === category.id))
  }

  assert.ok(searchDataCards("bitcoin").some((card) => card.id === "cripto"))
  assert.ok(searchDataCards("embi").some((card) => card.id === "riesgo-pais"))
  assert.ok(searchDataCards("reservas", "bcra").every((card) => card.category === "bcra"))
  assert.ok(searchDataCards("titulares").some((card) => card.id === "resumen-noticias"))
  assert.ok(searchDataCards("watchlist").some((card) => card.id === "screener-activos"))
  assert.ok(searchDataCards("treasury").some((card) => card.id === "screener-tasas"))
  assert.equal(DATA_CARD_CATALOG.find((card) => card.id === "resumen-reservas")?.endpoints[0].method, "POST")
})

test("expone bancos como tarjeta BCRA con rango explícito", () => {
  const bancos = DATA_CARD_CATALOG.find((card) => card.id === "bcra-bancos")
  assert.ok(bancos)
  assert.equal(bancos.category, "bcra")
  assert.equal(bancos.subtab, "bancos")
  assert.match(
    bancos.endpoints[0].path,
    /^\/api\/bcra-data\?endpoint=bancos&desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}$/,
  )
})

test("retired macro subtabs fall back safely while workspace cards stay available", () => {
  assert.equal(DATA_CARD_CATALOG.find((card) => card.id === "big-mac")?.subtab, null)
  assert.equal(DATA_CARD_CATALOG.find((card) => card.id === "senoraje")?.subtab, null)
  assert.doesNotMatch(macroUi, /\{ key: "bigmac"/)
  assert.doesNotMatch(macroUi, /\{ key: "senoraje"/)
})

test("EMAE does not duplicate the dedicated population-pyramid view", () => {
  const start = macroUi.indexOf("export function EmaeView")
  const end = macroUi.indexOf("export function IpcView")
  assert.ok(start >= 0 && end > start)

  const emaeUi = macroUi.slice(start, end)
  assert.doesNotMatch(emaeUi, /PIRÁMIDE POBLACIONAL/)
  assert.doesNotMatch(emaeUi, /populationpyramid\.net/)
})
