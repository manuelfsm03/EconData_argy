const EXCLUDE_TERMS: string[] = [
  // Deportes
  "mercado de pases", "pase de jugador", "fichaje", "transferencia de jugador",
  "traspaso de", "traspasa a", "flag football",
  "banco de suplentes", "línea de ataque", "linea de ataque", "campo de juego",
  "título mundial", "titulo mundial", "título de boxeo", "titulo de boxeo",
  "gol de", "goles de", "partido de fútbol", "partido de futbol",
  "boca juniors", "river plate", "selección argentina", "seleccion argentina",
  "copa libertadores", "copa américa", "copa america", "champions league",
  "mundial de fútbol", "mundial de futbol", "liga profesional",
  "futbolista", "jugador de fútbol", "jugador de futbol", "entrenador de",
  "básquet", "basquet", "tenis", "fórmula 1", "formula 1", "moto gp",
  "tarjeta roja", "tarjeta amarilla", "árbitro", "arbitro",
  // Espectáculos
  "famoso", "famosa", "celebridad", "novela", "actor de", "actriz de",
  "cantante", "reality show", "gran hermano", "escándalo mediático",
  "escandalo mediatico", "influencer",
  // Policiales no económicos
  "femicidio", "homicidio", "asesinato", "robo a mano armada",
  "secuestro extorsivo", "violencia de género", "violencia de genero",
  "fiesta ilegal", "denuncias por drogas", "banda que asaltaba", "robaba autos",
  // Accidentes, catástrofes y agenda general sin vínculo económico
  "terremoto", "epicentro", "accidente vial", "accidentes viales",
  "murió un ciclista", "murio un ciclista", "intoxicadas por una nube",
  // Ocio y estilo de vida
  "qué hay este fin de semana", "que hay este fin de semana",
  "what's on", "what’s on", "forró", "forro, circus", "ciranda",
  "ballroom project", "vandalism of", "vandalized", "vandalised", "strikes gold",
]

const EXCLUDED_URL_PARTS = [
  "/deportes/", "/sport/", "/sports/", "/sociedad/policiales/", "/policiales/",
  "/teleshow/", "/entretenimiento/", "/entertainment/", "/famosos/",
  "/tendencias/", "/virales/", "/mascotas/",
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const EXCLUDE_PATTERNS = EXCLUDE_TERMS.map((term) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, "iu"),
)

// A country name alone is too broad for the economics/politics feed. Keep it as
// a discovery term, but require an explicit news-domain signal when it is the
// only reason a headline matched. This prevents source-specific lifestyle and
// culture stories from leaking in through a generic geography keyword.
const GENERIC_GEOGRAPHY_TERMS = ["china"]

// Same problem, different shape, but scoped to what production evidence actually
// shows: "trump" is in RELEVANT_TERMS so real policy/government stories match,
// but his name alone also lets through anything mentioning him — personal legal
// cases, approval-rating trivia — with zero economic, political-governance, or
// social substance (verified against live feed output). Other heads-of-state in
// RELEVANT_TERMS (milei, putin, xi jinping, etc.) don't show this failure mode in
// practice — e.g. "Trump meets Xi Jinping in China" is itself a real diplomatic
// story — so they're deliberately left out to avoid dropping legitimate coverage
// without evidence they need the same treatment.
const GENERIC_NAME_TERMS = ["trump"]

const GENERIC_ALONE_TERMS = [...GENERIC_GEOGRAPHY_TERMS, ...GENERIC_NAME_TERMS]

const RELEVANT_PATTERN_CACHE = new WeakMap<object, RegExp[]>()

function relevantPatterns(relevantTerms: readonly string[]): RegExp[] {
  const cached = RELEVANT_PATTERN_CACHE.get(relevantTerms)
  if (cached) return cached

  const patterns = relevantTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`,
      "iu",
    ))
  RELEVANT_PATTERN_CACHE.set(relevantTerms, patterns)
  return patterns
}

export function isExcludedHeadline(title: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(title))
}

export function isRelevantHeadline(title: string, relevantTerms: readonly string[]): boolean {
  if (isExcludedHeadline(title)) return false
  if (!matchesAnyWholeTerm(title, relevantTerms)) return false

  if (!matchesAnyWholeTerm(title, GENERIC_ALONE_TERMS)) return true

  const substantiveTerms = relevantTerms.filter((term) =>
    !GENERIC_ALONE_TERMS.includes(term.trim().toLocaleLowerCase()),
  )
  return matchesAnyWholeTerm(title, substantiveTerms)
}

export function matchesAnyWholeTerm(text: string, terms: readonly string[]): boolean {
  return relevantPatterns(terms).some((pattern) => pattern.test(text))
}

export function isExcludedNewsUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return EXCLUDED_URL_PARTS.some((part) => path.includes(part))
  } catch {
    return true
  }
}

export function isRelevantNewsItem(
  title: string,
  relevantTerms: readonly string[],
  url: string,
): boolean {
  return !isExcludedNewsUrl(url) && isRelevantHeadline(title, relevantTerms)
}

function normalizedTitle(title: string): string {
  return title
    .toLocaleLowerCase()
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizedLink(link: string): string {
  try {
    const url = new URL(link)
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "output") url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return link.trim()
  }
}

export function dedupeNewsItems<T extends { title: string; link: string }>(items: readonly T[]): T[] {
  const seenTitles = new Set<string>()
  const seenLinks = new Set<string>()

  return items.filter((item) => {
    const title = normalizedTitle(item.title)
    const link = normalizedLink(item.link)
    if (seenTitles.has(title) || seenLinks.has(link)) return false
    seenTitles.add(title)
    seenLinks.add(link)
    return true
  })
}

export const NEWS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const NEWS_MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000

export function isFreshNewsDate(
  pubDate: string,
  nowMs = Date.now(),
  maxAgeMs = NEWS_MAX_AGE_MS,
): boolean {
  const publishedMs = Date.parse(pubDate)
  if (!Number.isFinite(publishedMs)) return false
  return publishedMs >= nowMs - maxAgeMs && publishedMs <= nowMs + NEWS_MAX_FUTURE_SKEW_MS
}
