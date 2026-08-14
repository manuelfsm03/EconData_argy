import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { DATA_CARD_CATALOG } from "../src/lib/card-catalog"
import { BCRA_VARIABLE_MAPPING } from "../src/server/sources/bcra-official-api"

const source = (path: string) => readFileSync(path, "utf8")

const bcraRoute = source("src/app/api/bcra/route.ts")
const breakevenRoute = source("src/app/api/breakeven/route.ts")
const economiaRoute = source("src/app/api/economia/route.ts")
const bcraUi = source("src/client/components/dashboard/tab-bcra.tsx")
const resumenUi = source("src/client/components/dashboard/tab-resumen.tsx")
const macroUi = source("src/client/components/dashboard/tab-macro.tsx")

test("TAMAR uses official BCRA variable 44 everywhere", () => {
  assert.equal(BCRA_VARIABLE_MAPPING.TAMAR_TNA.idVariable, 44)
  assert.match(bcraRoute, /fetchVar\(44, from\).*TAMAR/)
  assert.match(breakevenRoute, /getSeriesData\(\s*44,/)
  assert.match(economiaRoute, /getSeriesData\(\s*44,/)
})

test("BCRA endpoints keep BADLAR compatibility while making TAMAR primary", () => {
  assert.match(bcraRoute, /data: \{ tamar, badlar, tm20, tpm, pf30 \}/)
  assert.match(bcraRoute, /data: \{ tamar, badlar, dep30, adelantos, prestamos \}/)

  assert.match(breakevenRoute, /reference_name:\s*"TAMAR"/)
  assert.match(breakevenRoute, /tamar_tna:/)
  assert.match(breakevenRoute, /badlar_tna:/)
  assert.match(breakevenRoute, /tamar_fecha:\s*tamarFecha/)
  assert.match(breakevenRoute, /fecha:\s*badlarFecha/)

  assert.match(economiaRoute, /tamar:\s*\[\]/)
  assert.match(economiaRoute, /badlar:\s*\[\]/)
})

test("current dashboard reference is TAMAR and BADLAR remains historical", () => {
  assert.match(resumenUi, /useBCRAData\(\["reservas", "tamar", "badlar"\], "1m"\)/)
  assert.match(resumenUi, /Tasa TAMAR/)
  assert.match(resumenUi, /BADLAR histórica/)

  const plazoFijoStart = bcraUi.indexOf("export function PlazoFijoView")
  const plazoFijoEnd = bcraUi.indexOf("export function AgregadosView")
  const plazoFijoUi = bcraUi.slice(plazoFijoStart, plazoFijoEnd)
  assert.match(plazoFijoUi, /tamar: BCRAVar\[\]/)
  assert.match(plazoFijoUi, /TAMAR Bancos Privados/)
  assert.match(plazoFijoUi, /BADLAR histórica/)

  assert.match(macroUi, /TAMAR privados/)
  assert.match(macroUi, /tasas\.tamar_tna/)
})

test("workspace summary card requests TAMAR first and retains BADLAR", () => {
  const summary = DATA_CARD_CATALOG.find((card) => card.id === "resumen-reservas")
  assert.ok(summary)
  assert.equal(summary.title, "Reservas y TAMAR")
  assert.deepEqual(summary.endpoints[0].body, {
    series_ids: ["reservas", "tamar", "badlar"],
    period: "1m",
  })
})
