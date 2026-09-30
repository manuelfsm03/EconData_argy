import test from "node:test"
import assert from "node:assert/strict"

import { parseLetras, tasasAplicables, TOLERANCIA_PRECIO_PCT } from "../src/server/external/argentinadatos-letras"

// Recorte del payload real de https://api.argentinadatos.com/v1/finanzas/letras
// tomado el 2026-09-30. Se conservan los campos tal como los publica la fuente.
const PAYLOAD_REAL = {
  fechaActualizacion: "2026-09-30T01:20:56.334Z",
  letras: [
    {
      ticker: "S16O6",
      precioArs: 104.22,
      tnaPorcentaje: 23.1,
      teaPorcentaje: 25.84,
      temPorcentaje: 1.93,
      fechaVencimiento: "2026-10-16",
      diasAlVencimiento: 16,
      isin: "AR0183520128",
    },
    {
      ticker: "S30O6",
      precioArs: 133.05,
      tnaPorcentaje: 20.35,
      teaPorcentaje: 22.36,
      temPorcentaje: 1.7,
      fechaVencimiento: "2026-10-30",
      diasAlVencimiento: 30,
      isin: "AR0475783251",
    },
    {
      // Tasas negativas: existen de verdad en los duales, no se filtran.
      ticker: "TTD26",
      precioArs: 171.83,
      tnaPorcentaje: -29.86,
      teaPorcentaje: -26.53,
      temPorcentaje: -2.54,
      fechaVencimiento: "2026-12-15",
    },
  ],
}

test("parsea las letras del payload real y conserva el precio de referencia", () => {
  const { letras, asOf } = parseLetras(PAYLOAD_REAL)

  assert.equal(asOf, "2026-09-30T01:20:56.334Z")
  assert.equal(letras.size, 3)

  const s16 = letras.get("S16O6")
  assert.ok(s16)
  assert.equal(s16.tna, 23.1)
  assert.equal(s16.tea, 25.84)
  assert.equal(s16.tem, 1.93)
  assert.equal(s16.precioReferencia, 104.22)
  assert.equal(s16.vencimiento, "2026-10-16")
})

test("conserva las tasas negativas", () => {
  const { letras } = parseLetras(PAYLOAD_REAL)
  assert.equal(letras.get("TTD26")?.tem, -2.54)
})

test("descarta filas sin ninguna tasa, para no confundirlas con una letra sin datos", () => {
  const { letras } = parseLetras({
    letras: [
      { ticker: "SINTASA", precioArs: 100 },
      { ticker: "CONTASA", precioArs: 100, temPorcentaje: 2 },
    ],
  })

  assert.equal(letras.has("SINTASA"), false)
  assert.equal(letras.has("CONTASA"), true)
})

test("tolera payloads corruptos sin romper", () => {
  for (const basura of [null, undefined, 42, "texto", {}, { letras: "no es lista" }, { letras: [null, 7] }]) {
    const { letras } = parseLetras(basura)
    assert.equal(letras.size, 0)
  }
})

test("ignora tasas que no son números finitos", () => {
  const { letras } = parseLetras({
    letras: [{ ticker: "X", precioArs: 100, tnaPorcentaje: "no", teaPorcentaje: null, temPorcentaje: 1.5 }],
  })

  const x = letras.get("X")
  assert.equal(x?.tna, null)
  assert.equal(x?.tea, null)
  assert.equal(x?.tem, 1.5)
})

test("publica las tasas cuando el precio del panel coincide con el de la fuente", () => {
  const { letras } = parseLetras(PAYLOAD_REAL)
  const aplicables = tasasAplicables(letras.get("S16O6"), 104.22)

  assert.equal(aplicables?.tea, 25.84)
})

test("no publica las tasas si el precio del panel se despegó del de la fuente", () => {
  const { letras } = parseLetras(PAYLOAD_REAL)

  // 5% arriba: la TEA de la fuente describiría otro precio.
  assert.equal(tasasAplicables(letras.get("S16O6"), 109.43), null)
  // Dentro de la tolerancia, sí.
  assert.ok(tasasAplicables(letras.get("S16O6"), 104.8))
})

test("la tolerancia se mide en porcentaje del precio de la fuente", () => {
  const tasas = { ticker: "T", precioReferencia: 100, tna: 1, tea: 1, tem: 1, vencimiento: null }

  assert.ok(tasasAplicables(tasas, 101, 1))
  assert.equal(tasasAplicables(tasas, 101.5, 1), null)
  assert.ok(tasasAplicables(tasas, 101.5, 2))
  assert.equal(TOLERANCIA_PRECIO_PCT, 1)
})

test("si el panel no tiene precio, las tasas se publican con su propia referencia", () => {
  const { letras } = parseLetras(PAYLOAD_REAL)

  assert.ok(tasasAplicables(letras.get("S16O6"), null))
  assert.ok(tasasAplicables(letras.get("S16O6"), 0))
})

test("una letra que no está en la fuente no devuelve tasas", () => {
  assert.equal(tasasAplicables(undefined, 100), null)
})
