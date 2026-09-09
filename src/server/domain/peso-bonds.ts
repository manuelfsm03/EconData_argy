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
  /**
   * Si paga cupones o no, también de la condición de emisión.
   *
   * Está acá y no se deduce del nombre que manda la fuente de precios por un
   * motivo concreto: el 9/9/2026 Rava empezó a publicar `nombre` con sólo el
   * ticker ("TX26") en vez de la descripción completa ("BONCER (canje 2020)
   * 2026 $ ajustado por CER 2%") — 382 de 887 filas medidas ese día. Como la
   * detección de cero cupón buscaba "0%" DENTRO de ese nombre, de 28 bonos en
   * pesos pasó a reconocer 2, y la calculadora empezó a contestar "paga
   * cupones, falta el prospecto" a papeles que son cero cupón por emisión.
   *
   * Un feed de precios describe el PRECIO. La estructura del instrumento es
   * nuestra y no puede depender de que un tercero mantenga un string.
   */
  cupon: "cero" | "con_cupon"
}

const UNIVERSO = [
  // BONCER Ley Argentina (canje 2020) — pagan cupón semestral.
  { ticker: "TX26", vencimiento: "2026-11-09", cupon: "con_cupon" },   // CER 2%
  { ticker: "TX28", vencimiento: "2028-11-09", cupon: "con_cupon" },   // CER 2,25%
  { ticker: "TX31", vencimiento: "2031-11-30", cupon: "con_cupon" },   // CER 2,50%
  // Bono DUAL, CER/TAMAR + margen. Pagan cupón Y llevan opcionalidad adentro.
  { ticker: "TXMD8", vencimiento: "2028-12-15", cupon: "con_cupon" },  // CER/TAMAR + 3%
  { ticker: "TXMD9", vencimiento: "2029-12-14", cupon: "con_cupon" },
  { ticker: "TXMJ0", vencimiento: "2030-06-28", cupon: "con_cupon" },
  { ticker: "TXMJ8", vencimiento: "2028-06-30", cupon: "con_cupon" },
  { ticker: "TXMJ9", vencimiento: "2029-06-29", cupon: "con_cupon" },
  // BONCER cero cupón (Bono del Tesoro Nacional ajustado por CER). Los TZX26/27/28
  // se emiten como "BONO DEL TESORO NACIONAL EN PESOS CERO CUPÓN CON AJUSTE POR
  // CER"; el resto se publica directamente como "0%".
  { ticker: "TZX26", vencimiento: "2026-06-30", cupon: "cero" },
  { ticker: "TZX27", vencimiento: "2027-06-30", cupon: "cero" },
  { ticker: "TZX28", vencimiento: "2028-06-30", cupon: "cero" },
  { ticker: "TZXA7", vencimiento: "2027-04-30", cupon: "cero" },
  { ticker: "TZXD6", vencimiento: "2026-12-15", cupon: "cero" },
  { ticker: "TZXD7", vencimiento: "2027-12-15", cupon: "cero" },
  { ticker: "TZXD8", vencimiento: "2028-12-15", cupon: "cero" },
  { ticker: "TZXM6", vencimiento: "2026-03-31", cupon: "cero" },
  { ticker: "TZXM7", vencimiento: "2027-03-31", cupon: "cero" },
  { ticker: "TZXM8", vencimiento: "2028-03-31", cupon: "cero" },
  { ticker: "TZXM9", vencimiento: "2029-03-28", cupon: "cero" },
  { ticker: "TZXO6", vencimiento: "2026-10-30", cupon: "cero" },
  { ticker: "TZXO7", vencimiento: "2027-10-29", cupon: "cero" },
  { ticker: "TZXS7", vencimiento: "2027-09-30", cupon: "cero" },
  { ticker: "TZXS8", vencimiento: "2028-09-29", cupon: "cero" },
  { ticker: "TZXY7", vencimiento: "2027-05-31", cupon: "cero" },
  // LECER, letras cero cupón ajustadas por CER.
  { ticker: "X15Y6", vencimiento: "2026-05-15", cupon: "cero" },
  { ticker: "X29Y6", vencimiento: "2026-05-29", cupon: "cero" },
  { ticker: "X30N6", vencimiento: "2026-11-30", cupon: "cero" },
  { ticker: "X30S6", vencimiento: "2026-09-30", cupon: "cero" },
  { ticker: "X31L6", vencimiento: "2026-07-31", cupon: "cero" },
  // Discount/Par pesos CER (reestructuración 2005/2010): pagan cupón, y el Par
  // además es step-up. Quedan fuera del cálculo de tasa real por cero cupón.
  { ticker: "DICP", vencimiento: "2033-12-31", cupon: "con_cupon" },   // CER + 5,83%
  { ticker: "DIP0", vencimiento: "2033-12-31", cupon: "con_cupon" },   // CER + 5,83%
  { ticker: "PAP0", vencimiento: "2038-12-31", cupon: "con_cupon" },   // step-up
  { ticker: "PARP", vencimiento: "2038-12-31", cupon: "con_cupon" },   // CER + 1,77%
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
 * Si el ticker es cero cupón por condición de emisión.
 *
 * Devuelve `null` —y no `false`— cuando el papel no está en el catálogo: no es
 * lo mismo "sé que paga cupones" que "no lo tengo cargado". Quien llame decide
 * qué hacer con la diferencia; en la práctica se cae al nombre publicado, que
 * es mejor que nada pero no es confiable (ver el comentario de `cupon`).
 */
export function cuponDe(ticker: string): "cero" | "con_cupon" | null {
  return UNIVERSO.find((b) => b.ticker === ticker.toUpperCase())?.cupon ?? null
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
