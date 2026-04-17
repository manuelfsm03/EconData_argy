/**
 * Helpers centralizados de formateo de precios y porcentajes.
 * Bloomberg dark-theme: siempre usar en-US para números USD.
 */

/**
 * Formatea un precio en la moneda especificada.
 * Auto-detecta decimales según magnitud si no se especifican.
 *
 * @example fmtPrice(77640) → "$77,640"
 * @example fmtPrice(0.9996, "USD", 4) → "$0.9996"
 * @example fmtPrice(null) → "—"
 */
export function fmtPrice(
  val: number | null | undefined,
  currency = "USD",
  decimals?: number,
): string {
  if (val == null) return "—"

  let d = decimals
  if (d === undefined) {
    if (val > 1000) d = 0
    else if (val > 10) d = 2
    else d = 4
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(val)
}

/**
 * Formatea un porcentaje con signo + color para tema oscuro Bloomberg.
 *
 * @param pct         Valor en % (ej: 4.24 para +4.24%)
 * @param decimals    Decimales (default 2)
 * @param stablecoin  Si es stablecoin: color neutro cuando abs < 0.1%
 *
 * @returns { text, color } — usar text para el display, color para el style
 */
export function fmtPctColor(
  pct: number | null | undefined,
  decimals = 2,
  stablecoin = false,
): { text: string; color: string } {
  if (pct == null) return { text: "—", color: "#555" }

  if (stablecoin && Math.abs(pct) < 0.1) {
    return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(decimals)}%`, color: "#666" }
  }

  const sign = pct > 0 ? "+" : ""
  const color = pct > 0 ? "#4AF6C3" : pct < 0 ? "#FF433D" : "#888"
  return { text: `${sign}${pct.toFixed(decimals)}%`, color }
}

/**
 * Formatea un número como porcentaje simple (sin color).
 */
export function fmtPct(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—"
  return `${val >= 0 ? "+" : ""}${val.toFixed(decimals)}%`
}

/**
 * Formatea millones/billones de ARS con sufijo M/B.
 */
export function fmtARS(val: number | null | undefined): string {
  if (val == null) return "—"
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
  return `$${val.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}
