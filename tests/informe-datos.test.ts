import assert from "node:assert/strict"
import test from "node:test"

import { EXTRACTORES, formatearValor, unirPorFecha } from "../src/lib/informe/extractores"
import { calcularFrescura, diasHabilesEntre } from "../src/lib/informe/frescura"
import { semanaISO } from "../src/lib/informe/cargar"

test("todo extractor devuelve 'vacio' (no rompe, no inventa) ante payloads ausentes o malformados", () => {
  for (const [id, extraer] of Object.entries(EXTRACTORES)) {
    for (const basura of [null, undefined, {}, [], "texto", 42, { data: null }, { data: { datos: "x" } }]) {
      assert.equal(extraer(basura).tipo, "vacio", `${id} con ${JSON.stringify(basura)}`)
    }
  }
})

test("extractor de reservas une brutas y netas por fecha y toma la fecha del último dato del endpoint", () => {
  const r = EXTRACTORES.reservas({
    data: {
      brutas: [{ fecha: "2026-10-14", valor: 100 }, { fecha: "2026-10-15", valor: 110 }],
      netas: [{ fecha: "2026-10-14", brutas: 100, netas: 40 }, { fecha: "2026-10-15", brutas: 110, netas: null }],
      ultima: { fecha: "2026-10-15" },
    },
    source: "BCRA API v4.0",
  })
  assert.equal(r.tipo, "linea")
  if (r.tipo !== "linea") return
  assert.equal(r.ultimaFecha, "2026-10-15")
  assert.equal(r.fuenteEndpoint, "BCRA API v4.0")
  assert.deepEqual(r.filas, [
    { date: "2026-10-14", brutas: 100, netas: 40 },
    { date: "2026-10-15", brutas: 110 },
  ])
})

test("extractor de bandas excluye los puntos proyectados", () => {
  const r = EXTRACTORES.bandas({
    data: [
      { date: "2026-10-15", piso: 1, techo: 2, proyectado: false },
      { date: "2026-12-01", piso: 3, techo: 4, proyectado: true },
    ],
  })
  assert.equal(r.tipo, "linea")
  if (r.tipo !== "linea") return
  assert.equal(r.filas.length, 1)
  assert.equal(r.ultimaFecha, "2026-10-15")
})

test("el riesgo país distingue fecha de dato de fecha de consulta en la TIR de los Globales", () => {
  const r = EXTRACTORES.globales_tir({ data: { globalesTir: [{ ticker: "GD30", tir: 9.1, precio: 80, durationMod: 1.2 }] }, updated_at: "2026-10-16T12:00:00Z" })
  assert.equal(r.tipo, "tabla")
  if (r.tipo !== "tabla") return
  assert.equal(r.fechaTipo, "consulta")
  assert.equal(r.ultimaFecha, "2026-10-16")
})

test("unirPorFecha ordena y descarta puntos no numéricos", () => {
  const filas = unirPorFecha({ a: [{ fecha: "2026-01-02", valor: 2 }, { fecha: "2026-01-01", valor: 1 }, { fecha: "x", valor: null }], b: [{ fecha: "2026-01-02", valor: 5 }] })
  assert.deepEqual(filas, [{ date: "2026-01-01", a: 1 }, { date: "2026-01-02", a: 2, b: 5 }])
})

test("formatearValor muestra guion largo ante faltantes", () => {
  assert.equal(formatearValor(null, "pct2"), "—")
  assert.equal(formatearValor(undefined, "num0"), "—")
  assert.equal(formatearValor(Number.NaN, "num0"), "—")
  assert.equal(formatearValor("GD30", "texto"), "GD30")
})

test("días hábiles: de viernes a lunes hay 1", () => {
  assert.equal(diasHabilesEntre("2026-10-09", "2026-10-12"), 1) // vie -> lun
  assert.equal(diasHabilesEntre("2026-10-12", "2026-10-12"), 0)
})

test("frescura usa la ventana del registro: diaria en días hábiles, mensual en días corridos", () => {
  // bcra_official es official_daily (aviso a 36 h): 1 día hábil está al día, 3 no.
  assert.equal(calcularFrescura("2026-10-15", "bcra_official", "2026-10-16").estado, "al_dia")
  assert.equal(calcularFrescura("2026-10-12", "bcra_official", "2026-10-16").estado, "atrasado")
  // bcra_files es official_monthly (aviso a 45 días corridos).
  assert.equal(calcularFrescura("2026-09-05", "bcra_files", "2026-10-16").estado, "al_dia")
  assert.equal(calcularFrescura("2026-07-31", "bcra_files", "2026-10-16").estado, "atrasado")
  assert.equal(calcularFrescura(null, "bcra_files", "2026-10-16").estado, "sin_fecha")
})

test("semana ISO", () => {
  assert.deepEqual(semanaISO("2026-10-16"), { anio: 2026, semana: 42 })
  assert.deepEqual(semanaISO("2026-01-01"), { anio: 2026, semana: 1 })
  assert.deepEqual(semanaISO("2027-01-01"), { anio: 2026, semana: 53 })
})
