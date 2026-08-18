import { aISO } from "./market-calendar"
import { construirCashflows, ESQUEMAS } from "./bond-schedule"
import { FOMC_MEETINGS_2026, FUENTE_FOMC } from "@/server/domain/fomc-calendar"
import { INDEC_PUBLICACIONES_2026, FUENTE_INDEC } from "@/server/domain/indec-calendar"
import { INTL_CPI_2026, fuenteDe } from "@/server/domain/intl-cpi-calendar"
import { CENTRAL_BANK_MEETINGS_2026, fuenteBancoCentral, type CentralBankCode } from "@/server/domain/central-bank-calendar"
import { REM_PUBLICACIONES_2026, FUENTE_REM } from "@/server/domain/bcra-calendar"

/** Países que puede elegir el usuario para filtrar el calendario. */
export type CountryCode = "AR" | "US" | "JP" | "EU" | "GB"

export interface BondCalendarEvent {
  kind: "bono"
  country: "AR"
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
  country: "US"
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
  country: "AR"
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
  country: "US" | "JP"
  id: string
  ticker: "CPI-US" | "CPI-JP"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface CentralBankCalendarEvent {
  kind: "banco_central"
  country: "EU" | "GB" | "JP"
  id: string
  ticker: string
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface BcraCalendarEvent {
  kind: "bcra"
  country: "AR"
  id: string
  ticker: "REM"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export type MarketCalendarEvent =
  | BondCalendarEvent
  | FomcCalendarEvent
  | IndecCalendarEvent
  | IntlCpiCalendarEvent
  | CentralBankCalendarEvent
  | BcraCalendarEvent

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
        country: "AR" as const,
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
    country: "US" as const,
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
    country: "AR" as const,
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
    country: p.pais,
    id: `CPI-${p.pais}-${p.fecha}`,
    ticker: (p.pais === "US" ? "CPI-US" : "CPI-JP") as "CPI-US" | "CPI-JP",
    title: p.pais === "US" ? "Publicación CPI EEUU" : "Publicación CPI Japón",
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: fuenteDe(p.pais),
    impact: "high" as const,
  }))
}

const BANCO_CENTRAL_PAIS: Record<CentralBankCode, "EU" | "GB" | "JP"> = { ECB: "EU", BOE: "GB", BOJ: "JP" }
const BANCO_CENTRAL_TITULO: Record<CentralBankCode, string> = {
  ECB: "Decisión de tasa BCE",
  BOE: "Decisión de tasa Bank of England",
  BOJ: "Decisión de tasa Banco de Japón",
}

export function deriveCentralBankCalendarEvents(today: string = todayInBuenosAires()): CentralBankCalendarEvent[] {
  return CENTRAL_BANK_MEETINGS_2026.filter((m) => m.fecha >= today).map((m) => ({
    kind: "banco_central" as const,
    country: BANCO_CENTRAL_PAIS[m.banco],
    id: `${m.banco}-${m.fecha}`,
    ticker: m.banco,
    title: BANCO_CENTRAL_TITULO[m.banco],
    paymentDate: m.fecha,
    detail: m.descripcion,
    source: fuenteBancoCentral(m.banco),
    impact: "high" as const,
  }))
}

export function deriveBcraCalendarEvents(today: string = todayInBuenosAires()): BcraCalendarEvent[] {
  return REM_PUBLICACIONES_2026.filter((p) => p.fecha >= today).map((p) => ({
    kind: "bcra" as const,
    country: "AR" as const,
    id: `BCRA-REM-${p.fecha}`,
    ticker: "REM" as const,
    title: "Publicación REM (expectativas de mercado)",
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: FUENTE_REM,
    impact: "high" as const,
  }))
}

/** Unión de todos los eventos con fuente real conectada, ordenada por fecha. */
export function deriveMarketCalendarEvents(today: string = todayInBuenosAires()): MarketCalendarEvent[] {
  return [
    ...deriveBondCalendarEvents(today),
    ...deriveFomcCalendarEvents(today),
    ...deriveIndecCalendarEvents(today),
    ...deriveIntlCpiCalendarEvents(today),
    ...deriveCentralBankCalendarEvents(today),
    ...deriveBcraCalendarEvents(today),
  ].sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.ticker.localeCompare(right.ticker))
}
