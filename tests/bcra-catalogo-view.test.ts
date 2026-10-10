import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/**
 * /api/bcra-balance (descubrimiento dinámico de TODAS las variables
 * monetarias del BCRA — hoy 1.600+) ya existía pero no lo consumía ningún
 * componente. CatalogoView lo expone como un sub-tab navegable y buscable
 * dentro de la tab BCRA, en vez de quedar huérfano.
 */
const tabBcra = readFileSync("src/client/components/dashboard/tab-bcra.tsx", "utf8")

test("CatalogoView consume /api/bcra-balance, no inventa un fetch nuevo", () => {
  const start = tabBcra.indexOf("export function CatalogoView")
  const end = tabBcra.indexOf("export function BancosView")
  assert.ok(start >= 0 && end > start)
  const block = tabBcra.slice(start, end)
  assert.match(block, /fetch\("\/api\/bcra-balance"/)
})

test("el sub-tab Catálogo está en la lista de tabs de BCRA y en el switch de render", () => {
  assert.match(tabBcra, /key: "catalogo",\s*label: "Catálogo"/)
  const tabMacroStart = tabBcra.indexOf("export function TabBCRA")
  const tabMacroBody = tabBcra.slice(tabMacroStart)
  assert.match(tabMacroBody, /activeTab === "catalogo"\s*&&\s*<CatalogoView/)
})

test("la tabla corta en MAX_FILAS_TABLA y avisa cuántas coincidencias quedan afuera", () => {
  // Con 1.600+ variables, renderizar todo sin límite sería lento y además
  // nadie necesita ver 700 depósitos a la vez — pero tiene que avisarlo,
  // no recortar en silencio.
  assert.match(tabBcra, /const MAX_FILAS_TABLA = \d+/)
  assert.match(tabBcra, /filtradas\.length > MAX_FILAS_TABLA/)
  assert.match(tabBcra, /Mostrando \{MAX_FILAS_TABLA\} de \{filtradas\.length\}/)
})

test("el buscador filtra por descripción y por familia, sin pegarle a la red de nuevo por cada tecla", () => {
  const start = tabBcra.indexOf("export function CatalogoView")
  const end = tabBcra.indexOf("export function BancosView")
  const block = tabBcra.slice(start, end)
  assert.match(block, /onChange=\{e => setBusqueda/)
  assert.match(block, /v\.descripcion\.toLowerCase\(\)\.includes\(termino\)/)
  assert.doesNotMatch(block, /fetch\(.*busqueda/i)
})
