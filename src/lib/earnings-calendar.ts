/**
 * Calendario de earnings compartido — usado tanto por el frontend (tab-finanzas)
 * como por el servidor (TTL inteligente de fundamentals).
 *
 * Fuentes:
 *  - NEXT_EARNINGS del tab-finanzas.tsx (Q2/Q3 2026 — ya pasados, sirven como
 *    historial para el cálculo de ventana ±14 días)
 *  - Estimados Q4 2026 de server/domain/earnings-calendar.ts, mapeados a los
 *    tickers ADR que usa el cascade de fundamentals (PAM en vez de PAMP, TX en
 *    vez de TXAR, YPF en vez de YPFD, etc.)
 */

export interface EarningsEvent {
  ticker: string
  empresa: string
  fecha: string      // YYYY-MM-DD
  afterHours: boolean
}

export const EARNINGS_CALENDAR: EarningsEvent[] = [
  // ── Q2 2026 (copiado de NEXT_EARNINGS en tab-finanzas.tsx) ──────────────
  { ticker: "GOOGL", empresa: "Alphabet",   fecha: "2026-04-24", afterHours: false },
  { ticker: "MSFT",  empresa: "Microsoft",  fecha: "2026-04-23", afterHours: true  },
  { ticker: "META",  empresa: "Meta",       fecha: "2026-04-24", afterHours: true  },
  { ticker: "AAPL",  empresa: "Apple",      fecha: "2026-05-01", afterHours: true  },
  { ticker: "AMZN",  empresa: "Amazon",     fecha: "2026-05-01", afterHours: true  },
  { ticker: "NVDA",  empresa: "Nvidia",     fecha: "2026-05-22", afterHours: false },
  { ticker: "TSLA",  empresa: "Tesla",      fecha: "2026-07-22", afterHours: false },
  { ticker: "JPM",   empresa: "JPMorgan",   fecha: "2026-07-14", afterHours: false },

  // ── Q4 2026 — US (estimados por patrón trimestral) ──────────────────────
  { ticker: "MSFT",  empresa: "Microsoft",  fecha: "2026-10-28", afterHours: true  },
  { ticker: "META",  empresa: "Meta",       fecha: "2026-10-28", afterHours: true  },
  { ticker: "GOOGL", empresa: "Alphabet",   fecha: "2026-10-28", afterHours: false },
  { ticker: "TSLA",  empresa: "Tesla",      fecha: "2026-10-28", afterHours: false },
  { ticker: "AAPL",  empresa: "Apple",      fecha: "2026-10-29", afterHours: true  },
  { ticker: "AMZN",  empresa: "Amazon",     fecha: "2026-10-29", afterHours: true  },
  { ticker: "NVDA",  empresa: "Nvidia",     fecha: "2026-11-19", afterHours: false },

  // ── Q4 2026 — AR (usando tickers ADR, que es lo que recibe getFundamentals)
  // GGAL → GGAL (NASDAQ), YPFD → YPF (NYSE), PAMP → PAM (NYSE),
  // TXAR → TX (NYSE), TECO2 → TEO (NYSE), VALO → SUPV (NYSE)
  { ticker: "GGAL",  empresa: "Grupo Financiero Galicia", fecha: "2026-11-19", afterHours: false },
  { ticker: "BMA",   empresa: "Banco Macro",              fecha: "2026-11-11", afterHours: false },
  { ticker: "CEPU",  empresa: "Central Puerto",           fecha: "2026-11-10", afterHours: false },
  { ticker: "LOMA",  empresa: "Loma Negra",               fecha: "2026-11-08", afterHours: false },
  { ticker: "PAM",   empresa: "Pampa Energía",            fecha: "2026-11-03", afterHours: false },
  { ticker: "YPF",   empresa: "YPF",                      fecha: "2026-11-03", afterHours: false },
  { ticker: "TX",    empresa: "Ternium (TXAR)",           fecha: "2026-11-03", afterHours: false },
]

/**
 * Devuelve true si hoy está dentro de la ventana de earnings (±14 días de la
 * fecha más cercana del ticker).
 */
export function enVentanaEarnings(ticker: string, hoy = new Date()): boolean {
  const events = EARNINGS_CALENDAR.filter(e => e.ticker === ticker)
  if (events.length === 0) return false
  const WINDOW_MS = 14 * 24 * 60 * 60 * 1000
  return events.some(e => {
    const earningsDate = new Date(e.fecha)
    return Math.abs(earningsDate.getTime() - hoy.getTime()) <= WINDOW_MS
  })
}

/**
 * TTL en segundos para cachear fundamentals:
 * - 7 días si el ticker está cerca de publicar earnings (ventana ±14 días)
 * - 90 días en período tranquilo
 */
export function fundamentalsTTL(ticker: string): number {
  return enVentanaEarnings(ticker) ? 7 * 24 * 3600 : 90 * 24 * 3600
}
