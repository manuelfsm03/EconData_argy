function parseLocaleNumber(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.trim().match(/-?[\d.]+(?:,\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function extractRavaStockMetric(html: string, label: string): number | null {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`<span class="p2-ret-label">\\s*${safeLabel}:?\\s*<\\/span>\\s*<span class="p2-ret-val">([^<]+)`, "i"),
    new RegExp(`<dt>\\s*${safeLabel}:?\\s*<\\/dt>\\s*<dd>([^<]+)`, "i"),
    new RegExp(`<span>\\s*${safeLabel}:?\\s*<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
    new RegExp(`${safeLabel}:<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
    new RegExp(`>${safeLabel}<\\/span>\\s*<span class="bolder">([^<]+)`, "i"),
  ]

  for (const pattern of patterns) {
    const value = parseLocaleNumber(html.match(pattern)?.[1])
    if (value != null) return value
  }
  return null
}

export function parseRavaStockQuote(html: string): { lastPrice: number; previousClose: number | null } | null {
  const lastPrice = extractRavaStockMetric(html, "Precio")
  if (lastPrice == null) return null
  return { lastPrice, previousClose: extractRavaStockMetric(html, "Anterior") }
}
