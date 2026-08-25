import { createClient } from "@/lib/supabase/server"
import { getOrCreateProfile } from "@/server/auth/get-or-create-profile"
import { NextResponse } from "next/server"

// Callback de OAuth o Magic Link — intercambia el code por sesión y crea el perfil
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      await getOrCreateProfile(data.user)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
}
