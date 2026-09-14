import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Con carpeta src/, Next.js SOLO reconoce el middleware acá adentro — uno en
// la raíz del proyecto se ignora en silencio, sin error ni warning. Este
// archivo vivió en la raíz y nunca se ejecutó ni una vez: verificado en vivo
// (logs de diagnóstico agregados y quitados) que / devolvía 200 sin pedir
// sesión pese a que el código de abajo debería redirigir a /auth/login. No
// es una vulnerabilidad activa hoy —USERS_ENABLED en feature-flags.ts está en
// false y no hay nada gateado en el front— pero es plomería de auth muerta:
// si alguien prende USERS_ENABLED confiando en que este archivo protege las
// rutas, no protegía nada.

// Rutas que NO requieren sesión
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/callback", "/api/"]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Corregir la ubicación destapó un segundo problema: sin
  // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configuradas (hoy no lo están ni en
  // este .env.local ni, hasta que alguien lo confirme, en Vercel), el
  // middleware ahora SÍ se ejecuta pero createServerClient()/getUser()
  // explota y tira 500 en cada página del sitio público. La Pizarra es un
  // dashboard público: el comportamiento de hoy (deja pasar a todos) tiene
  // que seguir siendo el default cuando Supabase no está configurado. Si
  // falla, se loguea y se deja pasar — fallar "cerrado" acá significaría
  // que un dashboard público entero devuelve 500 por una variable de
  // entorno que falta, mucho peor que no tener el gate de auth.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[middleware] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no configuradas: el gate de auth queda desactivado, se deja pasar todo.")
      return supabaseResponse
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

    // Si no hay sesión y la ruta no es pública → redirigir a login
    if (!user && !isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error("[middleware] Falló la verificación de sesión, se deja pasar la request:", error instanceof Error ? error.message : error)
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto assets estáticos e internals de Next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
