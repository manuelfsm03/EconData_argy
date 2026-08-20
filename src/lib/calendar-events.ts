import { aISO } from "./market-calendar"
import { construirCashflows, ESQUEMAS } from "./bond-schedule"
import { FOMC_MEETINGS_2026, FUENTE_FOMC } from "@/server/domain/fomc-calendar"
import { INDEC_PUBLICACIONES_2026, FUENTE_INDEC } from "@/server/domain/indec-calendar"
import { BCRA_REM_IPOM_2026, FUENTE_BCRA } from "@/server/domain/bcra-calendar"
import { INTL_CPI_2026, fuenteDe } from "@/server/domain/intl-cpi-calendar"
import { CENTRAL_BANK_MEETINGS_2026, fuenteBancoCentral, type CentralBankCode } from "@/server/domain/central-bank-calendar"
import { BRAZIL_IPCA_2026, MEXICO_INPC_2026, COPOM_2026, BCCH_RPM_2026, BANXICO_2026, fuenteCpiLatam, fuenteBancoLatam } from "@/server/domain/latam-calendar"
import { EARNINGS_2026 } from "@/server/domain/earnings-calendar"

/** Países que puede elegir el usuario para filtrar el calendario. */
export type CountryCode = "AR" | "US" | "JP" | "EU" | "GB" | "BR" | "CL" | "MX"

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

export interface BcraCalendarEvent {
  kind: "bcra"
  country: "AR"
  id: string
  ticker: "REM" | "IPOM"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface IntlCpiCalendarEvent {
  kind: "intl_cpi"
  country: "US" | "JP" | "GB" | "EU"
  id: string
  ticker: "CPI-US" | "CPI-JP" | "CPI-GB" | "CPI-EU"
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

export interface LatamCpiCalendarEvent {
  kind: "latam_cpi"
  country: "BR" | "MX"
  id: string
  ticker: "IPCA" | "INPC"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface LatamBankCalendarEvent {
  kind: "latam_banco_central"
  country: "BR" | "CL" | "MX"
  id: string
  ticker: "COPOM" | "BCCh" | "Banxico"
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "high"
}

export interface EarningsCalendarEvent {
  kind: "earnings"
  country: "AR" | "US"
  id: string
  ticker: string
  title: string
  paymentDate: string
  detail: string
  source: string
  impact: "medium"
  /** false siempre: estas fechas son estimadas, no publicadas por una fuente oficial única. */
  confirmado: false
}

export type MarketCalendarEvent =
  | BondCalendarEvent
  | FomcCalendarEvent
  | IndecCalendarEvent
  | BcraCalendarEvent
  | IntlCpiCalendarEvent
  | CentralBankCalendarEvent
  | LatamCpiCalendarEvent
  | LatamBankCalendarEvent
  | EarningsCalendarEvent

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

const BCRA_TITULO: Record<"REM" | "IPOM", string> = {
  REM: "Relevamiento de Expectativas de Mercado (REM)",
  IPOM: "Informe de Política Monetaria (IPOM)",
}

export function deriveBcraCalendarEvents(today: string = todayInBuenosAires()): BcraCalendarEvent[] {
  return BCRA_REM_IPOM_2026.filter((p) => p.fecha >= today).map((p) => ({
    kind: "bcra" as const,
    country: "AR" as const,
    id: `BCRA-${p.indicador}-${p.fecha}`,
    ticker: p.indicador,
    title: BCRA_TITULO[p.indicador],
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: FUENTE_BCRA,
    impact: "high" as const,
  }))
}

const INTL_CPI_TICKER: Record<"US" | "JP" | "GB" | "EU", "CPI-US" | "CPI-JP" | "CPI-GB" | "CPI-EU"> = { US: "CPI-US", JP: "CPI-JP", GB: "CPI-GB", EU: "CPI-EU" }
const INTL_CPI_TITULO: Record<"US" | "JP" | "GB" | "EU", string> = { US: "Publicación CPI EEUU", JP: "Publicación CPI Japón", GB: "Publicación CPI Reino Unido", EU: "Publicación HICP Eurozona" }

export function deriveIntlCpiCalendarEvents(today: string = todayInBuenosAires()): IntlCpiCalendarEvent[] {
  return INTL_CPI_2026.filter((p) => p.fecha >= today).map((p) => ({
    kind: "intl_cpi" as const,
    country: p.pais,
    id: `CPI-${p.pais}-${p.fecha}`,
    ticker: INTL_CPI_TICKER[p.pais],
    title: INTL_CPI_TITULO[p.pais],
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

const LATAM_CPI_TICKER: Record<"BR" | "MX", "IPCA" | "INPC"> = { BR: "IPCA", MX: "INPC" }
const LATAM_CPI_TITULO: Record<"BR" | "MX", string> = { BR: "Publicación IPCA (inflación Brasil)", MX: "Publicación INPC (inflación México)" }

export function deriveLatamCpiCalendarEvents(today: string = todayInBuenosAires()): LatamCpiCalendarEvent[] {
  const publicaciones = [...BRAZIL_IPCA_2026, ...MEXICO_INPC_2026]
  return publicaciones.filter((p) => p.fecha >= today).map((p) => ({
    kind: "latam_cpi" as const,
    country: p.pais as "BR" | "MX",
    id: `${LATAM_CPI_TICKER[p.pais as "BR" | "MX"]}-${p.fecha}`,
    ticker: LATAM_CPI_TICKER[p.pais as "BR" | "MX"],
    title: LATAM_CPI_TITULO[p.pais as "BR" | "MX"],
    paymentDate: p.fecha,
    detail: p.descripcion,
    source: fuenteCpiLatam(p.pais),
    impact: "high" as const,
  }))
}

const LATAM_BANK_TITULO: Record<"COPOM" | "BCCh" | "Banxico", string> = {
  COPOM: "Decisión de tasa Selic (Copom)",
  BCCh: "Decisión de tasa BCCh",
  Banxico: "Decisión de tasa Banxico",
}

export function deriveLatamBankCalendarEvents(today: string = todayInBuenosAires()): LatamBankCalendarEvent[] {
  const meetings = [...COPOM_2026, ...BCCH_RPM_2026, ...BANXICO_2026]
  return meetings.filter((m) => m.fecha >= today).map((m) => ({
    kind: "latam_banco_central" as const,
    country: m.pais as "BR" | "CL" | "MX",
    id: `${m.banco}-${m.fecha}`,
    ticker: m.banco,
    title: LATAM_BANK_TITULO[m.banco],
    paymentDate: m.fecha,
    detail: m.descripcion,
    source: fuenteBancoLatam(m.banco),
    impact: "high" as const,
  }))
}

export function deriveEarningsCalendarEvents(today: string = todayInBuenosAires()): EarningsCalendarEvent[] {
  return EARNINGS_2026.filter((e) => e.fecha >= today).map((e) => ({
    kind: "earnings" as const,
    country: e.pais,
    id: `EARN-${e.ticker}-${e.fecha}`,
    ticker: e.ticker,
    title: `Balance ${e.empresa} (estimado)`,
    paymentDate: e.fecha,
    detail: e.base,
    source: "Estimación propia por patrón trimestral — no confirmado por la empresa, puede moverse",
    impact: "medium" as const,
    confirmado: false as const,
  }))
}

/** Unión de todos los eventos con fuente real conectada, ordenada por fecha. */
export function deriveMarketCalendarEvents(today: string = todayInBuenosAires()): MarketCalendarEvent[] {
  return [
    ...deriveBondCalendarEvents(today),
    ...deriveFomcCalendarEvents(today),
    ...deriveIndecCalendarEvents(today),
    ...deriveBcraCalendarEvents(today),
    ...deriveIntlCpiCalendarEvents(today),
    ...deriveCentralBankCalendarEvents(today),
    ...deriveLatamCpiCalendarEvents(today),
    ...deriveLatamBankCalendarEvents(today),
    ...deriveEarningsCalendarEvents(today),
  ].sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.ticker.localeCompare(right.ticker))
}
