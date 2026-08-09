/**
 * Precios de mercado de los bonos.
 *
 * PROVISORIO. Todavía no está definido de dónde se van a bajar los precios
 * (ByMA, Rava, entrada manual, otra cosa), así que por ahora se cargan a mano.
 *
 * Cada precio declara su fuente y su fecha, y `estaVigente()` avisa cuando
 * quedó viejo. La regla 2 del ROADMAP dice que si el dato no es confiable no se
 * muestra: un precio cargado a mano hace tres meses NO es un precio de mercado,
 * y la UI tiene que poder distinguirlo de uno en vivo en vez de dibujarlo igual.
 *
 * Cuando se conecte la fuente real, lo único que cambia es de dónde sale
 * `precioDirty`. Todo el motor de cálculo queda igual.
 */

import { fechaUTC } from "./market-calendar"

export type FuentePrecio = "planilla-referencia" | "manual" | "byma" | "rava"

export interface PrecioBono {
  ticker: string
  /** Precio con intereses corridos incluidos (dirty), por cada 100 de VN. */
  precioDirty: number
  /** Fecha de concertación de la operación, YYYY-MM-DD. */
  fechaConcertacion: string
  /** Liquidación efectiva. Para estos bonos es T+1 hábil. */
  fechaLiquidacion: string
  fuente: FuentePrecio
  nota?: string
}

/**
 * Un precio cargado a mano deja de ser representativo enseguida. Este umbral
 * es deliberadamente corto para que la UI marque "fuente no conectada" en vez
 * de mostrar un número viejo como si fuera de hoy.
 */
export const DIAS_TOLERANCIA_PRECIO = 5

export const PRECIOS: PrecioBono[] = [
  {
    ticker: "GD30",
    precioDirty: 64.44,
    fechaConcertacion: "2026-04-27",
    fechaLiquidacion: "2026-04-28",
    fuente: "planilla-referencia",
    nota: "Celda B16 de la hoja GD30 de la planilla del equipo. Es el precio con el que se verifica el motor, no un precio en vivo.",
  },
]

export function precioDe(ticker: string): PrecioBono | undefined {
  return PRECIOS.find((p) => p.ticker === ticker)
}

/** Antigüedad del precio en días respecto de una fecha de referencia. */
export function antiguedadEnDias(precio: PrecioBono, hoy: Date): number {
  const ms = hoy.getTime() - fechaUTC(precio.fechaConcertacion).getTime()
  return Math.floor(ms / 86_400_000)
}

export function estaVigente(precio: PrecioBono, hoy: Date): boolean {
  return antiguedadEnDias(precio, hoy) <= DIAS_TOLERANCIA_PRECIO
}
