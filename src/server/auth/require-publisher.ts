import { NextResponse } from "next/server"
import { getCurrentUser } from "./supabase-server"
import { prisma } from "@/server/db/prisma"

/**
 * Para proteger rutas de escritura de Informes: solo usuarios logueados CON
 * canPublish=true (hoy se habilita a mano en la tabla profiles, ver nota en
 * schema.prisma). Devuelve el Profile si está autorizado, o una respuesta
 * de error lista para retornar si no.
 */
export async function requirePublisher() {
  const user = await getCurrentUser()
  if (!user) {
    return {
      profile: null,
      blocked: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Hay que iniciar sesión", retryable: false } },
        { status: 401 },
      ),
    }
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } })
  if (!profile?.canPublish) {
    return {
      profile: null,
      blocked: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Tu cuenta no tiene permiso para publicar informes", retryable: false } },
        { status: 403 },
      ),
    }
  }

  return { profile, blocked: null }
}
