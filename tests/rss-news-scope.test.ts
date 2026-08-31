import assert from "node:assert/strict"
import test from "node:test"

import {
  dedupeNewsItems,
  isExcludedNewsUrl,
  isFreshNewsDate,
  isRelevantHeadline,
  isRelevantNewsItem,
  matchesAnyWholeTerm,
} from "../src/server/domain/rss-news-policy"

const terms = [
  "economía", "inflación", "mercado", "bonos", "dólar", "oro", "elecciones",
  "inversión", "presidente", "gobierno", "irán", "united nations",
  "war", "china", "trump", "bank",
]

test("positive terms require complete words instead of accidental substrings", () => {
  assert.equal(isRelevantHeadline("Once personas intoxicadas por una nube de gas cloro", terms), false)
  assert.equal(isRelevantHeadline("México clasificó con ambas selecciones al Mundial", terms), false)
  assert.equal(isRelevantHeadline("Forró, Circus and Ciranda this weekend", terms), false)
  assert.equal(isRelevantHeadline("Un detenido en una fiesta ilegal", terms), false)

  assert.equal(isRelevantHeadline("El oro subió y el mercado de bonos operó en alza", terms), true)
  assert.equal(isRelevantHeadline("Irán anunció nuevas sanciones económicas", terms), true)
  assert.equal(isRelevantHeadline("La inflación condiciona a la economía", terms), true)
})

test("real unrelated production headlines are rejected", () => {
  const unrelated = [
    "Un detenido y diversas denuncias por drogas en la fiesta ilegal de La Granja",
    "Detectado un terremoto de magnitud 3,7 con epicentro en Granada",
    "México clasifica a los Cuartos de Final del Mundial de Flag Football 2026",
    "Casi me vuelan: una banda que asaltaba casas y robaba autos",
    "Conmoción: murió un ciclista tras chocar en plena carrera",
    "What's On in Greater Recife This Weekend: Forró, Circus and Ciranda",
    "Woman arrested after second world war memorial in DC vandalized",
  ]

  for (const title of unrelated) {
    assert.equal(isRelevantHeadline(title, terms), false, title)
  }
})

test("generic geography needs an economic, political, or geopolitical co-signal", () => {
  const chinaTerms = [...terms, "market", "government", "policy", "security", "treaty", "xi jinping"]
  const tangentialChinaHeadlines = [
    "China Readies for a Record Number of Humanoids",
    "Alex Wang on What China Gets Right — and Wrong — on the Environment",
    "Geremie Barmé on the ‘Other China’",
  ]

  for (const title of tangentialChinaHeadlines) {
    assert.equal(isRelevantHeadline(title, chinaTerms), false, title)
  }

  assert.equal(isRelevantHeadline("China market rises as trade surplus hits a record", chinaTerms), true)
  assert.equal(isRelevantHeadline("China's government unveils a new industrial policy", chinaTerms), true)
  assert.equal(isRelevantHeadline("China and Russia prepare for war talks", chinaTerms), true)
  assert.equal(isRelevantHeadline("Trump meets Xi Jinping in China", chinaTerms), true)
})

test("Trump alone is not enough to admit unrelated personal or judicial news", () => {
  const nameTerms = [...terms, "policy", "tariff"]
  assert.equal(isRelevantHeadline("Trump loses second Supreme Court bid over a personal case", nameTerms), false)
  assert.equal(isRelevantHeadline("Trump's new tariff policy shakes markets", nameTerms), true)
})

test("source paths reject unrelated verticals before keyword scoring", () => {
  assert.equal(isExcludedNewsUrl("https://www.infobae.com/mexico/deportes/nota"), true)
  assert.equal(isExcludedNewsUrl("https://example.com/sport/football/nota"), true)
  assert.equal(isExcludedNewsUrl("https://www.infobae.com/sociedad/policiales/nota"), true)
  assert.equal(isExcludedNewsUrl("https://www.infobae.com/teleshow/nota"), true)
  assert.equal(isExcludedNewsUrl("not-a-url"), true)

  assert.equal(
    isRelevantNewsItem(
      "Osasuna traspasa un jugador por 600.000 dólares",
      terms,
      "https://www.infobae.com/deportes/osasuna-traspasa-jugador/",
    ),
    false,
  )
  assert.equal(
    isRelevantNewsItem(
      "El dólar y los bonos subieron tras el dato de inflación",
      terms,
      "https://www.infobae.com/economia/mercados/dolar-bonos/",
    ),
    true,
  )
})

test("category terms also require complete words", () => {
  assert.equal(matchesAnyWholeTerm("Denuncias por drogas", ["gas"]), false)
  assert.equal(matchesAnyWholeTerm("Subió el precio del gas", ["gas"]), true)
})

test("duplicate stories are collapsed by normalized title or canonical link", () => {
  const items = [
    { title: "La inflación de Estados Unidos volvió a subir", link: "https://example.com/a?utm_source=rss" },
    { title: "La inflación de Estados Unidos volvió a subir", link: "https://example.com/b" },
    { title: "Otro título", link: "https://example.com/a" },
    { title: "Una noticia distinta", link: "https://example.com/c" },
  ]

  assert.deepEqual(dedupeNewsItems(items), [items[0], items[3]])
})

test("news dates must be valid, recent, and not materially in the future", () => {
  const now = Date.parse("2026-08-14T12:00:00Z")
  assert.equal(isFreshNewsDate("2026-08-14T10:00:00Z", now), true)
  assert.equal(isFreshNewsDate("2026-07-16T12:00:00Z", now), true)
  assert.equal(isFreshNewsDate("2026-07-14T11:59:59Z", now), false)
  assert.equal(isFreshNewsDate("2025-01-01T00:00:00Z", now), false)
  assert.equal(isFreshNewsDate("", now), false)
  assert.equal(isFreshNewsDate("not-a-date", now), false)
  assert.equal(isFreshNewsDate("2026-08-16T12:00:00Z", now), false)
})
