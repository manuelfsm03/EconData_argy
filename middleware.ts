/**
 * Refresca la sesión de Supabase en cada request. Server Components no
 * pueden escribir cookies (ver supabase-server.ts) -- sin este middleware,
 * un access token vencido nunca se renovaría y la sesión se cortaría sola
 * cada ~1h. Patrón oficial de @supabase/ssr para Next.js App Router.
 */
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // Dispara la renovación del token si hace falta. No se usa el valor acá
  // -- cada route/Server Component que necesite el usuario lo lee con
  // getCurrentUser() (supabase-server.ts).
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Todas las rutas menos assets estáticos, imágenes y el service worker.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
