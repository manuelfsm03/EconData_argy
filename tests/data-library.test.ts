import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { libraryCardIdForTickerFocus } from "../src/lib/ticker-nav"

test("Biblioteca preserves the established embedded Dashboard experience", () => {
  const library = readFileSync("src/client/components/workspace/data-library.tsx", "utf8")
  assert.match(library, /main-dashboard/)
  assert.match(library, /<Dashboard/)
  assert.doesNotMatch(library, /DataCardRenderer|data-library-card-id/)
})

test("ticker focus opens the established Finanzas subtab", () => {
  assert.equal(libraryCardIdForTickerFocus({ kind: "accion", ticker: "YPFD" }), "acciones")
  assert.equal(libraryCardIdForTickerFocus({ kind: "bono", ticker: "GD30" }), "bonos")
  assert.equal(libraryCardIdForTickerFocus({ kind: "variable", ticker: "UNKNOWN" }), null)
  const library = readFileSync("src/client/components/workspace/data-library.tsx", "utf8")
  assert.match(library, /FINANZAS_SUBTAB_POR_KIND/)
  assert.match(library, /initialTicker=\{override\?\.ticker \?\? null\}/)
  assert.match(library, /embedded/)
})
