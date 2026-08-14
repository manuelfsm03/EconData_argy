const EXCLUDE_TERMS: string[] = [
  // Deportes
  "mercado de pases", "pase de jugador", "fichaje", "transferencia de jugador",
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
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const EXCLUDE_PATTERNS = EXCLUDE_TERMS.map((term) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, "iu"),
)

export function isExcludedHeadline(title: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(title))
}

export function isRelevantHeadline(title: string, relevantTerms: readonly string[]): boolean {
  const lower = title.toLowerCase()
  if (isExcludedHeadline(lower)) return false
  return relevantTerms.some((term) => lower.includes(term))
}
