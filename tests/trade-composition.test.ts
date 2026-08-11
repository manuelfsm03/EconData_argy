import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildIcaTradeComposition,
  buildSitcShareComposition,
} from "../src/server/domain/trade-composition"

const macroRoute = readFileSync("src/app/api/macro/route.ts", "utf8")
const macroUi = readFileSync("src/client/components/dashboard/tab-macro.tsx", "utf8")
const cardCatalog = readFileSync("src/lib/card-catalog.ts", "utf8")

test("builds observed monthly ICA composition in USD millions", () => {
  const result = buildIcaTradeComposition([
    {
      indice_tiempo: "2026-06-01",
      ica_exportacion_productos_primarios: "1886.363",
      ica_exportacion_manufacturas_origen_agropecuario: "3344.373",
      ica_exportacion_manufacturas_origen_industrial: "2418.270",
      ica_exportacion_combustible_energia: "1405.979",
      ica_importaciones_bienes_capital: "1119.194",
      ica_importaciones_bienes_intermedios: "2343.581",
      ica_importaciones_combustibles_lubricantes: "794.489",
      ica_importaciones_piezas_accesorios_bienes_capital: "1094.301",
      ica_importaciones_bienes_consumo: "922.777",
      ica_importaciones_vehiculos_automotores_pasajeros: "455.407",
      ica_importaciones_resto: "",
    },
  ])

  assert.equal(result.unidad, "USD millones")
  assert.deepEqual(result.expo.series[0], {
    date: "2026-06-01",
    "Prod. Primarios": 1886.36,
    MOA: 3344.37,
    MOI: 2418.27,
    Combustibles: 1405.98,
  })
  assert.equal(result.impo.series[0].Resto, null)
})

test("keeps historical SITC composition as percentage shares", () => {
  const result = buildSitcShareComposition([
    { geocodigoFundar: "ARG", year: "2021", sitc_product_name_es: "Alimentos", export_value_pc: "32.456" },
    { geocodigoFundar: "ARG", year: "2021", sitc_product_name_es: "Combustibles", export_value_pc: "7.5" },
    { geocodigoFundar: "BRA", year: "2021", sitc_product_name_es: "Alimentos", export_value_pc: "99" },
    { geocodigoFundar: "ARG", year: "2020", sitc_product_name_es: "Alimentos", export_value_pc: "" },
  ], "export_value_pc")

  assert.equal(result.unidad, "% del total")
  assert.deepEqual(result.series, [{ date: "2021-01-01", Alimentos: 32.46, Combustibles: 7.5 }])
})

test("route and consumers expose honest units without per-request Comtrade fan-out", () => {
  assert.match(macroRoute, /endpoint === "comext_sitc"/)
  assert.match(macroRoute, /Intercambio Comercial Argentino/)
  assert.doesNotMatch(macroRoute, /comtradeapi\.un\.org/)
  assert.match(macroUi, /USD MILLONES MENSUALES/)
  assert.match(cardCatalog, /comext_sitc/)
  assert.match(cardCatalog, /SITC histórico \(%\)/)
})
