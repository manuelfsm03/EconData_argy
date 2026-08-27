import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  SOURCE_REGISTRY,
  findSourceForUrl,
  validateSourceRegistry,
} from "../src/server/sources/registry"
import { fetchRegistered } from "../src/server/http/fetch-source"

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(filePath) : [filePath]
  })
}

const sourceFiles = walk("src").filter((file) => /\.(ts|tsx)$/.test(file))
const routeFiles = sourceFiles.filter((file) => file.includes("/app/api/") && file.endsWith("/route.ts"))

function source(file: string): string {
  return readFileSync(file, "utf8")
}

test("source registry is typed, complete, HTTPS-only, and internally valid", () => {
  assert.deepEqual(validateSourceRegistry(), [])
  assert.ok(Object.keys(SOURCE_REGISTRY).length >= 20)

  for (const definition of Object.values(SOURCE_REGISTRY)) {
    assert.ok(definition.allowedHosts.length > 0, definition.id)
    assert.ok(definition.timeoutMs >= 3_000 && definition.timeoutMs <= 15_000, definition.id)
    assert.ok(definition.maxResponseBytes > 0, definition.id)
    assert.ok(definition.cache.freshSeconds >= 0, definition.id)
    assert.ok(definition.freshness.warnAfterSeconds == null || definition.freshness.warnAfterSeconds >= definition.cache.freshSeconds, definition.id)
    if (definition.baseUrl) assert.equal(new URL(definition.baseUrl).protocol, "https:", definition.id)
  }
})

test("source lookup allows exact registered hosts and controlled subdomains only", () => {
  assert.equal(findSourceForUrl("https://api.eia.gov/v2/international/data/").id, "eia")
  assert.equal(findSourceForUrl("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC").id, "yahoo_finance_chart")
  assert.throws(() => findSourceForUrl("https://api.eia.gov.evil.test/steal"), /UNREGISTERED_SOURCE_HOST/)
  assert.throws(() => findSourceForUrl("http://api.eia.gov/v2/"), /SOURCE_REQUIRES_HTTPS/)
  assert.throws(() => findSourceForUrl("http://127.0.0.1/internal"), /SOURCE_REQUIRES_HTTPS/)
})

test("registered HTTP boundary enforces retry policy, redirect allowlist, and byte limit", async () => {
  let attempts = 0
  const retryingFetch: typeof fetch = async () => {
    attempts += 1
    return attempts === 1
      ? new Response("temporary", { status: 503 })
      : new Response("ok", { status: 200, headers: { "content-length": "2" } })
  }
  const response = await fetchRegistered("https://api.eia.gov/v2/test", {}, retryingFetch)
  assert.equal(response.status, 200)
  assert.equal(attempts, 2)

  let networkAttempts = 0
  const flakyNetworkFetch: typeof fetch = async () => {
    networkAttempts += 1
    if (networkAttempts === 1) throw new TypeError("network unavailable")
    return new Response("ok")
  }
  assert.equal(
    (await fetchRegistered("https://api.eia.gov/v2/test", {}, flakyNetworkFetch)).status,
    200,
  )
  assert.equal(networkAttempts, 2)

  const redirectingFetch: typeof fetch = async () => new Response(null, {
    status: 302,
    headers: { location: "https://api.eia.gov.evil.test/steal" },
  })
  await assert.rejects(
    fetchRegistered("https://api.eia.gov/v2/test", {}, redirectingFetch),
    /UNREGISTERED_SOURCE_HOST|SOURCE_REDIRECT_NOT_ALLOWED/,
  )

  const followedUrls: string[] = []
  const sameSourceRedirect: typeof fetch = async (input) => {
    followedUrls.push(input.toString())
    return followedUrls.length === 1
      ? new Response(null, { status: 302, headers: { location: "/v2/final" } })
      : new Response("ok", { status: 200 })
  }
  assert.equal(
    (await fetchRegistered("https://api.eia.gov/v2/start", {}, sameSourceRedirect)).status,
    200,
  )
  assert.deepEqual(followedUrls, ["https://api.eia.gov/v2/start", "https://api.eia.gov/v2/final"])

  const oversizedFetch: typeof fetch = async () => new Response("x", {
    status: 200,
    headers: { "content-length": String(30 * 1024 * 1024) },
  })
  await assert.rejects(
    fetchRegistered("https://api.eia.gov/v2/test", {}, oversizedFetch),
    /SOURCE_RESPONSE_TOO_LARGE/,
  )

  const oversizedWithoutHeader: typeof fetch = async () => new Response(
    new Uint8Array(6 * 1024 * 1024),
    { status: 200 },
  )
  await assert.rejects(
    fetchRegistered("https://api.eia.gov/v2/test", {}, oversizedWithoutHeader),
    /SOURCE_RESPONSE_TOO_LARGE/,
  )
})

test("browser components never fetch external URLs", () => {
  for (const file of sourceFiles.filter((candidate) => candidate.includes("/client/"))) {
    assert.doesNotMatch(source(file), /fetch\s*\(\s*[`'"]https?:\/\//, file)
  }
})

test("server external requests cross the registered HTTP boundary", () => {
  const allowed = new Set([
    "src/server/http/fetch-source.ts",
  ])
  for (const file of sourceFiles.filter((candidate) => candidate.includes("/app/api/") || candidate.includes("/server/"))) {
    if (allowed.has(file)) continue
    assert.doesNotMatch(source(file), /\bfetch\s*\(/, `${file} uses fetch outside the registered boundary`)
  }
  assert.doesNotMatch(source("src/server/scrapers/rss.ts"), /parseURL\s*\(/)
  for (const file of sourceFiles.filter((candidate) => candidate.includes("/server/"))) {
    assert.doesNotMatch(source(file), /\.goto\s*\(\s*[`'"]https?:\/\//, `${file} navigates to an upstream outside the HTTP boundary`)
  }
})

test("productive routes contain no random, mock, or silent synthetic fallback", () => {
  const productiveSurfaces = [
    "src/app/api/energia-global/route.ts",
    "src/app/api/mundo/route.ts",
    "src/app/api/balanza-socios/route.ts",
    "src/client/components/dashboard/tab-mundo.tsx",
  ]
  for (const file of productiveSurfaces) {
    const body = source(file)
    assert.doesNotMatch(body, /Math\.random\s*\(/, file)
    assert.doesNotMatch(body, /\bmock(?:Data|Macro| data)?\b/i, file)
    assert.doesNotMatch(body, /FALLBACK[\s\S]{0,100}\{[\s\S]*?\d{3,}/, file)
  }
})

test("route handlers do not self-fetch their own API", () => {
  for (const file of routeFiles) {
    const body = source(file)
    assert.doesNotMatch(
      body,
      /(?:fetch|fetchRegistered)\s*\(\s*(?:new URL\(\s*[`'"]\/api\/|[`'"](?:http:\/\/localhost|\/api\/)|`\$\{getBaseUrl\(\)\}\/api\/)/,
      file,
    )
    assert.doesNotMatch(body, /from\s+["']@\/app\/api\//, `${file} imports another route module`)
  }
})

test("GET handlers are read-only and ingestion POST handlers fail closed", () => {
  const mutationPattern = /prisma\.[A-Za-z]+\.(?:create|update|upsert|delete|createMany|updateMany|deleteMany)\s*\(/
  for (const file of routeFiles) {
    const body = source(file)
    const getStart = body.search(/export async function GET\s*\(/)
    if (getStart >= 0) {
      const postStart = body.search(/export async function POST\s*\(/)
      const getBody = body.slice(getStart, postStart >= 0 ? postStart : undefined)
      assert.doesNotMatch(getBody, mutationPattern, file)
      assert.doesNotMatch(getBody, /runAllScrapers\s*\(/, file)
    }
  }

  for (const file of [
    "src/app/api/exchange-rates/route.ts",
    "src/app/api/inflation/route.ts",
    "src/app/api/news/route.ts",
    "src/app/api/rofex/route.ts",
    "src/app/api/scrape/[source]/route.ts",
  ]) {
    const body = source(file)
    assert.match(body, /export async function POST/)
    assert.match(body, /requireAdminAuthorization\s*\(/, file)
  }
})

test("RSS proxy accepts only registered feed IDs and status derives checks from registry", () => {
  const rssProxy = source("src/app/api/rss-proxy/route.ts")
  assert.match(rssProxy, /searchParams\.get\("feedId"\)/)
  assert.doesNotMatch(rssProxy, /searchParams\.get\("url"\)/)
  assert.match(rssProxy, /getRegisteredFeed\s*\(/)

  const status = source("src/app/api/status/route.ts")
  assert.match(status, /registeredHealthchecks\s*\(/)
  assert.match(status, /dynamic\s*=\s*["']force-dynamic["']/)
  assert.doesNotMatch(status, /const CHECKS/)
  assert.match(status, /transport:/)
  assert.match(status, /ingestion:/)
  assert.match(status, /freshness:/)
})

test("world macro vertical exposes the common envelope, provenance, freshness, and headers", () => {
  const route = source("src/app/api/world-macro/route.ts")
  assert.match(route, /buildSuccessEnvelope\s*\(/)
  assert.match(route, /buildErrorEnvelope\s*\(/)
  assert.match(route, /freshnessFor\s*\(/)
  for (const header of ["X-Data-Source", "X-Data-As-Of", "X-Data-Freshness"]) {
    assert.match(route, new RegExp(header), header)
  }
})

test("curated datasets are registered and productive debt/band routes do not silently serve hardcoded fallback values", () => {
  const curated = source("src/server/sources/curated-registry.ts")
  assert.match(curated, /bandas_cambiarias_policy/)
  assert.match(curated, /effectiveAt/)
  assert.match(curated, /reference/)

  const bands = source("src/app/api/bandas-cambiarias/route.ts")
  assert.doesNotMatch(bands, /REM_MEDIANA_FALLBACK|REM_TOP10_FALLBACK|fallback hardcodeado|mediana\.map\([\s\S]*?-\s*0\.3|\?\?\s*2\.0/)

  const debt = source("src/app/api/deuda/route.ts")
  assert.doesNotMatch(debt, /LICITACIONES_FALLBACK|VENCIMIENTOS_DETALLE|FALLBACK_DEBT_HISTORY|fallback histórico/)
})

test("registered RSS feeds are HTTPS-only and scheduled GET does not mutate", () => {
  for (const file of ["src/app/api/rss-news/route.ts", "src/app/api/geopolitica/route.ts", "src/server/scrapers/rss.ts"]) {
    assert.doesNotMatch(source(file), /["']http:\/\//, file)
  }
  assert.doesNotMatch(source("vercel.json"), /"path"\s*:\s*"\/api\/cron"/)
  assert.doesNotMatch(source("src/app/api/cron/route.ts"), /export async function GET/)
})

test("card health probes only the bounded read-only endpoints declared for each card", () => {
  assert.ok(!sourceFiles.includes("src/app/api/card-health/route.ts"))
  const hook = source("src/client/hooks/use-card-health.ts")
  const policy = source("src/client/lib/card-health.ts")
  assert.doesNotMatch(hook, /\/api\/card-health/)
  assert.doesNotMatch(hook, /\/api\/status/)
  assert.match(hook, /selectCardHealthProbes\(cardId\)/)
  assert.match(policy, /MAX_CARD_HEALTH_PROBES = 5/)
  assert.match(policy, /SAFE_READ_POST_PATHS/)
})

test("world macro reports multi-country partialness and timeout errors explicitly", () => {
  const route = source("src/app/api/world-macro/route.ts")
  assert.match(route, /expectedCountries|EXPECTED_COUNTRIES/)
  assert.match(route, /completeness/)
  assert.match(route, /TimeoutError/)
})

test("central-bank upstreams are registered with truthful provenance and preserved timeouts", () => {
  const expected: Array<{
    url: string
    id: string
    publisher: string
    kind: string
    dataClass: string
    timeoutMs: number
    credentialEnv?: string
  }> = [
    { url: "https://markets.newyorkfed.org/api/rates/effr/last/1.json", id: "ny_fed_rates", publisher: "Federal Reserve Bank of New York", kind: "json", dataClass: "official_daily", timeoutMs: 10_000 },
    { url: "https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU", id: "fred", publisher: "Federal Reserve Bank of St. Louis", kind: "json", dataClass: "official_daily", timeoutMs: 10_000, credentialEnv: "FRED_API_KEY" },
    { url: "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,1.0/M.MEX.IR3TIB01.ST.A", id: "oecd_sdmx", publisher: "Organisation for Economic Co-operation and Development", kind: "json", dataClass: "official_monthly", timeoutMs: 12_000 },
    { url: "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SR16850/datos/oportuno", id: "banxico_sie", publisher: "Banco de México", kind: "json", dataClass: "official_daily", timeoutMs: 10_000, credentialEnv: "BMX_TOKEN" },
    { url: "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_RT.LEV", id: "ecb_sdw", publisher: "European Central Bank", kind: "csv", dataClass: "official_daily", timeoutMs: 10_000 },
    { url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1", id: "bcb_sgs", publisher: "Banco Central do Brasil", kind: "json", dataClass: "official_daily", timeoutMs: 10_000 },
    { url: "https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?Identifier=IUMABEDR", id: "bank_of_england", publisher: "Bank of England", kind: "csv", dataClass: "official_daily", timeoutMs: 12_000 },
    { url: "https://www.bankofcanada.ca/valet/observations/V39079/json", id: "bank_of_canada", publisher: "Bank of Canada", kind: "json", dataClass: "official_daily", timeoutMs: 10_000 },
    { url: "https://api.rba.gov.au/statistics/tables/f1/", id: "rba_statistics", publisher: "Reserve Bank of Australia", kind: "json", dataClass: "official_daily", timeoutMs: 12_000 },
  ] as const

  for (const item of expected) {
    const definition = findSourceForUrl(item.url)
    assert.equal(definition.id, item.id)
    assert.equal(definition.publisher, item.publisher)
    assert.equal(definition.kind, item.kind)
    assert.equal(definition.dataClass, item.dataClass)
    assert.equal(definition.timeoutMs, item.timeoutMs)
    assert.equal(definition.credentialEnv, item.credentialEnv)
  }
  assert.deepEqual(
    [SOURCE_REGISTRY.fred.credentialEnv, SOURCE_REGISTRY.banxico_sie.credentialEnv],
    ["FRED_API_KEY", "BMX_TOKEN"],
  )

  const route = source("src/app/api/bancos-centrales/route.ts")
  assert.match(route, /fetchRegistered\s*\(/)
  assert.doesNotMatch(route, /\bfetch\s*\(/)
  assert.doesNotMatch(route, /AbortSignal\.timeout/)
  for (const id of expected.map((item) => item.id)) assert.match(route, new RegExp(`sourceId:\\s*["']${id}["']`), id)
  assert.equal(route.split("\n").filter((line) => /^\s+\w[\w_]*:\s+.*tasa:\s+null/.test(line)).length, 10)
  assert.doesNotMatch(route, /hardcoded-fallback/)
  assert.throws(() => findSourceForUrl("https://markets.newyorkfed.org.evil.test/steal"), /UNREGISTERED_SOURCE_HOST/)
  assert.throws(() => findSourceForUrl("http://sdmx.oecd.org/private"), /SOURCE_REQUIRES_HTTPS/)
  assert.throws(() => findSourceForUrl("https://127.0.0.1/internal"), /UNREGISTERED_SOURCE_HOST/)
})

test("Users surfaces share one disabled fail-closed feature gate", () => {
  const flags = source("src/lib/feature-flags.ts")
  assert.match(flags, /^export const USERS_ENABLED = false$/m)
  assert.equal((flags.match(/USERS_ENABLED/g) ?? []).length, 1)

  const appShell = source("src/client/components/workspace/app-shell.tsx")
  assert.match(appShell, /USERS_ENABLED/)
  assert.match(appShell, /item\.id !== "community" \|\| USERS_ENABLED/)
  assert.match(appShell, /stored === "community" && !USERS_ENABLED/)
  assert.match(appShell, /sectionParam === "community" && !USERS_ENABLED/)
  assert.match(appShell, /USERS_ENABLED && section === "community"/)
  assert.doesNotMatch(appShell, /CommunityComingSoon|COMMUNITY_ENABLED/)

  const login = source("src/app/auth/login/page.tsx")
  assert.match(login, /if \(!USERS_ENABLED\) notFound\(\)/)
  assert.ok(login.indexOf("notFound()") < login.indexOf("<LoginForm"))

  for (const file of [
    "src/app/auth/callback/route.ts",
    "src/app/api/profiles/route.ts",
    "src/app/api/profiles/[id]/route.ts",
    "src/app/api/predictions/route.ts",
    "src/app/api/predictions/[id]/route.ts",
  ]) {
    const body = source(file)
    assert.match(body, /import \{ USERS_ENABLED \} from "@\/lib\/feature-flags"/, file)
    assert.match(body, /if \(!USERS_ENABLED\) return new NextResponse\(null, \{ status: 404 \}\)/, file)
  }

  const allSource = sourceFiles.map(source).join("\n")
  assert.doesNotMatch(allSource, /\b(?:COMMUNITY_ENABLED|AUTH_ENABLED)\b/)
})

test("MVP user APIs expose read-only gated GETs and no process-local mutations", () => {
  const userRoutes = [
    "src/app/api/profiles/route.ts",
    "src/app/api/profiles/[id]/route.ts",
    "src/app/api/predictions/route.ts",
    "src/app/api/predictions/[id]/route.ts",
  ]
  for (const file of userRoutes) {
    const body = source(file)
    assert.match(body, /export async function GET/, file)
    assert.doesNotMatch(body, /export async function (POST|PUT|PATCH|DELETE)/, file)
    assert.doesNotMatch(body, /runtimePredictions|new Map|Math\.random|\.push\(|\[[^\]]+\]\s*=/, file)
    assert.doesNotMatch(body, /prisma\.[A-Za-z]+\.(?:create|update|upsert|delete|createMany|updateMany|deleteMany)\s*\(/, file)
    assert.match(body, /if \(!USERS_ENABLED\) return new NextResponse\(null, \{ status: 404 \}\)/, file)
  }
  assert.ok(!sourceFiles.includes("src/app/api/predictions/_store.ts"))
})
