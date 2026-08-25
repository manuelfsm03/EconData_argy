import type { CardEndpoint } from "@/lib/card-catalog"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"

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
}

const MAX_FRESH_AGE_MS = 24 * 60 * 60 * 1000

function containsFiniteData(value: unknown): { valid: boolean; hasNumber: boolean } {
  if (typeof value === "number") return { valid: Number.isFinite(value), hasNumber: true }
  if (typeof value === "string" || typeof value === "boolean") return { valid: true, hasNumber: false }
  if (value === null || value === undefined) return { valid: false, hasNumber: false }
  if (Array.isArray(value)) {
    if (value.length === 0) return { valid: false, hasNumber: false }
    return value.reduce((result, item) => {
      const next = containsFiniteData(item)
      return { valid: result.valid && next.valid, hasNumber: result.hasNumber || next.hasNumber }
    }, { valid: true, hasNumber: false })
  }
  if (typeof value === "object") {
    const values = Object.values(value)
    if (values.length === 0) return { valid: false, hasNumber: false }
    return values.reduce((result, item) => {
      const next = containsFiniteData(item)
      return { valid: result.valid && next.valid, hasNumber: result.hasNumber || next.hasNumber }
    }, { valid: true, hasNumber: false })
  }
  return { valid: false, hasNumber: false }
}

function hasProvenance(record: Record<string, unknown>, meta: Record<string, unknown> | null): boolean {
  const provenance = record.provenance ?? record.source ?? meta?.source
  if (typeof provenance === "string") return provenance.trim().length > 0
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return false
  const source = provenance as Record<string, unknown>
  return [source.id, source.publisher, source.mode].some((value) => typeof value === "string" && value.trim().length > 0)
}

/** Transport 200 is not data health: require fresh, finite, timestamped data with provenance. */
export function assessCardHealthPayload(payload: unknown, now = Date.now(), maxAgeMs = MAX_FRESH_AGE_MS): "available" | "unavailable" {
  if (!payload || typeof payload !== "object") return "unavailable"
  const record = payload as Record<string, unknown>
  if (record.ok === false || "error" in record) return "unavailable"
  const meta = record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
    ? record.meta as Record<string, unknown>
    : null
  const asOf = record.asOf ?? meta?.asOf ?? record.updated_at ?? record.updatedAt
  const asOfMs = typeof asOf === "string" ? Date.parse(asOf) : Number.NaN
  const freshness = record.freshness ?? meta?.freshness
  if (!Number.isFinite(asOfMs) || asOfMs > now || now - asOfMs > maxAgeMs) return "unavailable"
  if (freshness === "stale" || freshness === "expired") return "unavailable"
  if (!hasProvenance(record, meta)) return "unavailable"
  const data = "data" in record
    ? record.data
    : Object.fromEntries(Object.entries(record).filter(([key]) => ![
      "asOf", "updated_at", "updatedAt", "retrievedAt", "freshness", "source", "provenance", "ok", "meta",
    ].includes(key)))
  const assessment = containsFiniteData(data)
  if (!assessment.valid || !assessment.hasNumber) return "unavailable"
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
    const response = await transport(probe.path, {
      method: probe.method,
      headers: probe.body ? { "Content-Type": "application/json" } : undefined,
      body: probe.body ? JSON.stringify(probe.body) : undefined,
      signal,
      cache: "no-store",
    })
    const payload = response.ok ? await response.json().catch(() => null) : null
    const assessment = response.ok ? assessCardHealthPayload(payload) : "unavailable"
    await response.body?.cancel().catch(() => undefined)
    return {
      label: probe.label,
      path: probe.path,
      ok: assessment === "available",
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      quality: assessment === "available" ? "estimated" : "unavailable",
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
    }
  }
}
