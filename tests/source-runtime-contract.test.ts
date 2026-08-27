import assert from "node:assert/strict"
import test from "node:test"

import { buildErrorEnvelope, buildSuccessEnvelope } from "../src/server/api/envelope"
import { DataCache, freshnessFor } from "../src/server/cache/data-cache"
import { loadCentralBankRates, MemoryDomainCache } from "../src/server/domain/central-bank-rates"
import { loadImfMacro } from "../src/server/domain/imf-macro-data"
import { fetchRegistered, fetchRegisteredSession } from "../src/server/http/fetch-source"
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

test("cross-source redirects require an explicit directed registry edge", async () => {
  const allowed: typeof fetch = async (input) => input.toString().includes("finance.yahoo.com")
    ? new Response(null, { status: 302, headers: { location: "https://consent.yahoo.com/consent" } })
    : new Response("ok")
  assert.equal((await fetchRegistered("https://finance.yahoo.com", {}, allowed)).status, 200)

  const blocked: typeof fetch = async () => new Response(null, { status: 302, headers: { location: "https://query1.finance.yahoo.com/steal" } })
  await assert.rejects(fetchRegistered("https://finance.yahoo.com", {}, blocked), /SOURCE_REDIRECT_NOT_ALLOWED/)
})

test("redirect hops rebind limits and stop after three redirects", async () => {
  const urls: string[] = []
  const redirecting: typeof fetch = async (input) => {
    urls.push(input.toString())
    return new Response(null, { status: 302, headers: { location: new URL(`/hop-${urls.length + 1}`, input.toString()).toString() } })
  }
  await assert.rejects(fetchRegistered("https://api.eia.gov/v2/start", {}, redirecting), /SOURCE_REDIRECT_LIMIT/)
  assert.equal(urls.length, 4)
})

test("Yahoo session captures safe cookie pairs without leaking attributes", async () => {
  const calls: Array<{ url: string; cookie: string | undefined }> = []
  const transport: typeof fetch = async (input, init) => {
    calls.push({ url: input.toString(), cookie: new Headers(init?.headers).get("cookie") ?? undefined })
    return new Response("home", { status: 200, headers: { "set-cookie": "A=one; Path=/; Secure, B=two; HttpOnly" } })
  }
  const session = await fetchRegisteredSession("https://finance.yahoo.com", {}, transport)
  assert.equal(await session.response.text(), "home")
  assert.equal(session.cookieHeader, "A=one; B=two")
  assert.deepEqual(calls, [{ url: "https://finance.yahoo.com", cookie: undefined }])

  const injection: typeof fetch = async () => ({ ok: true, status: 200, headers: { get: () => "bad\r\nX-Evil: yes" }, body: null } as unknown as Response)
  await assert.rejects(fetchRegisteredSession("https://finance.yahoo.com", {}, injection), /SOURCE_INVALID_COOKIE/)
})

test("session forwarding never accepts a direct consent-to-query API redirect", async () => {
  const transport: typeof fetch = async () => new Response(null, { status: 302, headers: { location: "https://query2.finance.yahoo.com/v1/test/getcrumb" } })
  await assert.rejects(fetchRegisteredSession("https://consent.yahoo.com/consent", {}, transport), /SOURCE_REDIRECT_NOT_ALLOWED/)
})

test("cross-source hops strip caller credentials and cookies", async () => {
  const calls: Array<{ url: string; headers: Headers }> = []
  const transport: typeof fetch = async (input, init) => {
    const url = input.toString()
    calls.push({ url, headers: new Headers(init?.headers) })
    if (calls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://consent.yahoo.com/consent" },
      })
    }
    return new Response("ok")
  }

  await fetchRegisteredSession("https://finance.yahoo.com", {
    headers: {
      Authorization: "Bearer caller-secret",
      Cookie: "caller-secret=1",
      "Bmx-Token": "source-secret",
      "X-Api-Key": "api-secret",
      "X-Source-Credential": "source-secret",
      "User-Agent": "test-agent",
    },
  }, transport)

  assert.equal(calls.length, 2)
  assert.equal(calls[0].headers.get("authorization"), "Bearer caller-secret")
  assert.equal(calls[0].headers.get("cookie"), "caller-secret=1")
  for (const header of ["authorization", "cookie", "bmx-token", "x-api-key", "x-source-credential", "proxy-authorization"]) {
    assert.equal(calls[1].headers.get(header), null, header)
  }
  assert.equal(calls[1].headers.get("user-agent"), "test-agent")
})

test("Yahoo session cookies survive same-source redirects", async () => {
  const calls: Array<{ url: string; cookie: string | null }> = []
  const transport: typeof fetch = async (input, init) => {
    calls.push({ url: input.toString(), cookie: new Headers(init?.headers).get("cookie") })
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: "https://finance.yahoo.com/next", "set-cookie": "A=one; Path=/" } })
    return new Response("ok")
  }
  const result = await fetchRegisteredSession("https://finance.yahoo.com", {}, transport)
  assert.equal(await result.response.text(), "ok")
  assert.deepEqual(calls.map((call) => call.cookie), [null, "A=one"])
})

test("Yahoo session cookies survive consent/guce/finance hops", async () => {
  const calls: Array<{ url: string; cookie: string | null }> = []
  const transport: typeof fetch = async (input, init) => {
    calls.push({ url: input.toString(), cookie: new Headers(init?.headers).get("cookie") })
    if (calls.length === 1) {
      return new Response(null, { status: 302, headers: { location: "https://consent.yahoo.com/consent", "set-cookie": "B=two; Path=/" } })
    }
    if (calls.length === 2) {
      return new Response(null, { status: 302, headers: { location: "https://guce.yahoo.com/consent", "set-cookie": "C=three; Path=/" } })
    }
    if (calls.length === 3) {
      return new Response(null, { status: 302, headers: { location: "https://finance.yahoo.com/final" } })
    }
    return new Response("ok")
  }

  const result = await fetchRegisteredSession("https://finance.yahoo.com", {}, transport)
  assert.equal(await result.response.text(), "ok")
  assert.deepEqual(calls.map((call) => call.cookie), [null, "B=two", "B=two; C=three", "B=two; C=three"])
})

function centralFixture(url: string): Response {
  if (url.includes("newyorkfed.org")) return Response.json({ refRates: [{ effectiveDate: "2026-08-27", targetRateHigh: 4.5, percentRate: "4.33" }] })
  if (url.includes("ecb.europa.eu")) return new Response("TIME_PERIOD,OBS_VALUE\n2026-08-26,2.15\n")
  if (url.includes("api.bcb.gov.br")) return Response.json([{ data: "27/08/2026", valor: "15.00" }])
  if (url.includes("bankofengland.co.uk")) return new Response("DATE,VALUE\n2026-08-26,4.00\n")
  if (url.includes("bankofcanada.ca")) return Response.json({ observations: [{ d: "2026-08-26", V39079: { v: "2.75" } }] })
  if (url.includes("rba.gov.au")) return Response.json({ dataSets: [{ series: { FIRMMCRT: { observations: { "2026-08-26": ["3.85"] } } } }] })
  if (url.includes("sdmx.oecd.org")) return Response.json({ dataSets: [{ observations: { "0": [3.25] } }], structure: { dimensions: { observation: [{ values: [{ id: "2026-07" }] }] } } })
  throw new Error(`unexpected fixture URL: ${url}`)
}

test("central-bank domain preserves live source contracts and real observation dates", async () => {
  const result = await loadCentralBankRates({ fetcher: async (input) => centralFixture(input.toString()), now: () => new Date("2026-08-27T12:00:00Z"), cache: new MemoryDomainCache() })
  assert.equal(result.allFailed, false)
  assert.equal(result.data.fed.sourceId, "ny_fed_rates")
  assert.equal(result.data.bce.updated_at, "2026-08-26")
  assert.equal(result.data.boe.updated_at, "2026-08-26")
  assert.equal(result.data.banxico.sourceId, "oecd_sdmx")
  assert.equal(result.data.banxico.updated_at, "2026-07")
  assert.equal(result.data.rba.sourceId, "rba_statistics")
})

test("central-bank domain preserves Banxico and RBA fallback order", async () => {
  const previousToken = process.env.BMX_TOKEN
  process.env.BMX_TOKEN = "fixture-token"
  try {
    const calls: string[] = []
    const fetcher: typeof fetch = async (input) => {
      const url = input.toString()
      calls.push(url)
      if (url.includes("newyorkfed.org") || url.includes("rba.gov.au")) throw new Error("fixture failure")
      if (url.includes("sdmx.oecd.org")) {
        if (url.includes(".AUS.")) return Response.json({ dataSets: [{ observations: { "0": [3.25] } }], structure: { dimensions: { observation: [{ values: [{ id: "2026-07" }] }] } } })
        throw new Error("fixture failure")
      }
      if (url.includes("banxico.org.mx")) return Response.json({ bmx: { series: [{ datos: [{ fecha: "27/08/2026", dato: "10.50" }] }] } })
      if (url.includes("bankofengland.co.uk")) return new Response("DATE,VALUE\n2026-08-26,4.00\n")
      if (url.includes("ecb.europa.eu")) return new Response("TIME_PERIOD,OBS_VALUE\n2026-08-26,2.15\n")
      if (url.includes("api.bcb.gov.br")) return Response.json([{ data: "27/08/2026", valor: "15.00" }])
      if (url.includes("bankofcanada.ca")) return Response.json({ observations: [{ d: "2026-08-26", V39079: { v: "2.75" } }] })
      throw new Error(`unexpected fixture URL: ${url}`)
    }
    const result = await loadCentralBankRates({ fetcher, now: () => new Date("2026-08-27T12:00:00Z"), cache: new MemoryDomainCache() })
    assert.equal(result.data.banxico.sourceId, "banxico_sie")
    assert.equal(result.data.rba.sourceId, "oecd_sdmx")
    const rbaIndex = calls.findIndex((url) => url.includes("rba.gov.au"))
    const ausOecdIndex = calls.findIndex((url) => url.includes("sdmx.oecd.org") && url.includes(".AUS."))
    assert.ok(rbaIndex >= 0 && ausOecdIndex > rbaIndex)
  } finally {
    if (previousToken == null) delete process.env.BMX_TOKEN
    else process.env.BMX_TOKEN = previousToken
  }
})

test("central-bank domain shares fresh, partial, stale, and first-run cache semantics", async () => {
  const cache = new MemoryDomainCache()
  const at = new Date("2026-08-27T12:00:00Z")
  const first = await loadCentralBankRates({ fetcher: async (input) => centralFixture(input.toString()), now: () => at, cache })
  const fresh = await loadCentralBankRates({ fetcher: async () => { throw new Error("must not fetch fresh cache") }, now: () => new Date(at.getTime() + 1000), cache })
  assert.equal(fresh.cached, true)
  assert.deepEqual(fresh.data, first.data)

  const partial = await loadCentralBankRates({ fetcher: async (input) => input.toString().includes("newyorkfed.org") ? Response.json({ refRates: [{ effectiveDate: "2026-08-27", percentRate: "4.33" }] }) : Promise.reject(new Error("partial outage")), now: () => new Date(at.getTime() + 3_601_000), cache: new MemoryDomainCache() })
  assert.equal(partial.allFailed, false)
  assert.equal(partial.data.fed.esVivo, true)
  assert.equal(partial.data.bce.tasa, null)

  const staleCache = new MemoryDomainCache()
  staleCache.put("bancos-centrales:tasas", first.data, 3600, at.getTime())
  const stale = await loadCentralBankRates({ fetcher: async () => { throw new Error("outage") }, now: () => new Date(at.getTime() + 3_601_000), cache: staleCache })
  assert.equal(stale.stale, true)
  assert.equal(stale.staleSince, at.toISOString())

  const empty = await loadCentralBankRates({ fetcher: async () => { throw new Error("first-run outage") }, now: () => at, cache: new MemoryDomainCache() })
  assert.equal(empty.allFailed, true)
  assert.equal(empty.stale, false)
  assert.equal(Object.values(empty.data).filter((bank) => bank.tasa !== null).length, 0)
})

function imfFixture(input: string): Response {
  const indicator = input.includes("NGDP_RPCH") ? "NGDP_RPCH" : "PCPIPCH"
  const value = indicator === "NGDP_RPCH" ? 2.1 : 3.4
  return Response.json({ values: { [indicator]: Object.fromEntries(["USA", "ARG", "DEU", "JPN", "GBR"].map((code) => [code, { "2026": value }])) } })
}

test("IMF domain returns typed cached results and stale-last-good data", async () => {
  const cache = new MemoryDomainCache()
  const at = new Date("2026-08-27T12:00:00Z")
  const first = await loadImfMacro({ fetcher: async (input) => imfFixture(input.toString()), now: () => at, cache })
  assert.equal(first.allFailed, false)
  assert.ok(first.data.find((country) => country.code === "USA"))
  const fresh = await loadImfMacro({ fetcher: async () => { throw new Error("must not fetch fresh cache") }, now: () => new Date(at.getTime() + 1000), cache })
  assert.equal(fresh.cached, true)
  assert.deepEqual(fresh.data, first.data)
  const staleCache = new MemoryDomainCache()
  staleCache.put("imf-macro:v1", first.data, 24 * 3600, at.getTime())
  const stale = await loadImfMacro({ fetcher: async () => { throw new Error("outage") }, now: () => new Date(at.getTime() + 24 * 3600 * 1000 + 1), cache: staleCache })
  assert.equal(stale.stale, true)
  assert.equal(stale.staleSince, at.toISOString())
})

test("IMF domain exposes partial and first-run total failure without synthetic values", async () => {
  const partial = await loadImfMacro({ fetcher: async (input) => input.toString().includes("NGDP_RPCH") ? imfFixture(input.toString()) : Promise.reject(new Error("one indicator unavailable")), now: () => new Date("2026-08-27T12:00:00Z"), cache: new MemoryDomainCache() })
  assert.equal(partial.allFailed, false)
  assert.ok(partial.data.some((country) => country.pib_crecimiento !== null))
  const empty = await loadImfMacro({ fetcher: async () => { throw new Error("first-run outage") }, now: () => new Date("2026-08-27T12:00:00Z"), cache: new MemoryDomainCache() })
  assert.equal(empty.allFailed, true)
  assert.equal(empty.data.every((country) => country.pib_crecimiento === null && country.inflacion === null), true)
})

test("cross-source redirects preserve only the explicit safe header allowlist", async () => {
  const calls: Headers[] = []
  const transport: typeof fetch = async (input, init) => {
    calls.push(new Headers(init?.headers))
    return calls.length === 1
      ? new Response(null, { status: 302, headers: { location: "https://consent.yahoo.com/consent" } })
      : new Response("ok")
  }

  await fetchRegisteredSession("https://finance.yahoo.com", {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US",
      "Accept-Encoding": "gzip",
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "User-Agent": "test-agent",
      "X-Subscription-Key": "credential-sentinel",
      "X-Arbitrary-Canary": "must-not-forward",
      Authorization: "Bearer caller-secret",
      Cookie: "caller-secret=1",
      Origin: "https://finance.yahoo.com",
      Referer: "https://finance.yahoo.com/",
      Signature: "signature-sentinel",
    },
  }, transport)

  assert.equal(calls.length, 2)
  for (const [name, value] of [
    ["accept", "application/json"],
    ["accept-language", "en-US"],
    ["accept-encoding", "gzip"],
    ["cache-control", "no-cache"],
    ["content-type", "application/json"],
    ["user-agent", "test-agent"],
  ]) assert.equal(calls[1].get(name), value, name)
  for (const name of [
    "x-subscription-key", "x-arbitrary-canary", "authorization", "cookie", "origin", "referer", "signature",
  ]) assert.equal(calls[1].get(name), null, name)
})

function invalidCentralFixture(url: string, kind: "blank" | "null" | "non-finite"): Response {
  const value = kind === "blank" ? "" : kind === "null" ? null : "Infinity"
  if (url.includes("newyorkfed.org")) return Response.json({ refRates: [{ effectiveDate: "2026-08-27", targetRateHigh: null, percentRate: value }] })
  if (url.includes("ecb.europa.eu")) return new Response(`TIME_PERIOD,OBS_VALUE\n2026-08-26,${value === null ? "" : value}\n`)
  if (url.includes("api.bcb.gov.br")) return Response.json([{ data: "27/08/2026", valor: value }])
  if (url.includes("bankofengland.co.uk")) return new Response(`DATE,VALUE\n2026-08-26,${value === null ? "" : value}\n`)
  if (url.includes("bankofcanada.ca")) return Response.json({ observations: [{ d: "2026-08-26", V39079: { v: value } }] })
  if (url.includes("rba.gov.au")) return Response.json({ dataSets: [{ series: { FIRMMCRT: { observations: { "2026-08-26": [value] } } } }] })
  if (url.includes("sdmx.oecd.org")) return Response.json({ dataSets: [{ observations: { "0": [value] } }], structure: { dimensions: { observation: [{ values: [{ id: "2026-07" }] }] } } })
  throw new Error(`unexpected fixture URL: ${url}`)
}

test("central-bank domain rejects blank, null, and non-finite observations without cache writes", async () => {
  const previousFredKey = process.env.FRED_API_KEY
  const previousBanxicoToken = process.env.BMX_TOKEN
  delete process.env.FRED_API_KEY
  delete process.env.BMX_TOKEN
  try {
    for (const kind of ["blank", "null", "non-finite"] as const) {
      const cache = new MemoryDomainCache()
      const at = new Date("2026-08-27T12:00:00Z")
      const result = await loadCentralBankRates({ fetcher: async (input) => invalidCentralFixture(input.toString(), kind), now: () => at, cache })
      assert.equal(result.allFailed, true, kind)
      assert.equal(result.stale, false, kind)
      assert.equal(Object.values(result.data).every((bank) => bank.tasa === null && !bank.esVivo), true, kind)

      const retry = await loadCentralBankRates({ fetcher: async () => { throw new Error("must fetch after invalid result") }, now: () => new Date(at.getTime() + 1), cache })
      assert.equal(retry.allFailed, true, `${kind} cache state`)
      assert.equal(retry.cached, undefined, `${kind} cache state`)
    }
  } finally {
    if (previousFredKey == null) delete process.env.FRED_API_KEY
    else process.env.FRED_API_KEY = previousFredKey
    if (previousBanxicoToken == null) delete process.env.BMX_TOKEN
    else process.env.BMX_TOKEN = previousBanxicoToken
  }
})

function responseWithJson(payload: unknown): Response {
  const response = new Response(null, { status: 200 })
  Object.defineProperty(response, "json", { value: async () => payload })
  return response
}

test("IMF domain rejects malformed latest values without throwing or poisoning cache", async () => {
  for (const malformed of [null, "3.4", NaN, Infinity, undefined] as const) {
    const cache = new MemoryDomainCache()
    const fetcher: typeof fetch = async (input) => {
      const name = input.toString().includes("NGDP_RPCH") ? "NGDP_RPCH" : "PCPIPCH"
      const values = malformed === undefined
        ? {}
        : Object.fromEntries(["USA", "ARG", "DEU", "JPN", "GBR"].map((code) => [code, { "2026": malformed }]))
      return responseWithJson({ values: { [name]: values } })
    }
    const at = new Date("2026-08-27T12:00:00Z")
    const result = await loadImfMacro({ fetcher, now: () => at, cache })
    assert.equal(result.allFailed, true, String(malformed))
    assert.equal(result.data.every((country) => country.pib_crecimiento === null && country.inflacion === null), true, String(malformed))

    const retry = await loadImfMacro({ fetcher: async () => { throw new Error("must fetch after malformed result") }, now: () => new Date(at.getTime() + 1), cache })
    assert.equal(retry.allFailed, true, `${String(malformed)} cache state`)
    assert.equal(retry.cached, undefined, `${String(malformed)} cache state`)
  }
})
