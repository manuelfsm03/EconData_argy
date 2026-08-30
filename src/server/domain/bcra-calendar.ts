/**
 * Calendario de publicaciones del BCRA — REM (Relevamiento de Expectativas
 * de Mercado) e IPOM (Informe de Política Monetaria).
 *
 * A diferencia de una decisión de tasa (que el BCRA no fija con calendario
 * anticipado bajo el esquema de bandas actual), REM e IPOM sí tienen fecha
 * de publicación fija y anunciada de antemano por el propio organismo.
 *
 * Fuente: BCRA — Calendario de informes 2026
 * (bcra.gob.ar/en/reporting-calendar/, tabla oficial, verificado 2026-08-17).
 * El BCRA no publica esta tabla en español en una URL separada; el
 * contenido (nombres de informes y fechas) es el mismo en ambos idiomas.
 */

export interface BcraPublicacion {
  fecha: string
  indicador: "REM" | "IPOM"
  descripcion: string
}

const FUENTE_BCRA = "BCRA — Calendario de informes 2026 (bcra.gob.ar/en/reporting-calendar/), verificado 2026-08-17"

export const BCRA_REM_IPOM_2026: BcraPublicacion[] = [
  { fecha: "2026-01-07", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — diciembre 2025" },
  { fecha: "2026-01-08", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-02-05", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — enero 2026" },
  { fecha: "2026-03-05", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — febrero 2026" },
  { fecha: "2026-04-08", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — marzo 2026" },
  { fecha: "2026-04-09", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-05-07", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — abril 2026" },
  { fecha: "2026-05-08", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-06-04", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — mayo 2026" },
  { fecha: "2026-06-05", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-07-06", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — junio 2026" },
  { fecha: "2026-07-07", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-08-06", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — julio 2026" },
  { fecha: "2026-08-07", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-09-04", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — agosto 2026" },
  { fecha: "2026-09-09", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-10-06", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — septiembre 2026" },
  { fecha: "2026-10-07", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-11-05", indicador: "REM", descripcion: "Relevamiento de Expectativas de Mercado — octubre 2026" },
  { fecha: "2026-11-09", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
  { fecha: "2026-12-09", indicador: "IPOM", descripcion: "Informe de Política Monetaria" },
]

export function bcraPublicacionesFrom(today: string): BcraPublicacion[] {
  return BCRA_REM_IPOM_2026.filter((p) => p.fecha >= today)
}

export { FUENTE_BCRA }
