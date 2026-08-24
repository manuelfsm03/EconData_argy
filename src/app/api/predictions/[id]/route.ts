/**
 * GET   /api/predictions/[id]  — devuelve una predicción por ID
 * PATCH /api/predictions/[id]  — actualiza estado / resolución de una predicción
 *
 * Fuentes de datos (en orden de búsqueda):
 *  1. runtimePredictions — predicciones creadas vía POST en esta sesión de proceso
 *  2. MOCK_PROFILES      — datos mock de la comunidad (solo lectura)
 *
 * TODO: Gonza → reemplazar con prisma.prediction.findUnique() / prisma.prediction.update()
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import type { EstadoPrediccion, Prediccion } from "@/lib/prediction-contract"
import { runtimePredictions } from "../_store"

export const dynamic = "force-dynamic"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Busca una predicción por ID en todas las fuentes disponibles. */
function findPrediccion(id: string): Prediccion | undefined {
  // 1. Runtime (creadas via POST)
  const runtime = runtimePredictions.find(p => p.id === id)
  if (runtime) return runtime

  // 2. Mock profiles
  for (const profile of MOCK_PROFILES) {
    const found = (profile.predicciones ?? []).find(p => p.id === id)
    if (found) return found
  }

  return undefined
}

/** Verifica si una predicción existe en los mock (son inmutables). */
function isFromMock(id: string): boolean {
  return MOCK_PROFILES.some(pr => (pr.predicciones ?? []).some(p => p.id === id))
}

const VALID_ESTADOS = new Set<EstadoPrediccion>(["abierta", "acertada", "errada", "anulada"])

// ── GET /api/predictions/[id] ─────────────────────────────────────────────────

/**
 * Devuelve una predicción específica por su ID.
 *
 * Response: { data: Prediccion }
 *
 * TODO: Gonza → reemplazar con prisma.prediction.findUnique({ where: { id: params.id } })
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
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

// ── PATCH /api/predictions/[id] ───────────────────────────────────────────────

/**
 * Actualiza el estado y/o la resolución de una predicción.
 *
 * Body (todos los campos son opcionales, pero al menos uno debe enviarse):
 *   {
 *     estado?: "abierta" | "acertada" | "errada" | "anulada"
 *     valorResolucion?: number | null
 *     fechaResuelta?: string | null   // ISO timestamp
 *   }
 *
 * Restricciones:
 *  - Solo se pueden modificar predicciones creadas vía POST (runtimePredictions).
 *  - Las predicciones mock son inmutables (devuelve 403).
 *
 * TODO: Gonza → reemplazar con prisma.prediction.update({ where: { id }, data: { estado, valorResolucion, fechaResuelta } })
 * TODO: Gonza → validar que el autenticado sea el autor o un admin antes de permitir el PATCH
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const idx = runtimePredictions.findIndex(p => p.id === params.id)

  if (idx === -1) {
    // Distinguir "no existe" de "existe pero es mock"
    const esMock = isFromMock(params.id)
    return NextResponse.json(
      {
        error: {
          code: esMock ? "READONLY" : "NOT_FOUND",
          message: esMock
            ? `La predicción "${params.id}" proviene de datos mock y no es mutable. Solo se pueden actualizar predicciones creadas vía POST.`
            : `Predicción "${params.id}" no encontrada`,
        },
      },
      { status: esMock ? 403 : 404 },
    )
  }

  let body: { estado?: EstadoPrediccion; valorResolucion?: number | null; fechaResuelta?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Body JSON inválido" },
      { status: 400 },
    )
  }

  const { estado, valorResolucion, fechaResuelta } = body

  // Validar estado si se envía
  if (estado !== undefined && !VALID_ESTADOS.has(estado)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_ESTADO", message: `Estado inválido: "${estado}". Valores aceptados: ${[...VALID_ESTADOS].join(", ")}` } },
      { status: 400 },
    )
  }

  // Verificar que al menos un campo viene
  if (estado === undefined && valorResolucion === undefined && fechaResuelta === undefined) {
    return NextResponse.json(
      { success: false, error: "El body debe incluir al menos uno de: estado, valorResolucion, fechaResuelta" },
      { status: 400 },
    )
  }

  // Aplicar cambios en memoria
  // TODO: Gonza → reemplazar con prisma.prediction.update()
  const actualizada: Prediccion = {
    ...runtimePredictions[idx],
    ...(estado !== undefined        && { estado }),
    ...(valorResolucion !== undefined && { valorResolucion }),
    ...(fechaResuelta !== undefined  && { fechaResuelta }),
  }
  runtimePredictions[idx] = actualizada

  return NextResponse.json(
    { success: true, data: actualizada },
    { headers: { "Cache-Control": "no-store" } },
  )
}
