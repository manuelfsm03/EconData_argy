import { aISO } from "./market-calendar"
import { construirCashflows, ESQUEMAS } from "./bond-schedule"
import { FOMC_MEETINGS_2026, FUENTE_FOMC } from "@/server/domain/fomc-calendar"
import { INDEC_PUBLICACIONES_2026, FUENTE_INDEC } from "@/server/domain/indec-calendar"
import { INTL_CPI_2026, fuenteDe } from "@/server/domain/intl-cpi-calendar"

export interface BondCalendarEvent {
  kind: "bono"
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

export interface FomcCalendarEvent {
  kind: "fomc"
  id: string
  ticker: "FOMC"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface IndecCalendarEvent {
  kind: "indec"
  id: string
  ticker: "IPC" | "EMAE"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface IntlCpiCalendarEvent {
  kind: "intl_cpi"
  id: string
  ticker: "CPI-US" | "CPI-JP"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export type MarketCalendarEvent = BondCalendarEvent | FomcCalendarEvent | IndecCalendarEvent | IntlCpiCalendarEvent

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
        kind: "bono" as const,
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

export function deriveFomcCalendarEvents(today: string = todayInBuenosAires()): FomcCalendarEvent[] {
  return FOMC_MEETINGS_2026.filter((meeting) => meeting.fecha >= today).map((meeting) => ({
    kind: "fomc" as const,
    id: `FOMC-${meeting.fecha}`,
    ticker: "FOMC" as const,
    title: "Decisión de tasa Fed",
    paymentDate: meeting.fecha,
    detail: meeting.descripcion,
    source: FUENTE_FOMC,
    impact: "high" as const,
  }))
}

export function deriveIndecCalendarEvents(today: string = todayInBuenosAires()): IndecCalendarEvent[] {
  return INDEC_PUBLICACIONES_2026.filter((p) => p.fecha >= today).map((p) => ({
    kind: "indec" as const,
    id: `INDEC-${p.indicador}-${p.fecha}`,
    ticker: p.indicador,
    title: p.indicador === "IPC" ? "Publicación IPC (inflación)" : "Publicación EMAE (actividad económica)",
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: FUENTE_INDEC,
    impact: "high" as const,
  }))
}

export function deriveIntlCpiCalendarEvents(today: string = todayInBuenosAires()): IntlCpiCalendarEvent[] {
  return INTL_CPI_2026.filter((p) => p.fecha >= today).map((p) => ({
    kind: "intl_cpi" as const,
    id: `CPI-${p.pais}-${p.fecha}`,
    ticker: (p.pais === "US" ? "CPI-US" : "CPI-JP") as "CPI-US" | "CPI-JP",
    title: p.pais === "US" ? "Publicación CPI EEUU" : "Publicación CPI Japón",
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: fuenteDe(p.pais),
    impact: "high" as const,
  }))
}

/** Unión de todos los eventos con fuente real conectada (bonos + FOMC + INDEC + CPI internacional), ordenada por fecha. */
export function deriveMarketCalendarEvents(today: string = todayInBuenosAires()): MarketCalendarEvent[] {
  return [
    ...deriveBondCalendarEvents(today),
    ...deriveFomcCalendarEvents(today),
    ...deriveIndecCalendarEvents(today),
    ...deriveIntlCpiCalendarEvents(today),
  ].sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.ticker.localeCompare(right.ticker))
}
