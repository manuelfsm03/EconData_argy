export interface EcbFxRate {
  par: string
  nombre: string
  valor: number
  fecha: string | null
}

const PAIR_META: Record<string, { nombre: string }> = {
  USD: { nombre: "Dólar estadounidense" },
  GBP: { nombre: "Libra esterlina" },
  JPY: { nombre: "Yen japonés" },
  CAD: { nombre: "Dólar canadiense" },
  AUD: { nombre: "Dólar australiano" },
  CHF: { nombre: "Franco suizo" },
  CNY: { nombre: "Yuan chino" },
  SEK: { nombre: "Corona sueca" },
  NOK: { nombre: "Corona noruega" },
  MXN: { nombre: "Peso mexicano" },
  BRL: { nombre: "Real brasileño" },
}

export function parseEcbRatesCsv(text: string): EcbFxRate[] {
  const lines = text.trim().split("\n")
  const header = lines[0]?.split(",").map((value) => value.trim().replace(/"/g, ""))
  if (!header) return []

  const keyIdx = header.indexOf("KEY")
  const currencyIdx = header.indexOf("CURRENCY")
  const dateIdx = header.indexOf("TIME_PERIOD")
  const valueIdx = header.indexOf("OBS_VALUE")
  if (keyIdx < 0 || valueIdx < 0) return []

  const rates: EcbFxRate[] = []
  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split(",").map((value) => value.trim().replace(/"/g, ""))
    if (!columns[keyIdx]) continue
    const keyParts = columns[keyIdx].split(".")
    const currency = currencyIdx >= 0 ? columns[currencyIdx] : keyParts[keyParts.indexOf("D") + 1]
    const value = Number.parseFloat(columns[valueIdx] ?? "")
    if (!currency || !PAIR_META[currency] || !Number.isFinite(value)) continue
    rates.push({
      par: `EUR/${currency}`,
      nombre: PAIR_META[currency].nombre,
      valor: Number.parseFloat(value.toFixed(5)),
      fecha: dateIdx >= 0 ? (columns[dateIdx] ?? null) : null,
    })
  }
  return rates
}
