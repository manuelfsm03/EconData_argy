import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_CARD_HEALTH_PROBES,
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
