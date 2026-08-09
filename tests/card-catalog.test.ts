import assert from "node:assert/strict"
import test from "node:test"
import { CARD_CATEGORIES, DATA_CARD_CATALOG, searchDataCards } from "../src/lib/card-catalog"

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
