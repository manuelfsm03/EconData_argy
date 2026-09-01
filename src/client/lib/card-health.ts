import type { CardEndpoint } from "@/lib/card-catalog"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"
import { inspectRuntimeData } from "@/lib/runtime-data-health"

export const MAX_CARD_HEALTH_PROBES = 5

const SAFE_READ_POST_PATHS = new Set(["/api/bcra-data"])

export interface CardHealthProbe {
  label: string
  path: string
  method: "GET" | "POST"
  body?: Record<string, unknown>
}

export interface CardHealthProbeResult {
  label: string
  path: string
  ok: boolean
  status: number | null
  latencyMs: number
  quality: "estimated" | "unavailable"
  checkedAt: string
  hasData: boolean
  source: string | null
  timestamp: string | null
  error: string | null
}

const MAX_FRESH_AGE_MS = 24 * 60 * 60 * 1000

function containsFiniteData(value: unknown): { valid: boolean; hasNumber: boolean; hasContent: boolean } {
  if (typeof value === "number") return { valid: Number.isFinite(value), hasNumber: true, hasContent: Number.isFinite(value) }
  if (typeof value === "string") return { valid: true, hasNumber: false, hasContent: value.trim().length > 0 }
  if (typeof value === "boolean") return { valid: true, hasNumber: false, hasContent: true }
  // A partial dataset may truthfully expose unavailable fields as null. Those
  // fields are neutral; at least one finite observation is still required.
  if (value === null || value === undefined) return { valid: true, hasNumber: false, hasContent: false }
  if (Array.isArray(value)) {
    return value.reduce((result, item) => {
      const next = containsFiniteData(item)
      return {
        valid: result.valid && next.valid,
        hasNumber: result.hasNumber || next.hasNumber,
        hasContent: result.hasContent || next.hasContent,
      }
    }, { valid: true, hasNumber: false, hasContent: false })
  }
  if (typeof value === "object") {
    const values = Object.values(value)
    return values.reduce((result, item) => {
      const next = containsFiniteData(item)
      return {
        valid: result.valid && next.valid,
        hasNumber: result.hasNumber || next.hasNumber,
        hasContent: result.hasContent || next.hasContent,
      }
    }, { valid: true, hasNumber: false, hasContent: false })
  }
  return { valid: false, hasNumber: false, hasContent: false }
}

function hasProvenance(record: Record<string, unknown>, meta: Record<string, unknown> | null, headers?: Headers): boolean {
  const provenance = record.provenance ?? record.source ?? meta?.source ?? headers?.get("X-Data-Source")
  if (typeof provenance === "string") return provenance.trim().length > 0
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return false
  const source = provenance as Record<string, unknown>
  return [source.id, source.publisher, source.mode].some((value) => typeof value === "string" && value.trim().length > 0)
}

/** Transport 200 is not data health: require fresh, finite, timestamped data with provenance. */
export function assessCardHealthPayload(payload: unknown, now = Date.now(), maxAgeMs = MAX_FRESH_AGE_MS, headers?: Headers): "available" | "unavailable" {
  if (!payload || typeof payload !== "object") return "unavailable"
  const record = Array.isArray(payload) ? {} : payload as Record<string, unknown>
  if (record.ok === false || record.success === false || record.stale === true || Boolean(record.error)) return "unavailable"
  const meta = record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
    ? record.meta as Record<string, unknown>
    : null
  const asOf = inspectRuntimeData(payload, headers).timestamp
  const asOfMs = typeof asOf === "string" ? Date.parse(asOf) : Number.NaN
  const freshness = record.freshness ?? meta?.freshness ?? headers?.get("X-Data-Freshness")
  if (!Number.isFinite(asOfMs) || asOfMs > now) return "unavailable"
  if (freshness !== "fresh" && now - asOfMs > maxAgeMs) return "unavailable"
  if (freshness === "stale" || freshness === "expired") return "unavailable"
  if (!hasProvenance(record, meta, headers)) return "unavailable"
  const data = Array.isArray(payload)
    ? payload
    : "data" in record
    ? record.data
    : Object.fromEntries(Object.entries(record).filter(([key]) => ![
      "asOf", "updated_at", "updatedAt", "retrievedAt", "freshness", "source", "provenance", "ok", "meta",
    ].includes(key)))
  const assessment = containsFiniteData(data)
  const newsPayload = headers?.get("X-Data-Source") === "news_rss"
  if (!assessment.valid || !assessment.hasContent || (!assessment.hasNumber && !newsPayload)) return "unavailable"
  return "available"
}

export function selectSafeHealthProbes(endpoints: readonly CardEndpoint[]): CardHealthProbe[] {
  const seen = new Set<string>()
  const probes: CardHealthProbe[] = []

  for (const endpoint of endpoints) {
    const method = endpoint.method ?? "GET"
    const safeMethod = method === "GET" || (method === "POST" && SAFE_READ_POST_PATHS.has(endpoint.path))
    if (!endpoint.path.startsWith("/api/") || !safeMethod) continue

    const key = `${method}:${endpoint.path}:${JSON.stringify(endpoint.body ?? null)}`
    if (seen.has(key)) continue
    seen.add(key)
    probes.push({ label: endpoint.label, path: endpoint.path, method, body: endpoint.body })
    if (probes.length >= MAX_CARD_HEALTH_PROBES) break
  }

  return probes
}

export function selectCardHealthProbes(cardId: string): CardHealthProbe[] {
  const definition = DATA_CARD_BY_ID.get(cardId)
  return definition ? selectSafeHealthProbes(definition.endpoints) : []
}

export async function probeCardEndpoint(
  probe: CardHealthProbe,
  signal: AbortSignal,
  transport: typeof fetch = globalThis.fetch,
): Promise<CardHealthProbeResult> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")
  const startedAt = performance.now()

  try {
    const timeout = AbortSignal.timeout(12_000)
    const response = await transport(probe.path, {
      method: probe.method,
      headers: probe.body ? { "Content-Type": "application/json" } : undefined,
      body: probe.body ? JSON.stringify(probe.body) : undefined,
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    })
    const payload = response.ok ? await response.json().catch(() => null) : null
    const assessment = response.ok ? assessCardHealthPayload(payload, Date.now(), MAX_FRESH_AGE_MS, response.headers) : "unavailable"
    const metadata = inspectRuntimeData(payload, response.headers)
    await response.body?.cancel().catch(() => undefined)
    return {
      label: probe.label,
      path: probe.path,
      ok: assessment === "available",
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      quality: assessment === "available" ? "estimated" : "unavailable",
      checkedAt: new Date().toISOString(),
      hasData: metadata.hasData,
      source: metadata.source,
      timestamp: metadata.timestamp,
      error: !response.ok
        ? `HTTP ${response.status}`
        : metadata.semanticError ?? (assessment === "available" ? null : "Faltan datos, provenance o freshness verificable"),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return {
      label: probe.label,
      path: probe.path,
      ok: false,
      status: null,
      latencyMs: Math.round(performance.now() - startedAt),
      quality: "unavailable",
      checkedAt: new Date().toISOString(),
      hasData: false,
      source: null,
      timestamp: null,
      error: error instanceof Error ? error.message : "No se pudo consultar el endpoint",
    }
  }
}
