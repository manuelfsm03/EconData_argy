import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/**
 * El tab Macro pasó de 11 sub-tabs sueltos a 5 pilares (Actividad, Precios,
 * Sector externo, Sector público, Empleo y sociedad), cada uno recorrido en
 * los mismos 4 niveles de profundidad (Titular/Apertura/Comparación/
 * Expectativa). Como la mayoría de los componentes de abajo (EmaeView,
 * IpcView, etc.) ya existían y se reutilizan tal cual, estos tests no repiten
 * sus propios tests — solo fijan que la navegación nueva quedó bien armada y
 * que los links viejos no se rompen.
 */
const macroUi = readFileSync("src/client/components/dashboard/tab-macro.tsx", "utf8")

test("los 5 pilares reemplazan a los 11 sub-tabs sueltos", () => {
  const start = macroUi.indexOf("const MACRO_TABS")
  const end = macroUi.indexOf("const SUBTAB_ALIAS")
  assert.ok(start >= 0 && end > start)
  const tabsBlock = macroUi.slice(start, end)

  for (const pilar of ["actividad", "precios", "externo", "publico", "empleo"]) {
    assert.match(tabsBlock, new RegExp(`key: "${pilar}"`), `falta el pilar ${pilar}`)
  }
  // Nada de los sub-tabs viejos como pilar de primer nivel.
  for (const viejo of ["emae", "ipc", "balanza", "agro", "provincias", "desigualdad", "piramides", "fx", "riesgo", "deuda", "fiscal"]) {
    assert.doesNotMatch(tabsBlock, new RegExp(`key: "${viejo}"`), `"${viejo}" no debería ser un pilar de primer nivel`)
  }
})

test("los links viejos (card-catalog, bookmarks) siguen aterrizando en algún pilar", () => {
  // Las claves que usaba card-catalog.ts para deep-link al tab macro.
  const clavesViejas = ["emae", "ipc", "balanza", "agro", "provincias", "desigualdad", "piramides", "fx", "riesgo", "deuda", "fiscal"]
  const start = macroUi.indexOf("const SUBTAB_ALIAS")
  const end = macroUi.indexOf("export function TabMacro")
  assert.ok(start >= 0 && end > start)
  const aliasBlock = macroUi.slice(start, end)

  for (const clave of clavesViejas) {
    assert.match(aliasBlock, new RegExp(`\\b${clave}:\\s*"(actividad|precios|externo|publico|empleo)"`), `"${clave}" sin alias a un pilar nuevo`)
  }
})

test("TabMacro resuelve initialSubtab viejo contra el alias, no contra la clave cruda", () => {
  const start = macroUi.indexOf("export function TabMacro")
  const tabMacroBody = macroUi.slice(start)
  assert.match(tabMacroBody, /SUBTAB_ALIAS\[init/)
})

test("cada pilar se renderiza con su propio componente en TabMacro", () => {
  const start = macroUi.indexOf("export function TabMacro")
  const tabMacroBody = macroUi.slice(start)
  assert.match(tabMacroBody, /ActividadPillarView/)
  assert.match(tabMacroBody, /PreciosPillarView/)
  assert.match(tabMacroBody, /SectorExternoPillarView/)
  assert.match(tabMacroBody, /SectorPublicoPillarView/)
  assert.match(tabMacroBody, /EmpleoSociedadPillarView/)
})

test("IpcDivisionesView consume el endpoint de 12 divisiones que ya existía sin frontend", () => {
  const start = macroUi.indexOf("export function IpcDivisionesView")
  const end = macroUi.indexOf("export function MiInflacionView")
  assert.ok(start >= 0 && end > start)
  const block = macroUi.slice(start, end)
  assert.match(block, /endpoint=ipc_divisiones/)
})

test("MercadoLaboralView tiene su propio fetch, no depende del estado interno de EmaeView", () => {
  const start = macroUi.indexOf("export function MercadoLaboralView")
  const end = macroUi.indexOf("export function IpcDivisionesView")
  assert.ok(start >= 0 && end > start)
  const block = macroUi.slice(start, end)
  assert.match(block, /endpoint=laboral/)
  assert.match(block, /useEffect/)
})

test("Precios · Expectativa reutiliza el REM ya construido en BCRA, no lo reinventa", () => {
  assert.match(macroUi, /import \{ REMView \} from "\.\/tab-bcra"/)
  const start = macroUi.indexOf("function PreciosPillarView")
  const end = macroUi.indexOf("function SectorExternoPillarView")
  assert.ok(start >= 0 && end > start)
  assert.match(macroUi.slice(start, end), /<REMView \/>/)
})
