/**
 * Familia dollar-linked: parsers y agregados PUROS (sin red), para poder testearlos.
 *
 * Qué es: bonos/letras en pesos cuyo capital ajusta por el dólar oficial.
 *
 * NO VERIFICADO EN VIVO (se armó sin red, por compliance): la forma exacta de la
 * respuesta del endpoint de universo de BYMA. Por eso el parser es tolerante:
 * acepta `data` o un array directo y varios nombres de campo. Validar contra la
 * respuesta real usando la env BYMA_DL_UNIVERSE_URL.
 */
import { DOLLAR_LINKED_CATALOGO } from "@/lib/dollar-linked-catalog"

export interface DollarLinkedInstrument {
  ticker: string
  vencimiento: string | null // YYYY-MM-DD si se pudo parsear
  descripcion: string | null
}

export interface VolumePoint {
  date: string // YYYY-MM-DD (hora Argentina)
  close: number | null
  volume: number | null
}

export interface AggregatedVolumePoint {
  date: string
  volume: number
  instruments: number // cuántos instrumentos aportaron dato ese día
}

/** Descripción que menciona dollar-linked / ajuste por dólar. */
const DESC_DL = /d[oó]lar[\s-]?linked|dollar[\s-]?linked|\bDL\b|ajust\w*\s+(?:por\s+)?(?:tipo de cambio|d[oó]lar)|tipo de cambio (?:inicial|aplicable)/i
/**
 * Patrón de ticker del Tesoro (TV.., TZV..). Es una CLASIFICACIÓN, no una lista
 * de tickers: puede sobre/sub-detectar. Se reemplaza con BYMA_DL_TICKER_REGEX.
 */
const TICKER_DL_DEFAULT = /^T(?:Z)?V[A-Z0-9]{2,3}$/

function ymd(value: unknown): string | null {
  if (typeof value !== "string") return null
  const s = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const latam = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (latam) return `${latam[3]}-${latam[2]}-${latam[1]}`
  return null
}

function firstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function tickerRegex(): RegExp {
  const custom = process.env.BYMA_DL_TICKER_REGEX
  if (custom) {
    try { return new RegExp(custom, "i") } catch { /* regex inválida: usar default */ }
  }
  return TICKER_DL_DEFAULT
}

/** Identifica dollar-linked por descripción o por patrón de ticker, y descarta vencidos. */
export function parseDollarLinkedUniverse(payload: unknown, now = new Date()): DollarLinkedInstrument[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : []
  const today = now.toISOString().slice(0, 10)
  const re = tickerRegex()
  const out = new Map<string, DollarLinkedInstrument>()

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue
    const row = raw as Record<string, unknown>
    const ticker = firstString(row, ["symbol", "ticker", "simbolo", "especie"])?.toUpperCase()
    if (!ticker) continue
    const descripcion = firstString(row, ["description", "denomination", "securityDesc", "name", "descripcion", "issuerName"])
    const esDL = re.test(ticker) || (descripcion != null && DESC_DL.test(descripcion))
    if (!esDL) continue
    const vencimiento = ymd(row.maturityDate ?? row.vencimiento ?? row.expirationDate)
    if (vencimiento && vencimiento < today) continue
    out.set(ticker, { ticker, vencimiento, descripcion })
  }

  return [...out.values()].sort((a, b) =>
    (a.vencimiento ?? "9999").localeCompare(b.vencimiento ?? "9999") || a.ticker.localeCompare(b.ticker))
}

/** Respaldo estático (hoy vacío; ver src/lib/dollar-linked-catalog.ts). */
export function dollarLinkedFromCatalog(): DollarLinkedInstrument[] {
  return DOLLAR_LINKED_CATALOGO.map((i) => ({ ticker: i.ticker, vencimiento: i.vencimiento ?? null, descripcion: null }))
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null // Number(null) daría 0: un cero falso
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Día calendario argentino (UTC-3) de un timestamp en segundos. */
function dayAR(tSeconds: number): string {
  return new Date((tSeconds - 3 * 3600) * 1000).toISOString().slice(0, 10)
}

/** Serie diaria (fecha, cierre, volumen) de la respuesta `history` de BYMA. */
export function parseBymaVolumeSeries(payload: unknown): VolumePoint[] {
  if (!payload || typeof payload !== "object") return []
  const p = payload as { s?: string; t?: unknown[]; c?: unknown[]; v?: unknown[] }
  if (p.s !== "ok" || !Array.isArray(p.t)) return []
  const out: VolumePoint[] = []
  p.t.forEach((t, i) => {
    const ts = num(t)
    if (ts == null || ts <= 0) return
    const close = num(p.c?.[i])
    const vol = num(p.v?.[i])
    // Filas sin cierre válido son relleno de BYMA, no una rueda real.
    if (close == null || close <= 0) return
    out.push({ date: dayAR(ts), close, volume: vol != null && vol >= 0 ? vol : null })
  })
  return out
}

/**
 * Volumen diario total de la familia = suma, por fecha, del campo `v` de cada
 * instrumento. Unidad: la que publica BYMA en `v` (se ASUME valor nominal, VN;
 * NO verificado). No es monto en pesos. Días sin ningún dato de volumen no se
 * emiten (nunca un cero inventado).
 */
export function aggregateFamilyVolume(seriesByTicker: Map<string, VolumePoint[]>): AggregatedVolumePoint[] {
  const byDate = new Map<string, { volume: number; instruments: number }>()
  for (const points of seriesByTicker.values()) {
    for (const pt of points) {
      if (pt.volume == null) continue
      const acc = byDate.get(pt.date) ?? { volume: 0, instruments: 0 }
      acc.volume += pt.volume
      acc.instruments += 1
      byDate.set(pt.date, acc)
    }
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
