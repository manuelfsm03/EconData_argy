/**
 * Condiciones de emisión de las LECAP y BONCAP vigentes.
 *
 * El pago final es el dato que ningún feed de precios trae, y sin él no se
 * calcula un solo rendimiento: TEM, TNA, TEA y duration salen de comparar el
 * precio contra este número. BYMA Data da el precio; esto da el otro lado de
 * la cuenta.
 *
 * Fuente: ficha técnica de cada especie en BYMA Data abierto
 * (bnown/fichatecnica/especies/general), que publica fecha de emisión y tasa
 * efectiva mensual. El pago final es 100 · (1 + TEM)^meses, con los meses
 * contados 30/360 US desde la emisión (ver pagoFinalDesdeEmision). Verificado
 * el 2026-09-21: los diez pagos cargados reproducen esa fórmula al sexto
 * decimal, y tests/cap-math.test.ts lo exige.
 *
 * S13N6 y S29E7 no publican la tasa en su ficha. Su TEM de emisión es la
 * implícita en el pago final, y da redonda (2,10% y 2,25%), como sale de
 * licitación.
 *
 * Cada licitación del Tesoro agrega instrumentos. Un ticker que BYMA cotiza y
 * no está acá aparece en el screener con precio y sin métricas, rotulado, no
 * inventado. Sumarlo es una línea: fecha de emisión, TEM y pago final.
 */

import type { TerminosCap } from "@/lib/cap-math"

export interface TerminosCapTicker extends TerminosCap {
  ticker: string
  tipo: "LECAP" | "BONCAP"
}

export const CAP_TERMINOS: readonly TerminosCapTicker[] = [
  { ticker: "S30S6", tipo: "LECAP",  emision: "2026-03-16", vencimiento: "2026-09-30", temEmision: 2.53, pagoFinal: 117.535626 },
  { ticker: "S16O6", tipo: "LECAP",  emision: "2026-07-31", vencimiento: "2026-10-16", temEmision: 2.05, pagoFinal: 105.275252 },
  { ticker: "S30O6", tipo: "LECAP",  emision: "2025-10-31", vencimiento: "2026-10-30", temEmision: 2.55, pagoFinal: 135.27825 },
  { ticker: "S13N6", tipo: "LECAP",  emision: "2026-06-30", vencimiento: "2026-11-13", temEmision: 2.10, pagoFinal: 109.651385 },
  { ticker: "S30N6", tipo: "LECAP",  emision: "2025-12-15", vencimiento: "2026-11-30", temEmision: 2.30, pagoFinal: 129.888227 },
  { ticker: "T15E7", tipo: "BONCAP", emision: "2025-01-31", vencimiento: "2027-01-15", temEmision: 2.05, pagoFinal: 161.103773 },
  { ticker: "S29E7", tipo: "LECAP",  emision: "2026-08-31", vencimiento: "2027-01-29", temEmision: 2.25, pagoFinal: 111.684903 },
  { ticker: "T30A7", tipo: "BONCAP", emision: "2025-10-31", vencimiento: "2027-04-30", temEmision: 2.55, pagoFinal: 157.341021 },
  { ticker: "T31Y7", tipo: "BONCAP", emision: "2025-12-15", vencimiento: "2027-05-31", temEmision: 2.40, pagoFinal: 151.562784 },
  { ticker: "T30J7", tipo: "BONCAP", emision: "2026-01-16", vencimiento: "2027-06-30", temEmision: 2.58, pagoFinal: 156.037291 },
]

const POR_TICKER = new Map(CAP_TERMINOS.map((t) => [t.ticker, t]))

/** Condiciones de emisión de un ticker, o undefined si todavía no se cargaron. */
export function terminosDe(ticker: string): TerminosCapTicker | undefined {
  return POR_TICKER.get(ticker.trim().toUpperCase())
}
