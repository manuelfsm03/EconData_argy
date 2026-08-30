import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  NUMERIC_RUNTIME_BINDINGS,
  NUMERIC_SURFACE_MANIFEST,
  assessNumericResponse,
  assessNumericResponseForCard,
  assertNumericRecord,
  manifestCoverage,
  runtimeCoverage,
  unavailableNumeric,
  validateNumericRecord,
} from "../src/server/numeric/manifest"
import {
  EIA_PRODUCTION_FIXTURE,
  REM_ESTIMATE_FIXTURE,
  UNAVAILABLE_SOURCE_FIXTURE,
} from "../fixtures/numeric-manifest.fixture"
import { buildSuccessEnvelope } from "../src/server/api/envelope"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const NOW = new Date("2026-08-26T00:00:00.000Z")

test("numeric manifest covers every catalog card with a non-empty surface", () => {
  const coverage = manifestCoverage()
  assert.equal(coverage.catalogCards, 35)
  assert.equal(coverage.coveredCards, coverage.catalogCards)
  assert.deepEqual(coverage.uncoveredCardIds, [])
  assert.equal(NUMERIC_SURFACE_MANIFEST.length, 35)
  for (const entry of NUMERIC_SURFACE_MANIFEST) {
    for (const key of ["source", "unit", "transform", "asOf", "retrievedAt", "freshness", "estimate"]) {
      assert.ok(Object.hasOwn(entry, key), `${entry.id} missing ${key}`)
    }
    assert.equal(entry.status, "unavailable")
    assert.equal(entry.asOf, null)
    assert.equal(entry.retrievedAt, null)
  }
})

test("available numeric values require source, unit, transform, dates, freshness and estimate state", () => {
  assert.deepEqual(validateNumericRecord(EIA_PRODUCTION_FIXTURE, NOW), [])
  assert.deepEqual(validateNumericRecord(REM_ESTIMATE_FIXTURE, NOW), [])
  assert.equal(assertNumericRecord(EIA_PRODUCTION_FIXTURE, NOW).value, 321.5)

  const missingSource = { ...EIA_PRODUCTION_FIXTURE, source: "unavailable" as const }
  assert.ok(validateNumericRecord(missingSource, NOW).includes("NUMERIC_SOURCE_MISSING"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, unit: "" }, NOW).includes("NUMERIC_UNIT_MISSING"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, asOf: null }, NOW).includes("NUMERIC_AS_OF_MISSING"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, retrievedAt: null }, NOW).includes("NUMERIC_RETRIEVED_AT_MISSING"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, value: Number.NaN }, NOW).includes("NUMERIC_VALUE_NONFINITE"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, status: "available", value: null }, NOW).includes("NUMERIC_AVAILABLE_NULL"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, freshness: "stale" }, NOW).includes("NUMERIC_DATA_STALE"))
})

test("missing or stale sources fail closed as an unavailable label, never a plausible value", () => {
  assert.deepEqual(validateNumericRecord(UNAVAILABLE_SOURCE_FIXTURE, NOW), [])
  assert.deepEqual(unavailableNumeric("EIA returned HTTP 403"), {
    value: null,
    source: "unavailable",
    unit: "not available",
    transform: "EIA returned HTTP 403",
    asOf: null,
    retrievedAt: null,
    freshness: "unavailable",
    estimate: false,
    status: "unavailable",
    label: "unavailable",
  })

  assert.deepEqual(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, status: "unavailable", value: null }, NOW), [])
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, status: "unavailable", value: 123 }, NOW).includes("NUMERIC_UNAVAILABLE_HAS_VALUE"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, freshness: "expired" }, NOW).includes("NUMERIC_DATA_STALE"))
})

test("estimate flag and status cannot silently disagree", () => {
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, estimate: true }, NOW).includes("NUMERIC_ESTIMATE_STATUS_MISMATCH"))
  assert.ok(validateNumericRecord({ ...REM_ESTIMATE_FIXTURE, estimate: false }, NOW).includes("NUMERIC_ESTIMATE_FLAG_MISSING"))
  assert.ok(validateNumericRecord({ ...EIA_PRODUCTION_FIXTURE, asOf: "2026-08-27T00:00:00.000Z" }, NOW).includes("NUMERIC_AS_OF_IN_FUTURE"))
})

test("success envelopes reject stale numeric provenance before serialization", () => {
  assert.throws(() => buildSuccessEnvelope({
    requestId: "numeric-stale",
    dataset: "energy.petroleum",
    data: { value: 1 },
    asOf: EIA_PRODUCTION_FIXTURE.asOf!,
    freshness: "fresh",
    completeness: "complete",
    source: {
      id: "eia",
      publisher: "U.S. Energy Information Administration",
      mode: "live",
      retrievedAt: EIA_PRODUCTION_FIXTURE.retrievedAt!,
      fallbackFrom: null,
    },
    numericManifest: [{ ...EIA_PRODUCTION_FIXTURE, freshness: "stale" }],
  }), /NUMERIC_DATA_STALE/)
})

test("EIA 403 and source failures are audited as unavailable, without leaking raw details", () => {
  const route = readFileSync("src/app/api/energia-global/route.ts", "utf8")
  assert.match(route, /EIA API 403/)
  assert.match(route, /EIA returned HTTP 403/)
  assert.match(route, /unavailableNumeric\(/)
  assert.doesNotMatch(route, /detail:\s*String\(error\)/)
  assert.doesNotMatch(route, /status:\s*500/)
  assert.match(route, /facets\[unit\]\[\]=/)
  assert.doesNotMatch(route, /facets\[unitId\]/)
  assert.equal(SOURCE_REGISTRY.eia.freshness.warnAfterSeconds, 155 * 86_400)
  assert.equal(SOURCE_REGISTRY.eia.freshness.rejectAfterSeconds, 245 * 86_400)
})

test("runtime bindings connect every catalog id to its endpoint, renderer and concrete numeric field", () => {
  const ids = new Set(NUMERIC_SURFACE_MANIFEST.map((entry) => entry.id))
  assert.equal(NUMERIC_RUNTIME_BINDINGS.length, ids.size)
  assert.deepEqual(new Set(NUMERIC_RUNTIME_BINDINGS.map((entry) => entry.cardId)), ids)
  for (const entry of NUMERIC_RUNTIME_BINDINGS) {
    assert.match(entry.endpoint, /^\/api\//)
    assert.notEqual(entry.field, "data[*].numeric")
    assert.ok(entry.rendererId.length > 0)
  }
  const eia = NUMERIC_RUNTIME_BINDINGS.find((entry) => entry.cardId === "mundo-avanzado")
  assert.deepEqual(eia && {
    endpoint: eia.endpoint,
    rendererId: eia.rendererId,
    field: eia.field,
  }, {
    endpoint: "/api/energia-global?endpoint=production",
    rendererId: "mundo-avanzado",
    field: "data[*][*][1]",
  })
})

test("catalog coverage is distinct from runtime verification coverage", () => {
  assert.deepEqual(runtimeCoverage(), {
    catalogCards: 35,
    manifestEntries: 35,
    runtimeBoundCards: 35,
    runtimeVerifiedCards: 0,
    unverifiedCardIds: NUMERIC_SURFACE_MANIFEST.map((entry) => entry.cardId),
  })
  const verified = runtimeCoverage(["mundo-avanzado"])
  assert.equal(verified.runtimeVerifiedCards, 1)
  assert.equal(verified.unverifiedCardIds.length, 34)
})

test("runtime response gate accepts only finite data with valid provenance", () => {
  const available = assessNumericResponse({
    data: { ARG: [["2026-08", 321.5]] },
    numericManifest: [{
      source: "eia",
      unit: "thousand barrels per day",
      transform: "EIA value",
      asOf: "2026-08-31T23:59:59.000Z",
      retrievedAt: "2026-08-31T23:59:59.000Z",
      freshness: "fresh",
      estimate: false,
      status: "available",
    }],
  }, new Date("2026-09-01T00:00:00.000Z"))
  assert.equal(available, "available")
  assert.equal(assessNumericResponse({ data: { ARG: [["2026-08", 321.5]] } }), "unavailable")
  assert.equal(assessNumericResponse({
    data: { ARG: [["2026-08", 321.5]] },
    numeric: unavailableNumeric("HTTP 403"),
  }), "unavailable")
  assert.equal(assessNumericResponse({
    data: { ARG: [["2026-08", Number.NaN]] },
    numericManifest: [{
      source: "eia",
      unit: "thousand barrels per day",
      transform: "EIA value",
      asOf: "2026-08-31T23:59:59.000Z",
      retrievedAt: "2026-08-31T23:59:59.000Z",
      freshness: "fresh",
      estimate: false,
      status: "available",
    }],
  }, new Date("2026-09-01T00:00:00.000Z")), "unavailable")
})

test("only the EIA mundo-avanzado vertical may become available in R2B", () => {
  const eiaPayload = {
    data: { ARG: [["2026-08", 321.5]] },
    numericManifest: [{
      source: "eia" as const,
      unit: "thousand barrels per day",
      transform: "EIA value",
      asOf: "2026-08-31T23:59:59.000Z",
      retrievedAt: "2026-08-31T23:59:59.000Z",
      freshness: "fresh" as const,
      estimate: false,
      status: "available" as const,
    }],
  }
  const now = new Date("2026-09-01T00:00:00.000Z")
  assert.equal(assessNumericResponseForCard("mundo-avanzado", eiaPayload, now), "available")
  assert.equal(assessNumericResponseForCard("resumen-ipc", eiaPayload, now), "unavailable")
  assert.equal(assessNumericResponseForCard("mundo-avanzado", {
    ...eiaPayload,
    numericManifest: [{ ...eiaPayload.numericManifest[0], source: "bcra" as const }],
  }, now), "unavailable")
  assert.equal(assessNumericResponseForCard("mundo-avanzado", {
    ...eiaPayload,
    data: { ARG: [["2026-08", null]] },
  }, now), "unavailable")
  assert.equal(assessNumericResponseForCard("mundo-avanzado", {
    ...eiaPayload,
    data: { ARG: [[321.5, null]] },
  }, now), "unavailable")
})

test("the real card renderer consumes the numeric boundary", () => {
  const renderer = readFileSync("src/client/components/workspace/data-card-renderer.tsx", "utf8")
  assert.match(renderer, /NUMERIC_SURFACE_BY_ID/)
  assert.match(renderer, /NumericBoundary/)
  assert.match(renderer, /cardId=\{cardId\}/)
})
