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
import { runtimePredictions } from "./_store"

export const dynamic = "force-dynamic"

const VALID_ESTADOS = new Set<EstadoPrediccion | "todas">([
  "abierta", "acertada", "errada", "anulada", "todas",
])

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const autorId = searchParams.get("autorId") ?? null
  const estadoParam = searchParams.get("estado") ?? "todas"
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 100

  // Validar el estado recibido
  const estado: EstadoPrediccion | "todas" = VALID_ESTADOS.has(estadoParam as EstadoPrediccion | "todas")
    ? (estadoParam as EstadoPrediccion | "todas")
    : "todas"

  // Combinar: predicciones de la comunidad (mock) + predicciones creadas en runtime
  let predicciones: Prediccion[] = [
    ...MOCK_PROFILES.flatMap(p => p.predicciones ?? []),
    ...runtimePredictions,
  ]

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

// ── POST /api/predictions ─────────────────────────────────────────────────────

/**
 * Crea una nueva predicción y la agrega al store en memoria.
 *
 * Body esperado:
 *   { activo, tipoActivo, tesis, metrica, operador, objetivo?, objetivoMax?,
 *     valorEntrada, horizonte, fechaResolucion }
 *
 * TODO: Gonza → reemplazar con prisma.prediction.create()
 * TODO: Gonza → tomar autorId del JWT/sesión del usuario autenticado (no hardcoded)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Body JSON inválido" },
      { status: 400 },
    )
  }

  const {
    activo,
    tipoActivo,
    tesis,
    metrica,
    operador,
    objetivo = null,
    objetivoMax = null,
    valorEntrada,
    horizonte,
    fechaResolucion,
  } = body

  // Validación de campos requeridos
  if (
    !activo || !tipoActivo || !tesis || !metrica || !operador ||
    valorEntrada == null || !horizonte || !fechaResolucion
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Faltan campos requeridos: activo, tipoActivo, tesis, metrica, operador, valorEntrada, horizonte, fechaResolucion",
      },
      { status: 400 },
    )
  }

  const nuevaPrediccion: Prediccion = {
    // ID generado en memoria; Prisma usará su propio autoincrement/uuid
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    autorId: "u_anon", // TODO: Gonza → reemplazar con el id del usuario autenticado (JWT/session)
    activo:          String(activo),
    tipoActivo:      tipoActivo as Prediccion["tipoActivo"],
    tesis:           String(tesis),
    metrica:         metrica as Prediccion["metrica"],
    operador:        operador as Prediccion["operador"],
    objetivo:        objetivo != null ? Number(objetivo) : null,
    objetivoMax:     objetivoMax != null ? Number(objetivoMax) : null,
    // Foto de entrada inmutable: el sistema fija el timestamp, no el cliente
    valorEntrada:    Number(valorEntrada),
    fechaEntrada:    new Date().toISOString(),
    horizonte:       String(horizonte),
    fechaResolucion: String(fechaResolucion),
    // Estado inicial siempre "abierta"; la resolución la corre el cron
    estado:          "abierta",
    valorResolucion: null,
    fechaResuelta:   null,
    fuente:          null,
  }

  // TODO: Gonza → reemplazar con prisma.prediction.create()
  runtimePredictions.push(nuevaPrediccion)

  return NextResponse.json(
    { success: true, data: nuevaPrediccion },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  )
}
