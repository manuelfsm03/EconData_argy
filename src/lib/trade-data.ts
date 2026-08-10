export const MACRO_TRADE_SERIES_IDS = {
  exportaciones: "74.3_IET_0_M_16",
  importaciones: "74.3_IIT_0_M_25",
  saldoComercial: "74.3_ISC_0_M_19",
} as const

export const PARTNER_EXPORT_SERIES = [
  { id: "357.1_EXPORTACIOSIL__28", nombre: "Brasil", iso2: "BR" },
  { id: "357.1_EXPORTACIOINA__27", nombre: "China", iso2: "CN" },
  { id: "357.1_EXPORTACIODOS__36", nombre: "Estados Unidos", iso2: "US" },
  { id: "357.1_EXPORTACIOILE__27", nombre: "Chile", iso2: "CL" },
  { id: "357.1_EXPORTACIODIA__27", nombre: "India", iso2: "IN" },
  { id: "357.1_EXPORTACIONIA__30", nombre: "Alemania", iso2: "DE" },
  { id: "357.1_EXPORTACIOJOS__34", nombre: "Países Bajos", iso2: "NL" },
  { id: "357.1_EXPORTACIOUAY__29", nombre: "Uruguay", iso2: "UY" },
  { id: "357.1_EXPORTACIONIA__29", nombre: "España", iso2: "ES" },
  { id: "357.1_EXPORTACIOLIA__28", nombre: "Italia", iso2: "IT" },
] as const

export interface TradePartnerExport {
  nombre: string
  iso2: string
  expo: number | null
  impo: null
  saldo: null
  total: number | null
}

interface SeriesPayload {
  data?: unknown[][]
}

export function parsePartnerExportPayload(payload: SeriesPayload): {
  year: string | null
  partners: TradePartnerExport[]
  liveCount: number
} {
  const row = Array.isArray(payload.data?.[0]) ? payload.data[0] : []
  const year = typeof row[0] === "string" ? row[0].slice(0, 4) : null

  const partners = PARTNER_EXPORT_SERIES.map((partner, index) => {
    const raw = row[index + 1]
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null
    return {
      nombre: partner.nombre,
      iso2: partner.iso2,
      expo: value,
      impo: null,
      saldo: null,
      total: value,
    }
  })

  return {
    year,
    partners,
    liveCount: partners.filter((partner) => partner.expo != null).length,
  }
}

export function tradeBalanceMatches(exportsValue: number, importsValue: number, balanceValue: number, tolerance = 0.01): boolean {
  return Math.abs(exportsValue - importsValue - balanceValue) <= tolerance
}
