/**
 * GET /api/profiles
 *
 * Sirve los perfiles de la comunidad de La Pizarra.
 * Contrato que Gonza reemplazará con datos reales de la BD.
 *
 * Query params:
 *   ?currentUserId=u1   — opcional; si se pasa, marca el perfil correspondiente
 *                         con isCurrentUser: true (útil cuando el auth esté listo)
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import type { UserProfile } from "@/client/components/profiles/mock-profiles"
// TODO (DB real): importar prisma cuando el modelo User esté migrado
// import { prisma } from "@/server/db/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const currentUserId = searchParams.get("currentUserId")

  // ─── TODO: reemplazar bloque MOCK por DB real ─────────────────────────────
  // Cuando prisma.user exista (después de `npx prisma migrate dev`), cambiar por:
  //
  //   const rows = await prisma.user.findMany({
  //     include: { predictions: true },
  //     orderBy: { puntos: "desc" },
  //   })
  //   const profiles: UserProfile[] = rows.map(u => ({
  //     id:          u.id,
  //     nombre:      u.name,          // DB usa "name", el tipo de cliente usa "nombre"
  //     handle:      u.handle,
  //     bio:         u.bio,
  //     linkedin:    u.linkedin ?? undefined,
  //     avatarBg:    u.avatarBg,
  //     nivel:       u.nivel as BadgeLevel,
  //     fechaAlta:   u.fechaAlta.toISOString(),
  //     streak:      u.streak,
  //     intereses:   u.intereses,
  //     topAcciones: u.topAcciones as { ticker: string; conviccion: number }[],
  //     stats: {
  //       posts:            u.posts,
  //       seguidores:       u.seguidores,
  //       aciertos:         u.aciertos,
  //       totalPrediciones: u.totalPrediciones,
  //       puntos:           u.puntos,
  //     },
  //     isCurrentUser: u.id === currentUserId,
  //   }))
  // ─────────────────────────────────────────────────────────────────────────

  let profiles: UserProfile[] = MOCK_PROFILES

  // Si se pasa currentUserId, recalcular la marca isCurrentUser
  if (currentUserId) {
    profiles = MOCK_PROFILES.map(p => ({
      ...p,
      isCurrentUser: p.id === currentUserId,
    }))
  }

  return NextResponse.json(
    {
      data: profiles,
      total: profiles.length,
      updated_at: new Date().toISOString(),
    },
    {
      headers: {
        // Sin cache por ahora; cuando el backend sea real se puede agregar revalidación
        "Cache-Control": "no-store",
      },
    },
  )
}
