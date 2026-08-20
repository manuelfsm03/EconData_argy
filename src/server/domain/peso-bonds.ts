/**
 * Universo de bonos soberanos en pesos ajustados por CER (BONCER, Bono DUAL
 * CER/TAMAR) y LECER, más los Discount/Par pesos de la reestructuración
 * 2005/2010 que siguen en circulación.
 *
 * Es sólo la lista de tickers a trackear: nombre, precio, TIR, duration,
 * paridad y vencimiento se toman en vivo de Rava (ver /api/bonos?tipo=pesos),
 * no se hardcodean acá para no arrastrar datos desactualizados o mal
 * transcriptos. Excluye deuda provincial (Córdoba, Buenos Aires, Mendoza):
 * es otra categoría, igual que BOND_DEFS sólo cubre soberano nacional.
 */

export const PESO_BOND_TICKERS = [
  // BONCER Ley Argentina (canje 2020)
  "TX26", "TX28", "TX31",
  // Bono DUAL, CER/TAMAR + margen
  "TXMD8", "TXMD9", "TXMJ0", "TXMJ8", "TXMJ9",
  // BONCER / Bono del Tesoro Nacional ajustado por CER
  "TZX26", "TZX27", "TZX28", "TZXA7", "TZXD6", "TZXD7", "TZXD8",
  "TZXM6", "TZXM7", "TZXM8", "TZXM9", "TZXO6", "TZXO7", "TZXS7", "TZXS8", "TZXY7",
  // LECER, letras cero cupón ajustadas por CER
  "X15Y6", "X29Y6", "X30N6", "X30S6", "X31L6",
  // Discount/Par pesos CER, reestructuración 2005/2010
  "DICP", "DIP0", "PAP0", "PARP",
] as const

export type PesoBondTicker = (typeof PESO_BOND_TICKERS)[number]

/**
 * Las familias en que se divide la renta fija en pesos.
 *
 * No es una taxonomía cosmética: cada familia se lee con una tasa distinta y
 * mezclarlas en una misma tabla hace comparar cosas que no se comparan.
 *
 *  - `cer`: BONCER y LECER. El flujo está en unidades CER, así que el número
 *    que publica el mercado es la TASA REAL, cotizada como "CER + X%". Una TIR
 *    nominal para estos bonos no existe sin proyectar inflación.
 *  - `dual`: pagan el máximo entre CER y TAMAR, o sea que llevan una
 *    opcionalidad adentro. Ni siquiera la tasa real los describe del todo.
 *  - `lecap`: tasa fija en pesos, y ahí sí la TEM/TNA es directamente el
 *    rendimiento.
 */
export type FamiliaPesos = "cer" | "dual" | "lecap"

export function familiaDe(ticker: string): FamiliaPesos {
  const t = ticker.toUpperCase()
  // Los duales arrancan todos con TXM (TXMD8, TXMJ0…). Va primero porque si no
  // el prefijo "TX" de los BONCER se los lleva puestos.
  if (t.startsWith("TXM")) return "dual"
  return "cer"
}

/** Los CER puros: BONCER, LECER y los Discount/Par de la reestructuración. */
export const CER_TICKERS = PESO_BOND_TICKERS.filter((t) => familiaDe(t) === "cer")

/** Los duales CER/TAMAR. */
export const DUAL_TICKERS = PESO_BOND_TICKERS.filter((t) => familiaDe(t) === "dual")
