/**
 * granos.ar — API pública (monitor agropecuario argentino).
 *
 * Ellos exponen esta API para consumo de terceros: CORS abierto, sin key,
 * licencia de uso libre con atribución (que rendimos en la UI). La descarga
 * vive en el endpoint; acá van solo el parseo y el armado de los tipos.
 *
 * Base: https://granosar.lfcaucino.workers.dev/api/v1
 * Se usan dos endpoints:
 *   /pizarra           → precios de pizarra Rosario por grano (ARS/tn y USD/tn)
 *   /cbot/diferencial  → FOB local vs CBOT por grano (el "descuento" argentino)
 */

export const GRANOS_AR_BASE = "https://granosar.lfcaucino.workers.dev/api/v1"

export type PrecioGrano = {
  grano: string
  arsTn: number | null
  usdTn: number | null
  variacionPct: number | null
}

export type DiferencialGrano = {
  grano: string
  fobUsdTn: number | null
  cbotUsdTn: number | null
  diferencialUsdTn: number | null
}

export type PreciosAgro = {
  fecha: string
  tipoCambio: number | null
  fuentePrecios: string
  precios: PrecioGrano[]
  diferenciales: DiferencialGrano[]
}

/** Sobre estándar de la API de granos.ar: { meta, data } | { meta, error }. */
type SobreGranos<T> = { meta?: unknown; data?: T; error?: string }

type PizarraData = {
  fecha?: string
  tipo_cambio_bna_divisas?: number
  fuente_precios?: string
  granos?: Record<string, { ars_tn?: number; usd_tn?: number; variacion_pct_vs_rueda_anterior?: number }>
}

type DiferencialData = {
  fecha?: string
  tipo_cambio?: { valor?: number }
} & Record<string, unknown>

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null

const cap = (s: string): string => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1))

/** Los 5 granos de la pizarra, en el orden en que se muestran. */
const ORDEN = ["soja", "maiz", "trigo", "sorgo", "girasol"] as const

export function parsePizarra(sobre: SobreGranos<PizarraData>): {
  fecha: string
  tipoCambio: number | null
  fuentePrecios: string
  precios: PrecioGrano[]
} | null {
  const d = sobre.data
  if (!d || !d.granos) return null
  const precios: PrecioGrano[] = ORDEN.filter(g => d.granos![g]).map(g => {
    const x = d.granos![g]
    return {
      grano: cap(g === "maiz" ? "maíz" : g),
      arsTn: num(x.ars_tn),
      usdTn: num(x.usd_tn),
      variacionPct: num(x.variacion_pct_vs_rueda_anterior),
    }
  })
  if (precios.length === 0) return null
  return {
    fecha: typeof d.fecha === "string" ? d.fecha : "",
    tipoCambio: num(d.tipo_cambio_bna_divisas),
    fuentePrecios: typeof d.fuente_precios === "string" ? d.fuente_precios : "granos.ar",
    precios,
  }
}

export function parseDiferencial(sobre: SobreGranos<DiferencialData>): DiferencialGrano[] {
  const d = sobre.data
  if (!d) return []
  const salida: DiferencialGrano[] = []
  for (const g of ["soja", "maiz", "trigo"] as const) {
    const x = d[g] as { fob_usd_tn?: number; cbot_usd_tn?: number; diferencial_usd_tn?: number } | undefined
    if (!x) continue
    salida.push({
      grano: cap(g === "maiz" ? "maíz" : g),
      fobUsdTn: num(x.fob_usd_tn),
      cbotUsdTn: num(x.cbot_usd_tn),
      diferencialUsdTn: num(x.diferencial_usd_tn),
    })
  }
  return salida
}

/** Une pizarra + diferencial en el payload que consume la UI. */
export function combinarPrecios(
  pizarra: SobreGranos<PizarraData>,
  diferencial: SobreGranos<DiferencialData>,
): PreciosAgro | null {
  const p = parsePizarra(pizarra)
  if (!p) return null
  return {
    fecha: p.fecha,
    tipoCambio: p.tipoCambio,
    fuentePrecios: p.fuentePrecios,
    precios: p.precios,
    diferenciales: parseDiferencial(diferencial),
  }
}
