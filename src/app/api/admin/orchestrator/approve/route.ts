/**
 * POST /api/admin/orchestrator/approve
 * ─────────────────────────────────────────────────────────
 * Valida el token de aprobación y ejecuta el orquestador.
 * Requiere: token (del preview) + APPROVER_TOKEN (env var del aprobador).
 *
 * Body: { token: string, approver_key: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateToken, consumeToken } from "../preview/route"
import { authenticator } from "otplib"

export const runtime     = "nodejs"
export const maxDuration = 55

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; totp_code?: string }

  // ── Validar código TOTP del teléfono ──────────────────────────────────────
  const totpSecret = process.env.TOTP_SECRET
  if (!totpSecret) {
    return NextResponse.json(
      { error: "TOTP no configurado. Ir a /admin/totp-setup para escanear el QR." },
      { status: 503 },
    )
  }

  const code = (body.totp_code ?? "").replace(/\s/g, "")
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Código TOTP debe ser 6 dígitos" }, { status: 400 })
  }

  const totpValid = authenticator.verify({ token: code, secret: totpSecret })
  if (!totpValid) {
    return NextResponse.json(
      { error: "Código TOTP incorrecto o expirado (30s de validez)" },
      { status: 401 },
    )
  }

  // ── Validar token de aprobación ───────────────────────────────────────────
  const token = (body.token ?? "").toUpperCase().trim()
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 })
  }

  const validation = validateToken(token)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // Consumir token (no reutilizable)
  consumeToken(token)

  // ── Ejecutar orquestador ──────────────────────────────────────────────────
  const res = await fetch(`${getBase()}/api/admin/orchestrator`, {
    method:  "POST",
    headers: {
      "x-admin-password": process.env.ADMIN_PASSWORD ?? "",
      "Content-Type":     "application/json",
    },
    signal: AbortSignal.timeout(50000),
  })

  const result = await res.json()

  return NextResponse.json({
    aprobado_por:   "totp",
    token_usado:    token,
    timestamp:      new Date().toISOString(),
    resultado:      result,
  })
}
