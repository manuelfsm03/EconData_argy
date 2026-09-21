import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Rutas que NO requieren sesión
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/callback", "/api/"]

/**
 * Refresca la sesión de Supabase en el edge (middleware) y devuelve el
 * NextResponse con las cookies actualizadas. Si el usuario no está autenticado
 * y la ruta no es pública, redirige a /auth/login.
 *
 * Sigue el patrón oficial de Supabase Next.js SSR.
 * TODO: eliminar fallback cuando todos los entornos migren.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
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
    }
  )

  // Refrescar sesión (importante para mantener el token activo)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Si no hay sesión y la ruta no es pública → redirigir a login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
