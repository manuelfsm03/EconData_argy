import { prisma } from "@/server/db/prisma"
import type { User } from "@supabase/supabase-js"

// Crea el perfil en Postgres la primera vez que el usuario se loguea con Supabase Auth.
// El `id` del perfil = UUID de auth.users.id (no autogenerado por Prisma).
export async function getOrCreateProfile(user: User) {
  const existing = await prisma.profile.findUnique({ where: { id: user.id } })
  if (existing) return existing

  // Username por defecto: parte del email antes del @
  const defaultUsername = (user.email?.split("@")[0] ?? `user_${user.id.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")

  return prisma.profile.create({
    data: {
      id:          user.id,
      username:    defaultUsername,
      displayName: user.user_metadata?.full_name ?? null,
      avatarUrl:   user.user_metadata?.avatar_url ?? null,
    },
  })
}
