import type { SourceDefinition } from "@/server/sources/types"

export type CacheFreshness = "fresh" | "stale" | "expired"

type Clock = { now(): Date }

type CacheIdentity = {
  sourceId: string
  dataset: string
  params: unknown
  normalizerVersion: string
}

type CacheWrite<T> = CacheIdentity & {
  value: T
  asOf: string
  retrievedAt: string
}

type CacheEntry<T> = {
  value: T
  asOf: string
  retrievedAt: string
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function keyFor(identity: CacheIdentity): string {
  return stable(identity)
}

export function freshnessFor(
  asOf: string,
  policy: SourceDefinition["freshness"],
  now = new Date(),
): CacheFreshness {
  const timestamp = Date.parse(asOf)
  if (!Number.isFinite(timestamp)) return "expired"
  const ageSeconds = Math.max(0, (now.getTime() - timestamp) / 1000)
  if (policy.rejectAfterSeconds != null && ageSeconds > policy.rejectAfterSeconds) return "expired"
  if (policy.warnAfterSeconds != null && ageSeconds > policy.warnAfterSeconds) return "stale"
  return "fresh"
}

export class DataCache {
  private readonly values = new Map<string, CacheEntry<unknown>>()

  constructor(private readonly clock: Clock = { now: () => new Date() }) {}

  set<T>(entry: CacheWrite<T>): void {
    const { sourceId, dataset, params, normalizerVersion, value, asOf, retrievedAt } = entry
    this.values.set(keyFor({ sourceId, dataset, params, normalizerVersion }), { value, asOf, retrievedAt })
  }

  get<T>(identity: CacheIdentity): CacheEntry<T> | null {
    void this.clock.now()
    return (this.values.get(keyFor(identity)) as CacheEntry<T> | undefined) ?? null
  }
}
