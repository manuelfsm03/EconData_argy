/**
 * /api/alertas
 *
 * MVP freemium: cada usuario puede tener hasta 3 alertas activas.
 *   • GET  → lista las alertas del usuario logueado
 *   • POST → crea una alerta nueva (respeta el límite free)
 *
 * Auth: sesión de Supabase (cookie). Sin sesión → 401.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/server/db/prisma"
import { ALERTAS_ENABLED } from "@/lib/feature-flags"
import {
  LIMITE_ALERTAS_FREE,
  validarConfig,
  validarTipo,
  describirAlerta,
  type AlertaConfig,
  type AlertaTipo,
} from "@/server/domain/alertas"

export const dynamic = "force-dynamic"

// ── GET /api/alertas ─────────────────────────────────────────────────────────
export async function GET() {
  if (!ALERTAS_ENABLED) return new NextResponse(null, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
  }

  const alertas = await prisma.alerta.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  const enriched = alertas.map((a) => ({
    id:            a.id,
    tipo:          a.tipo,
    config:        a.config,
    canal:         a.canal,
    emailDestino:  a.emailDestino,
    estado:        a.estado,
    ultimoDisparo: a.ultimoDisparo,
    createdAt:     a.createdAt,
    descripcion:   describirAlerta(a.tipo as AlertaTipo, a.config as unknown as AlertaConfig),
  }))

  const activas = enriched.filter((a) => a.estado === "activa").length

  return NextResponse.json(
    {
      data:       enriched,
      total:      enriched.length,
      activas,
      limiteFree: LIMITE_ALERTAS_FREE,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

// ── POST /api/alertas ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!ALERTAS_ENABLED) return new NextResponse(null, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "body debe ser JSON" } },
      { status: 400 },
    )
  }
  const b = body as Record<string, unknown>

  // Validar tipo
  if (!validarTipo(b.tipo)) {
    return NextResponse.json(
      { error: { code: "INVALID_TIPO", message: "tipo debe ser dolar | tasa_bcra | publicacion_ipc" } },
      { status: 400 },
    )
  }

  // Validar config
  const validacion = validarConfig(b.tipo, b.config)
  if (!validacion.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_CONFIG", message: validacion.error } },
      { status: 400 },
    )
  }

  // Canal — hoy sólo email
  const canal = typeof b.canal === "string" ? b.canal : "email"
  if (canal !== "email") {
    return NextResponse.json(
      { error: { code: "INVALID_CANAL", message: "canal soportado: email (Telegram/push próximamente)" } },
      { status: 400 },
    )
  }

  // Email destino — cae al email del user si no viene explícito
  const emailDestinoRaw = typeof b.emailDestino === "string" ? b.emailDestino.trim() : ""
  const emailDestino = emailDestinoRaw || user.email || ""
  if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
    return NextResponse.json(
      { error: { code: "INVALID_EMAIL", message: "emailDestino inválido y el usuario no tiene email asociado" } },
      { status: 400 },
    )
  }

  // Gate freemium: máximo 3 alertas activas por usuario
  const activas = await prisma.alerta.count({
    where: { userId: user.id, estado: "activa" },
  })
  if (activas >= LIMITE_ALERTAS_FREE) {
    return NextResponse.json(
      {
        error: {
          code: "LIMIT_REACHED",
          message: `Llegaste al límite del plan free (${LIMITE_ALERTAS_FREE} alertas activas). Próximamente: plan Pro.`,
        },
      },
      { status: 403 },
    )
  }

  const alerta = await prisma.alerta.create({
    data: {
      userId:       user.id,
      tipo:         b.tipo,
      config:       validacion.config as unknown as object,
      canal:        "email",
      emailDestino,
      estado:       "activa",
    },
  })

  return NextResponse.json(
    {
      data: {
        id:            alerta.id,
        tipo:          alerta.tipo,
        config:        alerta.config,
        canal:         alerta.canal,
        emailDestino:  alerta.emailDestino,
        estado:        alerta.estado,
        ultimoDisparo: alerta.ultimoDisparo,
        createdAt:     alerta.createdAt,
        descripcion:   describirAlerta(alerta.tipo as AlertaTipo, alerta.config as unknown as AlertaConfig),
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  )
}
