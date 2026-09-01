import assert from "node:assert/strict"
import test from "node:test"

import { inspectRuntimeData } from "../src/lib/runtime-data-health"
import { parseEcbRatesCsv } from "../src/server/domain/ecb-fx-rates"

test("runtime metadata prefers the observation date over a request-time updated_at", () => {
  const metadata = inspectRuntimeData({
    source: "ArgentinaDatos",
    updated_at: "2026-09-01T20:00:00.000Z",
    data: [
      { date: "2026-08-30", blue: 1545 },
      { date: "2026-08-31", blue: 1555 },
    ],
  })
  assert.equal(metadata.source, "ArgentinaDatos")
  assert.equal(metadata.timestamp, "2026-08-31")
  assert.equal(metadata.hasData, true)
})

test("runtime provenance headers take precedence over payload projections", () => {
  const headers = new Headers({
    "X-Data-Source": "DolarAPI",
    "X-Data-As-Of": "2026-09-01T19:00:00.000Z",
  })
  const metadata = inspectRuntimeData({ updated_at: "2026-09-01T20:00:00.000Z", data: [{ date: "2027-01-01", value: 1 }] }, headers)
  assert.equal(metadata.source, "DolarAPI")
  assert.equal(metadata.timestamp, "2026-09-01T19:00:00.000Z")
})

test("ECB CSV parser reads the current EXR.D.CURRENCY key shape", () => {
  const csv = [
    "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE",
    "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-09-01,1.159",
    "EXR.D.BRL.EUR.SP00.A,D,BRL,EUR,SP00,A,2026-09-01,6.0255",
  ].join("\n")
  assert.deepEqual(parseEcbRatesCsv(csv), [
    { par: "EUR/USD", nombre: "Dólar estadounidense", valor: 1.159, fecha: "2026-09-01" },
    { par: "EUR/BRL", nombre: "Real brasileño", valor: 6.0255, fecha: "2026-09-01" },
  ])
})
