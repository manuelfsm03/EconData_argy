/**
 * Matemática de letras y bonos capitalizables en pesos (LECAP / BONCAP).
 *
 * Son cero cupón: pagan un único flujo al vencimiento, el PAGO FINAL, que ya
 * trae capitalizada la tasa de emisión. Todo el rendimiento sale de comparar
 * ese pago contra el precio de hoy, sin ningún supuesto de mercado.
 *
 * Convenciones (las de la curva de pesos del equipo):
 *   - Días: Act/365, contados desde la LIQUIDACIÓN (T+1 hábil), no desde hoy.
 *     El precio de 24 hs liquida mañana; contar desde hoy le regala un día de
 *     rendimiento, y en una letra a 8 días eso mueve la TEM unos 20 bp.
 *   - TEM = (VF/P)^(30/d) − 1. Mes de 30 días, no mes calendario.
 *   - TNA = TEM × 12. Convención local de letras, NO (1+TEA)^(1/12) × 12.
 *   - TEA = (VF/P)^(365/d) − 1. En un cero cupón es también la TIR.
 *   - Duration (Macaulay) = d/365 años: con un solo flujo, es el plazo.
 *   - Duration modificada = D / (1 + TEA).
 *   - Capitalización de emisión: 30/360 US, que es como el Tesoro calcula el
 *     pago final. Ver yearFrac30360.
 *
 * Unidades: montos por cada 100 de valor nominal; TODAS las tasas en
 * porcentaje (2.53 = 2,53%), igual que las expone la API.
 */

import { yearFrac30360 } from "./daycount"
import { siguienteDiaHabil } from "./market-calendar"

const MS_POR_DIA = 86_400_000

/** Condiciones de emisión de un capitalizable. Fechas en ISO (YYYY-MM-DD). */
export interface TerminosCap {
  emision: string
  vencimiento: string
  /** Tasa efectiva mensual de emisión, en porcentaje. */
  temEmision: number
  /** Pago al vencimiento por cada 100 VN. */
  pagoFinal: number
}

export interface MetricasCap {
  /** Días Act entre la liquidación y el vencimiento. */
  dias: number
  tem: number
  tna: number
  tea: number
  /** Duration de Macaulay, en años. */
  durationMac: number
  /** Duration modificada, en años. */
  durationMod: number
  /** Valor técnico a la fecha de liquidación, por cada 100 VN. */
  valorTecnico: number
  /** Precio sobre valor técnico, en porcentaje. */
  paridad: number
}

function fechaUTC(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
}

/** Meses de capitalización entre dos fechas: YEARFRAC 30/360 US × 12. */
export function mesesCapitalizacion(desde: Date, hasta: Date): number {
  return yearFrac30360(desde, hasta) * 12
}

/** Pago final = 100 · (1 + TEM_emisión)^meses(emisión → vencimiento). */
export function pagoFinalDesdeEmision(temEmision: number, emision: string, vencimiento: string): number {
  return 100 * Math.pow(1 + temEmision / 100, mesesCapitalizacion(fechaUTC(emision), fechaUTC(vencimiento)))
}

/**
 * Valor técnico a una fecha = 100 · (1 + TEM_emisión)^meses(emisión → fecha).
 * Es lo que vale el instrumento capitalizado a su propia tasa de emisión. Tiene
 * tope en el pago final: pasado el vencimiento no capitaliza más.
 */
export function valorTecnico(t: TerminosCap, fecha: Date): number {
  const vt = 100 * Math.pow(1 + t.temEmision / 100, mesesCapitalizacion(fechaUTC(t.emision), fecha))
  return Math.min(vt, t.pagoFinal)
}

/**
 * Liquidación de una operación de hoy en 24 hs: el día hábil siguiente, con
 * "hoy" en hora de Buenos Aires (UTC−3) para que un server en UTC no cambie de
 * día a las 21 hs.
 *
 * OJO: el calendario de feriados de 2026 en adelante sólo trae los que pisan
 * pagos de bonos (ver market-calendar.ts). La víspera de un feriado que falte,
 * la liquidación sale un día antes de la real.
 */
export function liquidacion24hs(now: Date = new Date()): Date {
  const hoy = fechaUTC(new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString())
  return siguienteDiaHabil(new Date(hoy.getTime() + MS_POR_DIA))
}

/** Días Act entre dos fechas UTC. */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA)
}

/**
 * Todas las métricas de un capitalizable a un precio dado.
 *
 * Devuelve null si no hay cuenta posible: precio no positivo, pago final
 * faltante o instrumento que ya venció a la fecha de liquidación. Nunca
 * devuelve un número inventado.
 */
export function metricasCap(precio: number | null | undefined, t: TerminosCap, liquidacion: Date): MetricasCap | null {
  if (precio == null || !Number.isFinite(precio) || precio <= 0) return null
  if (!Number.isFinite(t.pagoFinal) || t.pagoFinal <= 0) return null

  const dias = diasEntre(liquidacion, fechaUTC(t.vencimiento))
  if (dias <= 0) return null

  const relacion = t.pagoFinal / precio
  const tem = (Math.pow(relacion, 30 / dias) - 1) * 100
  const tea = (Math.pow(relacion, 365 / dias) - 1) * 100
  const durationMac = dias / 365
  const vt = valorTecnico(t, liquidacion)

  return {
    dias,
    tem,
    tna: tem * 12,
    tea,
    durationMac,
    durationMod: durationMac / (1 + tea / 100),
    valorTecnico: vt,
    paridad: (precio / vt) * 100,
  }
}
