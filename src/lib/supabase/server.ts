import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Cliente para uso en Server Components, Route Handlers y Server Actions
// Maneja las cookies de sesión de Supabase Auth automáticamente
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En Server Components el set no aplica — el middleware lo maneja
          }
        },
      },
    }
  )
}
