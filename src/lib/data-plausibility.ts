/**
 * Capa de veracidad: ¿este número tiene sentido?, más allá de si el
 * transporte respondió 200 o si el timestamp es reciente. `/api/status`
 * (ver runtime-data-health.ts) ya cubre transporte y frescura; esto es lo
 * que faltaba — rangos de plausibilidad por métrica y chequeos de acuerdo
 * entre dos fuentes que deberían decir más o menos lo mismo.
 *
 * No es "correcto hasta el último decimal": es "no es un -999 o un typo de
 * tres órdenes de magnitud". Deliberadamente fuera de alcance: todo lo de
 * renta fija/bonos (TIR, paridad, CER) — eso vive en otra área del equipo.
 */

export type PlausibilityRule = {
  metric: string
  label: string
  unit: string
  min: number
  max: number
  /** Por qué este rango, no otro — para que no sea un número mágico. */
  reason: string
}

export const PLAUSIBILITY_RULES: Record<string, PlausibilityRule> = {
  ipc_var_mensual: {
    metric: "ipc_var_mensual",
    label: "IPC — variación mensual",
    unit: "%",
    min: -5,
    max: 60,
    reason: "Ni en los peores meses de la serie 1943– el IPC mensual perforó ese piso ni superó ese techo; fuera de rango es dato roto, no una cifra real.",
  },
  emae: {
    metric: "emae",
    label: "EMAE (índice, base 2004=100)",
    unit: "índice",
    min: 50,
    max: 400,
    reason: "Índice continuo desde 2004; nunca cayó debajo de 50 ni superó 400 en toda la serie histórica.",
  },
  riesgo_pais_bps: {
    metric: "riesgo_pais_bps",
    label: "Riesgo país (EMBI+)",
    unit: "puntos básicos",
    min: 0,
    max: 20_000,
    reason: "Puntos básicos nunca es negativo; el máximo histórico argentino rondó 7.000–8.000 — 20.000 ya es un techo generoso para sólo descartar un corte de manguera.",
  },
  desocupacion_pct: {
    metric: "desocupacion_pct",
    label: "Tasa de desocupación (EPH)",
    unit: "% de la PEA",
    min: 0,
    max: 40,
    reason: "Porcentaje de la PEA; la serie EPH moderna nunca superó el 25%, 40% ya es un techo amplio.",
  },
  dolar_ars: {
    metric: "dolar_ars",
    label: "Dólar (cualquier cotización)",
    unit: "ARS",
    min: 1,
    max: 100_000_000,
    reason: "Sólo descarta negativos, cero o errores de unidades (ej. centavos en vez de pesos) — el nivel nominal se mueve con la inflación, no hay techo fijo razonable.",
  },
}

export type PlausibilityStatus = "plausible" | "implausible" | "unknown"

export type PlausibilityResult = {
  metric: string
  status: PlausibilityStatus
  value: number | null
  reason: string
}

export function assessPlausibility(metric: string, value: number | null | undefined): PlausibilityResult {
  const rule = PLAUSIBILITY_RULES[metric]
  if (!rule) {
    return { metric, status: "unknown", value: value ?? null, reason: "No hay regla de plausibilidad cargada para esta métrica todavía." }
  }
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { metric, status: "unknown", value: null, reason: "Sin valor numérico para evaluar." }
  }
  if (value < rule.min || value > rule.max) {
    return {
      metric,
      status: "implausible",
      value,
      reason: `${value} está fuera del rango plausible [${rule.min}, ${rule.max}] ${rule.unit}. ${rule.reason}`,
    }
  }
  return { metric, status: "plausible", value, reason: `Dentro del rango esperado [${rule.min}, ${rule.max}] ${rule.unit}.` }
}

export type AgreementStatus = "agree" | "disagree" | "unknown"

export type AgreementResult = {
  status: AgreementStatus
  deltaPct: number | null
  reason: string
}

/**
 * ¿Dos fuentes/campos que deberían moverse juntos siguen de acuerdo? No
 * exige igualdad — exige que no se hayan desacoplado del todo (ej. un
 * typo de unidades en una de las dos).
 */
export function assessAgreement(args: {
  valueA: number | null | undefined
  valueB: number | null | undefined
  maxDeltaPct: number
  reason: string
}): AgreementResult {
  const { valueA, valueB, maxDeltaPct, reason } = args
  if (
    valueA == null || valueB == null ||
    !Number.isFinite(valueA) || !Number.isFinite(valueB) ||
    valueA === 0
  ) {
    return { status: "unknown", deltaPct: null, reason: "Falta uno de los dos valores para comparar." }
  }
  const deltaPct = Math.abs((valueB - valueA) / valueA) * 100
  if (deltaPct > maxDeltaPct) {
    return {
      status: "disagree",
      deltaPct,
      reason: `Difieren ${deltaPct.toFixed(1)}%, más del ${maxDeltaPct}% esperado: ${reason}`,
    }
  }
  return { status: "agree", deltaPct, reason: `Difieren ${deltaPct.toFixed(1)}%, dentro de lo esperado.` }
}
