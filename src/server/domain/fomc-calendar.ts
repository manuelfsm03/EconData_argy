/**
 * Calendario de reuniones FOMC 2026. Fechas fijas y públicas, no requieren
 * fetch en vivo: la Fed las publica con casi un año de antelación y no
 * cambian. `fecha` es el segundo día de cada reunión (cuando se anuncia la
 * decisión de tasa, 2pm ET); `fechaInicio` es el primer día para quien
 * quiera mostrar el rango completo.
 *
 * Fuente: Federal Reserve — federalreserve.gov/monetarypolicy/fomccalendars.htm
 * (verificado 2026-08-12).
 */

export interface FomcMeeting {
  fecha: string
  fechaInicio: string
  tipo: "FOMC"
  descripcion: string
  proyecciones: boolean
}

const FUENTE_FOMC = "Federal Reserve — federalreserve.gov/monetarypolicy/fomccalendars.htm, verificado 2026-08-12"

export const FOMC_MEETINGS_2026: FomcMeeting[] = [
  { fecha: "2026-01-28", fechaInicio: "2026-01-27", tipo: "FOMC", descripcion: "Decisión de tasa Fed", proyecciones: false },
  { fecha: "2026-03-18", fechaInicio: "2026-03-17", tipo: "FOMC", descripcion: "Decisión de tasa Fed + proyecciones económicas", proyecciones: true },
  { fecha: "2026-04-29", fechaInicio: "2026-04-28", tipo: "FOMC", descripcion: "Decisión de tasa Fed", proyecciones: false },
  { fecha: "2026-06-17", fechaInicio: "2026-06-16", tipo: "FOMC", descripcion: "Decisión de tasa Fed + proyecciones económicas", proyecciones: true },
  { fecha: "2026-07-29", fechaInicio: "2026-07-28", tipo: "FOMC", descripcion: "Decisión de tasa Fed", proyecciones: false },
  { fecha: "2026-09-16", fechaInicio: "2026-09-15", tipo: "FOMC", descripcion: "Decisión de tasa Fed + proyecciones económicas", proyecciones: true },
  { fecha: "2026-10-28", fechaInicio: "2026-10-27", tipo: "FOMC", descripcion: "Decisión de tasa Fed", proyecciones: false },
  { fecha: "2026-12-09", fechaInicio: "2026-12-08", tipo: "FOMC", descripcion: "Decisión de tasa Fed + proyecciones económicas", proyecciones: true },
]

export function fomcMeetingsFrom(today: string): FomcMeeting[] {
  return FOMC_MEETINGS_2026.filter((m) => m.fecha >= today)
}

export { FUENTE_FOMC }
