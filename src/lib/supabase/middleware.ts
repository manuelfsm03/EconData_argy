import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { USERS_ENABLED } from "@/lib/feature-flags"
import {
  decideAuthAction,
  readSupabaseEnv,
  shouldRedirectToLogin,
} from "./middleware-policy"

/**
 * Refresca la sesión de Supabase y redirige a /auth/login solo las rutas
 * protegidas. Es pass-through total (sin llamar a Supabase) si USERS_ENABLED
 * es false o faltan las env vars. Falla abierto: ante cualquier error deja
 * pasar la request (el sitio público no puede devolver 500 por auth).
 * Patrón oficial de Supabase Next.js SSR.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { url, key } = readSupabaseEnv()
  const action = decideAuthAction({
    pathname: request.nextUrl.pathname,
    usersEnabled: USERS_ENABLED,
    supabaseUrl: url,
    supabaseKey: key,
  })
  if (action === "pass") return supabaseResponse

  try {
    const supabase = createServerClient(url!, key!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Refrescar sesión (importante para mantener el token activo)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (shouldRedirectToLogin(request.nextUrl.pathname, !!user)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/auth/login"
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  } catch (error) {
    console.error(
      "[middleware] Falló la verificación de sesión, se deja pasar la request:",
      error instanceof Error ? error.message : error
    )
    return NextResponse.next({ request })
  }
}
