/**
 * Frescura de cada gráfico: "fuente + fecha del último dato + qué tan atrasado está".
 *
 * Es el diferencial del informe frente a 1816 ("Elaboración propia", sin rastro).
 * El umbral sale del propio registro de fuentes (freshness.warnAfterSeconds de
 * cada fuente), no de una constante del informe.
 *
 * Para fuentes de frecuencia diaria (umbral menor a 7 días) la edad se cuenta en
 * días hábiles, así un viernes visto un lunes no figura como atrasado. Como las
 * fechas no traen hora, el umbral mínimo es 1 día hábil (las fuentes intradía del
 * registro tienen ventanas de minutos que acá no se pueden evaluar).
 */

import { SOURCE_REGISTRY } from "@/server/sources/registry"

export type EstadoFrescura = "al_dia" | "atrasado" | "sin_fecha"

export interface Frescura {
  estado: EstadoFrescura
  /** Edad del último dato respecto de la fecha de corte, en días (hábiles si la fuente es diaria). */
  edadDias: number | null
  habiles: boolean
}

const DIA = 86_400
const ISO = /^\d{4}-\d{2}(-\d{2})?/

/** AAAA-MM-DD -> ese día; AAAA-MM -> último día de ese mes (un dato mensual se conoce recién al cerrar el mes). */
function aUTC(iso: string): Date {
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [a, m] = iso.split("-").map(Number)
    return new Date(Date.UTC(a, m, 0))
  }
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

/** Días hábiles (lun-vie) transcurridos después de `desde` hasta `hasta` inclusive. */
export function diasHabilesEntre(desde: string, hasta: string): number {
  const d = aUTC(desde)
  const h = aUTC(hasta)
  let n = 0
  while (d < h) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) n += 1
  }
  return n
}

export function calcularFrescura(ultimaFecha: string | null, fuenteId: string | undefined, fechaCorte: string): Frescura {
  if (!ultimaFecha || !ISO.test(ultimaFecha)) return { estado: "sin_fecha", edadDias: null, habiles: false }
  const def = fuenteId ? (SOURCE_REGISTRY as Record<string, { freshness: { warnAfterSeconds: number | null } }>)[fuenteId] : undefined
  // Las fechas llegan sin hora: una ventana menor a un día (fuentes intradía) no se puede
  // evaluar con esta granularidad, así que se usa como piso 1 día hábil (el cierre anterior).
  const warnRegistro = def?.freshness.warnAfterSeconds ?? null
  const warn = warnRegistro === null ? null : Math.max(warnRegistro, DIA)
  const habiles = warn !== null && warn < 7 * DIA
  const calendario = Math.max(0, Math.round((aUTC(fechaCorte).getTime() - aUTC(ultimaFecha).getTime()) / (DIA * 1000)))
  const edadDias = habiles ? diasHabilesEntre(ultimaFecha, fechaCorte) : calendario
  if (warn === null) return { estado: "al_dia", edadDias, habiles }
  return { estado: edadDias * DIA > warn ? "atrasado" : "al_dia", edadDias, habiles }
}
