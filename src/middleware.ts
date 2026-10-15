import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Con carpeta src/, Next.js SOLO ejecuta este archivo. Un middleware.ts en la
// raíz del proyecto se ignora en silencio.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Excluye: /api (CLI, MCP, workflows), /_next, /data, /demos, /instituciones,
    // /favicon, /icon y cualquier archivo estático con extensión.
    "/((?!api/|_next/|data/|demos/|instituciones/|favicon\\.ico|icon\\.png|.*\\.[a-zA-Z0-9]+$).*)",
  ],
}
