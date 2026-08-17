/**
 * GET /api/auth/me — usuario + perfil actuales, o { data: null } si no hay
 * sesión (200, no 401 -- esto lo consume el frontend para decidir qué
 * mostrar, no es una ruta protegida).
 */
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/server/auth/supabase-server"
import { getOrCreateProfile } from "@/server/auth/get-or-create-profile"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ data: null })

  const profile = await getOrCreateProfile(user)
  return NextResponse.json({
    data: { userId: user.id, email: user.email, username: profile.username, avatarUrl: profile.avatarUrl },
  })
}
