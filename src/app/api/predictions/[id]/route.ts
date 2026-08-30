/**
 * GET /api/predictions/[id] — devuelve una predicción por ID cuando Users esté habilitado.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import type { Prediccion } from "@/lib/prediction-contract"
import { USERS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Busca una predicción por ID en todas las fuentes disponibles. */
function findPrediccion(id: string): Prediccion | undefined {
  for (const profile of MOCK_PROFILES) {
    const found = (profile.predicciones ?? []).find(p => p.id === id)
    if (found) return found
  }

  return undefined
}

// ── GET /api/predictions/[id] ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!USERS_ENABLED) return new NextResponse(null, { status: 404 })

  const prediccion = findPrediccion(params.id)

  if (!prediccion) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Predicción "${params.id}" no encontrada` } },
      { status: 404 },
    )
  }

  return NextResponse.json(
    { data: prediccion },
    { headers: { "Cache-Control": "no-store" } },
  )
}
