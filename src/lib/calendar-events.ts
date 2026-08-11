import { aISO } from "./market-calendar"
import { construirCashflows, ESQUEMAS } from "./bond-schedule"

export interface BondCalendarEvent {
  id: string
  ticker: string
  title: string
  paymentDate: string
  accrualDate: string
  coupon: number
  amortization: number
  residualBeforePayment: number
  currency: string
  law: "local" | "NY"
  source: string
  impact: "medium" | "high"
}

export function todayInBuenosAires(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function deriveBondCalendarEvents(today: string = todayInBuenosAires()): BondCalendarEvent[] {
  return ESQUEMAS.flatMap((scheme) =>
    construirCashflows(scheme).map((cashflow) => {
      const paymentDate = aISO(cashflow.fechaPago)
      const accrualDate = aISO(cashflow.fechaDevengamiento)
      const hasAmortization = cashflow.amortizacion > 0
      return {
        id: `${scheme.ticker}-${accrualDate}`,
        ticker: scheme.ticker,
        title: hasAmortization ? `Renta y amortización ${scheme.ticker}` : `Renta ${scheme.ticker}`,
        paymentDate,
        accrualDate,
        coupon: cashflow.cupon,
        amortization: cashflow.amortizacion,
        residualBeforePayment: cashflow.vr,
        currency: scheme.moneda,
        law: scheme.ley,
        source: scheme.fuente,
        impact: hasAmortization ? "high" as const : "medium" as const,
      }
    }),
  )
    .filter((event) => event.paymentDate >= today)
    .sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.ticker.localeCompare(right.ticker))
}
