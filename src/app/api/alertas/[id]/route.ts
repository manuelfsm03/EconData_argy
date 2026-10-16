/**
 * /api/alertas/[id]
 *
 *   • DELETE → borra una alerta propia (chequea ownership)
 *   • PATCH  → actualiza el estado (pausar / reanudar / reactivar tras disparo)
 *
 * Ownership: siempre se filtra por userId de la sesión Supabase; nadie puede
 * tocar alertas ajenas por más que sepa el id.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/server/db/prisma"
import { ALERTAS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

const ESTADOS_VALIDOS = new Set(["activa", "pausada"])

async function getUserOr401() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, resp: NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }) }
  }
  return { user, resp: null }
}

// ── DELETE /api/alertas/[id] ─────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!ALERTAS_ENABLED) return new NextResponse(null, { status: 404 })

  const { user, resp } = await getUserOr401()
  if (!user) return resp!

  // deleteMany con filtro por userId → si no es tuya, count = 0 (404)
  const result = await prisma.alerta.deleteMany({
    where: { id: params.id, userId: user.id },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}

// ── PATCH /api/alertas/[id] ──────────────────────────────────────────────────
// Body: { estado: "activa" | "pausada" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!ALERTAS_ENABLED) return new NextResponse(null, { status: 404 })

  const { user, resp } = await getUserOr401()
  if (!user) return resp!

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 })
  }
  const nuevoEstado = (body as { estado?: unknown }).estado
  if (typeof nuevoEstado !== "string" || !ESTADOS_VALIDOS.has(nuevoEstado)) {
    return NextResponse.json(
      { error: { code: "INVALID_ESTADO", message: "estado debe ser: activa | pausada" } },
      { status: 400 },
    )
  }

  // Verificar ownership antes de actualizar
  const existente = await prisma.alerta.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!existente) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
  }

  // Si el usuario reactiva ("activa") una que estaba "disparada" o "pausada",
  // limpiamos ultimoDisparo para que el poller vuelva a evaluarla desde cero.
  const limpiarDisparo = nuevoEstado === "activa" && existente.estado !== "activa"

  const alerta = await prisma.alerta.update({
    where: { id: existente.id },
    data: {
      estado: nuevoEstado,
      ...(limpiarDisparo ? { ultimoDisparo: null } : {}),
    },
  })

  return NextResponse.json(
    { data: alerta },
    { headers: { "Cache-Control": "no-store" } },
  )
}
