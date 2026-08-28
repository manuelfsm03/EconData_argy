import assert from "node:assert/strict"
import test from "node:test"

import { normalizar, tokenizar, rankNewsByRelevance, type NewsDoc } from "../src/server/domain/news-search"

const docs: NewsDoc[] = [
  { id: "1", title: "El dólar blue subió y el BCRA vendió reservas", description: "Tensión cambiaria en el mercado", source: "Ámbito", pubDate: "2026-08-28T10:00:00Z", link: "http://a" },
  { id: "2", title: "Inflación de julio: el IPC marcó 2,1%", description: "El dato del INDEC sobre precios", source: "INDEC", pubDate: "2026-08-27T10:00:00Z", link: "http://b" },
  { id: "3", title: "Racing ganó el clásico", description: "Deporte, nada de economía", source: "Olé", pubDate: "2026-08-28T09:00:00Z", link: "http://c" },
  { id: "4", title: "El dólar oficial y el dólar CCL", description: "Brecha cambiaria y dólar en todos lados", source: "Cronista", pubDate: "2026-08-28T11:00:00Z", link: "http://d" },
]

test("normalizar quita acentos y baja a minúsculas", () => {
  assert.equal(normalizar("Inflación"), "inflacion")
  assert.equal(normalizar("DÓLAR"), "dolar")
})

test("tokenizar descarta stopwords y tokens cortos", () => {
  assert.deepEqual(tokenizar("el dólar y la inflación"), ["dolar", "inflacion"])
})

test("rankea por relevancia y solo devuelve los que matchean", () => {
  const res = rankNewsByRelevance(docs, "dólar")
  const ids = res.map((r) => r.id)
  assert.ok(ids.includes("1") && ids.includes("4"), "docs de dólar presentes")
  assert.ok(!ids.includes("3"), "la noticia de deporte no matchea")
  // El doc 4 menciona 'dolar' tres veces → mayor score que el doc 1
  assert.equal(res[0].id, "4", `esperaba doc 4 primero, fue ${res[0].id}`)
})

test("es insensible a acentos en la consulta", () => {
  const conAcento = rankNewsByRelevance(docs, "inflación")
  const sinAcento = rankNewsByRelevance(docs, "inflacion")
  assert.equal(conAcento.length, 1)
  assert.equal(sinAcento.length, 1)
  assert.equal(conAcento[0].id, "2")
  assert.deepEqual(conAcento[0].matched, ["inflacion"])
})

test("consulta vacía o sin corpus → []", () => {
  assert.deepEqual(rankNewsByRelevance(docs, "   "), [])
  assert.deepEqual(rankNewsByRelevance([], "dólar"), [])
})

test("respeta el límite de resultados", () => {
  const res = rankNewsByRelevance(docs, "dólar inflación", 1)
  assert.equal(res.length, 1)
})
