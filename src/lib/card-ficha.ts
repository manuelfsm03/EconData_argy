/**
 * Lógica pura de la ficha de tarjeta (sin React): armar la vista a partir del
 * catálogo + registry, extraer la serie de un payload, juzgar frescura y
 * calcular el foco del trampa de teclado. Vive en `src/lib` para poder testearse
 * con `tsx --test` sin DOM.
 */
import {
  DATA_CARD_BY_ID,
  cardsSharingEndpoint,
  type CardSerieEndpoint,
  type DataCardDefinition,
} from "@/lib/card-catalog"
import { buscarTermino, type GlossaryEntry } from "@/lib/glossary"
import { DATA_CLASS_FRESHNESS, SOURCE_REGISTRY } from "@/server/sources/registry"
import type { DataClass } from "@/server/sources/types"

// ── Vista de la ficha ────────────────────────────────────────────────────────

export interface FichaSource {
  id: string
  displayName: string
  publisher: string
  host: string
  dataClass: DataClass
  fallbackNames: string[]
}

export interface FichaView {
  card: DataCardDefinition
  source: FichaSource | null
  glossary: Array<{ id: string; entry: GlossaryEntry }>
  /** Tarjetas que consumen exactamente el mismo endpoint. */
  comparten: DataCardDefinition[]
  /** Relaciones conceptuales declaradas que no están ya en `comparten`. */
  relacionadas: DataCardDefinition[]
}

export function buildFichaView(cardId: string): FichaView | null {
  const card = DATA_CARD_BY_ID.get(cardId)
  if (!card) return null

  const definition = card.fuenteId ? SOURCE_REGISTRY[card.fuenteId] : null
  const source: FichaSource | null = definition
    ? {
        id: definition.id,
        displayName: definition.displayName,
        publisher: definition.publisher,
        host: definition.allowedHosts[0] ?? "",
        dataClass: definition.dataClass,
        fallbackNames: definition.fallbackSourceIds.flatMap((id) => {
          const fallback = (SOURCE_REGISTRY as Record<string, { displayName: string } | undefined>)[id]
          return fallback ? [fallback.displayName] : []
        }),
      }
    : null

  const glossary = (card.glosario ?? []).flatMap((termId) => {
    const found = buscarTermino(termId)
    return found ? [found] : []
  })

  const comparten = cardsSharingEndpoint(cardId)
  const ya = new Set(comparten.map((item) => item.id))
  const relacionadas = (card.relacionadas ?? []).flatMap((id) => {
    const related = DATA_CARD_BY_ID.get(id)
    return related && related.id !== cardId && !ya.has(related.id) ? [related] : []
  })

  return { card, source, glossary, comparten, relacionadas }
}

// ── Extracción de la serie ───────────────────────────────────────────────────

export interface FichaSeriesLine {
  key: string
  name: string
  color: string
}

export interface FichaSeries {
  rows: Array<Record<string, unknown>>
  lines: FichaSeriesLine[]
  /** Fecha de la última observación con valor (antes de adelgazar la serie). */
  lastDate: string | null
  points: number
}

const FALLBACK_COLORS = ["var(--amber)", "var(--sky)", "var(--positive)", "#CE93D8", "#FFD700", "var(--negative)"]
const MAX_ROWS = 1500

export function getByPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && !Array.isArray(current)) return (current as Record<string, unknown>)[key]
    return undefined
  }, root)
}

function toDateKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!/^\d{4}-\d{2}(-\d{2})?/.test(value)) return null
  return value
}

/** Junta las líneas por fecha, ordena de más vieja a más nueva y adelgaza si hace falta. */
export function extractSeries(payload: unknown, spec: CardSerieEndpoint, maxRows = MAX_ROWS): FichaSeries {
  const byDate = new Map<string, Record<string, unknown>>()
  let lastDate: string | null = null
  const lines: FichaSeriesLine[] = spec.lines.map((line, index) => ({
    key: `l${index}`,
    name: line.name,
    color: line.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }))

  spec.lines.forEach((line, index) => {
    const source = getByPath(payload, line.path)
    if (!Array.isArray(source)) return
    for (const point of source) {
      let date: string | null = null
      let value: unknown
      if (line.shape === "tuples") {
        if (!Array.isArray(point)) continue
        date = toDateKey(point[0])
        value = point[1]
      } else {
        if (!point || typeof point !== "object") continue
        const record = point as Record<string, unknown>
        date = toDateKey(record[line.dateKey ?? "date"])
        value = record[line.valueKey ?? "valor"]
      }
      if (!date || typeof value !== "number" || !Number.isFinite(value)) continue
      const row = byDate.get(date) ?? { date }
      row[`l${index}`] = Number((value * (line.scale ?? 1)).toFixed(4))
      byDate.set(date, row)
      if (!lastDate || date > lastDate) lastDate = date
    }
  })

  const sorted = [...byDate.values()].sort((a, b) => (a.date as string).localeCompare(b.date as string))
  const points = sorted.length
  let rows = sorted
  if (sorted.length > maxRows) {
    const step = Math.ceil(sorted.length / maxRows)
    rows = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1)
  }
  return { rows, lines, lastDate, points }
}

// ── Frescura ─────────────────────────────────────────────────────────────────

export type FichaFreshnessState = "al_dia" | "con_demora" | "vencido" | "sin_dato" | "caida" | "respaldo"

export interface FichaFreshness {
  state: FichaFreshnessState
  label: string
  detail: string
  ageSeconds: number | null
}

function parseObservationDate(value: string): number {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  return Date.parse(/T/.test(normalized) ? normalized : `${normalized}T00:00:00Z`)
}

function humanAge(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  if (days >= 60) return `${Math.round(days / 30)} meses`
  if (days >= 2) return `${days} días`
  const hours = Math.floor(seconds / 3_600)
  return hours >= 1 ? `${hours} h` : "menos de 1 h"
}

/**
 * Frescura de lo que la ficha muestra. Se mide contra la fecha de la última
 * OBSERVACIÓN de la serie (no contra `updated_at`, que muchos endpoints
 * completan con la hora de la consulta y no dice nada del dato). Los umbrales
 * son los del registry: por frecuencia de la serie si la tarjeta la declara,
 * si no los de la fuente.
 */
export function evaluateFreshness(input: {
  lastDate: string | null
  claseDato?: DataClass
  sourceId?: string
  now?: number
  fetchFailed?: boolean
  stalePayload?: boolean
}): FichaFreshness {
  if (input.fetchFailed) {
    return { state: "caida", label: "Fuente sin respuesta", detail: "El endpoint no devolvió datos en esta consulta.", ageSeconds: null }
  }
  if (input.stalePayload) {
    return { state: "respaldo", label: "Datos de respaldo", detail: "El servidor respondió con la última copia guardada: la fuente original no contestó.", ageSeconds: null }
  }
  if (!input.lastDate) {
    return { state: "sin_dato", label: "Sin fecha de dato", detail: "La serie no trae fechas interpretables.", ageSeconds: null }
  }
  const observed = parseObservationDate(input.lastDate)
  if (!Number.isFinite(observed)) {
    return { state: "sin_dato", label: "Sin fecha de dato", detail: "La fecha del último dato no es interpretable.", ageSeconds: null }
  }
  const ageSeconds = Math.max(0, Math.round(((input.now ?? Date.now()) - observed) / 1000))
  const registered = input.sourceId ? (SOURCE_REGISTRY as Record<string, { freshness: { warnAfterSeconds: number | null; rejectAfterSeconds: number | null } } | undefined>)[input.sourceId] : undefined
  const window = input.claseDato ? DATA_CLASS_FRESHNESS[input.claseDato] : registered?.freshness
  const warn = window?.warnAfterSeconds ?? null
  const reject = window?.rejectAfterSeconds ?? null
  const detail = `Último dato: ${input.lastDate} (hace ${humanAge(ageSeconds)}).`
  if (reject !== null && ageSeconds > reject) return { state: "vencido", label: "Dato vencido", detail, ageSeconds }
  if (warn !== null && ageSeconds > warn) return { state: "con_demora", label: "Con demora", detail, ageSeconds }
  return { state: "al_dia", label: "Al día", detail, ageSeconds }
}

// ── Trampa de foco ───────────────────────────────────────────────────────────

/**
 * Dado el índice enfocado dentro de la lista de elementos enfocables del panel,
 * devuelve a cuál mover el foco al apretar Tab / Shift+Tab, o `null` si el
 * navegador puede seguir con su comportamiento normal (el foco no sale del panel).
 * `current === -1` significa "el foco está fuera de la lista" (se lo trae adentro).
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number | null {
  if (count === 0) return null
  if (current === -1) return shift ? count - 1 : 0
  if (!shift && current === count - 1) return 0
  if (shift && current === 0) return count - 1
  return null
}
