/**
 * GET  /api/profiles/[id] — devuelve un perfil por id
 * PUT  /api/profiles/[id] — actualiza campos editables del perfil
 *
 * Mock layer: store en memoria inicializado desde MOCK_PROFILES.
 * Gonza reemplaza el store por prisma.user cuando el modelo esté migrado.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import type { UserProfile, PerfilRiesgo } from "@/client/components/profiles/mock-profiles"

// ── Campos que el usuario puede editar ─────────────────────────────────────────

type ProfilePatch = Partial<
  Pick<
    UserProfile,
    | "nombre"
    | "bio"
    | "linkedin"
    | "foto"
    | "topAcciones"
    | "intereses"
    | "interesesRentaFija"
    | "interesesRentaVariable"
    | "perfilRiesgo"
  >
>

const EDITABLE_KEYS: (keyof ProfilePatch)[] = [
  "nombre", "bio", "linkedin", "foto",
  "topAcciones", "intereses", "interesesRentaFija", "interesesRentaVariable",
  "perfilRiesgo",
]

// ── Mock in-memory store (se resetea con cada dev-server restart) ───────────────
// TODO (DB real): reemplazar por prisma.profile.findUnique / prisma.profile.update
// El `id` será el UUID de Supabase auth.users (no el "u1" del mock).
// Ver: src/server/auth/get-or-create-profile.ts para la lógica de creación lazy.

const store = new Map<string, UserProfile>(
  MOCK_PROFILES.map((p) => [p.id, { ...p }]),
)

export const dynamic = "force-dynamic"

// ── GET /api/profiles/[id] ─────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const profile = store.get(params.id)
  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }
  return NextResponse.json({ data: profile })
}

// ── PUT /api/profiles/[id] ─────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const existing = store.get(params.id)
  if (!existing) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  let body: ProfilePatch
  try {
    body = (await req.json()) as ProfilePatch
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Validaciones básicas
  if (body.bio !== undefined && body.bio.length > 280) {
    return NextResponse.json({ error: "Bio demasiado larga (máx 280 caracteres)" }, { status: 422 })
  }
  if (body.topAcciones !== undefined) {
    if (!Array.isArray(body.topAcciones) || body.topAcciones.length > 10) {
      return NextResponse.json({ error: "topAcciones inválido (máx 10)" }, { status: 422 })
    }
  }
  if (body.perfilRiesgo !== undefined) {
    const valid: PerfilRiesgo[] = ["conservador", "moderado", "agresivo"]
    if (!valid.includes(body.perfilRiesgo)) {
      return NextResponse.json({ error: "perfilRiesgo inválido" }, { status: 422 })
    }
  }

  // Aplicar solo campos permitidos
  const updated: UserProfile = { ...existing }
  for (const key of EDITABLE_KEYS) {
    if (key in body && body[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(updated as any)[key] = body[key]
    }
  }

  store.set(params.id, updated)

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } },
  )
}
