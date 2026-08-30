import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  parseComposicionLegislacion,
  parseComposicionMoneda,
} from "../src/server/domain/debt-stock"

const mundo = readFileSync("src/client/components/dashboard/tab-mundo.tsx", "utf8")
const live = readFileSync("src/client/components/dashboard/live-section.tsx", "utf8")
const community = readFileSync("src/client/components/profiles/community-view.tsx", "utf8")
const predictionsFeed = readFileSync("src/client/components/profiles/predictions-feed.tsx", "utf8")
const appShell = readFileSync("src/client/components/workspace/app-shell.tsx", "utf8")
const sidebar = readFileSync("src/client/components/ui/sidebar.tsx", "utf8")
const flags = readFileSync("src/lib/feature-flags.ts", "utf8")
const debtRoute = readFileSync("src/app/api/deuda/route.ts", "utf8")
const tabMacro = readFileSync("src/client/components/dashboard/tab-macro.tsx", "utf8")

function dateHeader(): unknown[] {
  return ["", "", 45000, 45001, 45002, 45003, 45004, 45005]
}

test("Mundo preserves seven Macro Comparada indicators and their units", () => {
  const start = mundo.indexOf("const indicadores = [")
  const end = mundo.indexOf("const indicadorSel", start)
  assert.ok(start >= 0 && end > start)
  const indicators = mundo.slice(start, end)
  assert.deepEqual(
    [...indicators.matchAll(/key: "([^"]+)"/g)].map((match) => match[1]),
    ["gdp_growth", "inflation", "unemployment", "gdp_per_capita", "trade_pct_gdp", "current_account", "fdi_inflows"],
  )
  assert.equal((indicators.match(/unit: "%"/g) ?? []).length, 6)
  assert.match(indicators, /key: "gdp_per_capita"\s*,\s*label: "PIB per cápita \(USD\)"\s*,\s*unit: "USD"/)
  assert.match(mundo, /const formatValue = unidad === "USD"/)
  assert.match(mundo, /US\$.*toFixed\(0\)/)
  assert.match(mundo, /\(v \/ 1000\)\.toFixed\(1\)\}K/)
  assert.match(mundo, /\$\{v\.toFixed\(1\)\}%/)
})

test("Live channels validate storage hydration and persist a valid replacement", () => {
  assert.match(live, /const STORAGE_KEY = "lapizarra:live-channels"/)
  const hydrationStart = live.indexOf("useEffect(() => {", live.indexOf("Hidratar canales guardados"))
  const hydrationEnd = live.indexOf("  }, [])", hydrationStart)
  assert.ok(hydrationStart >= 0 && hydrationEnd > hydrationStart)
  const hydration = live.slice(hydrationStart, hydrationEnd)
  assert.match(hydration, /localStorage\.getItem\(STORAGE_KEY\)/)
  assert.match(hydration, /Array\.isArray\(parsed\)/)
  assert.match(hydration, /parsed\.every\(\(c\) =>/)
  assert.match(hydration, /typeof c\.id === "string"/)
  assert.match(hydration, /typeof c\.videoId === "string"/)
  assert.match(hydration, /typeof c\.label === "string"/)
  assert.match(hydration, /setChannels\(parsed as Channel\[\]\)/)
  assert.match(live, /const videoId = extractVideoId\(urlInput\)/)
  assert.match(live, /next\[index\] = \{ \.\.\.next\[index\], label: label\.toUpperCase\(\), videoId \}/)
  assert.match(live, /setChannels\(next\)\s+persistChannels\(next\)/)
  assert.match(live, /catch \{ \/\* json inválido → ignorar y usar defaults \*\/ \}/)
  assert.match(live, /function persistChannels\(list: Channel\[\]\): void \{\s*try \{ localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(list\)\) \} catch/)
  assert.doesNotMatch(hydration, /localStorage\.setItem/)
})

test("Community feed remains preserved but unreachable while users are disabled", () => {
  assert.match(flags, /^export const USERS_ENABLED = false$/m)
  assert.match(community, /import \{ PredictionsFeed \} from "\.\/predictions-feed"/)
  assert.match(community, /<PredictionsFeed \/>/)
  assert.match(predictionsFeed, /fetch\("\/api\/predictions\?limit=48"\)/)
  assert.doesNotMatch(predictionsFeed, /fallback|MOCK_PREDICTIONS|mockPredictions/i)
  assert.match(appShell, /\.filter\(\(item\) => item\.id !== "community" \|\| USERS_ENABLED\)/)
  assert.match(appShell, /sectionParam === "community" && !USERS_ENABLED/)
  assert.match(appShell, /setSection\("canvas"\)/)
  assert.match(appShell, /USERS_ENABLED && section === "community" && <CommunityView \/>/)
  assert.doesNotMatch(sidebar, /community/i)
})

test("Debt composition parses latest A.2/A.3 columns and fails closed", () => {
  const legislationRows: unknown[][] = [
    dateHeader(),
    ["Legislación argentina", "", "", "", "", "", 10, 60],
    ["Legislación extranjera", "", "", "", "", "", 90, 40],
  ]
  assert.deepEqual(parseComposicionLegislacion(legislationRows), [
    { nombre: "Legislación argentina", pct: 60 },
    { nombre: "Legislación extranjera", pct: 40 },
  ])

  const currencyRows: unknown[][] = [
    dateHeader(),
    ["Moneda local", "", "", "", "", "", 20, 70],
    ["Moneda extranjera", "", "", "", "", "", 80, 30],
    ["", "Dólares", "", "", "", "", 50, 20],
    ["", "Euros", "", "", "", "", 10, 5],
  ]
  assert.deepEqual(parseComposicionMoneda(currencyRows), [
    { nombre: "Pesos (moneda local)", pct: 70 },
    { nombre: "Dólares", pct: 20 },
    { nombre: "Euros", pct: 5 },
    { nombre: "Otras monedas", pct: 5 },
  ])

  assert.deepEqual(parseComposicionLegislacion([dateHeader(), ["Legislación argentina", "", "", "", "", "", 1, 0]]), [])
  assert.deepEqual(parseComposicionLegislacion([dateHeader(), ["Legislación argentina", "", "", "", "", "", 1, 10]]), [])
  assert.deepEqual(parseComposicionMoneda([dateHeader(), ["Moneda local", "", "", "", "", "", 1, 10]]), [])
  assert.deepEqual(parseComposicionMoneda([["sin fechas"]]), [])

  assert.match(debtRoute, /const STOCK_CACHE_KEY = "deuda_stock_v5"/)
  assert.match(debtRoute, /A\.1: deuda por instrumento · A\.2: por legislación · A\.3: por moneda/)
  assert.match(debtRoute, /const composicion_moneda = parseComposicionMoneda\(sheets\.a3\)/)
  assert.match(debtRoute, /const composicion_acreedor = parseComposicionLegislacion\(sheets\.a2\)/)
  assert.match(debtRoute, /composicion_acreedor,/)
  assert.match(debtRoute, /composicion_moneda,/)
  assert.match(tabMacro, /Las licitaciones del Tesoro no están disponibles en este momento\./)
  assert.match(tabMacro, /title: "Por Legislación"/)
})
