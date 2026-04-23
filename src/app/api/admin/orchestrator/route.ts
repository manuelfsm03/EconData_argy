/**
 * POST /api/admin/orchestrator
 * ─────────────────────────────────────────────────────────
 * Orquestador de agentes — corre la cadena completa:
 *
 *  FASE 1 — Monitor: verifica completitud
 *  FASE 2 — Scraping: si hay problemas, intenta resolverlos
 *  FASE 3 — Verificación final: confirma estado post-scraping
 *
 * Retorna un reporte unificado con el estado de cada fase.
 * Auth: cookie | x-admin-password | Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime     = "nodejs"
export const maxDuration = 55

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const pw   = process.env.ADMIN_PASSWORD
  const cron = process.env.CRON_SECRET
  if (!pw) return false
  if (req.headers.get("x-admin-password") === pw) return true
  if (req.cookies.get("lapizarra_admin")?.value === pw) return true
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true
  return false
}

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

function adminPost(path: string) {
  return fetch(`${getBase()}${path}`, {
    method:  "POST",
    headers: {
      "x-admin-password": process.env.ADMIN_PASSWORD ?? "",
      "Content-Type":     "application/json",
    },
    signal: AbortSignal.timeout(45000),
  })
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FaseStatus = "ok" | "parcial" | "error" | "skipped"

interface Fase {
  nombre:     string
  status:     FaseStatus
  mensaje:    string
  elapsed_ms: number
  detalle?:   unknown
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tStart = Date.now()
  const fases:  Fase[] = []

  // ══════════════════════════════════════════════
  // FASE 1 — Monitor (completitud + log Supabase)
  // ══════════════════════════════════════════════
  const t1 = Date.now()
  let monitorData: Record<string, unknown> | null = null
  try {
    const res   = await adminPost("/api/admin/monitor")
    monitorData = await res.json() as Record<string, unknown>
    const healthy = monitorData.healthy as boolean
    const nivel   = monitorData.nivel   as string
    const ndeg    = monitorData.degradados_count as number

    fases.push({
      nombre:     "Monitor",
      status:     healthy ? "ok" : nivel === "critico" ? "error" : "parcial",
      mensaje:    monitorData.mensaje as string,
      elapsed_ms: Date.now() - t1,
      detalle:    monitorData.summary,
    })
  } catch (e) {
    fases.push({ nombre: "Monitor", status: "error", mensaje: String(e).slice(0, 100), elapsed_ms: Date.now() - t1 })
  }

  // ══════════════════════════════════════════════
  // FASE 2 — Scraping inteligente (solo si hay problemas)
  // ══════════════════════════════════════════════
  const hayProblemas = fases[0].status !== "ok"
  const t2 = Date.now()

  if (!hayProblemas) {
    fases.push({
      nombre:     "Scraping",
      status:     "skipped",
      mensaje:    "No se necesitó — todo estaba OK",
      elapsed_ms: 0,
    })
  } else {
    try {
      const res      = await adminPost("/api/admin/scraping-agent")
      const scraData = await res.json() as Record<string, unknown>
      const resueltos = (scraData.resueltos as unknown[] ?? []).length
      const siguen    = (scraData.siguen_rotos as unknown[] ?? []).length

      fases.push({
        nombre:     "Scraping",
        status:     siguen === 0 ? "ok" : resueltos > 0 ? "parcial" : "error",
        mensaje:    scraData.mensaje as string,
        elapsed_ms: Date.now() - t2,
        detalle:    { resueltos, siguen_rotos: siguen, runs: scraData.runs },
      })
    } catch (e) {
      fases.push({ nombre: "Scraping", status: "error", mensaje: String(e).slice(0, 100), elapsed_ms: Date.now() - t2 })
    }
  }

  // ══════════════════════════════════════════════
  // FASE 3 — Verificación final (solo si scraping corrió)
  // ══════════════════════════════════════════════
  const t3 = Date.now()

  if (fases[1].status === "skipped") {
    fases.push({
      nombre:     "Verificación",
      status:     "skipped",
      mensaje:    "No requerida",
      elapsed_ms: 0,
    })
  } else {
    try {
      const res   = await adminPost("/api/admin/monitor")
      const data  = await res.json() as Record<string, unknown>
      const sigue = data.degradados_count as number

      fases.push({
        nombre:     "Verificación",
        status:     sigue === 0 ? "ok" : "parcial",
        mensaje:    sigue === 0
          ? "✓ Dashboard completamente sano post-scraping"
          : `${sigue} endpoint(s) aún con problemas`,
        elapsed_ms: Date.now() - t3,
        detalle:    data.summary,
      })
    } catch (e) {
      fases.push({ nombre: "Verificación", status: "error", mensaje: String(e).slice(0, 100), elapsed_ms: Date.now() - t3 })
    }
  }

  // ── Nivel global ──────────────────────────────────────────────────────────
  const nivelGlobal: FaseStatus =
    fases.every(f => f.status === "ok" || f.status === "skipped") ? "ok"
    : fases.some(f => f.status === "error")                        ? "error"
    : "parcial"

  return NextResponse.json({
    nivel:      nivelGlobal,
    elapsed_ms: Date.now() - tStart,
    timestamp:  new Date().toISOString(),
    fases,
  })
}
