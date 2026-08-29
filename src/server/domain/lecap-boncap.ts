/**
 * LECAPs y BONCAPs -- letras y bonos del Tesoro a tasa fija capitalizable.
 *
 * El catálogo abierto de BYMA (endpoint "lebacs") solo lista LECAP (prefijo
 * S) -- confirmado bajando el JSON crudo del endpoint: 640 filas, 0 con
 * prefijo T. Los BONCAP (prefijo T) no aparecen ahí, pero BYMA SÍ tiene
 * precio en vivo para ellos por el endpoint de historical-series usando el
 * símbolo "TICKER 24HS" (probado con curl: T15E7/T30A7/T31Y7/T30J7 devuelven
 * series reales). Por eso acá se mantiene una lista curada -- para no
 * depender de un catálogo que le falta la mitad del universo.
 *
 * "pxFinish" es lo que paga el instrumento al vencimiento por cada 100 de
 * VN -- un dato ESTRUCTURAL fijado en la emisión (como el cupón de un bono),
 * no un precio de mercado. No lo calcula ninguna API: viene de Pista
 * (equipo), 2026-08-22, cruzado contra Rava (rava.com/perfil/T15E7 confirma
 * vencimiento 15/01/27 para T15E7) y contra los códigos de mes estándar del
 * mercado (E=enero F=febrero M=marzo A=abril Y=mayo J=junio L=julio G=agosto
 * S=septiembre O=octubre N=noviembre D=diciembre) para verificar cada
 * vencimiento de forma independiente antes de cargarlo.
 */

export type CapTipo = "LECAP" | "BONCAP"

export interface CapInstrumentoCurado {
  ticker: string
  tipo: CapTipo
  vencimiento: string // YYYY-MM-DD
  /**
   * Pago al vencimiento por cada 100 de VN. null = todavía no confirmado --
   * el dato que llegó para S30S6 ("26/4/1900") es un artefacto de fecha de
   * Excel (una celda vacía o mal tipeada que Excel formateó como fecha), no
   * un número real. Se deja el hueco en vez de inventar un valor.
   */
  pxFinish: number | null
}

export const CAP_INSTRUMENTOS_CURADOS: CapInstrumentoCurado[] = [
  { ticker: "S31G6", tipo: "LECAP", vencimiento: "2026-08-31", pxFinish: 127.0642 },
  { ticker: "S15S6", tipo: "LECAP", vencimiento: "2026-09-15", pxFinish: 107.21 },
  { ticker: "S30S6", tipo: "LECAP", vencimiento: "2026-09-30", pxFinish: null },
  { ticker: "S16O6", tipo: "LECAP", vencimiento: "2026-10-16", pxFinish: 105.275 },
  { ticker: "S30O6", tipo: "LECAP", vencimiento: "2026-10-30", pxFinish: 135.278 },
  { ticker: "S13N6", tipo: "LECAP", vencimiento: "2026-11-13", pxFinish: 109.651 },
  { ticker: "S30N6", tipo: "LECAP", vencimiento: "2026-11-30", pxFinish: 129.888 },
  { ticker: "T15E7", tipo: "BONCAP", vencimiento: "2027-01-15", pxFinish: 161.104 },
  { ticker: "T30A7", tipo: "BONCAP", vencimiento: "2027-04-30", pxFinish: 157.341 },
  { ticker: "T31Y7", tipo: "BONCAP", vencimiento: "2027-05-31", pxFinish: 151.563 },
  { ticker: "T30J7", tipo: "BONCAP", vencimiento: "2027-06-30", pxFinish: 156.037 },
]
