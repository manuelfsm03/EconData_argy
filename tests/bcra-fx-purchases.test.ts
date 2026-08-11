import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildBcraPurchaseSeries,
  summarizeBcraPurchases,
} from "../src/server/domain/bcra-fx-purchases"

const routeSource = readFileSync("src/app/api/bcra/route.ts", "utf8")

test("normalizes, deduplicates, sorts and accumulates official daily flows by month", () => {
  const rows = buildBcraPurchaseSeries([
    { fecha: "2026-08-05", valor: 8 },
    { fecha: "2026-07-31", valor: -20 },
    { fecha: "2026-08-03", valor: 18 },
    { fecha: "2026-08-04", valor: 28 },
    { fecha: "2026-08-04", valor: 30 },
    { fecha: "bad", valor: 99 },
    { fecha: "2026-08-06", valor: Number.NaN },
  ])

  assert.deepEqual(rows, [
    { fecha: "2026-07-31", monto: -20, acumulado_mensual: -20 },
    { fecha: "2026-08-03", monto: 18, acumulado_mensual: 18 },
    { fecha: "2026-08-04", monto: 30, acumulado_mensual: 48 },
    { fecha: "2026-08-05", monto: 8, acumulado_mensual: 56 },
  ])
})

test("summarizes the complete latest year while limiting only the visible window", () => {
  const input = [
    { fecha: "2025-12-31", monto: 50, acumulado_mensual: 50 },
    { fecha: "2026-01-02", monto: 100, acumulado_mensual: 100 },
    { fecha: "2026-01-05", monto: -40, acumulado_mensual: 60 },
    { fecha: "2026-08-03", monto: 18, acumulado_mensual: 18 },
    { fecha: "2026-08-04", monto: 28, acumulado_mensual: 46 },
    { fecha: "2026-08-05", monto: 8, acumulado_mensual: 54 },
  ]

  const result = summarizeBcraPurchases(input, 3)
  assert.deepEqual(result.datos.map(row => row.fecha), ["2026-08-03", "2026-08-04", "2026-08-05"])
  assert.deepEqual(result.resumen, {
    fecha_corte: "2026-08-05",
    mes_actual: 54,
    acumulado_anual: 114,
    mayor_compra_periodo: 28,
    mayor_venta_periodo: null,
  })
})

test("route uses BCRA variable 78 and removes the retired aggregator", () => {
  assert.match(routeSource, /fetchVar\(78,/)
  assert.match(routeSource, /Variación de reservas internacionales por compra de divisas/)
  assert.match(routeSource, /setCache\(cacheKey, result, 900\)/)
  assert.doesNotMatch(routeSource, /argentinadatos\.com\/api\/v1\/finanzas\/compras-dolar-bcra/)
})
