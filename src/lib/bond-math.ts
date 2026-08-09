/**
 * Matemática de bonos soberanos, replicando la calculadora de referencia del
 * equipo (Copia de Calculadoras de bonos.xlsx, hoja GD30).
 *
 * Convenciones, tal como las usa la planilla:
 *   - Devengamiento de intereses corridos: 30/360 (YEARFRAC basis 0).
 *   - Descuento de flujos: Act/365 (YEARFRAC basis 3), igual que XIRR.
 *   - Los flujos se descuentan a su FECHA DE PAGO efectiva, ya corrida al
 *     día hábil siguiente. Ver market-calendar.ts.
 *   - Todos los importes van por cada 100 de valor nominal ORIGINAL, no del
 *     residual. Es decir: un bono que ya amortizó el 28% tiene VR = 72.
 *
 * Cada función documenta su fórmula. Regla 6 del ROADMAP.
 */

import { yearFrac30360, yearFracAct365 } from "./daycount"

export interface Cashflow {
  /** Fecha teórica del prospecto (la que devenga). */
  fechaDevengamiento: Date
  /** Fecha efectiva de cobro, corrida al día hábil siguiente. */
  fechaPago: Date
  /** Tasa nominal anual del período. 0.0075 = 0.75%. Los soberanos del canje
   *  2020 tienen cupón escalonado, así que cambia a lo largo de la vida. */
  tasa: number
  /** Valor residual sobre el que devenga este cupón, por cada 100 de VN. */
  vr: number
  /** Renta del período. */
  cupon: number
  /** Amortización de capital del período. */
  amortizacion: number
}

/**
 * Métricas que salen sólo del prospecto y la fecha: NO necesitan precio de
 * mercado. Se pueden calcular apenas se carga un bono, antes de tener
 * conectada ninguna fuente de precios.
 */
export interface MetricasDevengadas {
  /** Capital pendiente de amortizar, por cada 100 de VN original. */
  valorResidual: number
  /** Porcentaje del capital original ya devuelto. */
  amortizado: number
  /** Intereses devengados y no cobrados a la fecha de liquidación. */
  interesesCorridos: number
  /** Valor residual + intereses corridos. */
  valorTecnico: number
  /** Tasa nominal anual vigente en el período en curso. */
  tasaVigente: number
  /** Fecha de cobro del próximo flujo, ya corrida a día hábil. */
  proximoPago: Date
  /** Renta + amortización del próximo flujo. */
  proximoFlujo: number
  /** Suma de todo lo que falta cobrar, sin descontar. */
  flujoRemanente: number
  /** Renta de los próximos 12 meses. */
  rentaProximos12m: number
  /** Vida promedio del capital (WAL), en años. No depende del precio. */
  vidaPromedio: number
  /** Años hasta el último pago. */
  plazoResidual: number
}

/**
 * Métricas que requieren un precio de mercado. Mientras no haya fuente de
 * precios conectada, esto se calcula sólo para los tickers que tengan precio
 * cargado a mano, y siempre declarando de dónde salió.
 */
export interface MetricasDeMercado {
  /** TIR anual efectiva, en porcentaje. */
  tir: number
  /** Duration de Macaulay, en años. */
  duration: number
  /** Duration modificada, en años. */
  durationMod: number
  convexity: number
  /** Precio dirty / valor técnico, en porcentaje. */
  paridad: number
  /** Cupones de los próximos 12 meses sobre precio clean, en porcentaje. */
  currentYield: number
  /** Precio dirty menos intereses corridos. */
  precioClean: number
}

export type MetricasBono = MetricasDevengadas & MetricasDeMercado

/**
 * Flujos que todavía no se cobraron a la fecha de liquidación.
 * El criterio es el de la planilla: entra el flujo cuya fecha de
 * DEVENGAMIENTO es posterior a la liquidación.
 */
export function flujosFuturos(cashflows: Cashflow[], liquidacion: Date): Cashflow[] {
  return cashflows
    .filter((cf) => cf.fechaDevengamiento.getTime() > liquidacion.getTime())
    .sort((a, b) => a.fechaPago.getTime() - b.fechaPago.getTime())
}

/**
 * Valor residual a la fecha: el capital que le queda por devolver al bono.
 * Sale del próximo flujo, porque su columna VR ya refleja las amortizaciones
 * pagadas hasta hoy.
 */
export function valorResidual(cashflows: Cashflow[], liquidacion: Date): number {
  const futuros = flujosFuturos(cashflows, liquidacion)
  if (futuros.length === 0) return 0
  return futuros[0].vr
}

/**
 * Intereses corridos = fracción del período transcurrida (30/360) x VR x tasa.
 * Es la renta ya devengada que todavía no se cobró: el comprador se la paga al
 * vendedor dentro del precio.
 */
export function interesesCorridos(cashflows: Cashflow[], liquidacion: Date): number {
  const futuros = flujosFuturos(cashflows, liquidacion)
  if (futuros.length === 0) return 0

  const proximo = futuros[0]
  const anteriores = cashflows
    .filter((cf) => cf.fechaDevengamiento.getTime() <= liquidacion.getTime())
    .sort((a, b) => a.fechaDevengamiento.getTime() - b.fechaDevengamiento.getTime())

  // Si todavía no pagó ningún cupón, se devenga desde la emisión, que es la
  // fecha de devengamiento del primer flujo hacia atrás medio período.
  const ultimoPago = anteriores.length > 0
    ? anteriores[anteriores.length - 1].fechaDevengamiento
    : proximo.fechaDevengamiento

  return yearFrac30360(ultimoPago, liquidacion) * proximo.vr * proximo.tasa
}

/**
 * TIR anual efectiva: la tasa que iguala el valor presente de los flujos
 * futuros al precio dirty pagado hoy. Equivale al XIRR de la planilla.
 *
 *   precio = SUM( flujo_i / (1 + tir) ^ ((fechaPago_i - liquidacion) / 365) )
 *
 * Se resuelve por bisección y se pule con Newton-Raphson. La bisección sola ya
 * garantiza convergencia si hay cambio de signo en el intervalo, cosa que
 * Newton solo no garantiza: con flujos irregulares puede divergir y quedarse
 * sin respuesta justo en los bonos más largos.
 */
export function tir(precioDirty: number, futuros: Cashflow[], liquidacion: Date): number | null {
  if (precioDirty <= 0 || futuros.length === 0) return null

  const plazos = futuros.map((cf) => ({
    t: yearFracAct365(liquidacion, cf.fechaPago),
    flujo: cf.cupon + cf.amortizacion,
  }))
  if (plazos.some((p) => p.t <= 0)) return null

  const vpn = (r: number) =>
    plazos.reduce((suma, { t, flujo }) => suma + flujo / Math.pow(1 + r, t), 0) - precioDirty

  let bajo = -0.99
  let alto = 10
  if (vpn(bajo) * vpn(alto) > 0) return null

  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2
    if (vpn(medio) > 0) bajo = medio
    else alto = medio
  }
  const r = (bajo + alto) / 2

  return Number.isFinite(r) ? r * 100 : null
}

/**
 * Duration de Macaulay: el plazo promedio de los flujos, ponderado por cuánto
 * pesa cada uno en el precio de hoy.
 *
 *   macaulay = SUM( t_i x VP_i ) / precio
 */
export function duration(
  precioDirty: number,
  futuros: Cashflow[],
  liquidacion: Date,
  tirPorcentaje: number,
): number | null {
  if (precioDirty <= 0 || futuros.length === 0) return null
  const r = tirPorcentaje / 100

  const macaulay = futuros.reduce((suma, cf) => {
    const t = yearFracAct365(liquidacion, cf.fechaPago)
    const vp = (cf.cupon + cf.amortizacion) / Math.pow(1 + r, t)
    return suma + (t * vp) / precioDirty
  }, 0)

  return macaulay
}

/**
 * Convexity, en la forma que usa la planilla:
 *
 *   convexity = SUM( VP_i x t_i x (1 + t_i) ) / ( precio x (1 + tir)^2 )
 */
export function convexity(
  precioDirty: number,
  futuros: Cashflow[],
  liquidacion: Date,
  tirPorcentaje: number,
): number | null {
  if (precioDirty <= 0 || futuros.length === 0) return null
  const r = tirPorcentaje / 100

  const suma = futuros.reduce((acumulado, cf) => {
    const t = yearFracAct365(liquidacion, cf.fechaPago)
    const vp = (cf.cupon + cf.amortizacion) / Math.pow(1 + r, t)
    return acumulado + vp * t * (1 + t)
  }, 0)

  return suma / (precioDirty * Math.pow(1 + r, 2))
}

/**
 * Current yield = renta de los próximos 12 meses sobre el precio clean.
 *
 * OJO: la planilla de referencia calcula esto con un rango fijo de celdas que
 * quedó desactualizado y termina sumando cupones YA COBRADOS. Acá se toman los
 * 12 meses hacia adelante desde la liquidación, que es la definición correcta.
 * Es la única métrica donde este módulo se aparta a propósito del excel.
 */
export function currentYield(
  precioClean: number,
  futuros: Cashflow[],
  liquidacion: Date,
): number | null {
  if (precioClean <= 0) return null

  const limite = new Date(liquidacion.getTime())
  limite.setUTCFullYear(limite.getUTCFullYear() + 1)

  const renta = futuros
    .filter((cf) => cf.fechaDevengamiento.getTime() <= limite.getTime())
    .reduce((suma, cf) => suma + cf.cupon, 0)

  return (renta / precioClean) * 100
}

/**
 * Vida promedio del capital (weighted average life): el plazo promedio en que
 * se devuelve el principal, ponderando cada amortización por su tamaño.
 *
 *   WAL = SUM( t_i x amortizacion_i ) / SUM( amortizacion_i )
 *
 * A diferencia de la duration, no descuenta ni usa el precio: es una propiedad
 * del prospecto. Por eso se puede calcular sin tener datos de mercado.
 */
export function vidaPromedio(futuros: Cashflow[], liquidacion: Date): number {
  const capital = futuros.reduce((suma, cf) => suma + cf.amortizacion, 0)
  if (capital <= 0) return 0

  const ponderado = futuros.reduce((suma, cf) => {
    const t = yearFracAct365(liquidacion, cf.fechaPago)
    return suma + t * cf.amortizacion
  }, 0)

  return ponderado / capital
}

/** Renta a cobrar en los próximos 12 meses desde la liquidación. */
export function rentaProximos12m(futuros: Cashflow[], liquidacion: Date): number {
  const limite = new Date(liquidacion.getTime())
  limite.setUTCFullYear(limite.getUTCFullYear() + 1)
  return futuros
    .filter((cf) => cf.fechaDevengamiento.getTime() <= limite.getTime())
    .reduce((suma, cf) => suma + cf.cupon, 0)
}

/**
 * Todo lo que se puede saber de un bono SIN precio de mercado.
 *
 * Esta es la mitad del motor que ya funciona hoy: apenas se carga el esquema de
 * un bono nuevo, estas métricas quedan disponibles sin depender de ninguna
 * fuente externa.
 */
export function metricasDevengadas(
  cashflows: Cashflow[],
  liquidacion: Date,
): MetricasDevengadas | null {
  const futuros = flujosFuturos(cashflows, liquidacion)
  if (futuros.length === 0) return null

  const proximo = futuros[0]
  const vr = valorResidual(cashflows, liquidacion)
  const corridos = interesesCorridos(cashflows, liquidacion)
  const ultimo = futuros[futuros.length - 1]

  return {
    valorResidual: vr,
    amortizado: 100 - vr,
    interesesCorridos: corridos,
    valorTecnico: vr + corridos,
    tasaVigente: proximo.tasa,
    proximoPago: proximo.fechaPago,
    proximoFlujo: proximo.cupon + proximo.amortizacion,
    flujoRemanente: futuros.reduce((suma, cf) => suma + cf.cupon + cf.amortizacion, 0),
    rentaProximos12m: rentaProximos12m(futuros, liquidacion),
    vidaPromedio: vidaPromedio(futuros, liquidacion),
    plazoResidual: yearFracAct365(liquidacion, ultimo.fechaPago),
  }
}

/**
 * Las métricas que necesitan un precio. Separadas a propósito: mientras no
 * haya fuente de precios conectada, el resto del motor funciona igual.
 */
export function metricasDeMercado(
  precioDirty: number,
  cashflows: Cashflow[],
  liquidacion: Date,
): MetricasDeMercado | null {
  const futuros = flujosFuturos(cashflows, liquidacion)
  if (futuros.length === 0 || precioDirty <= 0) return null

  const corridos = interesesCorridos(cashflows, liquidacion)
  const valorTecnico = valorResidual(cashflows, liquidacion) + corridos
  const precioClean = precioDirty - corridos

  const tirCalculada = tir(precioDirty, futuros, liquidacion)
  if (tirCalculada === null) return null

  const macaulay = duration(precioDirty, futuros, liquidacion, tirCalculada)
  const cx = convexity(precioDirty, futuros, liquidacion, tirCalculada)
  const cy = currentYield(precioClean, futuros, liquidacion)
  if (macaulay === null || cx === null || cy === null) return null

  return {
    tir: tirCalculada,
    duration: macaulay,
    durationMod: macaulay / (1 + tirCalculada / 100),
    convexity: cx,
    paridad: valorTecnico > 0 ? (precioDirty / valorTecnico) * 100 : 0,
    currentYield: cy,
    precioClean,
  }
}

/** Las dos mitades juntas, para cuando hay precio disponible. */
export function calcularMetricas(
  precioDirty: number,
  cashflows: Cashflow[],
  liquidacion: Date,
): MetricasBono | null {
  const devengadas = metricasDevengadas(cashflows, liquidacion)
  const mercado = metricasDeMercado(precioDirty, cashflows, liquidacion)
  if (devengadas === null || mercado === null) return null
  return { ...devengadas, ...mercado }
}
