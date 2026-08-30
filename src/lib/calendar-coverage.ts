export type CalendarCoverageStatus = "official" | "estimated" | "pending"
export type CalendarCoverageKey =
  | "bono:AR" | "fomc:US" | "indec:AR" | "bcra:AR"
  | "intl_cpi:US" | "intl_cpi:JP" | "intl_cpi:GB" | "intl_cpi:EU"
  | "banco_central:EU" | "banco_central:GB" | "banco_central:JP"
  | "latam_cpi:BR" | "latam_cpi:MX" | "latam_cpi:CL"
  | "latam_banco_central:BR" | "latam_banco_central:CL" | "latam_banco_central:MX"
  | "earnings:AR" | "earnings:US"

export interface CoverageDefinition {
  status: CalendarCoverageStatus
  label: string
  scope: string
  limitation?: string
}
export interface CalendarCoverage extends CoverageDefinition {
  source: string
  verifiedAt?: string
}

/** Stable classification only; source and evidence date come from each canonical event. */
export const CALENDAR_COVERAGE_REGISTRY: Record<CalendarCoverageKey, CoverageDefinition> = {
  "bono:AR": { status: "official", label: "Oficial", scope: "Bonos soberanos argentinos con esquema de cashflows cargado" },
  "fomc:US": { status: "official", label: "Oficial", scope: "Reuniones FOMC 2026" },
  "indec:AR": { status: "official", label: "Oficial", scope: "Publicaciones IPC y EMAE 2026" },
  "bcra:AR": { status: "official", label: "Oficial", scope: "REM e IPOM 2026" },
  "intl_cpi:US": { status: "official", label: "Oficial", scope: "CPI de EEUU 2026" },
  "intl_cpi:JP": { status: "official", label: "Oficial", scope: "CPI de Japón 2026 según el schedule publicado", limitation: "La página no distingue explícitamente CPI nacional de CPI de Tokio." },
  "intl_cpi:GB": { status: "official", label: "Oficial", scope: "CPI de Reino Unido 2026" },
  "intl_cpi:EU": { status: "official", label: "Oficial", scope: "Fechas HICP Eurozona confirmadas desde septiembre de 2026", limitation: "El calendario del BCE no publica una tabla anual completa ni fechas confirmadas anteriores a septiembre de 2026." },
  "banco_central:EU": { status: "official", label: "Oficial", scope: "Reuniones BCE 2026" },
  "banco_central:GB": { status: "official", label: "Oficial", scope: "Reuniones BOE 2026" },
  "banco_central:JP": { status: "official", label: "Oficial", scope: "Reuniones BOJ 2026" },
  "latam_cpi:BR": { status: "official", label: "Oficial", scope: "IPCA Brasil con fechas publicadas hasta noviembre de 2026" },
  "latam_cpi:MX": { status: "official", label: "Oficial", scope: "INPC México: agosto de 2026, única próxima publicación confirmada", limitation: "INEGI no publica una tabla anual del mismo indicador; cada boletín mensual confirma solo la fecha siguiente." },
  "latam_cpi:CL": { status: "official", label: "Oficial", scope: "IPC Chile con fechas del calendario anual publicado" },
  "latam_banco_central:BR": { status: "official", label: "Oficial", scope: "Reuniones COPOM Brasil 2026" },
  "latam_banco_central:CL": { status: "official", label: "Oficial", scope: "Reuniones BCCh Chile 2026" },
  "latam_banco_central:MX": { status: "official", label: "Oficial", scope: "Reuniones Banxico México 2026" },
  "earnings:AR": { status: "estimated", label: "Estimado", scope: "Empresas argentinas BYMA seleccionadas", limitation: "No confirmado por la empresa; la fecha puede moverse." },
  "earnings:US": { status: "estimated", label: "Estimado", scope: "Magnificent 7 seleccionadas", limitation: "No confirmado por la empresa; la fecha puede moverse." },
}

function evidenceDateFromSource(source: string): string | undefined {
  return source.match(/(\d{4}-\d{2}-\d{2})(?!.*\d{4}-\d{2}-\d{2})/)?.[1]
}

export function getCalendarCoverage(kind: string, country: string, source: string): CalendarCoverage {
  const definition = CALENDAR_COVERAGE_REGISTRY[`${kind}:${country}` as CalendarCoverageKey]
  return { ...definition, source, verifiedAt: evidenceDateFromSource(source) }
}

export interface PendingCalendarSource {
  id: "treasury" | "sp500"
  name: string
  statusLabel: "Pendiente"
  source: string
  scope: string
  items: string[]
  limitation: string
}

export const PENDING_CALENDAR_SOURCES: PendingCalendarSource[] = [
  { id: "treasury", name: "Licitaciones del Tesoro", statusLabel: "Pendiente", source: "Secretaría de Finanzas / Tesoro", scope: "Licitaciones, instrumentos, montos y tasas adjudicadas", items: ["Colocación de deuda en pesos: instrumentos, montos y tasas adjudicadas"], limitation: "La fuente oficial todavía no está conectada; no se muestran fechas simuladas." },
  { id: "sp500", name: "Earnings — S&P 500 (resto)", statusLabel: "Pendiente", source: "Calendarios oficiales de resultados de cada emisor", scope: "Resto del S&P 500 fuera de la cobertura estimada existente", items: ["S&P500 (493 empresas restantes)"], limitation: "La cobertura no es viable manualmente sin conectar una fuente oficial." },
]
