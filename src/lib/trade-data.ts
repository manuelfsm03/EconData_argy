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

// Importaciones CIF por país de origen, mismos 10 socios que PARTNER_EXPORT_SERIES,
// dataset 78 "Importaciones CIF por región y país" (datos.gob.ar). Series MENSUALES
// (código "3" = R/P1M) -- más frescas que las de exportación (dataset 357, anual).
// Verificadas una por una contra la API en vivo el 2026-08-15 para evitar confundir
// IDs parecidos (ej. "78.3_III_0_A_23" = India vs "78.3_III_0_A_24" = Italia).
export const PARTNER_IMPORT_SERIES = [
  { id: "78.3_IIB_0_A_24", nombre: "Brasil", iso2: "BR" },
  { id: "78.3_IIC_0_A_23", nombre: "China", iso2: "CN" },
  { id: "78.3_IIM_0_A_22_15", nombre: "Estados Unidos", iso2: "US" },
  { id: "78.3_IICH_0_A_23", nombre: "Chile", iso2: "CL" },
  { id: "78.3_III_0_A_23", nombre: "India", iso2: "IN" },
  { id: "78.3_IIA_0_A_26", nombre: "Alemania", iso2: "DE" },
  { id: "78.3_IIPB_0_A_30", nombre: "Países Bajos", iso2: "NL" },
  { id: "78.3_IIU_0_A_25", nombre: "Uruguay", iso2: "UY" },
  { id: "78.3_IIE_0_A_24", nombre: "España", iso2: "ES" },
  { id: "78.3_III_0_A_24", nombre: "Italia", iso2: "IT" },
] as const

export interface TradePartnerExport {
  nombre: string
  iso2: string
  expo: number | null
  impo: number | null
  saldo: number | null
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

/**
 * Última fila de importaciones mensuales por país (dataset 78). Devuelve el
 * período real de esa fila -- NO asumir que coincide con el año de
 * parsePartnerExportPayload(): las exportaciones son anuales y las
 * importaciones mensuales, vintages distintos por diseño de la fuente.
 */
export function parsePartnerImportPayload(payload: SeriesPayload): {
  periodo: string | null
  values: Record<string, number | null>
  liveCount: number
} {
  const row = Array.isArray(payload.data?.[0]) ? payload.data[0] : []
  const periodo = typeof row[0] === "string" ? row[0].slice(0, 7) : null

  const values: Record<string, number | null> = {}
  let liveCount = 0
  PARTNER_IMPORT_SERIES.forEach((partner, index) => {
    const raw = row[index + 1]
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null
    values[partner.nombre] = value
    if (value != null) liveCount += 1
  })

  return { periodo, values, liveCount }
}

export function tradeBalanceMatches(exportsValue: number, importsValue: number, balanceValue: number, tolerance = 0.01): boolean {
  return Math.abs(exportsValue - importsValue - balanceValue) <= tolerance
}
