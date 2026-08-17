import { NextResponse } from "next/server"
import { getCurrentUser } from "./supabase-server"

/**
 * Para proteger un route handler: `const blocked = await requireUser(); if (blocked) return blocked`.
 * Mismo patrón que requireAdminAuthorization (server/api/admin-auth.ts) pero
 * para "cualquier usuario logueado" en vez de admin por secret.
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Hay que iniciar sesión", retryable: false } },
      { status: 401 },
    )
  }
  return null
}
