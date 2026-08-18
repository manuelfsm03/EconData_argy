/**
 * Calendario de balances/resultados trimestrales -- empresas argentinas
 * (BYMA) y las de mayor peso del S&P 500 ("Magnificent 7").
 *
 * A DIFERENCIA de todo lo demás en esta carpeta (FOMC, INDEC, CPI, bancos
 * centrales), estas fechas NO están publicadas con antelación por una
 * fuente oficial única: cada empresa anuncia su balance individualmente,
 * semanas antes, y puede moverlo. Lo que hay acá son ESTIMACIONES basadas
 * en el patrón trimestral de balances ya confirmados de la propia empresa
 * (o, para los casos donde no hay patrón propio suficiente, no se carga
 * nada en vez de inventar una fecha).
 *
 * `confirmado: false` en todos los casos -- se muestra distinto en la UI
 * (no como un hecho firme). Cuando la empresa anuncie la fecha real, hay
 * que reemplazar el estimado por la fecha confirmada.
 */

export interface EarningsEstimado {
  fecha: string
  ticker: string
  empresa: string
  pais: "AR" | "US"
  base: string
}

export const EARNINGS_AR_2026: EarningsEstimado[] = [
  { fecha: "2026-11-19", ticker: "GGAL", empresa: "Grupo Financiero Galicia", pais: "AR", base: "estimado por patrón trimestral (Q1: 13/05, Q2: 20/08)" },
  { fecha: "2026-11-03", ticker: "PAMP", empresa: "Pampa Energía", pais: "AR", base: "estimado por patrón trimestral (Q1: 06/05, Q2: 04/08)" },
  { fecha: "2026-11-03", ticker: "YPF", empresa: "YPF", pais: "AR", base: "estimado por patrón trimestral (Q1: 07/05, Q2: 04/08)" },
  { fecha: "2026-11-08", ticker: "LOMA", empresa: "Loma Negra", pais: "AR", base: "estimado por patrón trimestral (Q1: 04/05, Q2: 06/08)" },
  { fecha: "2026-11-03", ticker: "TXAR", empresa: "Ternium Argentina", pais: "AR", base: "estimado por patrón trimestral (Q1: 05/05, Q2: 04/08)" },
  { fecha: "2026-11-10", ticker: "CEPU", empresa: "Central Puerto", pais: "AR", base: "estimado por patrón trimestral (Q1: 12/05, Q2: 11/08)" },
  { fecha: "2026-11-11", ticker: "BMA", empresa: "Banco Macro", pais: "AR", base: "estimado por patrón trimestral (Q1: 27/05, Q2: 19/08)" },
]

export const EARNINGS_US_2026: EarningsEstimado[] = [
  { fecha: "2026-10-28", ticker: "MSFT", empresa: "Microsoft", pais: "US", base: "estimado por patrón trimestral" },
  { fecha: "2026-10-28", ticker: "META", empresa: "Meta Platforms", pais: "US", base: "estimado por patrón trimestral" },
  { fecha: "2026-10-28", ticker: "GOOGL", empresa: "Alphabet (Google)", pais: "US", base: "estimado por patrón trimestral" },
  { fecha: "2026-10-28", ticker: "TSLA", empresa: "Tesla", pais: "US", base: "estimado (fuentes divergen entre 21 y 28 de octubre)" },
  { fecha: "2026-10-29", ticker: "AAPL", empresa: "Apple", pais: "US", base: "estimado por patrón trimestral" },
  { fecha: "2026-10-29", ticker: "AMZN", empresa: "Amazon", pais: "US", base: "estimado por patrón trimestral" },
  { fecha: "2026-11-19", ticker: "NVDA", empresa: "Nvidia", pais: "US", base: "estimado — Nvidia tiene año fiscal corrido (Q3 fiscal ≈ oct/nov calendario)" },
]

export const EARNINGS_2026: EarningsEstimado[] = [...EARNINGS_AR_2026, ...EARNINGS_US_2026]
