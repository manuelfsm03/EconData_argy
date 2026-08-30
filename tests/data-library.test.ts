import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DataCardRenderer } from "../src/client/components/workspace/data-card-renderer"
import { libraryCardIdForTickerFocus } from "../src/lib/ticker-nav"

test("Biblioteca previews through the same numeric renderer and never embeds Dashboard", () => {
  const library = readFileSync("src/client/components/workspace/data-library.tsx", "utf8")
  assert.match(library, /DataCardRenderer/)
  assert.doesNotMatch(library, /main-dashboard|<Dashboard/)
  assert.match(library, /data-library-card-id/)
  assert.doesNotMatch(library, /void focusTicker/)
})

test("ticker focus selects a semantic library card instead of falling back to EMAE", () => {
  assert.equal(libraryCardIdForTickerFocus({ kind: "accion", ticker: "YPFD" }), "acciones")
  assert.equal(libraryCardIdForTickerFocus({ kind: "bono", ticker: "GD30" }), "bonos")
  assert.equal(libraryCardIdForTickerFocus({ kind: "variable", ticker: "UNKNOWN" }), null)
  const library = readFileSync("src/client/components/workspace/data-library.tsx", "utf8")
  assert.match(library, /libraryCardIdForTickerFocus/)
  assert.match(library, /data-library-focus-ticker/)
  assert.match(library, /focusTicker=\{selected\.id === focusCardId \? focusTicker : null\}/)
})

test("EMAE preview is behind NumericBoundary and does not render a legacy number", () => {
  const markup = renderToStaticMarkup(React.createElement(DataCardRenderer, { cardId: "emae" }))
  assert.match(markup, /data-numeric-card="emae"/)
  assert.doesNotMatch(markup, /161[,.]0|EmaeView|Dashboard/)
})

test("non-allowlisted cards are boundary-only previews", () => {
  for (const cardId of ["ipc", "resumen-ipc", "bonos", "mundo-avanzado"]) {
    const markup = renderToStaticMarkup(React.createElement(DataCardRenderer, { cardId }))
    assert.match(markup, new RegExp(`data-numeric-card="${cardId}"`))
  }
})
