import type { User } from "@supabase/supabase-js"
import { prisma } from "@/server/db/prisma"

function usernameDesdeEmail(email: string | undefined, uid: string): string {
  const local = email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
  return local && local.length >= 3 ? local : `user_${uid.slice(0, 8)}`
}

/**
 * Devuelve el Profile del usuario logueado, creándolo la primera vez que
 * hace falta (idempotente -- no asume que el signup ya lo creó, para no
 * depender de un trigger de base de datos entre proyectos distintos).
 */
export async function getOrCreateProfile(user: User) {
  const existing = await prisma.profile.findUnique({ where: { id: user.id } })
  if (existing) return existing

  const base = usernameDesdeEmail(user.email, user.id)
  for (let intento = 0; intento < 5; intento++) {
    const username = intento === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    try {
      return await prisma.profile.create({ data: { id: user.id, username } })
    } catch (error) {
      // P2002 = unique constraint (username u id ya existe) -- reintentar con otro username.
      // Si es el id el que colisiona, otra request ya lo creó: lo leemos y listo.
      const yaExiste = await prisma.profile.findUnique({ where: { id: user.id } })
      if (yaExiste) return yaExiste
      if (intento === 4) throw error
    }
  }
  throw new Error("No se pudo crear el perfil")
}
