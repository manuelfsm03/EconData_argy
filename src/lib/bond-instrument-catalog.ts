import {
  AE38,
  AL29,
  AL30,
  AL35,
  AL41,
  GD29,
  GD30,
  GD35,
  GD38,
  GD41,
  type EsquemaBono,
} from "./bond-schedule"

export type EstadoInstrumento = "habilitado" | "excluido"

export interface InstrumentoBono {
  ticker: string
  nombre: string
  moneda: string
  ley: string
  vencimiento: string
  dayCount: string
  frecuencia: string
  fuentePrimaria: string
  decision: string
  estado: EstadoInstrumento
  esquema?: EsquemaBono
}

const fuenteCanje =
  "Decreto 2020, Anexo III/IV; InfoLEG IF-2020-53778419-APN-UGSDPE#MEC / IF-2020-53843620-APN-SSF#MEC"

function hardDollar(esquema: EsquemaBono): InstrumentoBono {
  return {
    ticker: esquema.ticker,
    nombre: esquema.nombre,
    moneda: esquema.moneda,
    ley: esquema.ley,
    vencimiento: esquema.vencimiento,
    dayCount: "30/360 US",
    frecuencia: "semestral",
    fuentePrimaria: esquema.fuente || fuenteCanje,
    decision: "Habilitado: cashflows derivados del anexo oficial del canje 2020 y validados contra amortización total de 100 VN.",
    estado: "habilitado",
    esquema,
  }
}

/**
 * Catálogo cerrado de PR76. S30S6 se enumera para no ocultar el pedido, pero
 * queda fuera del motor de TEA: el catálogo abierto permite identificar ticker
 * y vencimiento, no aporta en sí mismo un prospecto/cashflow verificable.
 */
export const INSTRUMENTOS_BONOS: InstrumentoBono[] = [
  ...[GD30, AL30, GD29, AL29, GD35, AL35, GD41, AL41, AE38, GD38].map(hardDollar),
  {
    ticker: "S30S6",
    nombre: "LECAP S30S6",
    moneda: "ARS",
    ley: "Argentina",
    vencimiento: "2026-09-30",
    dayCount: "ACT/365F (pendiente de base primaria)",
    frecuencia: "cero cupón (pendiente de base primaria)",
    fuentePrimaria: "BYMA Data abierto: catálogo de instrumentos; falta prospecto/condición de emisión incorporada al repositorio",
    decision: "Excluido de TEA en PR76: no publicar una tasa sin cashflow oficial verificable; requiere fuente primaria antes de habilitarlo.",
    estado: "excluido",
  },
]

const byTicker = new Map(INSTRUMENTOS_BONOS.map((instrumento) => [instrumento.ticker, instrumento]))

export const TICKERS_BONOS_HABILITADOS = INSTRUMENTOS_BONOS
  .filter((instrumento) => instrumento.estado === "habilitado")
  .map((instrumento) => instrumento.ticker)

export function getInstrumentoBono(ticker: string): InstrumentoBono | undefined {
  return byTicker.get(ticker.trim().toUpperCase())
}