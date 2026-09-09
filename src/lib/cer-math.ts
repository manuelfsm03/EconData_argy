/**
 * Tasa real de los instrumentos ajustados por CER.
 *
 * A un bono CER NO se le puede calcular una TIR nominal. El flujo futuro está
 * en unidades CER y el CER futuro depende de una inflación que nadie conoce:
 * cualquier "TIR" nominal que se publique para uno de estos papeles es un
 * pronóstico de inflación disfrazado de dato de mercado. Lo que sí queda bien
 * definido es el rendimiento REAL, que es como los cotiza la mesa: "CER + X%".
 *
 * ── Por qué para un CERO CUPÓN no hace falta el prospecto ────────────────────
 *
 * Un bono CER paga, al vencimiento, el capital ajustado:
 *
 *     Pago(T)  =  VN × CER(T) / CER(base)
 *
 * y el valor técnico de hoy es ese mismo capital, ajustado hasta hoy:
 *
 *     VT(t)    =  VN × CER(t) / CER(base)
 *
 * En términos reales, o sea deflactando por el propio CER, el pago vale
 * VN/CER(base) medido en unidades constantes, y el precio de hoy vale
 * P/CER(t). La tasa real sale de igualar los dos:
 *
 *     P / CER(t)  =  [ VN / CER(base) ] / (1 + r)^τ
 *
 * y como VN/CER(base) = VT(t)/CER(t), el CER(t) se cancela de los dos lados:
 *
 *     r  =  ( VT / P )^(1/τ) − 1                       con τ en años
 *
 * **El CER base desaparece de la fórmula.** No hace falta la fecha base ni la
 * condición de emisión: alcanza con el precio, el valor técnico publicado y la
 * fecha de vencimiento. Es lo que hace que esta parte se pueda calcular hoy y
 * bien, sin esperar a verificar prospecto por prospecto.
 *
 * Esto vale SÓLO para cero cupón. Con cupones de por medio hay un flujo
 * intermedio que la fórmula no ve, y el resultado quedaría por debajo del
 * rendimiento real. Por eso `esCeroCupon` es conservador: ante la duda, no
 * calcula.
 *
 * Verificado: TZX27 con paridad 93,33% y 315 días al vencimiento da 8,33%,
 * contra el 8,35% + CER que publicaba ecovalores ese día.
 *
 * Regla 6 del ROADMAP: cada cálculo con su fórmula.
 */

import { cuponDe } from "@/server/domain/peso-bonds"

/** Días de un año para anualizar. Act/365, igual que el resto del módulo. */
const DIAS_ANIO = 365

/**
 * Si el instrumento paga o no cupones, decidido de la forma más conservadora
 * posible: se calcula sólo cuando hay evidencia POSITIVA de que es cero cupón.
 *
 * ── Por qué el catálogo manda sobre el nombre ────────────────────────────────
 *
 * Antes esto se resolvía leyendo el nombre que publica la fuente de precios,
 * que en estos papeles declara la tasa ("BONCER 2028 $ 0%", "LECER $ 0% Vto.
 * 30.11.2026"). El 9/9/2026 Rava empezó a mandar `nombre` con sólo el ticker
 * ("TX26") en 382 de 887 filas, y la detección se cayó de 28 instrumentos a 2:
 * la calculadora pasó a contestar "paga cupones, falta el prospecto" a papeles
 * que son cero cupón por emisión (TZXD6/D7/D8, TZXA7, TZXM7/M8/M9, TZXO6/O7,
 * TZXS7/S8, TZXY7, LECER X30N6/X30S6). Nadie se enteró: el endpoint seguía
 * respondiendo 200 y el 501 se leía como una limitación conocida.
 *
 * Por eso la estructura del instrumento sale de `peso-bonds.ts`, que es
 * condición de emisión y no cambia, y el nombre queda sólo como último recurso
 * para tickers que no estén en el catálogo.
 */
export function esCeroCupon(ticker: string, nombre: string | null | undefined): boolean {
  const porEmision = cuponDe(ticker)
  if (porEmision !== null) return porEmision === "cero"

  // Fuera del catálogo: se cae al nombre publicado. Es peor evidencia, pero
  // para un ticker que no conocemos es lo único que hay.
  const texto = (nombre ?? "").toLowerCase()
  if (texto.includes("cero cupón") || texto.includes("cero cupon")) return true
  // "0%" con el porcentaje pegado o separado: "$ 0%", "0 %".
  return /\b0\s*%/.test(texto)
}

export interface TasaRealCeroCupon {
  /** Rendimiento real anual, en porcentaje. Se lee como "CER + X%". */
  tasaReal: number
  /** Días desde la liquidación hasta el vencimiento. */
  dias: number
  /** Precio sobre valor técnico, en porcentaje. */
  paridad: number
}

/**
 * Rendimiento real de un cero cupón CER.
 *
 *     r = (VT / P)^(365/días) − 1
 *
 * Devuelve null cuando el cálculo no tendría sentido: precio o valor técnico no
 * positivos, o un vencimiento que ya pasó. Un instrumento vencido no tiene
 * rendimiento, tiene un cobro.
 */
export function tasaRealCeroCupon(
  precio: number,
  valorTecnico: number,
  dias: number,
): TasaRealCeroCupon | null {
  if (!(precio > 0) || !(valorTecnico > 0) || !Number.isFinite(dias) || dias <= 0) return null

  const tasaReal = (Math.pow(valorTecnico / precio, DIAS_ANIO / dias) - 1) * 100
  if (!Number.isFinite(tasaReal)) return null

  return { tasaReal, dias, paridad: (precio / valorTecnico) * 100 }
}

/**
 * Días entre dos fechas, contando de fecha a fecha.
 *
 * Se hace sobre las fechas en UTC a mediodía para que un cambio de horario de
 * verano en el medio no reste ni sume un día por redondeo.
 */
export function diasEntre(desde: Date, hasta: Date): number {
  const aMediodia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)
  return Math.round((aMediodia(hasta) - aMediodia(desde)) / 86_400_000)
}

/**
 * Precio que corresponde a una tasa real objetivo. La inversa de la de arriba:
 *
 *     P = VT / (1 + r)^(días/365)
 *
 * Es lo que contesta "a qué precio tengo que comprarlo para llevarme CER + X".
 */
export function precioDadaTasaReal(
  tasaRealPorcentaje: number,
  valorTecnico: number,
  dias: number,
): number | null {
  if (!(valorTecnico > 0) || !Number.isFinite(dias) || dias <= 0) return null
  const r = tasaRealPorcentaje / 100
  if (r <= -1) return null
  const precio = valorTecnico / Math.pow(1 + r, dias / DIAS_ANIO)
  return Number.isFinite(precio) && precio > 0 ? precio : null
}
