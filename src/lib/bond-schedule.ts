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
 * Chequea que un esquema sea internamente coherente antes de dejarlo entrar al
 * motor. Devuelve la lista de problemas; vacía significa que está sano.
 *
 * Es la red de contención para bonos cargados desde un prospecto: el error
 * típico no es de fórmula sino de transcripción, y estas invariantes lo cazan
 * sin necesidad de conocer el bono. Los cinco esquemas rotos que hoy están en
 * src/lib/bonds-data.ts habrían fallado la primera regla.
 */
export function validarEsquema(esquema: EsquemaBono): string[] {
  const problemas: string[] = []

  const total = totalAmortizado(esquema)
  if (Math.abs(total - 100) > 1e-6) {
    problemas.push(`las amortizaciones suman ${total.toFixed(3)} en vez de 100`)
  }

  if (esquema.filas.length === 0) {
    problemas.push("no tiene ninguna fila de flujo")
    return problemas
  }

  const fechas = esquema.filas.map((f) => f.fecha)
  if (new Set(fechas).size !== fechas.length) {
    problemas.push("hay fechas de pago repetidas")
  }
  if ([...fechas].sort().join() !== fechas.join()) {
    problemas.push("las fechas no están en orden cronológico")
  }

  const ultima = fechas[fechas.length - 1]
  if (ultima !== esquema.vencimiento) {
    problemas.push(`el último flujo es ${ultima} pero el vencimiento declarado es ${esquema.vencimiento}`)
  }
  if (fechas[0] <= esquema.emision) {
    problemas.push(`el primer flujo (${fechas[0]}) no es posterior a la emisión (${esquema.emision})`)
  }

  for (const fila of esquema.filas) {
    if (fila.tasa < 0) problemas.push(`tasa negativa en ${fila.fecha}`)
    if (fila.amortizacion < 0) problemas.push(`amortización negativa en ${fila.fecha}`)
  }

  if (esquema.fuente.trim() === "") {
    problemas.push("no declara fuente (regla 5 del ROADMAP)")
  }

  return problemas
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
      inicioDevengamiento: fechaAnterior,
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
  fuente: "Decreto 676/2020, Anexo II/III Condiciones de Emisión de los Nuevos Títulos, InfoLEG IF-2020-53778419-APN-UGSDPE#MEC; cronograma cotejado contra la planilla de referencia del equipo, verificado 2026-08-25",
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

/**
 * AL30 — Bono Soberano USD Ley Argentina 2030, del mismo canje 2020 que GD30.
 * Mismo cronograma de tasas y amortización que GD30 (ambos "Step Up 2030" de
 * la misma reestructuración) — difieren en ley aplicable e ISIN, no en términos
 * financieros. Verificado cruzando Rava, cbonds.com y MAE (ver `fuente`).
 */
export const AL30: EsquemaBono = {
  ticker: "AL30",
  nombre: "Bono Soberano USD Ley Argentina 2030",
  isin: "ARARGE3209S6",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "local",
  emision: "2020-09-04",
  vencimiento: "2030-07-09",
  fuente: "Rava Bursátil (ficha AL30) + cbonds.com (ISIN ARARGE3209S6) + MAE — mismo cronograma que GD30 (ambos del canje 2020, difieren en ley aplicable), verificado 2026-08-16",
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

/**
 * GD29/AL29, GD35/AL35, GD41/AL41 y AE38 — resto del seed del canje 2020
 * (ROADMAP M1.1). A diferencia de GD30/AL30 (cargados a mano contra la
 * planilla de referencia del equipo), estos siete se generaron con un script
 * que expande los tramos de tasa tal cual figuran en el decreto oficial en
 * filas semestrales y valida las mismas invariantes que validarEsquema()
 * antes de imprimir — la expansión manual de 17 a 41 filas por bono es
 * exactamente el tipo de transcripción propensa a error que este archivo
 * existe para evitar. Fuente primaria en cada `fuente`: InfoLEG, anexos de
 * "Términos y condiciones de los nuevos títulos" del canje 2020 (uno para
 * Bonos Globales/Ley NY, otro para Bonos Ley Argentina).
 */
export const GD29: EsquemaBono = {
  ticker: "GD29",
  nombre: "Bono Global USD Ley NY 1% 2029",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "NY",
  emision: "2020-09-04",
  vencimiento: "2029-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Globales), InfoLEG IF-2020-53778419-APN-UGSDPE#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2025-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2026-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2026-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2027-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2027-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2028-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2028-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2029-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2029-07-09", tasa: 0.01, amortizacion: 10 },
  ],
}

export const AL29: EsquemaBono = {
  ticker: "AL29",
  nombre: "Bono Soberano USD Ley Argentina 1% 2029",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "local",
  emision: "2020-09-04",
  vencimiento: "2029-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Ley Argentina), InfoLEG IF-2020-53843620-APN-SSF#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.01, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2025-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2026-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2026-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2027-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2027-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2028-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2028-07-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2029-01-09", tasa: 0.01, amortizacion: 10 },
    { fecha: "2029-07-09", tasa: 0.01, amortizacion: 10 },
  ],
}

export const GD35: EsquemaBono = {
  ticker: "GD35",
  nombre: "Bono Global USD Ley NY 2035",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "NY",
  emision: "2020-09-04",
  vencimiento: "2035-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Globales), InfoLEG IF-2020-53778419-APN-UGSDPE#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.01125, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.01125, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.015, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.015, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.03625, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.03625, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2025-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2026-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2026-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2027-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2027-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2028-01-09", tasa: 0.0475, amortizacion: 0 },
    { fecha: "2028-07-09", tasa: 0.0475, amortizacion: 0 },
    { fecha: "2029-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2029-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2030-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2030-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2031-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2031-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2032-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2032-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2033-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2033-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2034-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2034-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2035-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2035-07-09", tasa: 0.05, amortizacion: 10 },
  ],
}

export const AL35: EsquemaBono = {
  ticker: "AL35",
  nombre: "Bono Soberano USD Ley Argentina 2035",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "local",
  emision: "2020-09-04",
  vencimiento: "2035-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Ley Argentina), InfoLEG IF-2020-53843620-APN-SSF#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.01125, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.01125, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.015, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.015, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.03625, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.03625, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2025-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2026-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2026-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2027-01-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2027-07-09", tasa: 0.04125, amortizacion: 0 },
    { fecha: "2028-01-09", tasa: 0.0475, amortizacion: 0 },
    { fecha: "2028-07-09", tasa: 0.0475, amortizacion: 0 },
    { fecha: "2029-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2029-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2030-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2030-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2031-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2031-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2032-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2032-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2033-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2033-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2034-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2034-07-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2035-01-09", tasa: 0.05, amortizacion: 10 },
    { fecha: "2035-07-09", tasa: 0.05, amortizacion: 10 },
  ],
}

export const GD41: EsquemaBono = {
  ticker: "GD41",
  nombre: "Bono Global USD Ley NY 2041",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "NY",
  emision: "2020-09-04",
  vencimiento: "2041-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Globales), InfoLEG IF-2020-53778419-APN-UGSDPE#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.025, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.025, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2025-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2026-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2026-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2027-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2027-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2028-01-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2028-07-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2029-01-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2029-07-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2030-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2030-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2031-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2031-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2032-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2032-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2033-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2033-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2034-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2034-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2035-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2035-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2036-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2036-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2037-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2037-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2038-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2038-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2039-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2039-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2040-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2040-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2041-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2041-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
  ],
}

export const AL41: EsquemaBono = {
  ticker: "AL41",
  nombre: "Bono Soberano USD Ley Argentina 2041",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "local",
  emision: "2020-09-04",
  vencimiento: "2041-07-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Ley Argentina), InfoLEG IF-2020-53843620-APN-SSF#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.025, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.025, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2025-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2026-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2026-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2027-01-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2027-07-09", tasa: 0.035, amortizacion: 0 },
    { fecha: "2028-01-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2028-07-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2029-01-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2029-07-09", tasa: 0.035, amortizacion: 3.5714285714285716 },
    { fecha: "2030-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2030-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2031-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2031-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2032-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2032-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2033-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2033-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2034-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2034-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2035-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2035-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2036-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2036-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2037-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2037-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2038-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2038-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2039-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2039-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2040-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2040-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2041-01-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
    { fecha: "2041-07-09", tasa: 0.04875, amortizacion: 3.5714285714285716 },
  ],
}

export const AE38: EsquemaBono = {
  ticker: "AE38",
  nombre: "Bono Soberano USD Ley Argentina 2038",
  emisor: "REPUBLIC OF ARGENTINA",
  moneda: "USD",
  ley: "local",
  emision: "2020-09-04",
  vencimiento: "2038-01-09",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Ley Argentina), InfoLEG IF-2020-53843620-APN-SSF#MEC, verificado 2026-08-16",
  filas: [
    { fecha: "2021-07-09", tasa: 0.00125, amortizacion: 0 },
    { fecha: "2022-01-09", tasa: 0.02, amortizacion: 0 },
    { fecha: "2022-07-09", tasa: 0.02, amortizacion: 0 },
    { fecha: "2023-01-09", tasa: 0.03875, amortizacion: 0 },
    { fecha: "2023-07-09", tasa: 0.03875, amortizacion: 0 },
    { fecha: "2024-01-09", tasa: 0.0425, amortizacion: 0 },
    { fecha: "2024-07-09", tasa: 0.0425, amortizacion: 0 },
    { fecha: "2025-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2025-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2026-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2026-07-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2027-01-09", tasa: 0.05, amortizacion: 0 },
    { fecha: "2027-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2028-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2028-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2029-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2029-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2030-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2030-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2031-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2031-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2032-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2032-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2033-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2033-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2034-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2034-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2035-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2035-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2036-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2036-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2037-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2037-07-09", tasa: 0.05, amortizacion: 4.545454545454546 },
    { fecha: "2038-01-09", tasa: 0.05, amortizacion: 4.545454545454546 },
  ],
}

/**
 * GD38 comparte términos económicos con AE38; cambia solamente la ley
 * aplicable y el identificador de mercado. Se mantiene como alias explícito
 * para que el catálogo no mezcle los tickers oficiales.
 */
export const GD38: EsquemaBono = {
  ...AE38,
  ticker: "GD38",
  nombre: "Bono Global USD Ley NY 2038",
  ley: "NY",
  fuente: "Decreto 2020, Anexo III/IV Terminos y condiciones de los nuevos titulos (Bonos Globales), InfoLEG IF-2020-53778419-APN-UGSDPE#MEC, verificado 2026-08-25",
}

export const ESQUEMAS: EsquemaBono[] = [GD30, AL30, GD29, AL29, GD35, AL35, GD41, AL41, AE38, GD38]
