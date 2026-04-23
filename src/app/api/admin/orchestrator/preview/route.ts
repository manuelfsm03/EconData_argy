/**
 * POST /api/admin/orchestrator/preview
 * ─────────────────────────────────────────────────────────
 * Dry-run del orquestador: corre solo completitud y devuelve
 * exactamente qué haría el flujo completo, sin ejecutar nada.
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const runtime     = "nodejs"
export const maxDuration = 30

// ── Token store en memoria (se limpia con cada deploy) ────────────────────────
// En producción con múltiples instancias usar Supabase/Redis
// Para Vercel Hobby (single region) es suficiente

interface PendingToken {
  token:      string
  preview:    unknown
  created_at: number
  expires_at: number
  used:       boolean
}

// Exportado para que /approve pueda acceder
export const pendingTokens = new Map<string, PendingToken>()

const TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutos

export function createApprovalToken(preview: unknown): string {
  // Limpiar tokens expirados
  const now = Date.now()
  for (const [k, v] of pendingTokens.entries()) {
    if (v.expires_at < now) pendingTokens.delete(k)
  }

  const token = crypto.randomBytes(4).toString("hex").toUpperCase() // ej: A3F9-B2C1
    .replace(/(.{4})(.{4})/, "$1-$2")

  pendingTokens.set(token, {
    token,
    preview,
    created_at: now,
    expires_at: now + TOKEN_TTL_MS,
    used:       false,
  })

  return token
}

export function validateToken(token: string): { ok: boolean; preview?: unknown; error?: string } {
  const entry = pendingTokens.get(token.toUpperCase())
  if (!entry)         return { ok: false, error: "Token inválido" }
  if (entry.used)     return { ok: false, error: "Token ya utilizado" }
  if (Date.now() > entry.expires_at)
    return { ok: false, error: "Token expirado (válido 10 min)" }
  return { ok: true, preview: entry.preview }
}

export function consumeToken(token: string): boolean {
  const entry = pendingTokens.get(token.toUpperCase())
  if (!entry || entry.used || Date.now() > entry.expires_at) return false
  entry.used = true
  return true
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return false
  if (req.headers.get("x-admin-password") === pw) return true
  if (req.cookies.get("lapizarra_admin")?.value === pw) return true
  return false
}

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

// ── Mapa check → scraper (duplicado del scraping-agent para el preview) ───────

const CHECK_TO_SCRAPER: Record<string, string> = {
  dolares:       "dolarapi",
  rss_news:      "rss",
  geopolitica:   "rss",
  tc_historico:  "dolarapi",
  riesgo_pais:   "bcra",
  macro_emae:    "cache_bust",
  macro_ipc:     "cache_bust",
  macro_ipi:     "cache_bust",
  macro_balanza: "cache_bust",
  macro_fiscal:  "cache_bust",
  mundo:         "cache_bust",
  acciones:      "cache_bust",
  bonos:         "cache_bust",
  deuda:         "cache_bust",
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Correr solo completitud (sin ejecutar scrapers)
  const res = await fetch(`${getBase()}/api/admin/completitud`, {
    headers: { "x-admin-password": process.env.ADMIN_PASSWORD ?? "" },
    signal:  AbortSignal.timeout(25000),
  })

  if (!res.ok)
    return NextResponse.json({ error: "No se pudo correr completitud" }, { status: 502 })

  const report = await res.json() as {
    summary: Record<string, number>
    checks:  { id: string; label: string; status: string; mensaje: string }[]
  }

  const problemas = report.checks.filter(c => c.status !== "ok")
  const scrapers  = [...new Set(problemas.map(c => CHECK_TO_SCRAPER[c.id] ?? "cache_bust"))]

  const preview = {
    timestamp:         new Date().toISOString(),
    estado_actual:     report.summary,
    problemas_count:   problemas.length,
    problemas:         problemas.map(c => ({
      label:   c.label,
      status:  c.status,
      mensaje: c.mensaje,
    })),
    acciones_previstas: problemas.length === 0
      ? ["Nada — todo está OK"]
      : [
          `Correr scraping inteligente (${scrapers.filter(s => s !== "cache_bust").join(", ") || "cache busts"})`,
          "Re-verificar completitud post-scraping",
          "Guardar resultado en Supabase (monitor)",
        ],
    scrapers_a_correr: scrapers,
    requiere_accion:   problemas.length > 0,
  }

  // Generar token de aprobación
  const token = createApprovalToken(preview)

  return NextResponse.json({
    preview,
    approval_token:  token,
    expires_in_min:  10,
    instrucciones:   `Compartí el token "${token}" con un miembro del equipo para que autorice la ejecución en /admin`,
  })
}
