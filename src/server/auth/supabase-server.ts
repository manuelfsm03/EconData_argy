/**
 * Cliente de Supabase para Server Components y Route Handlers. Lee/escribe
 * cookies de sesión vía next/headers -- por eso es server-only (no
 * "use client"). Usa la anon key igual que el browser; la validación real
 * de sesión la hace Supabase con el JWT de la cookie.
 */
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function createSupabaseServerClient() {
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
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // setAll llamado desde un Server Component (no un Route Handler
            // ni Server Action) -- no puede escribir cookies. El middleware
            // ya se encarga de refrescar la sesión, así que es seguro ignorar.
          }
        },
      },
    },
  )
}

/**
 * Usuario autenticado en el request actual, o null. Wrapper chico para no
 * repetir el try/catch en cada route que necesite saber "quién está
 * logueado" -- ver server/auth/require-user.ts para la versión que además
 * corta con 401 si no hay sesión.
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}
