import assert from "node:assert/strict"
import test from "node:test"

import {
  aggregateFamilyVolume, parseBymaVolumeSeries, parseDollarLinkedUniverse,
} from "../src/server/domain/dollar-linked"

// FIXTURES SINTETICOS: tickers, fechas y cantidades inventados para testear la
// logica. NO son datos de mercado ni muestran la forma real de la respuesta de BYMA.
const NOW = new Date("2026-10-15T12:00:00Z")

test("universo (fixture sintetico): detecta por ticker y por descripcion, descarta vencidos y duplicados", () => {
  const payload = {
    data: [
      { symbol: "TVXX1", maturityDate: "2027-01-31", description: "Bono sintetico A" },
      { symbol: "ZZDL1", maturityDate: "31/03/2027", description: "Letra del Tesoro dollar linked sintetica" },
      { symbol: "TVOLD", maturityDate: "2026-01-31", description: "vencido sintetico" },
      { symbol: "XXPES", maturityDate: "2027-05-31", description: "Letra en pesos tasa fija sintetica" },
      { symbol: "tvxx1", maturityDate: "2027-01-31" },
      null,
      { maturityDate: "2027-01-01" },
    ],
  }
  const out = parseDollarLinkedUniverse(payload, NOW)
  assert.deepEqual(out.map((i) => i.ticker), ["TVXX1", "ZZDL1"])
  assert.equal(out[1].vencimiento, "2027-03-31")
})

test("universo: payload invalido o vacio devuelve lista vacia", () => {
  assert.deepEqual(parseDollarLinkedUniverse(null, NOW), [])
  assert.deepEqual(parseDollarLinkedUniverse({ data: "x" }, NOW), [])
  assert.deepEqual(parseDollarLinkedUniverse([], NOW), [])
})

test("serie (fixture sintetico): ignora filas sin cierre y volumenes invalidos", () => {
  const t0 = 1_800_000_000
  const series = parseBymaVolumeSeries({
    s: "ok", t: [t0, t0 + 86_400, t0 + 2 * 86_400], c: [0, 100, 101], v: [50, 10, null],
  })
  assert.equal(series.length, 2)
  assert.equal(series[0].volume, 10)
  assert.equal(series[1].volume, null)
  assert.deepEqual(parseBymaVolumeSeries({ s: "no_data" }), [])
})

test("agregado (fixture sintetico): suma por fecha y no inventa dias sin volumen", () => {
  const a = [{ date: "2026-10-13", close: 1, volume: 10 }, { date: "2026-10-14", close: 1, volume: 5 }]
  const b = [{ date: "2026-10-14", close: 1, volume: 7 }, { date: "2026-10-15", close: 1, volume: null }]
  const agg = aggregateFamilyVolume(new Map([["A", a], ["B", b]]))
  assert.deepEqual(agg, [
    { date: "2026-10-13", volume: 10, instruments: 1 },
    { date: "2026-10-14", volume: 12, instruments: 2 },
  ])
  assert.deepEqual(aggregateFamilyVolume(new Map()), [])
})
