import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { bloquesDeTexto, parseInforme, parseNombreArchivo, SECCION_IDS } from "../src/lib/informe/markdown"

test("parsea frontmatter y un bloque por sección", () => {
  const md = [
    "---",
    "anio: 2026",
    "semana: 42",
    "fecha_corte: 2026-10-16",
    "titulo: Semana de calma",
    "---",
    "## deuda-usd",
    "El riesgo país cerró estable.",
    "",
    "Segundo párrafo.",
    "## reservas",
    "- compró el BCRA",
    "- subieron las brutas",
  ].join("\n")
  const r = parseInforme(md)
  assert.deepEqual(r.meta, { anio: 2026, semana: 42, fechaCorte: "2026-10-16", titulo: "Semana de calma" })
  assert.equal(r.secciones["deuda-usd"], "El riesgo país cerró estable.\n\nSegundo párrafo.")
  assert.equal(r.secciones["reservas"], "- compró el BCRA\n- subieron las brutas")
  assert.equal(r.secciones["credito"], null)
  assert.equal(r.secciones["deuda-pesos"], null)
  assert.equal(r.secciones["tipo-de-cambio"], null)
  assert.deepEqual(r.desconocidas, [])
})

test("tolera secciones faltantes, vacías o solo con comentarios: devuelve null, nunca relleno", () => {
  const md = "## deuda-usd\n\n<!-- escribir acá -->\n\n## credito\n   \n"
  const r = parseInforme(md)
  for (const id of SECCION_IDS) assert.equal(r.secciones[id], null, id)
})

test("tolera archivo vacío y sin frontmatter", () => {
  const vacio = parseInforme("")
  assert.deepEqual(vacio.meta, { anio: null, semana: null, fechaCorte: null, titulo: null })
  for (const id of SECCION_IDS) assert.equal(vacio.secciones[id], null)

  const sinFm = parseInforme("## credito\nLas tasas bajaron.")
  assert.equal(sinFm.secciones["credito"], "Las tasas bajaron.")
  assert.equal(sinFm.meta.semana, null)
})

test("frontmatter inválido no rompe: fecha mal formada o semana no numérica quedan en null", () => {
  const r = parseInforme("---\nsemana: cuarenta\nfecha_corte: 16/10/2026\n---\n## reservas\nok")
  assert.equal(r.meta.semana, null)
  assert.equal(r.meta.fechaCorte, null)
  assert.equal(r.secciones["reservas"], "ok")
})

test("ignora y reporta encabezados desconocidos sin mezclar su texto en otra sección", () => {
  const r = parseInforme("## deuda-usd\nuno\n## otra-cosa\ndos\n## credito\ntres")
  assert.deepEqual(r.desconocidas, ["otra-cosa"])
  assert.equal(r.secciones["deuda-usd"], "uno")
  assert.equal(r.secciones["credito"], "tres")
})

test("acepta CRLF y BOM", () => {
  const r = parseInforme("﻿---\r\nsemana: 5\r\n---\r\n## reservas\r\ntexto\r\n")
  assert.equal(r.meta.semana, 5)
  assert.equal(r.secciones["reservas"], "texto")
})

test("un encabezado repetido acumula el texto en la misma sección", () => {
  const r = parseInforme("## credito\nA\n## credito\nB")
  assert.equal(r.secciones["credito"], "A\nB")
})

test("parseNombreArchivo solo acepta AAAA-S<semana>.md", () => {
  assert.deepEqual(parseNombreArchivo("2026-S42.md"), { anio: 2026, semana: 42 })
  assert.deepEqual(parseNombreArchivo("2026-S7.md"), { anio: 2026, semana: 7 })
  assert.equal(parseNombreArchivo("PLANTILLA.md"), null)
  assert.equal(parseNombreArchivo("2026-S99.md"), null)
  assert.equal(parseNombreArchivo("../2026-S42.md"), null)
})

test("bloquesDeTexto separa párrafos y listas y no interpreta HTML", () => {
  const b = bloquesDeTexto("Uno\ndos\n\n- a\n- b\n\n<script>x</script>")
  assert.deepEqual(b, [
    { tipo: "parrafo", texto: "Uno dos" },
    { tipo: "lista", items: ["a", "b"] },
    { tipo: "parrafo", texto: "<script>x</script>" },
  ])
})

test("la PLANTILLA.md del repo parsea: 5 secciones vacías, sin texto de relleno", () => {
  const r = parseInforme(readFileSync("content/informes/PLANTILLA.md", "utf8"))
  assert.equal(r.meta.anio, 2026)
  assert.equal(r.meta.titulo, null)
  for (const id of SECCION_IDS) assert.equal(r.secciones[id], null, id)
  assert.deepEqual(r.desconocidas, [])
})
