/**
 * Definición de bonos soberanos y armado de su flujo de fondos.
 *
 * Un bono se declara por lo que dice el prospecto y NADA MÁS: fechas, tasa
 * vigente en cada período y amortización. El cupón se calcula, no se carga a
 * mano.
 *
 * Esto no es una preferencia de estilo. Los cupones cargados a mano en
 * src/lib/bonds-data.ts están mal por un factor de ~6 (GD30 tenía 1.825 donde
 * la renta real es 0.27) justamente porque nada obligaba a que fueran
 * consistentes con la tasa y el residual. Derivándolos, ese error es imposible.
 */

import type { Cashflow } from "./bond-math"
import { yearFrac30360 } from "./daycount"
import { fechaUTC, siguienteDiaHabil } from "./market-calendar"

export interface FilaEsquema {
  /** Fecha de devengamiento del prospecto, YYYY-MM-DD. */
  fecha: string
  /** Tasa nominal anual vigente para ese período. 0.0075 = 0.75%. */
  tasa: number
  /** Amortización de capital, por cada 100 de VN original. */
  amortizacion: number
}

export interface EsquemaBono {
  ticker: string
  nombre: string
  isin?: string
  emisor: string
  moneda: string
  ley: "local" | "NY"
  emision: string
  vencimiento: string
  /** De dónde salieron estos datos. Regla 5 del ROADMAP. */
  fuente: string
  filas: FilaEsquema[]
}

/** Suma de amortizaciones. Un bono sano devuelve exactamente 100. */
export function totalAmortizado(esquema: EsquemaBono): number {
  return esquema.filas.reduce((suma, fila) => suma + fila.amortizacion, 0)
}

/**
 * Convierte el esquema en flujos de fondos calculando, para cada período:
 *   - el valor residual (100 menos lo ya amortizado),
 *   - el cupón: fracción del período (30/360) x tasa x residual,
 *   - la fecha de pago efectiva, corrida al día hábil siguiente.
 */
export function construirCashflows(esquema: EsquemaBono): Cashflow[] {
  const cashflows: Cashflow[] = []
  let residual = 100
  let fechaAnterior = fechaUTC(esquema.emision)

  for (const fila of esquema.filas) {
    const fechaDevengamiento = fechaUTC(fila.fecha)
    const cupon = yearFrac30360(fechaAnterior, fechaDevengamiento) * fila.tasa * residual

    cashflows.push({
      fechaDevengamiento,
      fechaPago: siguienteDiaHabil(fechaDevengamiento),
      tasa: fila.tasa,
      vr: residual,
      cupon,
      amortizacion: fila.amortizacion,
    })

    residual -= fila.amortizacion
    fechaAnterior = fechaDevengamiento
  }

  return cashflows
}

/**
 * GD30 — Bono Soberano USD Ley NY 2030, del canje 2020.
 * Cupón escalonado (0.125% → 0.5% → 0.75% → 1.75%) y amortización en 13 cuotas:
 * una de 4% en julio 2024 y doce de 8% hasta el vencimiento.
 */
export const GD30: EsquemaBono = {
  ticker: "GD30",
  nombre: "Bono Soberano USD Ley NY 2030",
  isin: "US040114HS26",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "NY",
  emision: "2020-09-04",
  vencimiento: "2030-07-09",
  fuente: "Copia de Calculadoras de bonos.xlsx, hoja GD30 (planilla de referencia del equipo)",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.005, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.005, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.005, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.005, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.0075, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.0075, amortizacion: 4 },
    { fecha: "2025-01-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2025-07-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2026-01-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2026-07-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2027-01-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2027-07-09", tasa: 0.0075, amortizacion: 8 },
    { fecha: "2028-01-09", tasa: 0.0175, amortizacion: 8 },
    { fecha: "2028-07-09", tasa: 0.0175, amortizacion: 8 },
    { fecha: "2029-01-09", tasa: 0.0175, amortizacion: 8 },
    { fecha: "2029-07-09", tasa: 0.0175, amortizacion: 8 },
    { fecha: "2030-01-09", tasa: 0.0175, amortizacion: 8 },
    { fecha: "2030-07-09", tasa: 0.0175, amortizacion: 8 },
  ],
}

export const ESQUEMAS: EsquemaBono[] = [GD30]
