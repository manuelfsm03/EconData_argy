/**
 * POST /api/auth/login — { email, password } -> arranca la sesión (la
 * cookie la escribe createSupabaseServerClient a través del set-cookie de
 * la response de Next). Además asegura que exista el Profile del usuario.
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/server/auth/supabase-server"
import { getOrCreateProfile } from "@/server/auth/get-or-create-profile"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Falta email o contraseña", retryable: false } },
      { status: 400 },
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json(
      { error: { code: "LOGIN_FAILED", message: error?.message ?? "Credenciales inválidas", retryable: false } },
      { status: 401 },
    )
  }

  const profile = await getOrCreateProfile(data.user)
  return NextResponse.json({ data: { userId: data.user.id, username: profile.username } })
}
