import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const liveSection = readFileSync(
  "src/client/components/dashboard/live-section.tsx",
  "utf8",
)
const newsFeed = readFileSync(
  "src/client/components/dashboard/news-feed.tsx",
  "utf8",
)
const globalStyles = readFileSync("src/app/globals.css", "utf8")

test("live channels expose an accessible working visibility toggle", () => {
  assert.match(liveSection, /const \[hidden, setHidden\]\s*=\s*useState\(false\)/)
  assert.match(liveSection, /onClick=\{\(\) => setHidden\(\(value\) => !value\)\}/)
  assert.match(liveSection, /aria-expanded=\{!hidden\}/)
  assert.match(liveSection, /\{!hidden && \(/)
})

test("live channels use a compact adaptive grid", () => {
  assert.match(liveSection, /const TILE_HEIGHT = 90/)
  assert.match(liveSection, /repeat\(auto-fit, minmax\(120px, 1fr\)\)/)
  assert.match(liveSection, /height: TILE_HEIGHT/)
})

test("news rows use a responsive grid with a readable empty state", () => {
  assert.match(newsFeed, /className="news-feed-row"/)
  assert.match(newsFeed, /className="news-feed-columns"/)
  assert.match(newsFeed, /loading \? "CARGANDO NOTICIAS\.\.\." : "SIN RESULTADOS"/)
  assert.match(newsFeed, /hour12:\s*false/)
})

test("narrow news cards stack regional feeds into one readable column", () => {
  assert.match(newsFeed, /containerType:\s*"inline-size"/)
  assert.match(newsFeed, /className="news-feed-layout"/)
  assert.match(globalStyles, /@container news-feed \(max-width:\s*720px\)/)
  assert.match(globalStyles, /\.news-feed-layout\s*\{[^}]*flex-direction:\s*column/)
})
