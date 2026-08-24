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
import type { UserProfile, PerfilRiesgo } from "@/client/components/profiles/mock-profiles"
// TODO (DB real): importar prisma cuando Profile esté migrado con Supabase Auth
// import { prisma } from "@/server/db/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const currentUserId = searchParams.get("currentUserId")

  // ─── TODO: reemplazar bloque MOCK por DB real ─────────────────────────────
  // Cuando prisma.user exista (después de `npx prisma migrate dev`), cambiar por:
  //
  //   const rows = await prisma.profile.findMany({
  //     include: { predictions: true },
  //     orderBy: { puntos: "desc" },
  //   })
  //   const profiles: UserProfile[] = rows.map(p => ({
  //     id:          p.id,
  //     nombre:      p.displayName ?? p.username,
  //     handle:      p.username,
  //     bio:         p.bio,
  //     linkedin:    p.linkedin ?? undefined,
  //     foto:        p.avatarUrl ?? undefined,
  //     avatarBg:    p.avatarBg,
  //     nivel:       p.nivel as BadgeLevel,
  //     fechaAlta:   p.fechaAlta.toISOString(),
  //     streak:      p.streak,
  //     intereses:            p.intereses,
  //     interesesRentaFija:   p.interesesRentaFija,
  //     interesesRentaVariable: p.interesesRentaVariable,
  //     perfilRiesgo: (p.perfilRiesgo as PerfilRiesgo) ?? undefined,
  //     topAcciones: p.topAcciones as { ticker: string; conviccion: number }[],
  //     stats: {
  //       posts:            p.posts,
  //       seguidores:       p.seguidores,
  //       aciertos:         p.aciertos,
  //       totalPrediciones: p.totalPrediciones,
  //       puntos:           p.puntos,
  //     },
  //     isCurrentUser: p.id === currentUserId,
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
