/**
 * Store en memoria de predicciones creadas vía POST durante el ciclo de vida
 * del proceso Node.js (solo para desarrollo).
 *
 * TODO: Gonza → reemplazar todo este módulo con llamadas a Prisma.
 *
 * IMPORTANTE: en producción serverless (Vercel) cada función es stateless y
 * este array se resetea en cada invocación fría. Solo es útil en desarrollo
 * local o cuando la misma instancia atiende varias requests consecutivas.
 *
 * Las predicciones de la comunidad (MOCK_PROFILES) viven aparte; este store
 * solo persiste las creadas dinámicamente via POST /api/predictions.
 */

import type { Prediccion } from "@/lib/prediction-contract"

export const runtimePredictions: Prediccion[] = []

/** Reescribe el store en el lugar (para la resolución automática). */
export function setRuntimePredictions(next: Prediccion[]): void {
  runtimePredictions.splice(0, runtimePredictions.length, ...next)
}
