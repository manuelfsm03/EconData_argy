/**
 * GET /api/admin/metrics?days=7
 * ─────────────────────────────────────────────────────────
 * Panel de métricas del agente conversacional.
 * Auth: header x-admin-password contra env var ADMIN_PASSWORD.
 * ─────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function requireAdmin(request: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  if (request.headers.get("x-admin-password") === expected) return true
  if (request.cookies.get("lapizarra_admin")?.value === expected) return true
  return false
}

function supabaseUrl(path: string): string {
  return `${(process.env.SUPABASE_URL ?? "").replace(/\/$/, "")}/rest/v1/${path}`
}
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const days = Math.max(1, Math.min(90, Number(request.nextUrl.searchParams.get("days") ?? "7")))
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 })
  }

  try {
    const res = await fetch(
      supabaseUrl("chat_events") +
        `?select=*&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=5000`,
      { headers: supabaseHeaders(), signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) throw new Error(`Supabase ${res.status}`)
    const rows: ChatEvent[] = await res.json()

    return NextResponse.json({
      window_days:     days,
      since,
      totals:          computeTotals(rows),
      by_model:        computeByModel(rows),
      by_hour:         computeByHour(rows),
      top_questions:   computeTopQuestions(rows),
      tool_stats:      computeToolStats(rows),
      recent_errors:   recentErrors(rows),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ToolCallEntry {
  tool:       string
  ok:         boolean
  latency_ms: number
}

interface ChatEvent {
  id:               number
  created_at:       string
  ip_hash:          string
  session_id:       string | null
  message_text:     string
  message_hash:     string
  model_id:         string
  tool_calls:       ToolCallEntry[]
  iterations:       number
  latency_ms_total: number
  tokens_input:     number | null
  tokens_output:    number | null
  cost_usd:         number | null
  status:           string
  error_message:    string | null
  answer_len:       number | null
}

// ── Agregaciones ──────────────────────────────────────────────────────────────

function computeTotals(rows: ChatEvent[]) {
  const ok = rows.filter((r) => r.status === "ok")
  return {
    total_queries:   rows.length,
    ok_queries:      ok.length,
    errors:          rows.filter((r) => r.status === "error").length,
    rate_limited:    rows.filter((r) => r.status === "rate_limited").length,
    unique_users:    new Set(rows.map((r) => r.ip_hash).filter(Boolean)).size,
    cost_usd_total:  Math.round(rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) * 1_000_000) / 1_000_000,
    tokens_in_total: rows.reduce((s, r) => s + (r.tokens_input  ?? 0), 0),
    tokens_out_total:rows.reduce((s, r) => s + (r.tokens_output ?? 0), 0),
    avg_latency_ms:  ok.length ? Math.round(ok.reduce((s, r) => s + r.latency_ms_total, 0) / ok.length) : 0,
  }
}

function computeByModel(rows: ChatEvent[]) {
  const grouped: Record<string, { total: number; ok: number; cost: number; latencies: number[] }> = {}
  for (const r of rows) {
    const m = r.model_id
    if (!m) continue
    grouped[m] ??= { total: 0, ok: 0, cost: 0, latencies: [] }
    grouped[m].total++
    if (r.status === "ok") { grouped[m].ok++; grouped[m].latencies.push(r.latency_ms_total) }
    grouped[m].cost += r.cost_usd ?? 0
  }
  return Object.entries(grouped).map(([model_id, g]) => ({
    model_id,
    total:          g.total,
    ok:             g.ok,
    cost_usd:       Math.round(g.cost * 1_000_000) / 1_000_000,
    p50_latency_ms: percentile(g.latencies, 0.5),
    p95_latency_ms: percentile(g.latencies, 0.95),
  }))
}

function computeByHour(rows: ChatEvent[]) {
  const buckets = new Array(24).fill(0)
  for (const r of rows) {
    try {
      const hour = (new Date(r.created_at).getUTCHours() - 3 + 24) % 24 // UTC-3 Argentina
      buckets[hour]++
    } catch { /* skip */ }
  }
  return buckets.map((count, hour) => ({ hour, count }))
}

function computeTopQuestions(rows: ChatEvent[]) {
  const grouped: Record<string, { example: string; count: number; users: Set<string> }> = {}
  for (const r of rows) {
    if (r.status !== "ok" || !r.message_hash) continue
    grouped[r.message_hash] ??= { example: r.message_text, count: 0, users: new Set() }
    grouped[r.message_hash].count++
    grouped[r.message_hash].users.add(r.ip_hash)
  }
  return Object.values(grouped)
    .map((g) => ({ example: g.example, count: g.count, unique_users: g.users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
}

function computeToolStats(rows: ChatEvent[]) {
  const stats: Record<string, { total: number; ok: number; fail: number; latencies: number[] }> = {}
  for (const r of rows) {
    for (const tc of r.tool_calls ?? []) {
      stats[tc.tool] ??= { total: 0, ok: 0, fail: 0, latencies: [] }
      stats[tc.tool].total++
      if (tc.ok) stats[tc.tool].ok++; else stats[tc.tool].fail++
      if (tc.latency_ms) stats[tc.tool].latencies.push(tc.latency_ms)
    }
  }
  return Object.entries(stats).map(([tool, s]) => ({
    tool,
    total:          s.total,
    ok:             s.ok,
    fail:           s.fail,
    pct_fail:       s.total ? Math.round(s.fail * 100 / s.total * 10) / 10 : 0,
    avg_latency_ms: s.latencies.length ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length) : null,
  }))
}

function recentErrors(rows: ChatEvent[]) {
  return rows
    .filter((r) => r.status === "error")
    .slice(0, 20)
    .map((r) => ({
      created_at:       r.created_at,
      model_id:         r.model_id,
      message_text:     r.message_text,
      error_message:    r.error_message,
      latency_ms_total: r.latency_ms_total,
    }))
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)]
}
