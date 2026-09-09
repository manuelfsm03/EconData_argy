/**
 * GET /api/profiles/[id] — un perfil por id, desde Postgres (Prisma).
 *
 * Sigue detrás de USERS_ENABLED. Ver /api/profiles/route.ts para el
 * contexto de por qué el query real no corre hasta que la flag se prenda.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/server/db/prisma"
import { mapProfileToUserProfile } from "@/server/profiles/map-profile"
import { USERS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!USERS_ENABLED) return new NextResponse(null, { status: 404 })

  const { id } = await params

  try {
    const profile = await prisma.profile.findUnique({ where: { id } })
    if (!profile) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Perfil no encontrado" } }, { status: 404 })
    }

    return NextResponse.json(
      { data: mapProfileToUserProfile(profile) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[api/profiles/[id]] Error consultando el perfil:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: { code: "DB_UNAVAILABLE", message: "No se pudo consultar el perfil" } },
      { status: 503 },
    )
  }
}
