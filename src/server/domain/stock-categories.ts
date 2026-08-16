export const STOCK_CATEGORIES: Record<string, string[]> = {
  "Bancos y servicios financieros": ["GGAL", "BMA", "BBAR", "SUPV", "VALO", "BYMA", "MTR", "BHIP", "BPAT"],
  "Energía y servicios públicos": ["YPFD", "PAMP", "CEPU", "EDN", "TGSU2", "TGNO4", "TRAN", "CAPX", "CECO2", "CGPA2", "GBAN"],
  "Telecomunicaciones y medios": ["TECO2", "CVH", "GCLA"],
  "Materiales y construcción": ["TXAR", "ALUA", "LOMA", "HARG", "RIGO", "CELU", "DYCA", "GARO", "POLL"],
  "Industria y manufactura": ["AGRO", "MIRG", "LONG", "DOME", "FERR", "FIPL", "GRIM", "COME"],
  "Agro, alimentos y retail": ["MOLI", "MOLA", "MORI", "ESME", "HAVA", "LEDE", "SAMI", "PATA", "SEMI", "CRES"],
  "Inmobiliario y desarrollo": ["CTIO", "IRSA", "TGLT"],
  "Química, salud y agroquímicos": ["RICH", "INTR", "CARC", "ROSE"],
  "Infraestructura y concesiones": ["AUSO", "OEST"],
  "Tecnología y servicios": ["GAMI", "BOLT", "HSAT", "GCDI"],
}

export const MERVAL_TOP = ["GGAL", "BMA", "BBAR", "YPFD", "PAMP", "CEPU", "TECO2", "ALUA", "TXAR", "LOMA", "MIRG", "AGRO", "IRSA", "SUPV"]

export interface StockQuote {
  ticker: string
  category: string
  lastPrice: number | null
  closePrice: number | null
  openPrice: number | null
  change1D: number | null
  volume: number | null
  bid: number | null
  ask: number | null
  asOf?: string
  source?: "byma_data_open" | "rava"
  delayedMinutes?: number
}
