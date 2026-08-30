/**
 * GET /api/profiles/[id] — devuelve un perfil por id cuando Users esté habilitado.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import { USERS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

// ── GET /api/profiles/[id] ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!USERS_ENABLED) return new NextResponse(null, { status: 404 })

  const profile = MOCK_PROFILES.find((candidate) => candidate.id === params.id)
  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }
  return NextResponse.json({ data: profile })
}
