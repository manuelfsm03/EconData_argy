/**
 * POST /api/predictions/resolve — Resuelve las predicciones runtime vencidas.
 *
 * Recorre el store en memoria, y para cada predicción ABIERTA y ya vencida
 * consulta su valor observado (fuentes de La Pizarra) y aplica la regla del
 * contrato. Pensado para el cron (Vercel) o disparo admin.
 *
 * Auth: Bearer INGEST_SECRET/CRON_SECRET (mismo patrón que el resto de rutas de
 * escritura). Solo toca runtimePredictions; las mock de la comunidad no se tocan.
 *
 * NOTA: el store es en memoria → la resolución persiste solo dentro de la
 * instancia viva. La durabilidad real llega con la migración a Postgres (Gonza).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuthorization } from "@/server/api/admin-auth"
import { runtimePredictions, setRuntimePredictions } from "../_store"
import { resolveOpenPredictions } from "@/server/domain/prediction-resolver"
import { createValorFetcher } from "@/server/external/prediction-values"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized

  const resumen = await ejecutarResolucion(new URL(request.url).origin)
  return NextResponse.json(resumen)
}

// Lógica reutilizable (la usa también el cron). Devuelve un resumen plano.
export async function ejecutarResolucion(origin: string) {
  const abiertasVencidas = runtimePredictions.filter(
    (p) => p.estado === "abierta" && Date.now() >= new Date(p.fechaResolucion).getTime(),
  ).length

  const fetchValor = await createValorFetcher(origin)
  const { predicciones, resueltas } = await resolveOpenPredictions(runtimePredictions, fetchValor)
  setRuntimePredictions(predicciones)

  return {
    ok: true,
    abiertas_vencidas: abiertasVencidas,
    resueltas,
    total_runtime: predicciones.length,
    updated_at: new Date().toISOString(),
  }
}
