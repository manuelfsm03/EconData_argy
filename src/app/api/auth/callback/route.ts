/**
 * GET /api/auth/callback?code=... — a donde Supabase redirige después de
 * confirmar el mail o clickear un magic link. Cambia el `code` por una
 * sesión real y manda al usuario de vuelta a la app.
 */
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/server/auth/supabase-server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
