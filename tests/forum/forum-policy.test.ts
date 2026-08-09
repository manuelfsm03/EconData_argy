import assert from "node:assert/strict"
import test from "node:test"

import {
  ForumConfigurationError,
  deriveForumIdentity,
  getTrustedClientIp,
  normalizeForumTicker,
  requireForumRateLimitSecret,
} from "../../src/server/forum/forum-policy"

test("ticker policy normalizes documented safe ticker characters", () => {
  assert.equal(normalizeForumTicker(" ggal "), "GGAL")
  assert.equal(normalizeForumTicker("brk.b"), "BRK.B")
  assert.equal(normalizeForumTicker("btc-usd"), "BTC-USD")
})

test("ticker policy rejects blank, path-like, overlong, and arbitrary symbols", () => {
  for (const value of ["", "   ", "../GGAL", "GGAL/USD", "A".repeat(16), "GGAL$", "ÁL30", ".GGAL", "GGAL..A"]) {
    assert.equal(normalizeForumTicker(value), null, value)
  }
})

test("untrusted forwarding headers never establish a client identity", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.1, 198.51.100.2",
    "x-real-ip": "203.0.113.3",
  })
  assert.equal(getTrustedClientIp(headers, {}), null)
})

test("Vercel mode uses only a valid Vercel-owned client IP header", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.1",
    "x-vercel-forwarded-for": "2001:db8::1",
  })
  assert.equal(getTrustedClientIp(headers, { VERCEL: "1" }), "2001:db8::1")
  assert.equal(getTrustedClientIp(new Headers({ "x-vercel-forwarded-for": "bad, 203.0.113.1" }), { VERCEL: "1" }), null)
})

test("explicit proxy mode trusts a single validated x-real-ip value", () => {
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "198.51.100.8" }), { FORUM_TRUST_PROXY: "1" }), "198.51.100.8")
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "198.51.100.8, 10.0.0.1" }), { FORUM_TRUST_PROXY: "1" }), null)
})

test("forum secret is mandatory and identity is a keyed pseudonym", () => {
  assert.throws(() => requireForumRateLimitSecret({}), ForumConfigurationError)
  const secret = "disposable-test-secret-at-least-32-bytes"
  assert.equal(requireForumRateLimitSecret({ FORUM_RATE_LIMIT_SECRET: secret }), secret)

  const first = deriveForumIdentity("203.0.113.10", secret)
  const again = deriveForumIdentity("203.0.113.10", secret)
  const other = deriveForumIdentity("203.0.113.11", secret)
  assert.equal(first, again)
  assert.notEqual(first, other)
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.ok(!first.includes("203.0.113.10"))
})
