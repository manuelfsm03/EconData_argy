/**
 * Convenciones de conteo de días.
 *
 * Un bono no mide el tiempo como un calendario común: según la convención, un
 * mes puede valer 30 días fijos o los que realmente tenga. Elegir mal cambia
 * los intereses corridos y la TIR, así que cada función dice explícitamente
 * cuál implementa y a qué función de Excel equivale.
 *
 * Todas las fechas se leen en UTC a propósito: si se usara la hora local, un
 * bono cargado como 2030-07-09 se convertiría en 2030-07-08 al oeste de
 * Greenwich y correría un día todos los flujos.
 */

const MS_POR_DIA = 86_400_000

function esUltimoDiaDeFebrero(fecha: Date): boolean {
  if (fecha.getUTCMonth() !== 1) return false
  const siguiente = new Date(fecha.getTime() + MS_POR_DIA)
  return siguiente.getUTCMonth() !== 1
}

/**
 * 30/360 US (NASD). Equivale a YEARFRAC(desde, hasta, 0) de Excel.
 * Cada mes cuenta 30 días y cada año 360, con ajustes en los días 31 y en
 * febrero.
 */
export function yearFrac30360(desde: Date, hasta: Date): number {
  let d1 = desde.getUTCDate()
  let d2 = hasta.getUTCDate()
  const m1 = desde.getUTCMonth() + 1
  const m2 = hasta.getUTCMonth() + 1
  const y1 = desde.getUTCFullYear()
  const y2 = hasta.getUTCFullYear()

  // El orden de estos ajustes importa: es el que define la convención NASD.
  if (esUltimoDiaDeFebrero(desde) && esUltimoDiaDeFebrero(hasta)) d2 = 30
  if (esUltimoDiaDeFebrero(desde)) d1 = 30
  if (d2 === 31 && d1 >= 30) d2 = 30
  if (d1 === 31) d1 = 30

  return ((y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)) / 360
}

/**
 * Act/365. Equivale a YEARFRAC(desde, hasta, 3) de Excel y es la convención
 * que usa XIRR para descontar.
 */
export function yearFracAct365(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / MS_POR_DIA / 365
}
