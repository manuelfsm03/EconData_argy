/**
 * POST /api/admin/scraping-agent
 * ─────────────────────────────────────────────────────────
 * Agente de scraping inteligente:
 *  1. Corre el agente de completitud para saber qué está desactualizado
 *  2. Mapea cada problema a los scrapers responsables
 *  3. Prioriza por urgencia: error > empty > stale > hardcoded
 *  4. Corre solo los scrapers necesarios (no todos)
 *  5. Re-verifica completitud para confirmar que se resolvió
 *  6. Devuelve reporte de qué se arregló y qué sigue roto
 *
 * GET /api/admin/scraping-agent — devuelve el mapa de cobertura
 *
 * Auth: cookie lapizarra_admin o header x-admin-password o Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime    = "nodejs"
export const maxDuration = 55

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  if (req.headers.get("x-admin-password") === expected) return true
  if (req.cookies.get("lapizarra_admin")?.value === expected) return true
  const cron = process.env.CRON_SECRET
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true
  return false
}

// ── Base URL ──────────────────────────────────────────────────────────────────

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

function adminFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${getBase()}${path}`, {
    ...opts,
    headers: {
      "x-admin-password": process.env.ADMIN_PASSWORD ?? "",
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    signal: AbortSignal.timeout(30000),
  })
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Urgencia = "error" | "empty" | "stale" | "hardcoded"

interface CheckResult {
  id:       string
  label:    string
  status:   string
  mensaje:  string
}

interface ScraperTask {
  scraper:  string
  urgencia: Urgencia
  checks:   string[]   // IDs de checks que este scraper puede resolver
  labels:   string[]
}

interface ScraperRun {
  scraper:    string
  ok:         boolean
  message:    string
  latency_ms: number
}

// ── Mapa check → scraper ──────────────────────────────────────────────────────
// Qué scraper es responsable de actualizar cada endpoint

const CHECK_TO_SCRAPER: Record<string, string> = {
  dolares:      "dolarapi",
  rss_news:     "rss",
  geopolitica:  "rss",
  tc_historico: "dolarapi",
  // BCRA
  riesgo_pais:  "bcra",
  // Macro — datos.gob.ar, sin scraper dedicado (cache interno)
  macro_emae:   "cache_bust",
  macro_ipc:    "cache_bust",
  macro_ipi:    "cache_bust",
  macro_balanza:"cache_bust",
  macro_fiscal: "cache_bust",
  // Mercados — Yahoo Finance directo
  mundo:        "cache_bust",
  acciones:     "cache_bust",
  bonos:        "cache_bust",
  deuda:        "cache_bust",
}

// Scrapers reales disponibles en /api/scrape/[source]
const REAL_SCRAPERS = new Set(["dolarapi", "criptoya", "bcra", "rss"])

// ── Cache bust: fuerza re-fetch del endpoint ──────────────────────────────────

async function bustCache(checkId: string): Promise<ScraperRun> {
  const pathMap: Record<string, string> = {
    macro_emae:    "/api/macro?endpoint=emae",
    macro_ipc:     "/api/macro?endpoint=ipc",
    macro_ipi:     "/api/macro?endpoint=ipi",
    macro_balanza: "/api/macro?endpoint=balanza",
    macro_fiscal:  "/api/macro?endpoint=fiscal",
    mundo:         "/api/mundo",
    acciones:      "/api/acciones?category=all",
    bonos:         "/api/bonos?ticker=AL30",
    deuda:         "/api/deuda",
  }
  const path = pathMap[checkId]
  if (!path) return { scraper: `cache_bust:${checkId}`, ok: false, message: "Sin path mapeado", latency_ms: 0 }

  const t0 = Date.now()
  try {
    // El header cache-control: no-cache fuerza re-fetch en Next.js
    const res = await fetch(`${getBase()}${path}`, {
      headers: { "cache-control": "no-cache", "x-internal-agent": "scraping-agent" },
      signal: AbortSignal.timeout(10000),
    })
    return {
      scraper:    `cache_bust:${checkId}`,
      ok:         res.ok,
      message:    res.ok ? "Cache refrescada" : `HTTP ${res.status}`,
      latency_ms: Date.now() - t0,
    }
  } catch (e) {
    return { scraper: `cache_bust:${checkId}`, ok: false, message: String(e).slice(0, 100), latency_ms: Date.now() - t0 }
  }
}

// ── Correr scraper real ───────────────────────────────────────────────────────

async function runScraper(name: string): Promise<ScraperRun> {
  const t0 = Date.now()
  try {
    const res = await adminFetch(`/api/scrape/${name}`, { method: "POST" })
    const data = await res.json() as Record<string, unknown>
    return {
      scraper:    name,
      ok:         res.ok,
      message:    res.ok
        ? `${data.recordsAdded ?? data.message ?? "OK"}`
        : (data.error as string ?? `HTTP ${res.status}`),
      latency_ms: Date.now() - t0,
    }
  } catch (e) {
    return { scraper: name, ok: false, message: String(e).slice(0, 100), latency_ms: Date.now() - t0 }
  }
}

// ── POST: ejecutar agente ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tStart = Date.now()

  // ── 1. Completitud inicial ────────────────────────────────────────────────
  const beforeRes = await adminFetch("/api/admin/completitud")
  if (!beforeRes.ok)
    return NextResponse.json({ error: "No se pudo obtener completitud" }, { status: 502 })

  const before = await beforeRes.json() as { checks: CheckResult[]; summary: Record<string, number> }

  // ── 2. Identificar problemas y buildear plan ──────────────────────────────
  const URGENCIA_ORDER: Record<string, number> = { error: 0, empty: 1, stale: 2, hardcoded: 3 }

  const problemChecks = before.checks
    .filter(c => c.status !== "ok")
    .sort((a, b) => (URGENCIA_ORDER[a.status] ?? 9) - (URGENCIA_ORDER[b.status] ?? 9))

  if (problemChecks.length === 0) {
    return NextResponse.json({
      elapsed_ms:  Date.now() - tStart,
      ya_ok:       true,
      mensaje:     "✓ Todo estaba OK, no hubo nada que actualizar.",
      before_summary: before.summary,
      tasks:       [],
      runs:        [],
    })
  }

  // Agrupar por scraper
  const scraperMap = new Map<string, ScraperTask>()
  for (const check of problemChecks) {
    const scraper = CHECK_TO_SCRAPER[check.id] ?? "cache_bust"
    const key     = REAL_SCRAPERS.has(scraper) ? scraper : `cache_bust:${check.id}`

    if (!scraperMap.has(key)) {
      scraperMap.set(key, {
        scraper:  scraper,
        urgencia: check.status as Urgencia,
        checks:   [],
        labels:   [],
      })
    }
    const task = scraperMap.get(key)!
    task.checks.push(check.id)
    task.labels.push(check.label)
    // Mantener la urgencia más alta
    if ((URGENCIA_ORDER[check.status] ?? 9) < (URGENCIA_ORDER[task.urgencia] ?? 9)) {
      task.urgencia = check.status as Urgencia
    }
  }

  const tasks = [...scraperMap.values()]
    .sort((a, b) => (URGENCIA_ORDER[a.urgencia] ?? 9) - (URGENCIA_ORDER[b.urgencia] ?? 9))

  // ── 3. Ejecutar scrapers en orden de urgencia ─────────────────────────────
  const runs: ScraperRun[] = []
  for (const task of tasks) {
    let run: ScraperRun
    if (REAL_SCRAPERS.has(task.scraper)) {
      run = await runScraper(task.scraper)
    } else {
      // cache_bust para el check específico
      const checkId = task.checks[0]
      run = await bustCache(checkId)
    }
    runs.push(run)
  }

  // ── 4. Re-verificar completitud ───────────────────────────────────────────
  await new Promise(r => setTimeout(r, 1500)) // esperar que los caches se asienten
  const afterRes  = await adminFetch("/api/admin/completitud")
  const after     = afterRes.ok
    ? await afterRes.json() as { checks: CheckResult[]; summary: Record<string, number> }
    : null

  // ── 5. Diff: qué se arregló, qué sigue roto ──────────────────────────────
  const beforeMap = Object.fromEntries(before.checks.map(c => [c.id, c.status]))
  const afterMap  = after ? Object.fromEntries(after.checks.map(c => [c.id, c.status])) : {}

  const resueltos = problemChecks.filter(c => afterMap[c.id] === "ok")
  const siguen    = after?.checks.filter(c => c.status !== "ok") ?? problemChecks

  return NextResponse.json({
    elapsed_ms:      Date.now() - tStart,
    ya_ok:           false,
    mensaje:         resueltos.length === problemChecks.length
      ? `✓ Todos los problemas resueltos (${resueltos.length}/${problemChecks.length})`
      : `Resueltos ${resueltos.length}/${problemChecks.length} · ${siguen.length} siguen con problemas`,
    before_summary:  before.summary,
    after_summary:   after?.summary ?? null,
    tasks,
    runs,
    resueltos:       resueltos.map(c => ({ id: c.id, label: c.label })),
    siguen_rotos:    siguen.map(c => ({ id: c.id, label: c.label, status: c.status, mensaje: c.mensaje })),
  })
}

// ── GET: mapa de cobertura ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  return NextResponse.json({
    cobertura: Object.entries(CHECK_TO_SCRAPER).map(([check, scraper]) => ({
      check,
      scraper,
      tipo: REAL_SCRAPERS.has(scraper) ? "scraper_real" : "cache_bust",
    })),
    scrapers_disponibles: [...REAL_SCRAPERS],
  })
}
