import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync("src/app/api/ust-curve/route.ts", "utf8")

test("bills branch reuses home.treasury.gov, no new external domain", () => {
  assert.match(route, /tipoParam === "bills"/)
  assert.match(route, /daily_treasury_bill_rates/)
  const domainMatches = route.match(/https?:\/\/[^"'`\s]+/g) ?? []
  for (const url of domainMatches) {
    assert.match(url, /^https:\/\/home\.treasury\.gov\//)
  }
})

test("bill maturities use coupon equivalent, not bank discount", () => {
  const billsSection = route.slice(route.indexOf("BILL_MATURITIES"), route.indexOf("fetchLatestTreasuryRow"))
  assert.match(billsSection, /COUPON EQUIVALENT/)
  assert.doesNotMatch(billsSection, /BANK DISCOUNT/)
  for (const weeks of ["4", "6", "8", "13", "17", "26", "52"]) {
    assert.match(billsSection, new RegExp(`${weeks} WEEKS COUPON EQUIVALENT`))
  }
})

test("default GET (sin ?tipo) sigue devolviendo la curva par, sin romper compatibilidad", () => {
  assert.match(route, /daily_treasury_yield_curve/)
  const defaultBranch = route.slice(route.indexOf("async function fetchYieldCurve"), route.indexOf("export async function GET"))
  assert.match(defaultBranch, /fetchCsvCurve\("daily_treasury_yield_curve", MATURITIES\)/)
})
