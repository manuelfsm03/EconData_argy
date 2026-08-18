/**
 * Calendario de difusión del BCRA — REM (Relevamiento de Expectativas de
 * Mercado). Mismo patrón que fomc-calendar.ts / indec-calendar.ts: fechas
 * fijas y públicas, publicadas con antelación por el organismo oficial,
 * no requieren fetch en vivo.
 *
 * Fuente: BCRA — Calendario de informes/reporting-calendar
 * (bcra.gob.ar/en/reporting-calendar), verificado 2026-08-17.
 *
 * Nota sobre el calendario oficial: lista fechas de enero a noviembre 2026
 * para el REM; diciembre 2026 no figura publicado todavía en esa página al
 * momento de verificar — no se completa a mano, se deja afuera hasta que
 * el organismo lo confirme (mismo criterio de no inventar fechas).
 *
 * IPOM (Informe de Política Monetaria): investigado, NO cargado en esta
 * pasada — mismo caso que Eurozona en intl-cpi-calendar.ts. Se confirmó
 * que es trimestral (T1 2026 publicado 15/5, T2 2026 publicado en junio,
 * T4 2025 publicado en diciembre 2025 — PDFs oficiales en
 * bcra.gob.ar/archivos/.../informe-politica-monetaria-2026-T{n}.pdf) pero
 * el calendario de informes del BCRA NO lista "IPOM" como categoría con
 * fechas futuras pre-anunciadas (a diferencia del REM, que sí tiene
 * calendario fijo) — solo aparece un "Monthly Monetary Report" distinto,
 * mensual, que no es lo mismo. No hay fuente única y verificable con las
 * fechas de T3 y T4 2026 todavía, así que queda sin cargar en vez de
 * estimar un trimestre a ojo.
 */

export interface RemPublicacion {
  fecha: string
  descripcion: string
}

const FUENTE_REM = "BCRA — Calendario de informes (bcra.gob.ar/en/reporting-calendar), verificado 2026-08-17"

export const REM_PUBLICACIONES_2026: RemPublicacion[] = [
  { fecha: "2026-01-07", descripcion: "Publicación REM — relevamiento diciembre 2025" },
  { fecha: "2026-02-05", descripcion: "Publicación REM — relevamiento enero 2026" },
  { fecha: "2026-03-05", descripcion: "Publicación REM — relevamiento febrero 2026" },
  { fecha: "2026-04-08", descripcion: "Publicación REM — relevamiento marzo 2026" },
  { fecha: "2026-05-07", descripcion: "Publicación REM — relevamiento abril 2026" },
  { fecha: "2026-06-04", descripcion: "Publicación REM — relevamiento mayo 2026" },
  { fecha: "2026-07-06", descripcion: "Publicación REM — relevamiento junio 2026" },
  { fecha: "2026-08-06", descripcion: "Publicación REM — relevamiento julio 2026" },
  { fecha: "2026-09-04", descripcion: "Publicación REM — relevamiento agosto 2026" },
  { fecha: "2026-10-06", descripcion: "Publicación REM — relevamiento septiembre 2026" },
  { fecha: "2026-11-05", descripcion: "Publicación REM — relevamiento octubre 2026" },
]

export function remPublicacionesFrom(today: string): RemPublicacion[] {
  return REM_PUBLICACIONES_2026.filter((p) => p.fecha >= today)
}

export { FUENTE_REM }
