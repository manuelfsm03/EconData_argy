/**
 * Calendario de días hábiles del mercado argentino.
 *
 * Los soberanos hard dollar pagan los 9 de enero y 9 de julio. El 9 de julio es
 * feriado nacional todos los años, así que el pago efectivo cae siempre uno o
 * más días después de la fecha del prospecto. Ignorar ese corrimiento mueve
 * todos los flujos de julio y ensucia la TIR.
 *
 * También es la tabla que usan las LECAP/BONCAP (`peso-bonds.ts`) para
 * liquidación T+1: cualquier fecha puede ser liquidación, no solo las 5 fechas
 * de pago de los soberanos, así que acá SÍ hace falta un calendario completo.
 *
 * Fuentes por rango (pedido explícito: cobertura completa 2018-01-01 a
 * 2027-01-01, verificado 2026-08-22):
 * - 2021-2025: hoja "Feriados" de la calculadora de referencia del equipo
 *   (Copia de Calculadoras de bonos.xlsx) -- incluye feriados bancarios/
 *   puentes turísticos, no solo los feriados nacionales "de ley".
 * - 2018-2020: Nager.Date API (date.nager.at/api/v3/publicholidays/{year}/AR)
 *   -- cubre los feriados nacionales oficiales; puede faltarle algún puente
 *   turístico específico de banco que no esté en esa fuente genérica (menor
 *   confianza que 2021-2025).
 * - 2026: BCRA -- Comunicación "C" 101352 (30/12/2025), página oficial
 *   bcra.gob.ar/en/check-bank-holidays/, verificada leyendo el HTML crudo (no
 *   por resumen de IA). Ese año no incluye el 20/6 (Día de la Bandera) como
 *   feriado bancario -- se dejó tal cual figura en la fuente oficial, sin
 *   "corregirlo" a mano.
 * - 2027: solo 1/1 (fijo todos los años) -- el resto del año todavía no tiene
 *   decreto oficial publicado y el rango pedido solo llega hasta 1/1/2027.
 */

const FERIADOS_AR = [
  "2018-01-01", "2018-02-12", "2018-02-13", "2018-03-24", "2018-03-30",
  "2018-04-02", "2018-05-01", "2018-05-25", "2018-06-17", "2018-06-20",
  "2018-07-09", "2018-08-20", "2018-10-15", "2018-11-19", "2018-12-08",
  "2018-12-25",
  "2019-01-01", "2019-03-04", "2019-03-05", "2019-03-24", "2019-04-02",
  "2019-04-19", "2019-05-01", "2019-05-25", "2019-06-17", "2019-06-20",
  "2019-07-09", "2019-08-17", "2019-10-12", "2019-11-18", "2019-12-08",
  "2019-12-25",
  "2020-01-01", "2020-02-24", "2020-02-25", "2020-03-24", "2020-04-02",
  "2020-04-10", "2020-05-01", "2020-05-25", "2020-06-15", "2020-06-20",
  "2020-07-09", "2020-08-17", "2020-10-12", "2020-11-23", "2020-12-08",
  "2020-12-25",
  "2021-01-01", "2021-02-15", "2021-02-16", "2021-03-24", "2021-04-01",
  "2021-04-02", "2021-04-24", "2021-05-01", "2021-05-24", "2021-05-25",
  "2021-06-20", "2021-06-21", "2021-07-09", "2021-08-16", "2021-10-08",
  "2021-10-11", "2021-11-20", "2021-11-22", "2021-12-08", "2021-12-24",
  "2021-12-25", "2021-12-31",
  "2022-01-01", "2022-02-28", "2022-03-01", "2022-03-24", "2022-04-02",
  "2022-04-14", "2022-04-15", "2022-05-01", "2022-05-18", "2022-05-25",
  "2022-06-17", "2022-06-20", "2022-07-09", "2022-08-15", "2022-10-07",
  "2022-10-10", "2022-11-20", "2022-11-21", "2022-12-08", "2022-12-09",
  "2022-12-24", "2022-12-25", "2022-12-31",
  "2023-01-01", "2023-02-20", "2023-02-21", "2023-03-24", "2023-04-02",
  "2023-04-06", "2023-04-07", "2023-05-01", "2023-05-25", "2023-05-26",
  "2023-06-17", "2023-06-19", "2023-06-20", "2023-07-09", "2023-08-21",
  "2023-10-13", "2023-10-16", "2023-11-20", "2023-12-08", "2023-12-25",
  "2024-01-01", "2024-02-12", "2024-02-13", "2024-03-24", "2024-03-28",
  "2024-03-29", "2024-04-01", "2024-04-02", "2024-05-01", "2024-05-25",
  "2024-06-17", "2024-06-20", "2024-06-21", "2024-07-09", "2024-08-17",
  "2024-10-11", "2024-10-12", "2024-11-18", "2024-12-08", "2024-12-24",
  "2024-12-25", "2024-12-31",
  "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02",
  "2025-04-17", "2025-04-18", "2025-05-01", "2025-05-02", "2025-05-25",
  "2025-06-16", "2025-06-20", "2025-07-09", "2025-08-15", "2025-08-17",
  "2025-10-12", "2025-11-21", "2025-11-24", "2025-12-08", "2025-12-25",
  // 2026: BCRA, Comunicación "C" 101352 (calendario completo, no solo pagos de bonos).
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24",
  "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15",
  "2026-07-09", "2026-07-10", "2026-08-17", "2026-10-12", "2026-11-23",
  "2026-12-08", "2026-12-25",
  // 2027: solo 1/1 confirmado -- el resto del año no tiene decreto oficial
  // todavía y el rango pedido para este calendario termina en 1/1/2027.
  "2027-01-01",
  // De acá en adelante (2028+): sólo los feriados que pisan fechas de pago de
  // bonos soberanos de largo plazo -- fuera del alcance de este fix.
  "2028-01-01", "2028-04-02", "2028-05-01", "2028-06-25", "2028-07-09",
  "2029-01-01", "2029-04-02", "2029-05-01", "2029-06-25", "2029-07-09",
  "2030-01-01", "2030-04-02", "2030-05-01", "2030-06-25", "2030-07-09",
  "2031-01-01", "2031-04-02", "2031-05-01", "2031-06-25", "2031-07-09",
  "2032-01-01", "2032-04-02", "2032-05-01", "2032-06-25", "2032-07-09",
  "2033-01-01", "2033-04-02", "2033-05-01", "2033-06-25", "2033-07-09",
  "2034-01-01", "2034-04-02", "2034-05-01", "2034-06-25", "2034-07-09",
  "2035-01-01", "2035-04-02", "2035-05-01", "2035-06-25", "2035-07-09",
  "2036-01-01", "2036-04-02", "2036-05-01", "2036-06-25", "2036-07-09",
  "2037-01-01", "2037-04-02", "2037-05-01", "2037-06-25", "2037-07-09",
  "2038-01-01", "2038-04-02", "2038-05-01", "2038-06-25", "2038-07-09",
  "2039-01-01", "2039-04-02", "2039-05-01", "2039-06-25", "2039-07-09",
  "2040-01-01", "2040-04-02", "2040-05-01", "2040-06-25", "2040-07-09",
  "2041-01-01", "2041-04-02", "2041-05-01", "2041-06-25", "2041-07-09",
  "2042-01-01", "2042-04-02", "2042-05-01", "2042-06-25", "2042-07-09",
  "2043-01-01", "2043-04-02", "2043-05-01", "2043-06-25", "2043-07-09",
  "2044-01-01", "2044-04-02", "2044-05-01", "2044-06-25", "2044-07-09",
  "2045-01-01", "2045-04-02", "2045-05-01", "2045-06-25", "2045-07-09",
  "2046-01-01", "2046-04-02", "2046-05-01", "2046-06-25", "2046-07-09",
]

const FERIADOS = new Set(FERIADOS_AR)

const MS_POR_DIA = 86_400_000

/** Fecha en formato YYYY-MM-DD, siempre en UTC para que no la mueva el huso. */
export function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

/** Construye una fecha UTC a partir de "YYYY-MM-DD". */
export function fechaUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getUTCDay()
  if (dia === 0 || dia === 6) return false
  return !FERIADOS.has(aISO(fecha))
}

/**
 * Corre la fecha al siguiente día hábil si cae en fin de semana o feriado
 * (convención "following"). Es lo que hace la planilla de referencia con
 * NETWORKDAYS: prueba el mismo día, +1, +2, +3.
 */
export function siguienteDiaHabil(fecha: Date): Date {
  const resultado = new Date(fecha.getTime())
  let intentos = 0
  while (!esDiaHabil(resultado) && intentos < 10) {
    resultado.setTime(resultado.getTime() + MS_POR_DIA)
    intentos += 1
  }
  return resultado
}

/**
 * Equivalente a WORKDAY(fecha, 1, feriados) de Excel: SIEMPRE avanza al
 * menos un día hábil, a diferencia de siguienteDiaHabil (que devuelve la
 * misma fecha si ya es hábil). Es la liquidación T+1 -- lo que se paga hoy
 * se cobra/liquida el próximo día hábil, nunca el mismo día.
 */
export function proximoDiaHabil(fecha: Date): Date {
  const resultado = new Date(fecha.getTime() + MS_POR_DIA)
  let intentos = 0
  while (!esDiaHabil(resultado) && intentos < 10) {
    resultado.setTime(resultado.getTime() + MS_POR_DIA)
    intentos += 1
  }
  return resultado
}
