/**
 * prediction-resolver.ts — Resuelve predicciones vencidas contra un valor observado.
 *
 * Separa la LÓGICA (pura, testeable) de la FUENTE de datos: recibe un `fetchValor`
 * inyectado que trae el valor actual de la métrica de cada predicción. Así el
 * resolver no depende de red y se puede testear con un fetcher mock.
 *
 * La regla de acierto/error la aplica `resolverPrediccion` del contrato (única
 * fuente de verdad); acá solo orquestamos qué predicciones tocar.
 */

import { resolverPrediccion, type Prediccion } from "@/lib/prediction-contract"

export type ValorObservado = { valor: number; fuente: string }
export type ValorFetcher = (p: Prediccion) => Promise<ValorObservado | null>

/**
 * Recorre las predicciones y resuelve las que estén ABIERTAS y ya VENCIDAS,
 * consultando su valor observado. Las que no vencieron, ya están resueltas, o
 * para las que no se consiguió valor, quedan intactas (siguen abiertas).
 */
export async function resolveOpenPredictions(
  preds: Prediccion[],
  fetchValor: ValorFetcher,
  ahora: string = new Date().toISOString(),
): Promise<{ predicciones: Prediccion[]; resueltas: number }> {
  const ahoraMs = new Date(ahora).getTime()
  let resueltas = 0
  const out: Prediccion[] = []

  for (const p of preds) {
    const vencida = ahoraMs >= new Date(p.fechaResolucion).getTime()
    if (p.estado !== "abierta" || !vencida) {
      out.push(p)
      continue
    }
    const obs = await fetchValor(p)
    if (!obs) {
      out.push(p)  // sin valor confiable → la dejamos abierta, se reintenta luego
      continue
    }
    const resuelta = resolverPrediccion(p, obs.valor, obs.fuente, ahora)
    if (resuelta.estado !== "abierta") resueltas++
    out.push(resuelta)
  }

  return { predicciones: out, resueltas }
}
