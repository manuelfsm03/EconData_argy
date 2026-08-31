import type { DataCardDefinition } from "@/lib/card-catalog"
import { DATA_CARD_CATALOG } from "@/lib/card-catalog"
import type { SourceId } from "@/server/sources/registry"

export type NumericFreshness = "fresh" | "stale" | "expired" | "unavailable"
export type NumericStatus = "available" | "estimated" | "unavailable"

/**
 * Provenance attached to one numeric value (or to the honest unavailable label
 * rendered in its place). A number is never valid without all of this context.
 */
export type NumericProvenance = {
  source: SourceId | "unavailable"
  unit: string
  transform: string
  asOf: string | null
  retrievedAt: string | null
  freshness: NumericFreshness
  estimate: boolean
  status: NumericStatus
}

export type NumericRecord = NumericProvenance & {
  value: number | null
}

export type NumericSurfaceManifestEntry = NumericProvenance & {
  id: string
  cardId: string
  endpoint: string
  field: string
  label: string
  /** Stable key consumed by the runtime card renderer. */
  rendererId: string
}

const unavailable = (id: string, cardId: string, endpoint: string, field: string, label: string): NumericSurfaceManifestEntry => ({
  id,
  cardId,
  endpoint,
  field,
  label,
  rendererId: cardId,
  source: "unavailable",
  unit: "not available",
  transform: "not rendered until the endpoint supplies provenance",
  asOf: null,
  retrievedAt: null,
  freshness: "unavailable",
  estimate: false,
  status: "unavailable",
})

/**
 * The frozen inventory of numeric surfaces. This is deliberately a contract,
 * not a cache of plausible values: until an endpoint supplies source metadata,
 * a fixture is unavailable and the renderer must not invent a number.
 */
export const NUMERIC_SURFACE_MANIFEST: readonly NumericSurfaceManifestEntry[] = [
  unavailable("resumen-tipo-cambio", "resumen-tipo-cambio", "/api/tc-historico?period=1m", "data.series[*].value", "Tipo de cambio"),
  unavailable("resumen-ipc", "resumen-ipc", "/api/macro?endpoint=ipc", "data.ipc.latest", "IPC"),
  unavailable("resumen-riesgo", "resumen-riesgo", "/api/riesgo-pais", "data.embi.valor", "Riesgo país"),
  unavailable("resumen-reservas", "resumen-reservas", "/api/bcra-data", "data.series.reservas[*].value", "Reservas, TAMAR y BADLAR"),
  unavailable("resumen-noticias", "resumen-noticias", "/api/rss-news", "data.items[*].publishedAt", "Noticias"),
  unavailable("acciones", "acciones", "/api/acciones?category=all", "data.byCategory[*][*].lastPrice", "Acciones"),
  unavailable("bonos", "bonos", "/api/bonos", "data[*].precio", "Bonos"),
  unavailable("renta-fija-avanzada", "renta-fija-avanzada", "/api/bonos", "data[*].precio", "Bonos"),
  unavailable("rofex", "rofex", "/api/rofex", "data[*].precio", "ROFEX"),
  unavailable("plazo-fijo-mercado", "plazo-fijo-mercado", "/api/bcra?endpoint=plazofijo", "data[*].tasa", "BCRA plazo fijo"),
  unavailable("commodities", "commodities", "/api/mundo", "data[*].precio", "Mercados globales"),
  unavailable("mercados-mundo", "mercados-mundo", "/api/mundo", "data[*].precio", "Mercados globales"),
  unavailable("cripto", "cripto", "/api/cripto", "data.market_cap_usd", "Cripto"),
  unavailable("screener-activos", "screener-activos", "/api/acciones?category=all", "data.byCategory[*][*].lastPrice", "Acciones"),
  unavailable("emae", "emae", "/api/macro?endpoint=emae", "data[*].valor", "EMAE"),
  unavailable("ipc", "ipc", "/api/macro?endpoint=ipc", "data[*].valor", "IPC"),
  unavailable("balanza", "balanza", "/api/macro?endpoint=balanza", "data[*].saldo", "Balanza"),
  unavailable("desigualdad", "desigualdad", "/api/macro?endpoint=argendata_desigualdad", "data.gini_arg[*][1]", "Desigualdad"),
  unavailable("piramides", "piramides", "/api/macro?endpoint=piramide&year=2025&country=32", "data.total", "Demografía"),
  unavailable("fx", "fx", "/api/tc-historico?period=max", "data.series[*].value", "Dólares"),
  unavailable("big-mac", "big-mac", "/api/big-mac", "data[*].implied_rate", "Big Mac"),
  unavailable("riesgo-pais", "riesgo-pais", "/api/riesgo-pais", "data.embi.valor", "Riesgo país"),
  unavailable("deuda-publica", "deuda-publica", "/api/deuda?n=6", "data[*].saldo", "Deuda"),
  unavailable("senoraje", "senoraje", "/api/senoraje", "data.seigniorage", "Señoreaje"),
  unavailable("bcra-plazo-fijo", "bcra-plazo-fijo", "/api/bcra?endpoint=plazofijo", "data[*].tasa", "Plazo fijo"),
  unavailable("bcra-tasas", "bcra-tasas", "/api/bcra?endpoint=tasas", "data[*].tasa", "Tasas"),
  unavailable("bcra-agregados", "bcra-agregados", "/api/bcra?endpoint=agregados", "data[*].valor", "Agregados"),
  unavailable("bcra-reservas", "bcra-reservas", "/api/bcra?endpoint=reservas&historico=true", "data[*].valor", "Reservas"),
  unavailable("bcra-bancos", "bcra-bancos", "/api/bcra-data?endpoint=bancos&desde=2021-01-01&hasta=2030-12-31", "data.familias[*].variables[*].valor", "Balance de bancos"),
  unavailable("bcra-compras", "bcra-compras", "/api/bcra?endpoint=compras", "data[*].compras", "Compras y ventas"),
  unavailable("rem", "rem", "/api/rem", "data[*].valor", "REM"),
  unavailable("noticias", "noticias", "/api/rss-news", "data.items[*].publishedAt", "RSS"),
] as const

export const NUMERIC_SURFACE_BY_ID = new Map(NUMERIC_SURFACE_MANIFEST.map((entry) => [entry.id, entry]))

function isIsoDate(value: string | null): boolean {
  return value != null && Number.isFinite(Date.parse(value))
}

export function validateNumericProvenance(provenance: NumericProvenance, now = new Date()): string[] {
  const errors: string[] = []
  const unavailable = provenance.status === "unavailable"

  if (provenance.source === "unavailable" && !unavailable) errors.push("NUMERIC_SOURCE_MISSING")
  if (provenance.source !== "unavailable" && provenance.source.trim() === "") errors.push("NUMERIC_SOURCE_MISSING")
  if (provenance.unit.trim() === "") errors.push("NUMERIC_UNIT_MISSING")
  if (provenance.transform.trim() === "") errors.push("NUMERIC_TRANSFORM_MISSING")
  if (!unavailable && !isIsoDate(provenance.asOf)) errors.push("NUMERIC_AS_OF_MISSING")
  if (!unavailable && !isIsoDate(provenance.retrievedAt)) errors.push("NUMERIC_RETRIEVED_AT_MISSING")
  if (!unavailable && (provenance.freshness === "stale" || provenance.freshness === "expired" || provenance.freshness === "unavailable")) {
    errors.push("NUMERIC_DATA_STALE")
  }
  if (provenance.status === "estimated" && !provenance.estimate) errors.push("NUMERIC_ESTIMATE_FLAG_MISSING")
  if (provenance.status === "available" && provenance.estimate) errors.push("NUMERIC_ESTIMATE_STATUS_MISMATCH")
  if (provenance.freshness === "fresh" && isIsoDate(provenance.asOf) && Date.parse(provenance.asOf!) > now.getTime()) {
    errors.push("NUMERIC_AS_OF_IN_FUTURE")
  }
  return errors
}

/** Runtime invariant for values crossing an API/UI boundary. */
export function validateNumericRecord(record: NumericRecord, now = new Date()): string[] {
  const errors = validateNumericProvenance(record, now)
  if (record.status === "available" && record.value === null) errors.push("NUMERIC_AVAILABLE_NULL")
  const unavailableRecord = record.status === "unavailable" || record.value === null

  if (!unavailableRecord && (typeof record.value !== "number" || !Number.isFinite(record.value))) {
    errors.push("NUMERIC_VALUE_NONFINITE")
  }
  if (record.status === "unavailable" && record.value !== null) errors.push("NUMERIC_UNAVAILABLE_HAS_VALUE")
  return errors
}

export function assertNumericRecord(record: NumericRecord, now = new Date()): NumericRecord {
  const errors = validateNumericRecord(record, now)
  if (errors.length > 0) throw new Error(errors.join(","))
  return record
}

export function unavailableNumeric(reason: string): NumericRecord & { label: "unavailable" } {
  return {
    value: null,
    source: "unavailable",
    unit: "not available",
    transform: reason,
    asOf: null,
    retrievedAt: null,
    freshness: "unavailable",
    estimate: false,
    status: "unavailable",
    label: "unavailable",
  }
}

export function manifestCoverage(catalog: readonly DataCardDefinition[] = DATA_CARD_CATALOG) {
  const ids = new Set(catalog.map((card) => card.id))
  const covered = NUMERIC_SURFACE_MANIFEST.filter((entry) => ids.has(entry.cardId))
  return {
    catalogCards: ids.size,
    manifestEntries: NUMERIC_SURFACE_MANIFEST.length,
    coveredCards: new Set(covered.map((entry) => entry.cardId)).size,
    uncoveredCardIds: catalog.filter((card) => !NUMERIC_SURFACE_BY_ID.has(card.id)).map((card) => card.id),
  }
}

export type NumericRuntimeBinding = NumericSurfaceManifestEntry & { method: "GET" }

/**
 * Runtime bindings are separate from catalog coverage. A binding names the
 * route and renderer boundary that must prove provenance at runtime; it does
 * not turn the static `unavailable` inventory into verified data.
 */
export const NUMERIC_RUNTIME_BINDINGS: readonly NumericRuntimeBinding[] = NUMERIC_SURFACE_MANIFEST.map((entry) => ({
  ...entry,
  method: "GET" as const,
}))

/**
 * R2B deliberately has one verified runtime vertical. The other catalog cards
 * remain unavailable even if an unrelated endpoint happens to return a number
 * with provenance; they are not allowed to mount a legacy renderer yet.
 */
export const NUMERIC_RUNTIME_VERIFIED_SOURCES: Readonly<Partial<Record<string, SourceId>>> = {}

export type NumericRuntimeStatus = "available" | "unavailable"

function hasFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value)
}

function hasFiniteNumberDeep(value: unknown): boolean {
  if (hasFiniteNumber(value)) return true
  if (Array.isArray(value)) return value.some(hasFiniteNumberDeep)
  if (value && typeof value === "object") return Object.values(value).some(hasFiniteNumberDeep)
  return false
}

function fieldTokens(field: string): Array<string | number | "*"> {
  return field.split(".").flatMap((part) => {
    const tokens: Array<string | number | "*"> = []
    const name = part.match(/^[^\[]+/)?.[0]
    if (name) tokens.push(name)
    for (const index of part.matchAll(/\[(\*|\d+)\]/g)) tokens.push(index[1] === "*" ? "*" : Number(index[1]))
    return tokens
  })
}

function fieldHasFiniteNumber(payload: unknown, field: string): boolean {
  const values = fieldTokens(field).reduce<unknown[]>((current, token) => current.flatMap((value) => {
    if (token === "*") {
      if (Array.isArray(value)) return value
      if (value && typeof value === "object") return Object.values(value)
      return []
    }
    if (typeof token === "number") return Array.isArray(value) && token < value.length ? [value[token]] : []
    return value && typeof value === "object" && token in value ? [(value as Record<string, unknown>)[token]] : []
  }), [payload])
  return values.some(hasFiniteNumber)
}

/** The runtime gate accepts only valid provenance and finite data. */
export function assessNumericResponse(payload: unknown, now = new Date(), expectedSource?: SourceId, expectedField?: string): NumericRuntimeStatus {
  if (!payload || typeof payload !== "object") return "unavailable"
  const response = payload as { data?: unknown; numeric?: NumericProvenance; numericManifest?: NumericProvenance[] }
  const candidates = Array.isArray(response.numericManifest)
    ? response.numericManifest
    : response.numeric
      ? [response.numeric]
      : []
  const hasValidProvenance = candidates.some((candidate) =>
    (!expectedSource || candidate.source === expectedSource) &&
    validateNumericProvenance(candidate, now).length === 0 &&
    candidate.status === "available",
  )
  return hasValidProvenance && (expectedField ? fieldHasFiniteNumber(payload, expectedField) : hasFiniteNumberDeep(response.data)) ? "available" : "unavailable"
}

export function assessNumericResponseForCard(cardId: string, payload: unknown, now = new Date()): NumericRuntimeStatus {
  const expectedSource = NUMERIC_RUNTIME_VERIFIED_SOURCES[cardId]
  if (!expectedSource) return "unavailable"
  const binding = NUMERIC_RUNTIME_BINDINGS.find((entry) => entry.cardId === cardId)
  return assessNumericResponse(payload, now, expectedSource, binding?.field)
}

export function runtimeCoverage(verifiedCardIds: readonly string[] = []) {
  const verified = new Set(verifiedCardIds)
  const unverifiedCardIds = NUMERIC_RUNTIME_BINDINGS
    .map((entry) => entry.cardId)
    .filter((cardId) => !verified.has(cardId))
  return {
    catalogCards: DATA_CARD_CATALOG.length,
    manifestEntries: NUMERIC_SURFACE_MANIFEST.length,
    runtimeBoundCards: NUMERIC_RUNTIME_BINDINGS.length,
    runtimeVerifiedCards: NUMERIC_RUNTIME_BINDINGS.filter((entry) => verified.has(entry.cardId)).length,
    unverifiedCardIds,
  }
}
