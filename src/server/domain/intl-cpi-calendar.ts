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
  pais: "US" | "JP" | "GB" | "EU"
  descripcion: string
}

const FUENTE_US_CPI = "US Bureau of Labor Statistics — CPI release schedule (bls.gov/schedule/news_release/cpi.htm), verificado 2026-08-17"
const FUENTE_JP_CPI = "Statistics Bureau of Japan — CPI Schedule of Release (stat.go.jp/english/data/cpi/1582.html), verificado 2026-08-17"
const FUENTE_GB_CPI = "UK Office for National Statistics — Consumer price inflation release calendar (ons.gov.uk/economy/inflationandpriceindices/bulletins/consumerpriceinflation), verificado 2026-08-17"
const FUENTE_EU_HICP = "European Central Bank — Release calendar for the Euro area seasonally adjusted HICP statistics (ecb.europa.eu/press/calendars/statscal/ges/html/sthicp.en.html), verificado 2026-08-17"

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

/** ONS -- Consumer price inflation, UK. Publicado ~7am, cubre el mes anterior. */
export const UK_CPI_2026: CpiPublicacion[] = [
  { fecha: "2026-01-21", pais: "GB", descripcion: "CPI Reino Unido — diciembre 2025" },
  { fecha: "2026-02-18", pais: "GB", descripcion: "CPI Reino Unido — enero 2026" },
  { fecha: "2026-03-25", pais: "GB", descripcion: "CPI Reino Unido — febrero 2026" },
  { fecha: "2026-04-22", pais: "GB", descripcion: "CPI Reino Unido — marzo 2026" },
  { fecha: "2026-05-20", pais: "GB", descripcion: "CPI Reino Unido — abril 2026" },
  { fecha: "2026-06-17", pais: "GB", descripcion: "CPI Reino Unido — mayo 2026" },
  { fecha: "2026-07-22", pais: "GB", descripcion: "CPI Reino Unido — junio 2026" },
  { fecha: "2026-08-19", pais: "GB", descripcion: "CPI Reino Unido — julio 2026" },
  { fecha: "2026-09-16", pais: "GB", descripcion: "CPI Reino Unido — agosto 2026" },
  { fecha: "2026-10-21", pais: "GB", descripcion: "CPI Reino Unido — septiembre 2026" },
  { fecha: "2026-11-18", pais: "GB", descripcion: "CPI Reino Unido — octubre 2026" },
  { fecha: "2026-12-16", pais: "GB", descripcion: "CPI Reino Unido — noviembre 2026" },
]

/**
 * HICP Eurozona -- resuelto en un reintento con un ángulo distinto a los
 * 3 que habían fallado antes (calendario JS de Eurostat, investing.com,
 * feed .ics caído): el propio BCE publica su calendario estadístico del
 * HICP en una página HTML con fechas concretas hasta principios de 2027
 * (ecb.europa.eu/press/calendars/statscal/ges/html/sthicp.en.html),
 * verificado con curl+parseo de texto plano, no por resumen de IA. Incluye
 * dos publicaciones por mes: el "flash estimate" (~mediados del mes
 * siguiente) y el dato final con desagregación completa (~1-6 del mes
 * subsiguiente). Solo hay fechas confirmadas desde septiembre 2026 en
 * adelante -- el calendario del BCE no publica hacia atrás ni el año
 * completo de una sola vez.
 */
export const EU_HICP_2026: CpiPublicacion[] = [
  { fecha: "2026-09-01", pais: "EU", descripcion: "HICP Eurozona (dato final) — julio 2026" },
  { fecha: "2026-09-17", pais: "EU", descripcion: "HICP Eurozona (estimación flash) — agosto 2026" },
  { fecha: "2026-10-02", pais: "EU", descripcion: "HICP Eurozona (dato final) — agosto 2026" },
  { fecha: "2026-10-16", pais: "EU", descripcion: "HICP Eurozona (estimación flash) — septiembre 2026" },
  { fecha: "2026-11-04", pais: "EU", descripcion: "HICP Eurozona (dato final) — septiembre 2026" },
  { fecha: "2026-11-18", pais: "EU", descripcion: "HICP Eurozona (estimación flash) — octubre 2026" },
  { fecha: "2026-12-01", pais: "EU", descripcion: "HICP Eurozona (dato final) — octubre 2026" },
  { fecha: "2026-12-17", pais: "EU", descripcion: "HICP Eurozona (estimación flash) — noviembre 2026" },
]

export const INTL_CPI_2026: CpiPublicacion[] = [...US_CPI_2026, ...JAPAN_CPI_2026, ...UK_CPI_2026, ...EU_HICP_2026]

export function fuenteDe(pais: "US" | "JP" | "GB" | "EU"): string {
  if (pais === "US") return FUENTE_US_CPI
  if (pais === "JP") return FUENTE_JP_CPI
  if (pais === "EU") return FUENTE_EU_HICP
  return FUENTE_GB_CPI
}
