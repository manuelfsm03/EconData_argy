/**
 * GET /api/predictions
 *
 * Sirve las predicciones de todos los usuarios de la comunidad.
 * Contrato que Gonza reemplazará con datos reales de la BD.
 *
 * Query params:
 *   ?autorId=u1               — filtrar predicciones de un solo usuario
 *   ?estado=abierta|acertada|errada|anulada|todas  — default: todas
 *   ?limit=50                 — máximo de resultados; default: 100
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MOCK_PROFILES } from "@/client/components/profiles/mock-profiles"
import type { EstadoPrediccion, Prediccion } from "@/lib/prediction-contract"
import { USERS_ENABLED } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

const VALID_ESTADOS = new Set<EstadoPrediccion | "todas">([
  "abierta", "acertada", "errada", "anulada", "todas",
])

export async function GET(req: NextRequest) {
  if (!USERS_ENABLED) return new NextResponse(null, { status: 404 })

  const { searchParams } = req.nextUrl

  const autorId = searchParams.get("autorId") ?? null
  const estadoParam = searchParams.get("estado") ?? "todas"
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 100

  // Validar el estado recibido
  const estado: EstadoPrediccion | "todas" = VALID_ESTADOS.has(estadoParam as EstadoPrediccion | "todas")
    ? (estadoParam as EstadoPrediccion | "todas")
    : "todas"

  // Datos mock de la comunidad; el reemplazo por persistencia real queda fuera del MVP.
  let predicciones: Prediccion[] = MOCK_PROFILES.flatMap(p => p.predicciones ?? [])

  // Filtrar por autorId si se pidió
  if (autorId) {
    predicciones = predicciones.filter(p => p.autorId === autorId)
  }

  // Filtrar por estado si no es "todas"
  if (estado !== "todas") {
    predicciones = predicciones.filter(p => p.estado === estado)
  }

  // Ordenar por fechaEntrada DESC (más reciente primero)
  predicciones.sort((a, b) =>
    new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime(),
  )

  // Aplicar límite
  const data = predicciones.slice(0, limit)

  return NextResponse.json(
    {
      data,
      total: data.length,
      updated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
