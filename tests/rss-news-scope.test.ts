import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  dedupeNewsItems,
  isExcludedNewsUrl,
  isFreshNewsDate,
  isRelevantHeadline,
  isRelevantNewsItem,
  matchesAnyWholeTerm,
} from "../src/server/domain/rss-news-policy"

const rssRoute = readFileSync("src/app/api/rss-news/route.ts", "utf8")
const newsFeed = readFileSync("src/client/components/dashboard/news-feed.tsx", "utf8")

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

test("'trump' alone needs an economic, political, or social co-signal, unlike other head-of-state names", () => {
  const nameTerms = [...terms, "milei", "policy", "tariff"]

  // Producción real: pasaba el filtro sólo porque "trump" matcheaba, sin
  // ningún contenido económico/político-gubernamental/social genuino.
  assert.equal(
    isRelevantHeadline("Trump loses second Supreme Court bid over E Jean Carroll sex abuse case", nameTerms),
    false,
  )
  assert.equal(isRelevantHeadline("Trump's approval rating sinks to new low", nameTerms), false)

  // Con señal sustantiva adicional, sigue pasando.
  assert.equal(isRelevantHeadline("Trump's new tariff policy shakes markets", nameTerms), true)

  // Otras figuras de gobierno no quedan sujetas a la misma restricción: no hay
  // evidencia productiva de que necesiten el co-signal, y exigirlo tira noticias
  // legítimas (ver el caso "Xi Jinping" del test de geografía genérica).
  assert.equal(isRelevantHeadline("Milei fue a comer a un restaurante con amigos", nameTerms), true)
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

test("the 'bid' acronym (BID, Banco Interamericano de Desarrollo) is not a relevant term", () => {
  // Colisiona con la palabra inglesa común "bid" y le daba señal sustantiva
  // falsa a notas sin relación económica — verificado en producción con este
  // titular exacto, que pasaba el filtro sólo por "bid" + "trump".
  const termsBlock = rssRoute.slice(
    rssRoute.indexOf("const RELEVANT_TERMS"),
    rssRoute.indexOf("const RELEVANT_SET"),
  )
  const quotedTerms = [...termsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase())
  assert.equal(quotedTerms.includes("bid"), false)

  assert.equal(
    isRelevantHeadline(
      "Trump loses second Supreme Court bid over E Jean Carroll sex abuse case",
      quotedTerms,
    ),
    false,
  )
})

test("corporate profit/earnings/layoff news is relevant even without a numeric budget term", () => {
  const termsBlock = rssRoute.slice(
    rssRoute.indexOf("const RELEVANT_TERMS"),
    rssRoute.indexOf("const RELEVANT_SET"),
  )
  const quotedTerms = [...termsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase())

  // Caso real de producción: sólo matcheaba "china" (geografía genérica, no
  // alcanza sola), así que una nota claramente económica quedaba afuera.
  assert.equal(
    isRelevantHeadline("Volkswagen profits down as competition from China heats up", quotedTerms),
    true,
  )
  assert.equal(
    isRelevantHeadline("Germany's BioNTech announces layoffs as vaccine sales drop", quotedTerms),
    true,
  )
  assert.equal(isRelevantHeadline("Local bakery wins best croissant award", quotedTerms), false)
})

test("germany's dead DW feed is replaced by two working, verified-live sources", () => {
  // rss-es-eco devolvía "Error: no feed by that name." en vivo (verificado);
  // por eso Alemania no traía ninguna nota. No repetir esta URL.
  assert.doesNotMatch(rssRoute, /rss-es-eco/)

  const germanyBlock = rssRoute.slice(rssRoute.indexOf('country: "alemania"') - 200, rssRoute.indexOf("Medio Oriente"))
  const germanyFeeds = [...germanyBlock.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1])
  assert.equal(germanyFeeds.length, 2)
  for (const url of germanyFeeds) {
    // Ambas nuevas fuentes son en inglés — RELEVANT_TERMS no tiene términos en
    // alemán, así que una fuente en "de" quedaría filtrada al 100% en silencio.
    assert.doesNotMatch(url, /rss-es-eco/)
  }
})

test("'trump' is not a category keyword for comercio (miscategorized military/legal news)", () => {
  const categoryBlock = rssRoute.slice(
    rssRoute.indexOf("CATEGORY_KEYWORDS"),
    rssRoute.indexOf("isNonLatinScript"),
  )
  const comercioBlock = categoryBlock.slice(
    categoryBlock.indexOf("comercio:"),
    categoryBlock.indexOf("energía:"),
  )
  assert.doesNotMatch(comercioBlock, /"trump"/)
})

test("a 'social' section exists end to end: relevant terms, category bucket, and UI filter", () => {
  const socialTerms = ["huelga", "educación", "salud pública", "vivienda", "jubilados", "sindicatos", "migrantes"]
  for (const term of socialTerms) {
    assert.match(rssRoute, new RegExp(`"${term}"`), `RELEVANT_TERMS should include "${term}"`)
  }

  const categoryBlock = rssRoute.slice(
    rssRoute.indexOf("CATEGORY_KEYWORDS"),
    rssRoute.indexOf("isNonLatinScript"),
  )
  assert.match(categoryBlock, /social:\s*\[/)
  assert.match(categoryBlock, /"huelga"/)
  assert.match(categoryBlock, /"jubilados"/)

  assert.match(newsFeed, /key:\s*"social",\s*label:\s*"Social"/)
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
