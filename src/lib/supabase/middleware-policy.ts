// Decisión PURA del middleware de auth (sin Next ni Supabase) para poder testearla.
// Regla de oro: La Pizarra es un dashboard público. Salvo que auth esté
// habilitada Y configurada, el middleware es un pass-through total.

// Rutas que NO requieren sesión (se mantienen del middleware original)
export const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/callback",
  "/api/",
  "/data/",
  "/glosario",
  "/privacidad",
  "/terminos",
  "/tv",
]

// Rutas que SÍ exigen sesión cuando auth está habilitada. El resto del sitio
// es público. Agregar acá las páginas que requieran login.
export const PROTECTED_PATHS = ["/perfil", "/cuenta"]

/** Lee las env vars de Supabase (publishable key con fallback a la anon key legacy). */
export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): {
  url?: string
  key?: string
} {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    key:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      undefined,
  }
}

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) =>
    p.endsWith("/")
      ? pathname.startsWith(p)
      : pathname === p || pathname.startsWith(p + "/")
  )
}

export function isPublicPath(pathname: string): boolean {
  return matches(pathname, PUBLIC_PATHS)
}

export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname) && matches(pathname, PROTECTED_PATHS)
}

/**
 * Paso 1: ¿el middleware debe tocar Supabase para esta request?
 * - "pass": devolver NextResponse.next() sin llamar a Supabase.
 * - "check-session": refrescar sesión (y eventualmente redirigir).
 */
export function decideAuthAction(input: {
  pathname: string
  usersEnabled: boolean
  supabaseUrl?: string
  supabaseKey?: string
}): "pass" | "check-session" {
  if (!input.usersEnabled) return "pass"
  if (!input.supabaseUrl || !input.supabaseKey) return "pass"
  if (isPublicPath(input.pathname)) return "pass"
  return "check-session"
}

/** Paso 2 (con sesión consultada): ¿redirigir a /auth/login? */
export function shouldRedirectToLogin(pathname: string, hasUser: boolean): boolean {
  return !hasUser && isProtectedPath(pathname)
}
