export interface BondCashflowDef {
  fecha: string
  cupon: number
  amortizacion: number
}

export interface BondDef {
  ticker: string
  nombre: string
  moneda: string
  ley: string
  cupon: number
  amortizacion: string
  emision: string
  vencimiento: string
  cashflows: BondCashflowDef[]
}

export interface CapInstrumentDef {
  ticker: string
  tipo: string
  vencimiento: string
  tem?: number
}

export const BOND_DEFS: BondDef[] = [
  {
    ticker: "AL29",
    nombre: "Bono Soberano USD Ley Arg. 2029",
    moneda: "USD",
    ley: "local",
    cupon: 4.125,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2029-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 2.0625, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 2.0625, amortizacion: 6.667 },
      { fecha: "2026-01-09", cupon: 1.993, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.993, amortizacion: 6.667 },
      { fecha: "2027-01-09", cupon: 1.924, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.924, amortizacion: 6.667 },
      { fecha: "2028-01-09", cupon: 1.855, amortizacion: 0 },
      { fecha: "2028-07-09", cupon: 1.855, amortizacion: 6.667 },
      { fecha: "2029-01-09", cupon: 1.786, amortizacion: 0 },
      { fecha: "2029-07-09", cupon: 1.786, amortizacion: 6.665 },
    ],
  },
  {
    ticker: "AL30",
    nombre: "Bono Soberano USD Ley Arg. 2030",
    moneda: "USD",
    ley: "local",
    cupon: 0.5,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2030-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.25, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.825, amortizacion: 4.0 },
      { fecha: "2027-07-09", cupon: 1.789, amortizacion: 4.0 },
      { fecha: "2028-01-09", cupon: 1.754, amortizacion: 8.0 },
      { fecha: "2028-07-09", cupon: 1.683, amortizacion: 8.0 },
      { fecha: "2029-01-09", cupon: 1.612, amortizacion: 8.0 },
      { fecha: "2029-07-09", cupon: 1.541, amortizacion: 16.0 },
      { fecha: "2030-01-09", cupon: 1.399, amortizacion: 16.0 },
      { fecha: "2030-07-09", cupon: 1.257, amortizacion: 36.0 },
    ],
  },
  {
    ticker: "AL35",
    nombre: "Bono Soberano USD Ley Arg. 2035",
    moneda: "USD",
    ley: "local",
    cupon: 3.625,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2035-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.8125, amortizacion: 4.545 },
      { fecha: "2028-01-09", cupon: 1.73, amortizacion: 4.545 },
      { fecha: "2028-07-09", cupon: 1.648, amortizacion: 4.545 },
      { fecha: "2029-01-09", cupon: 1.566, amortizacion: 4.545 },
      { fecha: "2029-07-09", cupon: 1.484, amortizacion: 9.091 },
      { fecha: "2030-01-09", cupon: 1.319, amortizacion: 9.091 },
      { fecha: "2030-07-09", cupon: 1.154, amortizacion: 9.091 },
      { fecha: "2031-01-09", cupon: 0.99, amortizacion: 9.091 },
      { fecha: "2031-07-09", cupon: 0.825, amortizacion: 9.091 },
      { fecha: "2032-01-09", cupon: 0.66, amortizacion: 9.091 },
      { fecha: "2032-07-09", cupon: 0.495, amortizacion: 9.091 },
      { fecha: "2033-01-09", cupon: 0.33, amortizacion: 9.091 },
      { fecha: "2033-07-09", cupon: 0.165, amortizacion: 9.091 },
      { fecha: "2035-07-09", cupon: 0, amortizacion: 9.082 },
    ],
  },
  {
    ticker: "GD30",
    nombre: "Bono Soberano USD Ley NY 2030",
    moneda: "USD",
    ley: "NY",
    cupon: 0.5,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2030-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.25, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.825, amortizacion: 4.0 },
      { fecha: "2027-07-09", cupon: 1.789, amortizacion: 4.0 },
      { fecha: "2028-01-09", cupon: 1.754, amortizacion: 8.0 },
      { fecha: "2028-07-09", cupon: 1.683, amortizacion: 8.0 },
      { fecha: "2029-01-09", cupon: 1.612, amortizacion: 8.0 },
      { fecha: "2029-07-09", cupon: 1.541, amortizacion: 16.0 },
      { fecha: "2030-01-09", cupon: 1.399, amortizacion: 16.0 },
      { fecha: "2030-07-09", cupon: 1.257, amortizacion: 36.0 },
    ],
  },
  {
    ticker: "GD35",
    nombre: "Bono Soberano USD Ley NY 2035",
    moneda: "USD",
    ley: "NY",
    cupon: 3.625,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2035-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.8125, amortizacion: 4.545 },
      { fecha: "2028-01-09", cupon: 1.73, amortizacion: 4.545 },
      { fecha: "2028-07-09", cupon: 1.648, amortizacion: 4.545 },
      { fecha: "2029-01-09", cupon: 1.566, amortizacion: 4.545 },
      { fecha: "2029-07-09", cupon: 1.484, amortizacion: 9.091 },
      { fecha: "2030-01-09", cupon: 1.319, amortizacion: 9.091 },
      { fecha: "2030-07-09", cupon: 1.154, amortizacion: 9.091 },
      { fecha: "2031-01-09", cupon: 0.99, amortizacion: 9.091 },
      { fecha: "2031-07-09", cupon: 0.825, amortizacion: 9.091 },
      { fecha: "2032-01-09", cupon: 0.66, amortizacion: 9.091 },
      { fecha: "2032-07-09", cupon: 0.495, amortizacion: 9.091 },
      { fecha: "2033-01-09", cupon: 0.33, amortizacion: 9.091 },
      { fecha: "2033-07-09", cupon: 0.165, amortizacion: 9.091 },
      { fecha: "2035-07-09", cupon: 0, amortizacion: 9.082 },
    ],
  },
  {
    ticker: "GD41",
    nombre: "Bono Soberano USD Ley NY 2041",
    moneda: "USD",
    ley: "NY",
    cupon: 4.875,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2041-07-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2028-01-09", cupon: 2.4375, amortizacion: 2.0 },
      { fecha: "2028-07-09", cupon: 2.389, amortizacion: 2.0 },
      { fecha: "2029-01-09", cupon: 2.34, amortizacion: 2.0 },
      { fecha: "2029-07-09", cupon: 2.291, amortizacion: 4.0 },
      { fecha: "2030-01-09", cupon: 2.194, amortizacion: 4.0 },
      { fecha: "2030-07-09", cupon: 2.097, amortizacion: 4.0 },
      { fecha: "2031-01-09", cupon: 2.0, amortizacion: 4.0 },
      { fecha: "2031-07-09", cupon: 1.903, amortizacion: 8.0 },
      { fecha: "2032-01-09", cupon: 1.709, amortizacion: 8.0 },
      { fecha: "2032-07-09", cupon: 1.514, amortizacion: 8.0 },
      { fecha: "2033-01-09", cupon: 1.319, amortizacion: 8.0 },
      { fecha: "2033-07-09", cupon: 1.125, amortizacion: 8.0 },
      { fecha: "2034-01-09", cupon: 0.93, amortizacion: 8.0 },
      { fecha: "2034-07-09", cupon: 0.736, amortizacion: 8.0 },
      { fecha: "2035-01-09", cupon: 0.541, amortizacion: 8.0 },
      { fecha: "2035-07-09", cupon: 0.347, amortizacion: 8.0 },
      { fecha: "2041-07-09", cupon: 0, amortizacion: 14.0 },
    ],
  },
  {
    ticker: "AE38",
    nombre: "Bono Soberano USD Ley Arg. 2038",
    moneda: "USD",
    ley: "local",
    cupon: 1.0,
    amortizacion: "amortizing",
    emision: "2020-09-04",
    vencimiento: "2038-01-09",
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 2.125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 2.125, amortizacion: 0 },
      { fecha: "2028-01-09", cupon: 2.125, amortizacion: 3.333 },
      { fecha: "2028-07-09", cupon: 2.054, amortizacion: 3.333 },
      { fecha: "2029-01-09", cupon: 1.984, amortizacion: 3.333 },
      { fecha: "2029-07-09", cupon: 1.913, amortizacion: 6.667 },
      { fecha: "2030-01-09", cupon: 1.772, amortizacion: 6.667 },
      { fecha: "2030-07-09", cupon: 1.631, amortizacion: 6.667 },
      { fecha: "2031-01-09", cupon: 1.49, amortizacion: 6.667 },
      { fecha: "2031-07-09", cupon: 1.349, amortizacion: 6.667 },
      { fecha: "2032-01-09", cupon: 1.208, amortizacion: 6.667 },
      { fecha: "2032-07-09", cupon: 1.067, amortizacion: 6.667 },
      { fecha: "2033-01-09", cupon: 0.926, amortizacion: 6.667 },
      { fecha: "2033-07-09", cupon: 0.785, amortizacion: 6.667 },
      { fecha: "2034-01-09", cupon: 0.644, amortizacion: 6.667 },
      { fecha: "2034-07-09", cupon: 0.503, amortizacion: 6.667 },
      { fecha: "2035-01-09", cupon: 0.362, amortizacion: 6.667 },
      { fecha: "2038-01-09", cupon: 0, amortizacion: 6.663 },
    ],
  },
]

// Fallback estático de BONCAPs — solo para cuando BYMA falla.
// Actualizar con cada licitación del Tesoro (tickers = T{dia}{mes}{año}).
// El código de consumo filtra vencidos por fecha, así que entradas pasadas
// no aparecen en el screener, pero se deben limpiar para no acumular deuda.
export const CAP_INSTRUMENT_DEFS: CapInstrumentDef[] = [
  // 2026
  { ticker: "T15D6", tipo: "BONCAP", vencimiento: "2026-12-15" },
  // 2027 — instrumentos licitados por el Tesoro a lo largo de 2026
  { ticker: "T15E7", tipo: "BONCAP", vencimiento: "2027-01-15" },
  { ticker: "T30J7", tipo: "BONCAP", vencimiento: "2027-06-30" },
  { ticker: "T15D7", tipo: "BONCAP", vencimiento: "2027-12-15" },
]
