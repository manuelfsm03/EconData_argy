import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { combinarPrecios, parseDiferencial, parsePizarra } from "../src/server/external/granos-ar"

const route = readFileSync("src/app/api/agro-precios/route.ts", "utf8")

const pizarra = {
  meta: { fuente: "granos.ar" },
  data: {
    fecha: "2026-09-09",
    tipo_cambio_bna_divisas: 1504,
    fuente_precios: "Consiagro / BCR Rosario",
    granos: {
      soja: { ars_tn: 555000, usd_tn: 369.02, variacion_pct_vs_rueda_anterior: -0.18 },
      maiz: { ars_tn: 293400, usd_tn: 195.08, variacion_pct_vs_rueda_anterior: 0.1 },
      trigo: { ars_tn: 346700, usd_tn: 230.52, variacion_pct_vs_rueda_anterior: 0.29 },
      sorgo: { ars_tn: 275300, usd_tn: 183.05, variacion_pct_vs_rueda_anterior: 0.11 },
      girasol: { ars_tn: 760000, usd_tn: 505.32, variacion_pct_vs_rueda_anterior: 0 },
    },
  },
}

const diferencial = {
  meta: { fuente: "granos.ar" },
  data: {
    fecha: "2026-09-10",
    tipo_cambio: { valor: 1504 },
    soja: { fob_usd_tn: 369.02, cbot_usd_tn: 489.34, diferencial_usd_tn: -120.32 },
    maiz: { fob_usd_tn: 195.08, cbot_usd_tn: 210.03, diferencial_usd_tn: -14.95 },
    trigo: { fob_usd_tn: 230.52, cbot_usd_tn: 272.46, diferencial_usd_tn: -41.94 },
  },
}

test("parsePizarra ordena los 5 granos y traduce maíz con tilde", () => {
  const p = parsePizarra(pizarra)
  assert.ok(p)
  assert.deepEqual(p.precios.map(g => g.grano), ["Soja", "Maíz", "Trigo", "Sorgo", "Girasol"])
  assert.equal(p.precios[0].arsTn, 555000)
  assert.equal(p.precios[0].usdTn, 369.02)
  assert.equal(p.precios[0].variacionPct, -0.18)
  assert.equal(p.tipoCambio, 1504)
  assert.equal(p.fuentePrecios, "Consiagro / BCR Rosario")
})

test("parsePizarra devuelve null si el sobre no trae granos", () => {
  assert.equal(parsePizarra({ meta: {}, data: { fecha: "x" } }), null)
  assert.equal(parsePizarra({ meta: {}, error: "boom" }), null)
})

test("un grano con precio faltante queda en null, no en 0", () => {
  const roto = { meta: {}, data: { granos: { soja: { ars_tn: 100, usd_tn: null as unknown as number, variacion_pct_vs_rueda_anterior: 1 } } } }
  const p = parsePizarra(roto)
  assert.ok(p)
  assert.equal(p.precios[0].usdTn, null)
  assert.equal(p.precios[0].arsTn, 100)
})

test("parseDiferencial arma soja/maíz/trigo con FOB, CBOT y diferencial", () => {
  const d = parseDiferencial(diferencial)
  assert.deepEqual(d.map(x => x.grano), ["Soja", "Maíz", "Trigo"])
  assert.equal(d[0].fobUsdTn, 369.02)
  assert.equal(d[0].cbotUsdTn, 489.34)
  assert.equal(d[0].diferencialUsdTn, -120.32)
})

test("combinarPrecios une pizarra + diferencial en un solo payload", () => {
  const combinado = combinarPrecios(pizarra, diferencial)
  assert.ok(combinado)
  assert.equal(combinado.precios.length, 5)
  assert.equal(combinado.diferenciales.length, 3)
  assert.equal(combinado.fecha, "2026-09-09")
})

test("combinarPrecios devuelve null si la pizarra no es usable (no dibuja vacío)", () => {
  assert.equal(combinarPrecios({ meta: {}, error: "down" }, diferencial), null)
})

test("el endpoint pega a la API pública de granos.ar y rinde la atribución", () => {
  assert.match(route, /granosar\.lfcaucino\.workers\.dev|GRANOS_AR_BASE/)
  assert.match(route, /\/pizarra/)
  assert.match(route, /cbot\/diferencial/)
  assert.match(route, /atribuci[oó]n/i)
  // cachea del lado nuestro, como pide la licencia de granos.ar
  assert.match(route, /guardarExito|leerFresco/)
})
