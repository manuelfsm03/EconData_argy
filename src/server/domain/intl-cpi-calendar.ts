/**
 * Calendarios de publicación de inflación (CPI) de otros países — mismo
 * patrón que fomc-calendar.ts e indec-calendar.ts: fechas fijas y públicas,
 * anunciadas con antelación por el organismo oficial, no requieren fetch
 * en vivo.
 *
 * Pedido explícito: EEUU, Japón (más países quedan para sumar después,
 * ver nota sobre Eurozona al final del archivo).
 */

export interface CpiPublicacion {
  fecha: string
  pais: "US" | "JP"
  descripcion: string
}

const FUENTE_US_CPI = "US Bureau of Labor Statistics — CPI release schedule (bls.gov/schedule/news_release/cpi.htm), verificado 2026-08-17"
const FUENTE_JP_CPI = "Statistics Bureau of Japan — CPI Schedule of Release (stat.go.jp/english/data/cpi/1582.html), verificado 2026-08-17"

export const US_CPI_2026: CpiPublicacion[] = [
  { fecha: "2026-01-13", pais: "US", descripcion: "CPI EEUU — diciembre 2025" },
  { fecha: "2026-02-13", pais: "US", descripcion: "CPI EEUU — enero 2026" },
  { fecha: "2026-03-11", pais: "US", descripcion: "CPI EEUU — febrero 2026" },
  { fecha: "2026-04-10", pais: "US", descripcion: "CPI EEUU — marzo 2026" },
  { fecha: "2026-05-12", pais: "US", descripcion: "CPI EEUU — abril 2026" },
  { fecha: "2026-06-10", pais: "US", descripcion: "CPI EEUU — mayo 2026" },
  { fecha: "2026-07-14", pais: "US", descripcion: "CPI EEUU — junio 2026" },
  { fecha: "2026-08-12", pais: "US", descripcion: "CPI EEUU — julio 2026" },
  { fecha: "2026-09-11", pais: "US", descripcion: "CPI EEUU — agosto 2026" },
  { fecha: "2026-10-14", pais: "US", descripcion: "CPI EEUU — septiembre 2026" },
  { fecha: "2026-11-10", pais: "US", descripcion: "CPI EEUU — octubre 2026" },
  { fecha: "2026-12-10", pais: "US", descripcion: "CPI EEUU — noviembre 2026" },
]

/**
 * Fechas del "Schedule of Release" oficial de Japón. Nota honesta: la
 * página oficial no distingue explícitamente si es el CPI nacional o el de
 * Tokio (que suele publicarse más rápido) -- se cita la fecha y la fuente
 * exacta tal cual figuran ahí; quien lo revise puede ajustar el rótulo si
 * hace falta.
 */
export const JAPAN_CPI_2026: CpiPublicacion[] = [
  { fecha: "2026-01-30", pais: "JP", descripcion: "CPI Japón — enero 2026" },
  { fecha: "2026-02-27", pais: "JP", descripcion: "CPI Japón — febrero 2026" },
  { fecha: "2026-03-31", pais: "JP", descripcion: "CPI Japón — marzo 2026" },
  { fecha: "2026-05-01", pais: "JP", descripcion: "CPI Japón — abril 2026" },
  { fecha: "2026-05-29", pais: "JP", descripcion: "CPI Japón — mayo 2026" },
  { fecha: "2026-06-26", pais: "JP", descripcion: "CPI Japón — junio 2026" },
  { fecha: "2026-07-31", pais: "JP", descripcion: "CPI Japón — julio 2026" },
  { fecha: "2026-08-28", pais: "JP", descripcion: "CPI Japón — agosto 2026" },
  { fecha: "2026-10-02", pais: "JP", descripcion: "CPI Japón — septiembre 2026" },
  { fecha: "2026-10-30", pais: "JP", descripcion: "CPI Japón — octubre 2026" },
  { fecha: "2026-11-27", pais: "JP", descripcion: "CPI Japón — noviembre 2026" },
  { fecha: "2026-12-25", pais: "JP", descripcion: "CPI Japón — diciembre 2026" },
]

export const INTL_CPI_2026: CpiPublicacion[] = [...US_CPI_2026, ...JAPAN_CPI_2026]

export function fuenteDe(pais: "US" | "JP"): string {
  return pais === "US" ? FUENTE_US_CPI : FUENTE_JP_CPI
}

/**
 * Eurozona (ECB/Eurostat): investigado pero NO cargado en esta pasada.
 * Se encontró el patrón (flash estimate publicado el último día hábil del
 * mes de referencia, HICP completo ~20 del mes siguiente) y 5 fechas
 * puntuales confirmadas via Eurostat, pero no una fuente única con el
 * calendario completo y verificable de 2026 -- tanto el calendario oficial
 * de Eurostat como el de investing.com/es/economic-calendar son
 * herramientas interactivas (JS) que solo muestran el día actual en un
 * fetch estático, no exponen el año completo. Queda pendiente para quien
 * lo retome, con este punto de partida en vez de arrancar de cero.
 */
