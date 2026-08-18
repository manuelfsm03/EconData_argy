/**
 * Calendario de reuniones de política monetaria de otros bancos centrales
 * relevantes (además de la Fed, que ya tiene su propio fomc-calendar.ts).
 * Mismo patrón: fechas fijas y públicas, anunciadas con antelación por
 * cada banco central, no requieren fetch en vivo.
 *
 * `fecha` es el día de la decisión (segundo día cuando la reunión dura
 * dos días, como BOJ); `fechaInicio` el primer día para quien quiera
 * mostrar el rango completo.
 */

export type CentralBankCode = "ECB" | "BOE" | "BOJ"

export interface CentralBankMeeting {
  fecha: string
  fechaInicio: string
  banco: CentralBankCode
  descripcion: string
}

const FUENTE_ECB = "European Central Bank — Governing Council monetary policy meetings (ecb.europa.eu/press/calendars/mgcgc), verificado 2026-08-17"
const FUENTE_BOE = "Bank of England — Monetary Policy Committee dates (bankofengland.co.uk/monetary-policy/upcoming-mpc-dates), verificado 2026-08-17"
const FUENTE_BOJ = "Bank of Japan — Scheduled Dates of Monetary Policy Meetings 2026 (boj.or.jp/en/mopo/mpmsche_minu), verificado 2026-08-17"

export const CENTRAL_BANK_MEETINGS_2026: CentralBankMeeting[] = [
  // ECB — Governing Council (decisión + conferencia de prensa el mismo día)
  { fecha: "2026-09-10", fechaInicio: "2026-09-09", banco: "ECB", descripcion: "Decisión de tasa BCE + conferencia de prensa" },
  { fecha: "2026-10-29", fechaInicio: "2026-10-28", banco: "ECB", descripcion: "Decisión de tasa BCE + conferencia de prensa" },
  { fecha: "2026-12-17", fechaInicio: "2026-12-16", banco: "ECB", descripcion: "Decisión de tasa BCE + conferencia de prensa" },

  // Bank of England — MPC (todos jueves, 12:00 hora UK)
  { fecha: "2026-09-17", fechaInicio: "2026-09-17", banco: "BOE", descripcion: "Decisión de tasa Bank of England (MPC)" },
  { fecha: "2026-11-05", fechaInicio: "2026-11-05", banco: "BOE", descripcion: "Decisión de tasa Bank of England (MPC) + Monetary Policy Report" },
  { fecha: "2026-12-17", fechaInicio: "2026-12-17", banco: "BOE", descripcion: "Decisión de tasa Bank of England (MPC)" },

  // Bank of Japan — Monetary Policy Meeting (2 días, decisión el segundo)
  { fecha: "2026-09-18", fechaInicio: "2026-09-17", banco: "BOJ", descripcion: "Decisión de política monetaria BOJ" },
  { fecha: "2026-10-30", fechaInicio: "2026-10-29", banco: "BOJ", descripcion: "Decisión de política monetaria BOJ" },
  { fecha: "2026-12-18", fechaInicio: "2026-12-17", banco: "BOJ", descripcion: "Decisión de política monetaria BOJ" },
]

export function centralBankMeetingsFrom(today: string): CentralBankMeeting[] {
  return CENTRAL_BANK_MEETINGS_2026.filter((m) => m.fecha >= today)
}

export function fuenteBancoCentral(banco: CentralBankCode): string {
  if (banco === "ECB") return FUENTE_ECB
  if (banco === "BOE") return FUENTE_BOE
  return FUENTE_BOJ
}
