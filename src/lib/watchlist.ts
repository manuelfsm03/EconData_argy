/**
 * Watchlist compartida ("monitor de activos").
 *
 * El screener de activos (AssetScreener) es el dueño visual de la watchlist,
 * pero otras vistas —como el screener de bonos— también agregan/sacan tickers.
 * Para que todos queden sincronizados en vivo (sin recargar), la fuente de
 * verdad es localStorage y los cambios se avisan con un CustomEvent.
 *
 * Formato de cada entrada: "<kind>:<TICKER>", ej. "bono:GD30", "accion:GGAL".
 */

export const WATCHLIST_STORAGE_KEY = "lapizarra.screener.activos.v1"
export const WATCHLIST_EVENT = "lapizarra:watchlist-changed"

export const WATCHLIST_DEFAULT = ["accion:GGAL", "accion:YPFD", "bono:AL30", "mundo:SP500"]

/** Lee la selección actual de la watchlist desde localStorage. */
export function readWatchlist(): string[] {
  if (typeof window === "undefined") return WATCHLIST_DEFAULT
  try {
    const stored = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "null")
    if (Array.isArray(stored) && stored.every((value) => typeof value === "string")) return stored
  } catch {
    // draft corrupto -> caemos al default
  }
  return WATCHLIST_DEFAULT
}

/** Persiste la selección y avisa a las demás vistas montadas. */
export function writeWatchlist(selection: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(selection))
  window.dispatchEvent(new CustomEvent<string[]>(WATCHLIST_EVENT, { detail: selection }))
}

/** Agrega o saca un ticker del monitor. Devuelve la nueva selección. */
export function toggleWatchlistId(id: string): string[] {
  const current = readWatchlist()
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
  writeWatchlist(next)
  return next
}
