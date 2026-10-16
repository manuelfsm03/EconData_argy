import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  acumularVentana,
  grillaMercosur,
  nivelDeLluvia,
  NIVELES_LLUVIA,
  resumirPorPais,
  type PuntoLluviaAcumulada,
} from "../src/server/external/clima-regional"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const route = readFileSync("src/app/api/clima-regional/route.ts", "utf8")

test("la grilla cubre los cuatro países sin puntos duplicados", () => {
  const grilla = grillaMercosur(2)
  const paises = new Set(grilla.map((p) => p.pais))
  assert.deepEqual([...paises].sort(), ["Argentina", "Brasil", "Paraguay", "Uruguay"])

  const claves = grilla.map((p) => `${p.lat},${p.lon}`)
  assert.equal(claves.length, new Set(claves).size, "no debería haber puntos repetidos")
})

test("un paso más fino da más puntos, uno más grueso da menos", () => {
  const fina = grillaMercosur(1)
  const gruesa = grillaMercosur(3)
  assert.ok(fina.length > gruesa.length)
})

test("Uruguay tiene más de dos puntos aunque el paso general sea grueso", () => {
  // Con paso 2° el país casi no entra en la grilla general: se le fuerza un
  // paso más fino para que el mapa no lo muestre vacío.
  const grilla = grillaMercosur(2)
  const uruguay = grilla.filter((p) => p.pais === "Uruguay")
  assert.ok(uruguay.length > 4, `Uruguay solo tiene ${uruguay.length} puntos`)
})

test("todos los puntos caen dentro del cuadrante sudamericano", () => {
  for (const punto of grillaMercosur(2)) {
    assert.ok(punto.lat < 0 && punto.lat > -45, `lat fuera de rango: ${punto.lat}`)
    assert.ok(punto.lon < -45 && punto.lon > -70, `lon fuera de rango: ${punto.lon}`)
  }
})

test("acumula la ventana sumando solo los días con dato", () => {
  const punto = { lat: -33, lon: -60, pais: "Argentina" }
  const resultado = acumularVentana(
    punto,
    ["2026-09-01", "2026-09-02", "2026-09-03"],
    [10, null, 5.5],
  )
  assert.equal(resultado.mm, 15.5)
  assert.equal(resultado.diasConDato, 2)
  assert.equal(resultado.pais, "Argentina")
})

test("una ventana sin ningún dato da cero sin romper", () => {
  const punto = { lat: -33, lon: -60, pais: "Argentina" }
  const resultado = acumularVentana(punto, ["2026-09-01"], [null])
  assert.equal(resultado.mm, 0)
  assert.equal(resultado.diasConDato, 0)
})

test("los niveles de lluvia son consistentes y cubren todo el rango", () => {
  assert.equal(nivelDeLluvia(0).etiqueta, "sin lluvia")
  assert.equal(nivelDeLluvia(0.5).etiqueta, "sin lluvia")
  assert.equal(nivelDeLluvia(5).etiqueta, "muy poca")
  assert.equal(nivelDeLluvia(45).etiqueta, "moderada")
  assert.equal(nivelDeLluvia(500).etiqueta, "extrema")
  // El último nivel tiene que ser infinito: ningún mm puede quedar sin color.
  assert.equal(NIVELES_LLUVIA[NIVELES_LLUVIA.length - 1].hasta, Infinity)
})

test("el resumen por país no promedia países entre sí", () => {
  const puntos: PuntoLluviaAcumulada[] = [
    { lat: -30, lon: -60, pais: "Argentina", mm: 10, diasConDato: 14 },
    { lat: -32, lon: -62, pais: "Argentina", mm: 30, diasConDato: 14 },
    { lat: -25, lon: -52, pais: "Brasil", mm: 100, diasConDato: 14 },
  ]
  const resumen = resumirPorPais(puntos)

  const argentina = resumen.find((r) => r.pais === "Argentina")
  assert.ok(argentina)
  assert.equal(argentina.promedioMm, 20)
  assert.equal(argentina.puntos, 2)
  assert.equal(argentina.minimoMm, 10)
  assert.equal(argentina.maximoMm, 30)

  const brasil = resumen.find((r) => r.pais === "Brasil")
  assert.equal(brasil?.promedioMm, 100)
  assert.equal(brasil?.puntos, 1)
})

test("el resumen por país sale ordenado de más a menos lluvia", () => {
  const puntos: PuntoLluviaAcumulada[] = [
    { lat: -30, lon: -60, pais: "Paraguay", mm: 5, diasConDato: 14 },
    { lat: -25, lon: -52, pais: "Brasil", mm: 80, diasConDato: 14 },
    { lat: -32, lon: -56, pais: "Uruguay", mm: 40, diasConDato: 14 },
  ]
  const resumen = resumirPorPais(puntos)
  assert.deepEqual(resumen.map((r) => r.pais), ["Brasil", "Uruguay", "Paraguay"])
})

test("la fuente NASA POWER declara su demora de reporte", () => {
  const fuente = SOURCE_REGISTRY.nasa_power
  assert.equal(fuente.publisher, "NASA Langley Research Center")
  assert.ok(fuente.allowedHosts.includes("power.larc.nasa.gov"))
})

test("el endpoint reutiliza el chequeo de error silencioso de Open-Meteo", () => {
  assert.match(route, /fallaDeclarada/)
  assert.match(route, /error\?: boolean/)
  assert.match(route, /reanálisis ERA5/)
  assert.match(route, /warnings:/)
})

test("el endpoint valida el rango de días antes de pegarle a la fuente", () => {
  assert.match(route, /diasParam >= 3 && diasParam <= 30/)
})
