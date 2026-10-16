import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { SECCION_IDS } from "../src/lib/informe/markdown"
import { EXTRACTORES } from "../src/lib/informe/extractores"
import { SECCIONES, descomponerEndpoint } from "../src/lib/informe/secciones"
import { SOURCE_REGISTRY } from "../src/server/sources/registry"

const RAIZ_API = path.join("src", "app", "api")

test("hay 5 secciones, en el orden del molde 1816, con los ids del markdown", () => {
  assert.equal(SECCIONES.length, 5)
  assert.deepEqual(SECCIONES.map((s) => s.id), [...SECCION_IDS])
  assert.deepEqual(SECCIONES.map((s) => s.rankingTema), [1, 2, 3, 4, 5])
})

test("cada sección tiene de 2 a 4 gráficos y los ids de gráfico no se repiten", () => {
  const vistos = new Set<string>()
  for (const s of SECCIONES) {
    assert.ok(s.graficos.length >= 2 && s.graficos.length <= 4, `${s.id}: ${s.graficos.length} gráficos`)
    for (const g of s.graficos) {
      assert.ok(!vistos.has(g.id), `id de gráfico repetido: ${g.id}`)
      vistos.add(g.id)
    }
  }
})

test("cada gráfico disponible apunta a un endpoint que existe en src/app/api", () => {
  for (const s of SECCIONES) {
    for (const g of s.graficos.filter((x) => x.estado === "disponible")) {
      assert.ok(g.endpoint, `${g.id}: falta endpoint`)
      const { ruta, query } = descomponerEndpoint(g.endpoint)
      const archivo = path.join(RAIZ_API, ruta, "route.ts")
      assert.ok(existsSync(archivo), `${g.id}: no existe ${archivo}`)
      // Los parámetros (endpoint=reservas, tipo=lecap...) tienen que ser valores que la ruta realmente maneja.
      const fuente = readFileSync(archivo, "utf8")
      for (const [clave, valor] of Object.entries(query)) {
        assert.ok(
          fuente.includes(`"${valor}"`),
          `${g.id}: la ruta ${ruta} no menciona el valor "${valor}" del parámetro ${clave}`,
        )
      }
    }
  }
})

test("cada gráfico disponible declara un fuenteId del registro y un extractor existente", () => {
  for (const s of SECCIONES) {
    for (const g of s.graficos.filter((x) => x.estado === "disponible")) {
      assert.ok(g.fuenteId && g.fuenteId in SOURCE_REGISTRY, `${g.id}: fuenteId "${g.fuenteId}" no está en el registro`)
      assert.ok(g.extractor && g.extractor in EXTRACTORES, `${g.id}: extractor "${g.extractor}" no existe`)
    }
  }
})

test("cada gráfico pendiente declara su rama y, si indica fuente prevista, existe en el registro", () => {
  const pendientes = SECCIONES.flatMap((s) => s.graficos.filter((g) => g.estado === "pendiente"))
  assert.ok(pendientes.length > 0)
  for (const g of pendientes) {
    assert.ok(g.rama && g.rama.length > 0, `${g.id}: pendiente sin rama`)
    assert.equal(g.endpoint, undefined, `${g.id}: un pendiente no puede tener endpoint todavía`)
    if (g.fuenteId) assert.ok(g.fuenteId in SOURCE_REGISTRY, `${g.id}: fuenteId "${g.fuenteId}" no está en el registro`)
  }
})

test("descomponerEndpoint separa ruta y query", () => {
  assert.deepEqual(descomponerEndpoint("/api/bcra?endpoint=reservas"), { ruta: "bcra", query: { endpoint: "reservas" } })
  assert.deepEqual(descomponerEndpoint("/api/riesgo-pais"), { ruta: "riesgo-pais", query: {} })
})
