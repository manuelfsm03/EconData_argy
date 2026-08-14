import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { NextRequest } from "next/server"
import * as XLSX from "xlsx"

import { GET as calculateBond } from "../src/app/api/bonos/calculadora/route"
import { construirCashflows, GD30 } from "../src/lib/bond-schedule"
import {
  flujosFuturos,
  metricasDesdeTIR,
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

test("REM monthly parser selects the latest survey, orders periods, and reads the real TOP-10 column", () => {
  const parsed = parseRemMensual(remWorkbook())
  assert.deepEqual(parsed, {
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

test("RSS negative terms override ambiguous positive matches without dropping real finance titles", () => {
  const relevantTerms = ["mercado", "bonos", "presidente", "banco", "título"]
  assert.equal(isRelevantHeadline("El mercado de bonos subió tras la decisión del BCRA", relevantTerms), true)
  assert.equal(isRelevantHeadline("Mercado de pases: el presidente del club confirmó un fichaje", relevantTerms), false)
  assert.equal(isRelevantHeadline("El banco de suplentes fue clave para ganar el título mundial", relevantTerms), false)
})

test("ForumHub consumes trending topics as a bounded optional enhancement", () => {
  const source = readFileSync("src/client/components/workspace/forum-hub.tsx", "utf8")
  assert.match(source, /\/api\/foro\/trending\?hours=24&limit=6/)
  assert.match(source, /openThread\(topic\.assetType, topic\.ticker\)/)
  assert.match(source, /trending es un extra, no bloquea el resto del foro/)
})
