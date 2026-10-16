/**
 * Catálogo ESTÁTICO de respaldo para la familia dollar-linked.
 *
 * Está VACÍO a propósito: no se cargan tickers de memoria. El universo se
 * descubre en vivo desde BYMA Open Data (ver src/server/domain/dollar-linked.ts
 * y la env BYMA_DL_UNIVERSE_URL). Este catálogo sólo sirve como red de
 * seguridad si el descubrimiento falla o todavía no está configurado.
 *
 * Cómo completarlo: tomar el ticker y el vencimiento del prospecto / aviso de
 * licitación del Tesoro (o del listado público de BYMA), un instrumento por
 * línea, y citar la fuente en `fuente`. Un ticker sin fuente no entra.
 */
export interface InstrumentoDollarLinked {
  ticker: string
  /** YYYY-MM-DD; opcional si no se pudo verificar. */
  vencimiento?: string
  /** Documento o URL donde se verificó el instrumento. */
  fuente: string
}

export const DOLLAR_LINKED_CATALOGO: readonly InstrumentoDollarLinked[] = []
