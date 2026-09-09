import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { DATA_CARD_CATALOG } from "../src/lib/card-catalog"
import { cbotUsdTon } from "../src/lib/agro"

const localRoute = readFileSync("src/app/api/agro-local/route.ts", "utf8")
const commoditiesRoute = readFileSync("src/app/api/commodities/route.ts", "utf8")
const agroUi = readFileSync("src/client/components/dashboard/tab-macro.tsx", "utf8")
const financeUi = readFileSync("src/client/components/dashboard/tab-finanzas.tsx", "utf8")
const agroView = agroUi.slice(agroUi.indexOf("function AgroView()"), agroUi.indexOf("// ── Main Component"))

 test("Agro is available to the catalog and canvas through the canonical card registry", () => {
  const agro = DATA_CARD_CATALOG.find((card) => card.id === "agro")
  assert.ok(agro)
  assert.equal(agro.tab, "macro")
  assert.equal(agro.subtab, "agro")
  assert.ok(agro.endpoints.some((endpoint) => endpoint.path === "/api/agro-local"))
})

test("CBOT US cents per bushel convert explicitly to USD per tonne", () => {
  assert.equal(cbotUsdTon(1000, "ZS=F"), 367.44)
  assert.equal(cbotUsdTon(1000, "ZC=F"), 393.68)
  assert.equal(cbotUsdTon(null, "ZS=F"), null)
  assert.equal(cbotUsdTon(1000, "ZL=F"), null)
})

test("local agro data never fabricates FOB or withholding rates", () => {
  assert.match(localRoute, /fobOficial:\s*null/)
  assert.match(localRoute, /retencion:\s*null/)
  assert.doesNotMatch(localRoute, /GASTOS_PORTUARIOS|RETENCIONES|precio \* \(1 - retencion\)/)
  assert.doesNotMatch(financeUi, /FOB teórico|gastos portuarios/)
})

test("Agro sources load independently and expose response failures", () => {
  assert.doesNotMatch(agroView, /Promise\.all\(/)
  assert.match(agroUi, /response\.ok/)
  assert.match(agroUi, /type AgroSourceStatus = "loading" \| "ok" \| "error" \| "unavailable"/)
  assert.match(agroView, /source=|Fuente:/)
  assert.match(agroView, /Sin datos|No disponible|Error/)
  assert.match(commoditiesRoute, /fechaActualizacion/)
  assert.match(agroView, /cierre diario/i)
})

test("Agro production keeps annual years and millions-of-tonnes metadata visible", () => {
  assert.match(agroUi, /millones de toneladas/i)
  assert.match(agroUi, /dataKey=\"date\"/)
  assert.match(agroUi, /Our World in Data \/ FAO/)
  assert.match(agroUi, /último año|año/i)
})
