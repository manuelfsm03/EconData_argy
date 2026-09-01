export type RuntimeDataMetadata = {
  source: string | null
  timestamp: string | null
  hasData: boolean
  semanticError: string | null
}

const SOURCE_KEYS = new Set(["source", "source_id", "source_name", "fuente", "provider", "publisher"])
const PRIMARY_TIMESTAMP_KEYS = new Set([
  "as_of", "asof", "data_as_of", "dataasof", "last_updated", "lastupdated", "last_update", "lastupdate",
  "fechaactualizacion", "fecha_actualizacion", "effective_at", "effectiveat",
])
const SECONDARY_TIMESTAMP_KEYS = new Set(["date", "fecha", "periodo", "pubdate"])
const RESPONSE_TIMESTAMP_KEYS = new Set(["updated_at", "updatedat", "timestamp", "retrieved_at", "retrievedat", "checked_at", "checkedat"])
const MAX_VISITED_NODES = 5_000
const MAX_ARRAY_SAMPLES = 8

function keyName(value: string): string {
  return value.replace(/[-\s]/g, "_").toLowerCase()
}

function nonEmpty(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0
  if (typeof value === "string") return value.trim().length > 0
  return true
}

function payloadHasData(payload: unknown): boolean {
  if (!nonEmpty(payload)) return false
  if (Array.isArray(payload)) return payload.length > 0
  if (typeof payload !== "object" || payload === null) return true
  const object = payload as Record<string, unknown>
  if (object.success === false || object.ok === false) return false
  for (const key of ["data", "results", "rates", "items"]) {
    if (key in object) return nonEmpty(object[key])
  }
  return Object.keys(object).some((key) => !["error", "message", "meta", "metadata"].includes(key))
}

function semanticError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null
  const object = payload as Record<string, unknown>
  if (object.success === false || object.ok === false) return "La respuesta reporta success=false"
  if (object.error && !nonEmpty(object.data)) {
    return typeof object.error === "string" ? object.error.slice(0, 180) : "La respuesta contiene un error"
  }
  return null
}

function sourceValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const object = value as Record<string, unknown>
  for (const key of ["id", "name", "displayName", "publisher", "mode"]) {
    if (typeof object[key] === "string" && object[key].trim()) return object[key].trim()
  }
  return null
}

function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const raw = String(value).trim()
  if (!raw || /^\d{1,3}(?:\.\d+)?$/.test(raw)) return null
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date(parsed).toISOString()
}

function newest(values: string[]): string | null {
  return values.reduce<string | null>((latest, candidate) => {
    if (!latest) return candidate
    return Date.parse(candidate) > Date.parse(latest) ? candidate : latest
  }, null)
}

function sampledArray(values: unknown[]): unknown[] {
  if (values.length <= MAX_ARRAY_SAMPLES) return values
  const edge = MAX_ARRAY_SAMPLES / 2
  return [...values.slice(0, edge), ...values.slice(-edge)]
}

/** Extracts only provenance/timestamps actually reported by runtime responses. */
export function inspectRuntimeData(payload: unknown, headers?: Pick<Headers, "get"> | null): RuntimeDataMetadata {
  const headerSource = headers?.get("x-data-source")?.trim() || null
  const headerTimestamp = normalizedTimestamp(headers?.get("x-data-as-of") ?? headers?.get("last-modified"))
  const sources = new Set<string>()
  const primaryTimestamps: string[] = []
  const secondaryTimestamps: string[] = []
  const responseTimestamps: string[] = []
  const queue: unknown[] = [payload]
  let visited = 0

  while (queue.length > 0 && visited < MAX_VISITED_NODES) {
    const current = queue.shift()
    visited += 1
    if (Array.isArray(current)) {
      queue.push(...sampledArray(current))
      continue
    }
    if (typeof current !== "object" || current === null) continue
    for (const [rawKey, value] of Object.entries(current as Record<string, unknown>)) {
      const key = keyName(rawKey)
      if (SOURCE_KEYS.has(key)) {
        const source = sourceValue(value)
        if (source) sources.add(source)
      }
      if (PRIMARY_TIMESTAMP_KEYS.has(key)) {
        const timestamp = normalizedTimestamp(value)
        if (timestamp) primaryTimestamps.push(timestamp)
      } else if (SECONDARY_TIMESTAMP_KEYS.has(key)) {
        const timestamp = normalizedTimestamp(value)
        if (timestamp) secondaryTimestamps.push(timestamp)
      } else if (RESPONSE_TIMESTAMP_KEYS.has(key)) {
        const timestamp = normalizedTimestamp(value)
        if (timestamp) responseTimestamps.push(timestamp)
      }
      if (typeof value === "object" && value !== null) queue.push(value)
    }
  }

  const discoveredSources = [...sources]
  const source = headerSource || (
    discoveredSources.length > 4
      ? `${discoveredSources.slice(0, 4).join(" + ")} +${discoveredSources.length - 4}`
      : discoveredSources.join(" + ") || null
  )
  return {
    source,
    timestamp: headerTimestamp || newest(primaryTimestamps) || newest(secondaryTimestamps) || newest(responseTimestamps),
    hasData: payloadHasData(payload),
    semanticError: semanticError(payload),
  }
}
