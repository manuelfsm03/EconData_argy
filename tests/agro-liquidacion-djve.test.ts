/**
 * Tests de los parsers de CIARA-CEC (liquidación agro) y DJVE.
 *
 * IMPORTANTE: TODOS los fixtures de este archivo son SINTETICOS (inventados
 * para ejercitar el parser; los números no son datos reales). Las fuentes
 * reales NO estan verificadas en vivo: esto prueba la logica, no el formato
 * real de ciaracec.com.ar ni del CSV del MAGyP.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

import {
  detectarMontoMusd,
  detectarPeriodo,
  extraerLinksComunicados,
  fusionarSeries,
  parseComunicadoCiara,
  parseNumeroEs,
} from "../src/server/external/ciara-liquidacion"
import {
  agregarDjvePorMes,
  decodificarCsv,
  elegirRecursoCkan,
  normalizarFecha,
  parseDjveCsv,
} from "../src/server/external/djve"
import { SOURCE_REGISTRY, validateSourceRegistry } from "../src/server/sources/registry"

// ---------- CIARA-CEC (fixtures SINTETICOS) ----------

test("parseNumeroEs entiende formato argentino", () => {
  assert.equal(parseNumeroEs("2.346,5"), 2346.5)
  assert.equal(parseNumeroEs("2.346.543.451"), 2346543451)
  assert.equal(parseNumeroEs("2,5"), 2.5)
  assert.equal(parseNumeroEs("1.234"), 1234)
  assert.equal(parseNumeroEs("abc"), null)
})

test("CIARA: comunicado en HTML con millones (SINTETICO)", () => {
  const html = "<html><body><h1>Liquidaci&oacute;n de divisas de Septiembre 2099</h1>" +
    "<p>Las empresas del sector liquidaron <b>US$ 1.234,5 millones</b> en el mes.</p></body></html>"
  const r = parseComunicadoCiara(html, "https://ejemplo.invalid/x")
  assert.deepEqual(r, { periodo: "2099-09", monto_musd: 1234.5, fuente_url: "https://ejemplo.invalid/x" })
})

test("CIARA: dólares enteros, 'mil millones' y 'millones de dólares' (SINTETICO)", () => {
  assert.equal(detectarMontoMusd("liquidaron USD 1.500.000.000 en octubre"), 1500)
  assert.equal(detectarMontoMusd("liquidaron US$ 2,1 mil millones"), 2100)
  assert.equal(detectarMontoMusd("liquidaron 987 millones de dólares"), 987)
})

test("CIARA: prioriza el monto cerca de 'liquid' y descarta fuera de rango", () => {
  const t = "Dato aparte US$ 5 millones. El sector liquidó US$ 800 millones. Otra cifra US$ 99.999.999 millones."
  assert.equal(detectarMontoMusd(t), 800)
})

test("CIARA: sin período o sin monto devuelve null, no inventa", () => {
  assert.equal(parseComunicadoCiara("<p>Texto sin datos</p>"), null)
  assert.equal(parseComunicadoCiara("<p>Liquidaron US$ 1.000 millones</p>"), null) // falta mes/año
  assert.equal(parseComunicadoCiara("<p>Marzo 2099 sin monto</p>"), null)
  assert.equal(detectarPeriodo("setiembre de 2099"), "2099-09")
})

test("CIARA: extrae links de liquidación y resuelve relativos", () => {
  const html = '<a href="/novedades/liquidacion-septiembre">Liquidación Sept</a>' +
    '<a href="/contacto">Contacto</a><a href="https://otro.invalid/liquidacion.html">x</a>' +
    '<a href="/novedades/liquidacion-septiembre">dup liquidación</a>'
  assert.deepEqual(extraerLinksComunicados(html, "https://base.invalid/"), [
    "https://base.invalid/novedades/liquidacion-septiembre",
    "https://otro.invalid/liquidacion.html",
  ])
})

test("CIARA: fusionar conserva meses viejos y actualiza el mismo mes", () => {
  const viejo = [{ periodo: "2099-01", monto_musd: 1 }, { periodo: "2099-02", monto_musd: 2 }]
  const nuevo = [{ periodo: "2099-02", monto_musd: 22 }, { periodo: "2099-03", monto_musd: 3 }]
  assert.deepEqual(fusionarSeries(viejo, nuevo).map((f) => [f.periodo, f.monto_musd]),
    [["2099-01", 1], ["2099-02", 22], ["2099-03", 3]])
})

// ---------- DJVE (fixtures SINTETICOS) ----------

const CSV_COMA = [
  "fecha_registro,producto,toneladas,destino",
  "2099-01-05,Soja,1000,X",
  "2099-01-20,SOJA,500,Y",
  "2099-02-03,Maíz,2000,X",
  "2099-02-04,Maíz,0,X", // toneladas 0: se descarta
  "fecha-rota,Trigo,10,X", // fecha inválida: se descarta
].join("\n")

test("DJVE: parsea y agrega por mes y cultivo (SINTETICO)", () => {
  const filas = parseDjveCsv(CSV_COMA)
  assert.equal(filas.length, 3)
  const mensual = agregarDjvePorMes(filas)
  assert.deepEqual(mensual, [
    { periodo: "2099-01", cultivo: "soja", toneladas: 1500, declaraciones: 2 },
    { periodo: "2099-02", cultivo: "maíz", toneladas: 2000, declaraciones: 1 },
  ])
  assert.equal(agregarDjvePorMes(filas, "2099-02").length, 1)
})

test("DJVE: separador ';', fecha dd/mm/yyyy, encabezados con acentos/BOM y miles con punto (SINTETICO)", () => {
  const csv = "﻿\"Fecha de Registro\";\"Producto\";\"Toneladas Declaradas\"\n05/03/2099;Girasol;\"1.250\"\n"
  assert.deepEqual(parseDjveCsv(csv), [{ fecha: "2099-03-05", cultivo: "girasol", toneladas: 1250 }])
  assert.equal(normalizarFecha("2099-03-05T10:00:00"), "2099-03-05")
})

test("DJVE: columnas irreconocibles fallan fuerte, no devuelven basura", () => {
  assert.throws(() => parseDjveCsv("a,b,c\n1,2,3"), /DJVE_COLUMNAS/)
  assert.throws(() => parseDjveCsv(""), /DJVE_VACIO/)
})

test("DJVE: elige el CSV de last_modified más reciente del package_show (SINTETICO)", () => {
  const resp = { result: { resources: [
    { name: "DJVE 2098", format: "CSV", url: "https://e.invalid/a.csv", last_modified: "2098-12-01" },
    { name: "DJVE 2099", format: "csv", url: "https://e.invalid/b.csv", last_modified: "2099-06-01" },
    { name: "Diccionario", format: "PDF", url: "https://e.invalid/c.pdf" },
  ] } }
  assert.equal(elegirRecursoCkan(resp), "https://e.invalid/b.csv")
  assert.equal(elegirRecursoCkan(resp, { nombre: /2098/ }), "https://e.invalid/a.csv")
  assert.equal(elegirRecursoCkan({ result: { resources: [] } }), null)
  assert.equal(elegirRecursoCkan(null), null)
})

test("DJVE: decodifica Latin-1 cuando UTF-8 corrompe acentos", () => {
  const latin1 = Uint8Array.from([0x6d, 0x61, 0xed, 0x7a]) // "maíz" en Latin-1
  assert.equal(decodificarCsv(latin1), "maíz")
})

// ---------- Registry / artefactos ----------

test("registry incluye ciara_cec y sigue válido", () => {
  assert.deepEqual(validateSourceRegistry(), [])
  assert.equal(SOURCE_REGISTRY.ciara_cec.dataClass, "official_monthly")
})

test("si existen los JSON generados, tienen la forma esperada y cobertura coherente", () => {
  for (const [ruta, campo] of [
    ["public/data/agro-liquidacion-ciara.json", "monto_musd"],
    ["public/data/djve-mensual.json", "toneladas"],
  ] as const) {
    if (!existsSync(ruta)) continue // aún no corrió el workflow: es lo esperado
    const j = JSON.parse(readFileSync(ruta, "utf8"))
    assert.ok(Array.isArray(j.serie) && j.serie.length > 0, ruta)
    assert.ok(j.serie.every((f: Record<string, unknown>) => typeof f[campo] === "number" && /^\d{4}-\d{2}$/.test(String(f.periodo))), ruta)
    assert.equal(j.cobertura.desde, j.serie[0].periodo, ruta)
  }
})
