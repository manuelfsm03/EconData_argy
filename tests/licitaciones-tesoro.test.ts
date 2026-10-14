import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  clasificarInstrumento, extraerLinksComunicados, mergeLicitaciones, parseFecha, parseLicitacion, parseMonto,
} from "../src/lib/licitaciones-tesoro"

// Fixture SINTETICO (ver comentario en el HTML): no son datos reales.
const html = readFileSync("tests/fixtures/licitacion-tesoro.SINTETICO.html", "utf8")

test("parseMonto tolera formato AR y US y rechaza basura", () => {
  assert.equal(parseMonto("1.234.567,89"), 1234567.89)
  assert.equal(parseMonto("1,234,567.5"), 1234567.5)
  assert.equal(parseMonto("$ 1.500.000"), 1500000)
  assert.equal(parseMonto(""), null)
  assert.equal(parseMonto("s/d"), null)
})

test("parseFecha acepta varios formatos y rechaza fechas imposibles", () => {
  assert.equal(parseFecha("14 de octubre de 2026"), "2026-10-14")
  assert.equal(parseFecha("31/12/2026"), "2026-12-31")
  assert.equal(parseFecha("2026-10-14"), "2026-10-14")
  assert.equal(parseFecha("31/02/2026"), null)
})

test("clasificarInstrumento distingue familias", () => {
  assert.equal(clasificarInstrumento("LECAP S31X6"), "LECAP")
  assert.equal(clasificarInstrumento("BONCAP T30A7"), "BONCAP")
  assert.equal(clasificarInstrumento("Bono CER X15Y7"), "CER")
  assert.equal(clasificarInstrumento("Bono Dual"), "DUAL")
  assert.equal(clasificarInstrumento("Letra Dollar Linked D30N6"), "DOLLAR_LINKED")
})

test("parseLicitacion extrae instrumentos, totales y calcula rollover", () => {
  const l = parseLicitacion(html, { fuenteUrl: "https://ejemplo.invalid/x" })
  assert.equal(l.fecha, "2026-10-14")
  assert.equal(l.instrumentos.length, 3) // la fila Total se excluye
  assert.equal(l.instrumentos[0].tipo, "LECAP")
  assert.equal(l.instrumentos[0].vencimiento, "2026-12-31")
  assert.equal(l.monto_ofertado_total, 3000000)
  assert.equal(l.monto_adjudicado_total, 2000000)
  assert.equal(l.vencimientos_a_cubrir, 1600000)
  assert.equal(l.rollover, 1.25)
  assert.equal(l.incompleta, false)
})

test("campo faltante no se inventa: queda null y la fila es incompleta", () => {
  const l = parseLicitacion(html)
  assert.equal(l.instrumentos[2].monto_adjudicado, null)
  const sinTotales = parseLicitacion("<p>Licitacion del 14/10/2026</p>")
  assert.equal(sinTotales.incompleta, true)
  assert.equal(sinTotales.rollover, null)
  assert.ok(sinTotales.faltantes.includes("instrumentos"))
  assert.ok(sinTotales.faltantes.includes("vencimientos_a_cubrir"))
})

test("alias de columnas configurables", () => {
  const h = "<table><tr><th>Papel</th><th>Adj.</th></tr><tr><td>LECAP X</td><td>10</td></tr></table>"
  const l = parseLicitacion(h, { fecha: "2026-10-14", columnAliases: { nombre: ["papel"], adjudicado: ["adj."] } })
  assert.equal(l.instrumentos[0].monto_adjudicado, 10)
})

test("extraerLinksComunicados resuelve URLs relativas; merge reemplaza por fecha", () => {
  const links = extraerLinksComunicados(html, "https://ejemplo.invalid/economia/finanzas/")
  assert.equal(links[0].url, "https://ejemplo.invalid/economia/finanzas/licitacion-1")
  const a = parseLicitacion(html)
  const merged = mergeLicitaciones([{ ...a, rollover: 0 }], [a])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].rollover, 1.25)
})
