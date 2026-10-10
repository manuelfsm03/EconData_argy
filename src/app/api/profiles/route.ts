/**
 * GET /api/profiles
 *
 * Sirve los perfiles de la comunidad de La Pizarra desde Postgres (Prisma).
 *
 * Query params:
 *   ?currentUserId=u1   — opcional; marca el perfil correspondiente
 *                         con isCurrentUser: true
 *
 * Sigue detrás de USERS_ENABLED: hasta que la base de datos exista de
 * verdad (ver prisma/postgresql/20260909_add_user_profiles.sql) y se
 * prenda la flag, esta ruta sigue devolviendo 404 igual que antes — el
 * query real no se ejecuta si USERS_ENABLED es false.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/server/db/prisma"
import { mapProfileToUserProfile } from "@/server/profiles/map-profile"
import { USERS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!USERS_ENABLED) return new NextResponse(null, { status: 404 })

  const { searchParams } = req.nextUrl
  const currentUserId = searchParams.get("currentUserId")

  try {
    const rows = await prisma.profile.findMany({ orderBy: { puntos: "desc" } })
    const profiles = rows.map((row) => mapProfileToUserProfile(row, currentUserId))

    return NextResponse.json(
      { data: profiles, total: profiles.length, updated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    // No se filtra el mensaje de error al cliente: puede traer detalle de la
    // connection string de Postgres. Se loguea del lado del servidor nomás.
    console.error("[api/profiles] Error consultando perfiles:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: { code: "DB_UNAVAILABLE", message: "No se pudo consultar la base de perfiles" } },
      { status: 503 },
    )
  }
}
