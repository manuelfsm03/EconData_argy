/**
 * POST /api/auth/signup — { email, password } -> crea el usuario en Supabase
 * Auth. Supabase manda el mail de confirmación (config default del proyecto);
 * el Profile recién se crea cuando el usuario efectivamente loguea (ver
 * get-or-create-profile.ts), no acá.
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/server/auth/supabase-server"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Email válido y contraseña de al menos 8 caracteres", retryable: false } },
      { status: 400 },
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return NextResponse.json(
      { error: { code: "SIGNUP_FAILED", message: error.message, retryable: false } },
      { status: 400 },
    )
  }

  return NextResponse.json({
    data: { userId: data.user?.id ?? null, requiereConfirmacion: !data.session },
  })
}
