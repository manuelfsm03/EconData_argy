import assert from "node:assert/strict"
import test from "node:test"

import { buildErrorEnvelope, buildSuccessEnvelope } from "../src/server/api/envelope"
import { DataCache, freshnessFor } from "../src/server/cache/data-cache"
import { fetchRegistered } from "../src/server/http/fetch-source"
import { resolveSourceChain } from "../src/server/sources/fallback"
import { SOURCE_REGISTRY, registeredHealthchecks } from "../src/server/sources/registry"

test("success and error envelopes preserve as-of provenance without leaking details", () => {
  const success = buildSuccessEnvelope({
    requestId: "req-1",
    dataset: "world.gdp_growth",
    data: { ARG: 2.5 },
    asOf: "2025-12-31",
    freshness: "fresh",
    completeness: "complete",
    source: {
      id: "world_bank",
      publisher: "World Bank",
      mode: "live",
      retrievedAt: "2026-01-02T12:00:00.000Z",
      fallbackFrom: null,
    },
    generatedAt: "2026-01-02T12:01:00.000Z",
  })
  assert.equal(success.ok, true)
  assert.equal(success.meta.asOf, "2025-12-31")
  assert.equal(success.meta.source.id, "world_bank")

  const failure = buildErrorEnvelope({
    requestId: "req-2",
    dataset: "energy.petroleum",
    code: "SOURCE_NOT_CONFIGURED",
    message: "EIA_API_KEY=secret-value at /srv/app.ts:42",
    retryable: false,
    generatedAt: "2026-01-02T12:01:00.000Z",
  })
  assert.equal(failure.ok, false)
  assert.equal(failure.error.message, "Source is not configured")
  assert.doesNotMatch(JSON.stringify(failure), /secret-value|\/srv\/|app\.ts/)
})

test("freshness classification uses asOf and rejects expired observations", () => {
  const policy = { warnAfterSeconds: 600, rejectAfterSeconds: 1_800 }
  const now = new Date("2026-01-01T12:00:00.000Z")
  assert.equal(freshnessFor("2026-01-01T11:55:00.000Z", policy, now), "fresh")
  assert.equal(freshnessFor("2026-01-01T11:45:00.000Z", policy, now), "stale")
  assert.equal(freshnessFor("2026-01-01T11:00:00.000Z", policy, now), "expired")
})

test("cache retains original retrieval and as-of times while separating normalized params", () => {
  const clock = { now: () => new Date("2026-01-01T12:00:00.000Z") }
  const cache = new DataCache(clock)
  cache.set({
    sourceId: "world_bank",
    dataset: "world.gdp",
    params: { countries: ["BRA", "ARG"], page: 1 },
    normalizerVersion: "v1",
    value: { ARG: 1 },
    asOf: "2025-12-31",
    retrievedAt: "2026-01-01T11:59:00.000Z",
  })

  const same = cache.get({
    sourceId: "world_bank",
    dataset: "world.gdp",
    params: { page: 1, countries: ["BRA", "ARG"] },
    normalizerVersion: "v1",
  })
  assert.equal(same?.asOf, "2025-12-31")
  assert.equal(same?.retrievedAt, "2026-01-01T11:59:00.000Z")
  assert.equal(cache.get({ sourceId: "world_bank", dataset: "world.gdp", params: { page: 2 }, normalizerVersion: "v1" }), null)
  assert.equal(cache.get({ sourceId: "world_bank", dataset: "world.gdp", params: { page: 1, countries: ["BRA", "ARG"] }, normalizerVersion: "v2" }), null)
})

test("fallback chain is registered, compatible, acyclic, and reports the effective source", () => {
  const chain = resolveSourceChain("dolar_api")
  assert.deepEqual(chain.map((entry) => entry.id), ["dolar_api", "argentina_datos"])
  assert.equal(chain[1].fallbackFrom, "dolar_api")
  assert.throws(() => resolveSourceChain("missing" as never), /SOURCE_NOT_REGISTERED/)
})

test("status healthchecks are derived only from the canonical registry", () => {
  const checks = registeredHealthchecks()
  assert.ok(checks.length > 0)
  assert.equal(new Set(checks.map((check) => check.id)).size, checks.length)
  for (const check of checks) {
    assert.equal(check, SOURCE_REGISTRY[check.id])
    assert.ok(check.healthcheck)
  }
})

test("registry timeout cannot be disabled by a caller signal and retries get fresh signals", async () => {
  const caller = new AbortController()
  const signals: AbortSignal[] = []
  let attempts = 0
  const transport: typeof fetch = async (_input, init) => {
    attempts += 1
    assert.ok(init?.signal)
    signals.push(init.signal)
    if (attempts === 1) throw new DOMException("timed out", "TimeoutError")
    return new Response("ok")
  }

  const response = await fetchRegistered("https://api.eia.gov/v2/test", { signal: caller.signal }, transport)
  assert.equal(response.status, 200)
  assert.equal(attempts, 2)
  assert.notEqual(signals[0], caller.signal)
  assert.notEqual(signals[0], signals[1])
})
