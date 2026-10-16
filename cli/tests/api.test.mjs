import assert from "node:assert/strict"
import test from "node:test"
import { ApiError, apiGet } from "../dist/lib/api.js"

test("apiGet parses fixture JSON and omits empty query parameters", async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl
  let requestedHeaders
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url)
    requestedHeaders = options.headers
    return Response.json({ ok: true, data: { value: 42 } })
  }

  try {
    const response = await apiGet("/api/fixture", { period: "monthly", empty: "" })
    assert.deepEqual(response, { ok: true, data: { value: 42 } })
    assert.equal(requestedUrl.pathname, "/api/fixture")
    assert.equal(requestedUrl.searchParams.get("period"), "monthly")
    assert.equal(requestedUrl.searchParams.has("empty"), false)
    assert.match(requestedHeaders["User-Agent"], /^lapizarra-cli\//)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiGet returns an ApiError for an HTTP error fixture", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response("service unavailable", { status: 503 })

  try {
    await assert.rejects(apiGet("/api/fixture"), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 503)
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("apiGet reports invalid JSON fixtures", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response("not-json", { status: 200 })

  try {
    await assert.rejects(apiGet("/api/fixture"), /Respuesta no-JSON/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
