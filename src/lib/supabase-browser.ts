/**
 * Cliente de Supabase para componentes de cliente ("use client"). Solo usa
 * la anon key (pública, segura de exponer al browser) -- nunca la
 * service_role key, que es server-only (ver @/server/auth/supabase-server).
 */
"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
