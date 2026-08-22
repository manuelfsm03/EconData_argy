import { fechaUTC, proximoDiaHabil } from "./market-calendar"

const MS_POR_DIA = 86_400_000

export interface MetricasCap {
  /** Días entre la próxima liquidación hábil (T+1) y el vencimiento. */
  diasVencimiento: number
  /** Tasa efectiva mensual (%), directamente lo que licita el Tesoro. */
  tem: number | null
  /** Tasa nominal anual (%), lineal. */
  tna: number | null
  /** Tasa efectiva anual (%), compuesta. */
  tea: number | null
  /** Macaulay duration en años -- para un instrumento bullet (1 solo flujo), es simplemente el plazo. */
  duration: number | null
  /** Modified duration en años. */
  durationMod: number | null
  /** Precio (dirty) / pago al vencimiento * 100. */
  paridad: number | null
}

/**
 * TEM/TNA/TEA/Duration/Paridad para una LECAP o BONCAP -- instrumento
 * "bullet": un solo flujo (pxFinish) en la fecha de vencimiento, sin cupones
 * intermedios. Metodología pedida explícitamente por Pista (equipo),
 * 2026-08-22:
 *
 * - Los días a vencimiento se cuentan desde la PRÓXIMA liquidación hábil
 *   (T+1 = WORKDAY(hoy, 1, feriados)), no desde hoy -- el precio de mercado
 *   de hoy es lo que se paga para liquidar mañana (o el próximo hábil).
 * - TEM = (pxFinish/pxDirty)^(30/diasVencimiento) - 1
 * - TNA = (pxFinish/pxDirty - 1) * 360/diasVencimiento
 * - TEA = (pxFinish/pxDirty)^(360/diasVencimiento) - 1
 *
 * Nota sobre TEA: la fórmula tal cual se dictó fue
 * "(px_finish/px_dirty-1)^(360/dias_vto)-1", con la resta DENTRO de la base.
 * Eso da un número sin sentido (ej. con TNA≈23%, TEA calculada así da ≈-100%
 * porque eleva un número chico a una potencia grande). La fórmula que sí da
 * un resultado financiero razonable -- y que es la definición estándar de
 * TEA a partir de una TNA/TEM -- es la de arriba, mismo patrón que TEM pero
 * con 360 en vez de 30. Se implementó así y se avisó a Pista para que
 * confirme; si la intención era otra, es un cambio de una línea.
 */
export function calcularMetricasCap(pxDirty: number | null, pxFinish: number | null, vencimientoISO: string, hoy: Date): MetricasCap {
  // Normalizado a medianoche UTC -- "hoy" trae hora, y arrastrarla corrompe
  // el conteo de días (Excel/DIAS.LAB trabaja solo con fechas, sin hora).
  const hoyFecha = fechaUTC(hoy.toISOString().slice(0, 10))
  const liquidacion = proximoDiaHabil(hoyFecha)
  const diasVencimiento = Math.round((fechaUTC(vencimientoISO).getTime() - liquidacion.getTime()) / MS_POR_DIA)

  if (pxDirty == null || pxFinish == null || diasVencimiento <= 0) {
    return { diasVencimiento, tem: null, tna: null, tea: null, duration: null, durationMod: null, paridad: null }
  }

  const ratio = pxFinish / pxDirty
  const tem = (Math.pow(ratio, 30 / diasVencimiento) - 1) * 100
  const tna = ((ratio - 1) * 360) / diasVencimiento * 100
  const tea = (Math.pow(ratio, 360 / diasVencimiento) - 1) * 100
  const paridad = (pxDirty / pxFinish) * 100

  // Bullet (un solo flujo): la Macaulay duration coincide con el plazo.
  const duration = diasVencimiento / 365
  const durationMod = duration / (1 + tea / 100)

  return {
    diasVencimiento,
    tem: Number(tem.toFixed(4)),
    tna: Number(tna.toFixed(4)),
    tea: Number(tea.toFixed(4)),
    duration: Number(duration.toFixed(4)),
    durationMod: Number(durationMod.toFixed(4)),
    paridad: Number(paridad.toFixed(2)),
  }
}
