import assert from "node:assert/strict"
import test from "node:test"

import { fetchRegistered } from "../src/server/http/fetch-source"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const MB = 1024 * 1024

test("Rava market has a bounded per-source override while the global JSON limit stays closed", async () => {
  assert.equal(SOURCE_REGISTRY.rava_market.maxResponseBytes, 15 * MB)
  assert.equal(SOURCE_REGISTRY.eia.maxResponseBytes, 5 * MB)

  const sixMegabytes: typeof fetch = async () => new Response(
    new Uint8Array(6 * MB),
    { status: 200 },
  )

  const accepted = await fetchRegistered("https://mercado.rava.com/api/prices/arg", {}, sixMegabytes)
  assert.equal((await accepted.arrayBuffer()).byteLength, 6 * MB)

  await assert.rejects(
    fetchRegistered("https://api.eia.gov/v2/test", {}, sixMegabytes),
    /SOURCE_RESPONSE_TOO_LARGE/,
  )
})
