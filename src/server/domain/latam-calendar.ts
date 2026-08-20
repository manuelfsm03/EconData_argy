/**
 * Calendarios de inflación y bancos centrales de países latinoamericanos
 * vecinos/relevantes para Argentina. Mismo patrón que el resto: fechas
 * fijas y públicas, anunciadas con antelación por el organismo oficial,
 * no requieren fetch en vivo.
 */

export type LatamCountry = "BR" | "CL" | "MX"

export interface LatamCpiPublicacion {
  fecha: string
  pais: LatamCountry
  descripcion: string
}

export interface LatamCentralBankMeeting {
  fecha: string
  fechaInicio: string
  pais: LatamCountry
  banco: "COPOM" | "BCCh" | "Banxico"
  descripcion: string
}

const FUENTE_IBGE = "IBGE — Sistema Nacional de Índices de Preços ao Consumidor, calendário de divulgação do IPCA (ibge.gov.br), verificado contra o boletim oficial de julho/2026, 2026-08-17"
const FUENTE_INEGI = "INEGI — Boletín de indicador 481/26, INPC (inegi.org.mx/contenidos/saladeprensa/boletines/2026/inpc/inpc_2q2026_08.pdf), campo \"Próxima publicación mensual\" en la portada, verificado 2026-08-17. INEGI no publica una tabla anual del INPC de un mismo indicador -- cada boletín mensual solo confirma la fecha del mes siguiente."
const FUENTE_COPOM = "Banco Central do Brasil — Calendário de reuniões do Copom 2026 (bcb.gov.br), verificado 2026-08-17"
const FUENTE_BCCH = "Banco Central de Chile — Calendario de Reuniones de Política Monetaria (RPM) 2026 (bcentral.cl), verificado 2026-08-17"
const FUENTE_BANXICO = "Banco de México — Calendario 2026 para los anuncios de las decisiones de política monetaria (banxico.org.mx), PDF oficial, verificado 2026-08-17"
const FUENTE_INE_CHILE = "INE Chile — Calendario 2026 Indicadores de Coyuntura (ine.gob.cl/inicio/agendaestadistica), PDF oficial, actualización de calendario fecha 10 de abril 2026, verificado 2026-08-20"

/**
 * IPCA (Brasil) -- publicado ~10-12 días después de fin de mes. Fechas
 * verificadas contra el listado público y cruzadas con el boletín oficial
 * de julio/2026 (publicado 11/08/2026), que corrigió el mes de referencia
 * del listado original en un mes (estaba corrido).
 */
export const BRAZIL_IPCA_2026: LatamCpiPublicacion[] = [
  { fecha: "2026-01-08", pais: "BR", descripcion: "IPCA Brasil — diciembre 2025" },
  { fecha: "2026-02-09", pais: "BR", descripcion: "IPCA Brasil — enero 2026" },
  { fecha: "2026-03-10", pais: "BR", descripcion: "IPCA Brasil — febrero 2026" },
  { fecha: "2026-04-10", pais: "BR", descripcion: "IPCA Brasil — marzo 2026" },
  { fecha: "2026-05-12", pais: "BR", descripcion: "IPCA Brasil — abril 2026" },
  { fecha: "2026-06-12", pais: "BR", descripcion: "IPCA Brasil — mayo 2026" },
  { fecha: "2026-07-10", pais: "BR", descripcion: "IPCA Brasil — junio 2026" },
  { fecha: "2026-08-11", pais: "BR", descripcion: "IPCA Brasil — julio 2026" },
  { fecha: "2026-09-11", pais: "BR", descripcion: "IPCA Brasil — agosto 2026" },
  { fecha: "2026-10-09", pais: "BR", descripcion: "IPCA Brasil — septiembre 2026" },
  { fecha: "2026-11-12", pais: "BR", descripcion: "IPCA Brasil — octubre 2026" },
]

/**
 * INPC (México) -- a diferencia de Brasil, INEGI ya no publica quincenal
 * (esa suposición inicial era incorrecta, corregida acá): el boletín
 * mensual del INPC dice explícitamente "Próxima publicación mensual" con
 * una sola fecha hacia adelante. Por eso esta lista tiene un solo dato
 * confirmado (el próximo boletín, 481/26 del 7/8/2026) en vez de un año
 * completo -- se puede ampliar mes a mes a medida que salgan nuevos
 * boletines.
 */
export const MEXICO_INPC_2026: LatamCpiPublicacion[] = [
  { fecha: "2026-09-09", pais: "MX", descripcion: "INPC México — agosto 2026" },
]

/**
 * IPC (Chile) -- publicado el mismo día del mes, con corrimiento cuando cae
 * fin de semana/feriado. Fuente: calendario anual del INE (mismo documento
 * que agrupa todos sus indicadores de coyuntura, no uno específico del
 * IPC) -- a diferencia de los intentos previos, el PDF sí es accesible
 * fetcheándolo directo en vez de por la página HTML de la agenda.
 */
export const CHILE_IPC_2026: LatamCpiPublicacion[] = [
  { fecha: "2026-01-08", pais: "CL", descripcion: "IPC Chile — diciembre 2025" },
  { fecha: "2026-02-06", pais: "CL", descripcion: "IPC Chile — enero 2026" },
  { fecha: "2026-03-06", pais: "CL", descripcion: "IPC Chile — febrero 2026" },
  { fecha: "2026-04-08", pais: "CL", descripcion: "IPC Chile — marzo 2026" },
  { fecha: "2026-05-08", pais: "CL", descripcion: "IPC Chile — abril 2026" },
  { fecha: "2026-06-08", pais: "CL", descripcion: "IPC Chile — mayo 2026" },
  { fecha: "2026-07-08", pais: "CL", descripcion: "IPC Chile — junio 2026" },
  { fecha: "2026-08-07", pais: "CL", descripcion: "IPC Chile — julio 2026" },
  { fecha: "2026-09-08", pais: "CL", descripcion: "IPC Chile — agosto 2026" },
  { fecha: "2026-10-08", pais: "CL", descripcion: "IPC Chile — septiembre 2026" },
  { fecha: "2026-11-06", pais: "CL", descripcion: "IPC Chile — octubre 2026" },
  { fecha: "2026-12-07", pais: "CL", descripcion: "IPC Chile — noviembre 2026" },
]

export const COPOM_2026: LatamCentralBankMeeting[] = [
  { fecha: "2026-01-28", fechaInicio: "2026-01-27", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-03-18", fechaInicio: "2026-03-17", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-04-29", fechaInicio: "2026-04-28", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-06-17", fechaInicio: "2026-06-16", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-08-05", fechaInicio: "2026-08-04", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-09-16", fechaInicio: "2026-09-15", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-11-04", fechaInicio: "2026-11-03", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
  { fecha: "2026-12-09", fechaInicio: "2026-12-08", pais: "BR", banco: "COPOM", descripcion: "Decisión de tasa Selic (Copom)" },
]

export const BCCH_RPM_2026: LatamCentralBankMeeting[] = [
  { fecha: "2026-01-27", fechaInicio: "2026-01-26", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-03-24", fechaInicio: "2026-03-24", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-04-28", fechaInicio: "2026-04-27", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-06-16", fechaInicio: "2026-06-16", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-07-28", fechaInicio: "2026-07-27", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-09-08", fechaInicio: "2026-09-08", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-10-27", fechaInicio: "2026-10-26", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
  { fecha: "2026-12-15", fechaInicio: "2026-12-15", pais: "CL", banco: "BCCh", descripcion: "Decisión de tasa de política monetaria (RPM)" },
]

export const BANXICO_2026: LatamCentralBankMeeting[] = [
  { fecha: "2026-02-05", fechaInicio: "2026-02-05", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-03-26", fechaInicio: "2026-03-26", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-05-07", fechaInicio: "2026-05-07", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-06-25", fechaInicio: "2026-06-25", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-08-06", fechaInicio: "2026-08-06", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-09-24", fechaInicio: "2026-09-24", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-11-05", fechaInicio: "2026-11-05", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
  { fecha: "2026-12-17", fechaInicio: "2026-12-17", pais: "MX", banco: "Banxico", descripcion: "Decisión de tasa de interés objetivo" },
]

export function fuenteCpiLatam(pais: LatamCountry): string {
  if (pais === "BR") return FUENTE_IBGE
  if (pais === "MX") return FUENTE_INEGI
  return FUENTE_INE_CHILE
}

export function fuenteBancoLatam(banco: "COPOM" | "BCCh" | "Banxico"): string {
  if (banco === "COPOM") return FUENTE_COPOM
  if (banco === "BCCh") return FUENTE_BCCH
  return FUENTE_BANXICO
}

/**
 * Pendientes, investigados pero no cargados en esta pasada (no se
 * encontró una fuente con el mismo nivel de certeza que el resto):
 * - INPC México (INEGI): la suposición inicial (10 y 25 de cada mes,
 *   quincenal) era incorrecta -- el boletín oficial más reciente (481/26,
 *   7/8/2026) muestra que el INPC ya es mensual, no quincenal, y que
 *   INEGI solo confirma la fecha del mes siguiente en cada boletín (no
 *   publica una tabla anual de este indicador específico). Por eso
 *   MEXICO_INPC_2026 arriba solo tiene un dato real en vez de un año
 *   completo -- se puede ir ampliando mes a mes con cada boletín nuevo.
 */
