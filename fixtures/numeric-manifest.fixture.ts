import type { NumericRecord } from "../src/server/numeric/manifest"

/** Exact, deterministic values used by the NUM contract tests only. */
export const EIA_PRODUCTION_FIXTURE: NumericRecord = {
  value: 321.5,
  source: "eia",
  unit: "thousand barrels per day",
  transform: "EIA value for ARG, activity=production, product=crude oil, unit=TBPD",
  asOf: "2026-08-25T00:00:00.000Z",
  retrievedAt: "2026-08-25T12:00:00.000Z",
  freshness: "fresh",
  estimate: false,
  status: "available",
}

export const REM_ESTIMATE_FIXTURE: NumericRecord = {
  value: 4.2,
  source: "eia",
  unit: "% month over month",
  transform: "fixture-only illustrative estimate; not displayed as official live data",
  asOf: "2026-08-25T00:00:00.000Z",
  retrievedAt: "2026-08-25T12:00:00.000Z",
  freshness: "fresh",
  estimate: true,
  status: "estimated",
}

export const UNAVAILABLE_SOURCE_FIXTURE: NumericRecord = {
  value: null,
  source: "unavailable",
  unit: "not available",
  transform: "source returned HTTP 403; fail closed",
  asOf: null,
  retrievedAt: null,
  freshness: "unavailable",
  estimate: false,
  status: "unavailable",
}
