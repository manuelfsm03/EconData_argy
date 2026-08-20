/**
 * Universo de bonos soberanos en pesos ajustados por CER (BONCER, Bono DUAL
 * CER/TAMAR) y LECER, más los Discount/Par pesos de la reestructuración
 * 2005/2010 que siguen en circulación.
 *
 * Cada ticker va con su VENCIMIENTO, y es lo único que se hardcodea acá.
 * A propósito: la fecha de vencimiento sale de la condición de emisión y no
 * cambia nunca, a diferencia del precio, la tasa o la paridad, que se toman en
 * vivo de la fuente justamente para no arrastrar datos viejos.
 *
 * Tener la fecha acá es lo que hace que un instrumento vencido se caiga SOLO
 * del panel. Antes esto era una lista de tickers pelados que había que podar a
 * mano, y el 20/8/2026 había cinco papeles ya vencidos —TZX26, TZXM6, X15Y6,
 * X29Y6 y X31L6— todavía entrando al screener con duration 0 y rendimientos
 * anualizados de 30% y pico que no significaban nada, además de deformar la
 * curva CER. Nadie los había sacado porque nada obligaba a acordarse.
 *
 * Excluye deuda provincial (Córdoba, Buenos Aires, Mendoza): es otra
 * categoría, igual que BOND_DEFS sólo cubre soberano nacional.
 */

export interface PesoBond {
  ticker: string
  /** Vencimiento en ISO, de la condición de emisión. */
  vencimiento: string
}

const UNIVERSO = [
  // BONCER Ley Argentina (canje 2020)
  { ticker: "TX26", vencimiento: "2026-11-09" },
  { ticker: "TX28", vencimiento: "2028-11-09" },
  { ticker: "TX31", vencimiento: "2031-11-30" },
  // Bono DUAL, CER/TAMAR + margen
  { ticker: "TXMD8", vencimiento: "2028-12-15" },
  { ticker: "TXMD9", vencimiento: "2029-12-14" },
  { ticker: "TXMJ0", vencimiento: "2030-06-28" },
  { ticker: "TXMJ8", vencimiento: "2028-06-30" },
  { ticker: "TXMJ9", vencimiento: "2029-06-29" },
  // BONCER cero cupón (Bono del Tesoro Nacional ajustado por CER)
  { ticker: "TZX26", vencimiento: "2026-06-30" },
  { ticker: "TZX27", vencimiento: "2027-06-30" },
  { ticker: "TZX28", vencimiento: "2028-06-30" },
  { ticker: "TZXA7", vencimiento: "2027-04-30" },
  { ticker: "TZXD6", vencimiento: "2026-12-15" },
  { ticker: "TZXD7", vencimiento: "2027-12-15" },
  { ticker: "TZXD8", vencimiento: "2028-12-15" },
  { ticker: "TZXM6", vencimiento: "2026-03-31" },
  { ticker: "TZXM7", vencimiento: "2027-03-31" },
  { ticker: "TZXM8", vencimiento: "2028-03-31" },
  { ticker: "TZXM9", vencimiento: "2029-03-28" },
  { ticker: "TZXO6", vencimiento: "2026-10-30" },
  { ticker: "TZXO7", vencimiento: "2027-10-29" },
  { ticker: "TZXS7", vencimiento: "2027-09-30" },
  { ticker: "TZXS8", vencimiento: "2028-09-29" },
  { ticker: "TZXY7", vencimiento: "2027-05-31" },
  // LECER, letras cero cupón ajustadas por CER
  { ticker: "X15Y6", vencimiento: "2026-05-15" },
  { ticker: "X29Y6", vencimiento: "2026-05-29" },
  { ticker: "X30N6", vencimiento: "2026-11-30" },
  { ticker: "X30S6", vencimiento: "2026-09-30" },
  { ticker: "X31L6", vencimiento: "2026-07-31" },
  // Discount/Par pesos CER, reestructuración 2005/2010
  { ticker: "DICP", vencimiento: "2033-12-31" },
  { ticker: "DIP0", vencimiento: "2033-12-31" },
  { ticker: "PAP0", vencimiento: "2038-12-31" },
  { ticker: "PARP", vencimiento: "2038-12-31" },
] as const satisfies readonly PesoBond[]

/**
 * TODOS los tickers del universo, vencidos incluidos.
 *
 * Contesta "¿este ticker es un bono en pesos?", que es una pregunta sobre
 * identidad y no sobre vigencia: a un papel vencido hay que poder decirle
 * "venció el tal día", no "no existe".
 */
export const PESO_BOND_TICKERS = UNIVERSO.map((b) => b.ticker)

export type PesoBondTicker = (typeof UNIVERSO)[number]["ticker"]

/**
 * Los que siguen vivos a una fecha. Es lo que tiene que consumir el panel.
 *
 * Se evalúa en cada llamada y no se congela en una constante de módulo: el
 * server vive semanas, y una lista calculada al importar seguiría mostrando un
 * bono vencido hasta el próximo deploy, que es exactamente el problema que
 * esto viene a resolver.
 */
export function pesoBondsVigentes(hoy: Date = new Date()): readonly PesoBond[] {
  const corte = hoy.toISOString().slice(0, 10)
  return UNIVERSO.filter((b) => b.vencimiento > corte)
}

/** Los ya vencidos a una fecha. Sirve para explicar por qué no están. */
export function pesoBondsVencidos(hoy: Date = new Date()): readonly PesoBond[] {
  const corte = hoy.toISOString().slice(0, 10)
  return UNIVERSO.filter((b) => b.vencimiento <= corte)
}

/** El vencimiento de un ticker, o null si no pertenece al universo. */
export function vencimientoDe(ticker: string): string | null {
  return UNIVERSO.find((b) => b.ticker === ticker.toUpperCase())?.vencimiento ?? null
}

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
