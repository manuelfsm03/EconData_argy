import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_CARD_HEALTH_PROBES,
  assessCardHealthPayload,
  probeCardEndpoint,
  selectCardHealthProbes,
  selectSafeHealthProbes,
} from "../src/client/lib/card-health"
import { DATA_CARD_BY_ID } from "../src/lib/card-catalog"

test("card health maps the requested card only and unknown cards stay unprobed", () => {
  const ipc = selectCardHealthProbes("ipc")
  assert.ok(ipc.length > 0)
  assert.deepEqual(
    ipc.map((probe) => probe.path),
    DATA_CARD_BY_ID.get("ipc")?.endpoints.map((endpoint) => endpoint.path),
  )
  assert.deepEqual(selectCardHealthProbes("missing-card"), [])
})

test("health probes are deduplicated, bounded, and reject side-effecting POST endpoints", () => {
  const probes = selectSafeHealthProbes([
    { path: "/api/delete-all", label: "No", method: "POST", body: { confirm: true } },
    { path: "/api/bcra-data", label: "BCRA", method: "POST", body: { series_ids: ["tamar"] } },
    { path: "/api/a", label: "A" },
    { path: "/api/a", label: "A duplicate" },
    { path: "/api/b", label: "B" },
    { path: "/api/c", label: "C" },
    { path: "/api/d", label: "D" },
    { path: "/api/e", label: "E" },
    { path: "https://example.com/external", label: "External" },
  ])

  assert.equal(probes.length, MAX_CARD_HEALTH_PROBES)
  assert.ok(probes.some((probe) => probe.path === "/api/bcra-data" && probe.method === "POST"))
  assert.equal(probes.filter((probe) => probe.path === "/api/a").length, 1)
  assert.ok(probes.every((probe) => probe.path !== "/api/delete-all"))
  assert.ok(probes.every((probe) => probe.path.startsWith("/api/")))
})

test("an aborted card-health probe never starts a request", async () => {
  const controller = new AbortController()
  controller.abort()
  let requests = 0

  await assert.rejects(
    probeCardEndpoint(
      { path: "/api/macro?endpoint=ipc", label: "IPC", method: "GET" },
      controller.signal,
      async () => {
        requests += 1
        return new Response("ok")
      },
    ),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  )
  assert.equal(requests, 0)
})

test("card health accepts only non-empty finite fresh payloads with an asOf", () => {
  const now = Date.parse("2026-08-26T12:00:00.000Z")
  const provenance = { source: "test-source" }
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: { value: 42 } }, now), "available")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: { value: Number.NaN } }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: { value: Infinity } }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: { value: 0 } }, now), "available")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: [] }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ asOf: "2026-08-26T11:59:00.000Z", data: { value: 42 } }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T12:01:00.000Z", data: { value: 42 } }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-24T11:59:00.000Z", data: { value: 42 } }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", data: { value: 42 }, freshness: "stale" }, now), "unavailable")
  assert.equal(assessCardHealthPayload({ ...provenance, asOf: "2026-08-26T11:59:00.000Z", error: "upstream failed", data: { value: 42 } }, now), "unavailable")
})

test("a 200 response with an empty payload is still unavailable", async () => {
  const result = await probeCardEndpoint(
    { path: "/api/macro?endpoint=ipc", label: "IPC", method: "GET" },
    new AbortController().signal,
    async () => new Response(JSON.stringify({ asOf: "2026-08-26T11:59:00.000Z", source: "test-source", data: [] }), { status: 200 }),
  )
  assert.equal(result.status, 200)
  assert.equal(result.ok, false)
  assert.equal(result.quality, "unavailable")
})
