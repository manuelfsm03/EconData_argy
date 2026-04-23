/**
 * GET  /api/admin/monitor          — historial de runs
 * POST /api/admin/monitor          — ejecuta un run ahora (manual o cron)
 *
 * El agente monitor llama al agente de completitud, guarda el resultado
 * en Supabase y retorna un resumen con las degradaciones detectadas.
 *
 * Auth: cookie lapizarra_admin o header x-admin-password
 * Cron: llamar con header Authorization: Bearer CRON_SECRET (Vercel Cron)
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime    = "nodejs"
export const maxDuration = 45

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  if (req.headers.get("x-admin-password") === expected) return true
  if (req.cookies.get("lapizarra_admin")?.value === expected) return true
  // Vercel Cron / scheduled calls
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true
  return false
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbUrl(path: string) {
  return `${(process.env.SUPABASE_URL ?? "").replace(/\/$/, "")}/rest/v1/${path}`
}
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

async function saveRun(payload: unknown) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  await fetch(sbUrl("monitor_runs"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(4000),
  }).catch(() => {/* fire-and-forget */})
}

async function getHistory(limit = 20): Promise<unknown[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return []
  try {
    const res = await fetch(
      sbUrl("monitor_runs") + `?select=*&order=created_at.desc&limit=${limit}`,
      { headers: sbHeaders(), signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

// ── Base URL ──────────────────────────────────────────────────────────────────

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  id:         string
  label:      string
  categoria:  string
  status:     string
  mensaje:    string
  hardcoded?: string[]
}

interface CompletitudReport {
  generated_at: string
  elapsed_ms:   number
  summary:      Record<string, number>
  checks:       CheckResult[]
}

// ── POST: ejecutar run ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tStart = Date.now()

  // Llamar al agente de completitud
  const completitudRes = await fetch(`${getBase()}/api/admin/completitud`, {
    headers: { "x-admin-password": process.env.ADMIN_PASSWORD ?? "" },
    signal:  AbortSignal.timeout(35000),
  })

  if (!completitudRes.ok) {
    return NextResponse.json({ error: "No se pudo correr completitud" }, { status: 502 })
  }

  const report = await completitudRes.json() as CompletitudReport

  // Detectar degradaciones (endpoints que no están ok)
  const degradados = report.checks
    .filter(c => c.status !== "ok")
    .map(c => ({
      id:       c.id,
      label:    c.label,
      status:   c.status,
      mensaje:  c.mensaje,
      hardcoded: c.hardcoded ?? [],
    }))

  const healthy = degradados.length === 0
  const nivel   = degradados.some(d => d.status === "error")  ? "critico"
                : degradados.some(d => d.status === "empty")   ? "alto"
                : degradados.some(d => d.status === "stale")   ? "medio"
                : degradados.some(d => d.status === "hardcoded") ? "bajo"
                : "ok"

  const runPayload = {
    created_at:       new Date().toISOString(),
    elapsed_ms:       Date.now() - tStart,
    healthy,
    nivel,
    summary:          report.summary,
    degradados_count: degradados.length,
    degradados:       degradados,
    checks_total:     report.checks.length,
  }

  await saveRun(runPayload)

  return NextResponse.json({
    ...runPayload,
    mensaje: healthy
      ? `✓ Todo OK — ${report.checks.length} endpoints verificados`
      : `⚠ ${degradados.length} endpoint(s) con problemas`,
  })
}

// ── GET: historial ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const history = await getHistory(30)
  return NextResponse.json({ runs: history })
}
