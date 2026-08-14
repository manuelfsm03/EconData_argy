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
    await response.body?.cancel().catch(() => undefined)
    return {
      label: probe.label,
      path: probe.path,
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return {
      label: probe.label,
      path: probe.path,
      ok: false,
      status: null,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}
