import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest } from "next/server"
import * as XLSX from "xlsx"

import { GET as calculateBond } from "../src/app/api/bonos/calculadora/route"
import { construirCashflows, GD30 } from "../src/lib/bond-schedule"
import {
  flujosFuturos,
  interesesCorridos,
  metricasDesdeTIR,
  metricasDevengadas,
  precioDadoTIR,
  tir,
} from "../src/lib/bond-math"
import { fechaUTC } from "../src/lib/market-calendar"
import { parseRemExcel, parseRemMensual } from "../src/server/domain/rem-data"
import { isRelevantHeadline } from "../src/server/domain/rss-news-policy"

function remWorkbook(includeTop10 = true): Buffer {
  const workbook = XLSX.utils.book_new()
  const olderSurvey = fechaUTC("2026-06-01")
  const latestSurvey = fechaUTC("2026-07-01")
  const variable = "Precios minoristas (IPC nivel general; INDEC)"

  const general = [
    ["encabezado"],
    ["encabezado 2"],
    [olderSurvey, variable, "var. % mensual", fechaUTC("2026-07-01"), 9.9],
    [latestSurvey, variable, "var. % mensual", fechaUTC("2026-09-01"), 1.7],
    [latestSurvey, variable, "var. % mensual", fechaUTC("2026-08-01"), 1.8],
    [latestSurvey, variable, "var. % i.a.", "Próx. 12 meses", 18.5],
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(general), "Base de Datos Completa")

  if (includeTop10) {
    const top10 = [
      ["encabezado"],
      ["encabezado 2"],
      [latestSurvey, variable, "var. % mensual", fechaUTC("2026-09-01"), "ignorar", 1.4],
      [latestSurvey, variable, "var. % mensual", fechaUTC("2026-08-01"), "ignorar", 1.5],
    ]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(top10), "Base Completa TOP-10")
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}

test("bond price and yield calculations round-trip on the verified GD30 schedule", () => {
  const settlement = fechaUTC("2026-04-28")
  const dirtyPrice = 64.44
  const cashflows = construirCashflows(GD30)
  const futureFlows = flujosFuturos(cashflows, settlement)
  const yieldPercent = tir(dirtyPrice, futureFlows, settlement)

  assert.notEqual(yieldPercent, null)
  const impliedPrice = precioDadoTIR(yieldPercent as number, futureFlows, settlement)
  assert.notEqual(impliedPrice, null)
  assert.ok(Math.abs((impliedPrice as number) - dirtyPrice) < 1e-9)

  const metrics = metricasDesdeTIR(yieldPercent as number, cashflows, settlement)
  assert.notEqual(metrics, null)
  assert.ok(Math.abs((metrics?.tir ?? 0) - (yieldPercent as number)) < 1e-9)
  assert.equal(precioDadoTIR(-100, futureFlows, settlement), null)
})

test("bond calculator rejects malformed and impossible settlement dates", async () => {
  for (const value of ["not-a-date", "2026-02-30"]) {
    const response = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5&liquidacion=${value}`,
    ))
    assert.equal(response.status, 400)
  }
})

test("bond calculator enforces the verified bond life and first-period accrual", async () => {
  for (const settlement of ["2019-01-01", "2030-07-09", "2031-01-01"]) {
    const response = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5&liquidacion=${settlement}`,
    ))
    assert.equal(response.status, 422)
  }

  const firstPeriod = await calculateBond(new NextRequest(
    "http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5&liquidacion=2020-10-01",
  ))
  assert.equal(firstPeriod.status, 200)
  const payload = await firstPeriod.json()
  assert.ok(payload.metricas.interesesCorridos > 0)
  assert.equal(payload.dayCount, "30/360 US")
  assert.equal(payload.frecuencia, "semestral")
  assert.equal(payload.dataQuality, "prospectus_schedule_verified")
})

test("bond calculator reports the explicit PR76 exclusion for S30S6", async () => {
  const response = await calculateBond(new NextRequest(
    "http://localhost/api/bonos/calculadora?ticker=S30S6&modo=tir&valor=12.5&liquidacion=2026-08-25",
  ))
  assert.equal(response.status, 422)
  const payload = await response.json()
  assert.equal(payload.estado, "excluido")
  assert.match(payload.error, /TEA|cashflow|verific/i)
})

test("bond calculator accepts zero and negative yields above -100 percent", async () => {
  for (const yieldPercent of [0, -0.25, -99.99, 1000]) {
    const response = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=${yieldPercent}&liquidacion=2026-04-28`,
    ))
    assert.equal(response.status, 200)
  }

  for (const yieldPercent of [-100, 1000.01]) {
    const response = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=${yieldPercent}&liquidacion=2026-04-28`,
    ))
    assert.equal(response.status, 400)
  }
})

test("bond calculator round-trips yields near -100 percent through clean price mode", async () => {
  for (const yieldPercent of [-99.9, -99.99]) {
    const fromYield = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=${yieldPercent}&liquidacion=2026-04-28`,
    ))
    assert.equal(fromYield.status, 200)
    const yieldPayload = await fromYield.json()

    const fromPrice = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=precio&valor=${yieldPayload.metricas.precioClean}&liquidacion=2026-04-28`,
    ))
    assert.equal(fromPrice.status, 200)
    const pricePayload = await fromPrice.json()
    assert.ok(Math.abs(pricePayload.metricas.tir - yieldPercent) < 1e-8)
  }
})

test("bond calculator rejects empty and non-decimal values", async () => {
  for (const value of ["", "%20", "0x10", "1e2", "NaN"]) {
    const response = await calculateBond(new NextRequest(
      `http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=${value}&liquidacion=2026-04-28`,
    ))
    assert.equal(response.status, 400)
  }
})

test("bond core fails closed before issuance and preserves explicit valuation dates", async () => {
  const cashflows = construirCashflows(GD30)
  const preIssuance = fechaUTC("2020-09-03")
  assert.equal(interesesCorridos(cashflows, preIssuance), 0)
  assert.equal(metricasDevengadas(cashflows, preIssuance), null)

  const response = await calculateBond(new NextRequest(
    "http://localhost/api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5&liquidacion=2026-05-09",
  ))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).liquidacion, "2026-05-09")
})

test("REM monthly parser selects the latest survey, orders periods, and reads the real TOP-10 column", () => {
  const parsed = parseRemMensual(remWorkbook())
  assert.deepEqual(parsed, {
    periodos: ["2026-08-01", "2026-09-01"],
    mediana: [1.8, 1.7],
    top10: [1.5, 1.4],
    fechaEncuesta: "2026-07-01",
  })

  const annual = parseRemExcel(remWorkbook())
  assert.equal(annual.serie.at(-1)?.inflacion_12m, 18.5)
})

test("REM monthly parser leaves missing TOP-10 evidence empty instead of synthesizing values", () => {
  const parsed = parseRemMensual(remWorkbook(false))
  assert.deepEqual(parsed?.mediana, [1.8, 1.7])
  assert.deepEqual(parsed?.top10, [])
})

test("REM monthly parser fails the complete TOP-10 series closed on an interior period gap", () => {
  const parsedWorkbook = XLSX.read(remWorkbook(), { type: "buffer", cellDates: true })
  const sheet = parsedWorkbook.Sheets["Base Completa TOP-10"]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  rows.splice(2, 1)
  parsedWorkbook.Sheets["Base Completa TOP-10"] = XLSX.utils.aoa_to_sheet(rows)
  const withGap = XLSX.write(parsedWorkbook, { type: "buffer", bookType: "xlsx" }) as Buffer

  const parsed = parseRemMensual(withGap)
  assert.deepEqual(parsed?.periodos, ["2026-08-01", "2026-09-01"])
  assert.deepEqual(parsed?.top10, [])
})

test("RSS negative terms override ambiguous positive matches without dropping real finance titles", () => {
  const relevantTerms = ["mercado", "bonos", "presidente", "banco", "título"]
  assert.equal(isRelevantHeadline("El mercado de bonos subió tras la decisión del BCRA", relevantTerms), true)
  assert.equal(isRelevantHeadline("Mercado de pases: el presidente del club confirmó un fichaje", relevantTerms), false)
  assert.equal(isRelevantHeadline("El banco de suplentes fue clave para ganar el título mundial", relevantTerms), false)
  assert.equal(isRelevantHeadline("La inflación fue el principal factor de presión sobre el mercado de bonos", relevantTerms), true)
  assert.equal(isRelevantHeadline("El actor de la novela habló de su carrera", ["actor"]), false)
})

test("ForumHub consumes trending topics as a bounded optional enhancement", () => {
  const source = readFileSync("src/client/components/workspace/forum-hub.tsx", "utf8")
  assert.match(source, /\/api\/foro\/trending\?hours=24&limit=6/)
  assert.match(source, /openThread\(topic\.assetType, topic\.ticker\)/)
  assert.match(source, /trending es un extra, no bloquea el resto del foro/)
})
