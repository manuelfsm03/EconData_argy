import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const EXPECTATIONS: Record<string, Array<{ snippet: string; count?: number }>> = {
  "src/app/api/bcra/route.ts": [{ snippet: "next: { revalidate: 900 }" }],
  "src/app/api/big-mac/route.ts": [{ snippet: "next: { revalidate: 3600 }" }],
  "src/app/api/breakeven/route.ts": [{ snippet: "next: { revalidate: 300 }", count: 3 }],
  "src/app/api/deuda/route.ts": [{ snippet: "next: { revalidate: 86_400 }", count: 3 }],
  "src/app/api/energia-global/route.ts": [{ snippet: "next: { revalidate: 21600 }", count: 2 }],
  "src/app/api/ia/route.ts": [{ snippet: "next: { revalidate: 3600 }" }],
  "src/app/api/ipc-historico/route.ts": [{ snippet: "next: { revalidate: 3600 }" }],
  "src/app/api/polymarket/route.ts": [{ snippet: "next: { revalidate: 300 }" }],
  "src/app/api/rofex/route.ts": [{ snippet: "next: { revalidate: 300 }" }],
  "src/app/api/tcr/route.ts": [{ snippet: "next: { revalidate: 3600 }" }],
  "src/app/api/world-macro/route.ts": [{ snippet: "next: { revalidate: 21_600 }" }],
}

test("external data fetches carry explicit bounded cache policy", () => {
  for (const [path, expectations] of Object.entries(EXPECTATIONS)) {
    const source = readFileSync(path, "utf8")
    for (const expectation of expectations) {
      const count = source.split(expectation.snippet).length - 1
      assert.equal(count, expectation.count ?? 1, `${path}: ${expectation.snippet}`)
    }
  }
})

test("large REM workbook stays outside the Next data cache", () => {
  const source = readFileSync("src/app/api/rem/route.ts", "utf8")
  assert.match(source, /REM_XLSX_URL[\s\S]+cache: "no-store"/)
})
