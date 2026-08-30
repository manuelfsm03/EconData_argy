/**
 * Calendario de difusión de INDEC — fechas de publicación de IPC y EMAE.
 * Igual que fomc-calendar.ts: fechas fijas y públicas, publicadas con
 * antelación por el organismo oficial, no requieren fetch en vivo.
 *
 * Fuente: INDEC — Calendario de difusión, segundo semestre de 2026
 * (indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf,
 * actualizado al 1/7/2026, verificado 2026-08-17).
 *
 * Solo IPC y EMAE por ahora (lo que Juan pidió explícitamente). El
 * calendario de INDEC tiene decenas de indicadores más -- se puede sumar
 * REM/IPOM (BCRA, fuente distinta) o el resto de INDEC más adelante.
 */

export interface IndecPublicacion {
  fecha: string
  indicador: "IPC" | "EMAE"
  descripcion: string
}

const FUENTE_INDEC = "INDEC — Calendario de difusión, segundo semestre de 2026 (indec.gob.ar/ftp/cuadros/publicaciones/calendario_2sem2026.pdf), verificado 2026-08-17"

export const INDEC_PUBLICACIONES_2026: IndecPublicacion[] = [
  { fecha: "2026-07-14", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, junio 2026" },
  { fecha: "2026-07-22", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — mayo 2026" },
  { fecha: "2026-08-13", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, julio 2026" },
  { fecha: "2026-08-20", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — junio 2026" },
  { fecha: "2026-09-10", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, agosto 2026" },
  { fecha: "2026-09-24", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — julio 2026" },
  { fecha: "2026-10-13", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, septiembre 2026" },
  { fecha: "2026-10-21", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — agosto 2026" },
  { fecha: "2026-11-12", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, octubre 2026" },
  { fecha: "2026-11-24", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — septiembre 2026" },
  { fecha: "2026-12-15", indicador: "IPC", descripcion: "Índice de precios al consumidor — cobertura nacional, noviembre 2026" },
  { fecha: "2026-12-21", indicador: "EMAE", descripcion: "Estimador mensual de actividad económica — octubre 2026" },
]

export function indecPublicacionesFrom(today: string): IndecPublicacion[] {
  return INDEC_PUBLICACIONES_2026.filter((p) => p.fecha >= today)
}

export { FUENTE_INDEC }
