import assert from "node:assert/strict"
import test from "node:test"
import { buildSovereignCurve } from "../src/lib/sovereign-curve"

test("fits independent local-law and New-York-law curves", () => {
  const curve = buildSovereignCurve([
    { ticker: "GD1", law: "NY", duration: 1, ytm: 10 },
    { ticker: "GD2", law: "NY", duration: 2, ytm: 11 },
    { ticker: "GD3", law: "NY", duration: 3, ytm: 12 },
    { ticker: "AL1", law: "local", duration: 1, ytm: 20 },
    { ticker: "AL2", law: "local", duration: 2, ytm: 21 },
    { ticker: "AL3", law: "local", duration: 3, ytm: 22 },
  ])

  const gd2 = curve.find((point) => point.ticker === "GD2")
  const al2 = curve.find((point) => point.ticker === "AL2")

  assert.equal(gd2?.fittedYtm, 11)
  assert.equal(al2?.fittedYtm, 21)
  assert.equal(gd2?.residualBps, 0)
  assert.equal(al2?.residualBps, 0)
})

test("classifies positive yield residuals as cheap and negative residuals as expensive", () => {
  const curve = buildSovereignCurve([
    { ticker: "A", law: "NY", duration: 1, ytm: 10 },
    { ticker: "B", law: "NY", duration: 2, ytm: 13 },
    { ticker: "C", law: "NY", duration: 3, ytm: 10 },
    { ticker: "D", law: "NY", duration: 4, ytm: 7 },
  ])

  const cheap = curve.find((point) => point.ticker === "B")
  const expensive = curve.find((point) => point.ticker === "D")

  assert.equal(cheap?.valuation, "barato")
  assert.ok((cheap?.residualBps ?? 0) > 5)
  assert.equal(expensive?.valuation, "caro")
  assert.ok((expensive?.residualBps ?? 0) < -5)
})

test("withholds residuals when a law has too few or degenerate observations", () => {
  const curve = buildSovereignCurve([
    { ticker: "GD1", law: "NY", duration: 1, ytm: 10 },
    { ticker: "GD2", law: "NY", duration: 2, ytm: 11 },
    { ticker: "AL1", law: "local", duration: 2, ytm: 20 },
    { ticker: "AL2", law: "local", duration: 2, ytm: 21 },
    { ticker: "AL3", law: "local", duration: 2, ytm: 22 },
  ])

  for (const point of curve) {
    assert.equal(point.fittedYtm, null)
    assert.equal(point.residualBps, null)
    assert.equal(point.valuation, "sin_referencia")
  }
})
