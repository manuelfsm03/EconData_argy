/**
 * Tasas de letras en pesos (LECAP/BONCAP) desde ArgentinaDatos.
 *
 * POR QUÉ EXISTE ESTO
 * El screener de LECAP mostraba TIR, TEA y TEM en null desde siempre. No era un
 * dato que se hubiera caído: esas columnas salían únicamente de la tabla
 * `cap_instruments`, y lo único que escribe esa tabla es `prisma/seed-bonds.ts`,
 * que carga ticker, tipo y vencimiento — nunca las tasas. O sea que estaban
 * garantizadas en null por construcción.
 *
 * POR QUÉ NO SE CALCULAN ACÁ
 * Una LECAP capitaliza a una tasa fija desde la emisión, así que el pago final
 * NO es 100 por cada 100 de valor nominal: depende de la tasa licitada y de la
 * fecha de emisión. Sin esa condición de emisión no hay TIR posible a partir del
 * precio (se ve a simple vista en S30O6, que cotiza sobre 133). El repositorio
 * ya había tomado la decisión de no publicar tasas sin cashflow verificable
 * (ver bond-instrument-catalog.ts), y esa decisión se mantiene: acá no se
 * inventa una tasa, se toma de una fuente que publica la suya.
 *
 * LA FUENTE
 * ArgentinaDatos ya es fuente registrada del proyecto (`argentina_datos`) y
 * publica, por letra, TNA, TEA y TEM junto con el precio con el que las calculó.
 * Que venga el precio de referencia es lo que permite no mezclar: si el precio
 * que muestra el panel (BYMA) se despegó del de la fuente, las tasas no se
 * publican, porque describirían otro precio. Ver `tasasAplicables`.
 */

import { fetchRegistered } from "@/server/http/fetch-source"

const URL_LETRAS = "https://api.argentinadatos.com/v1/finanzas/letras"

/** Diferencia máxima tolerada entre el precio del panel y el de la fuente. */
export const TOLERANCIA_PRECIO_PCT = 1

const TTL_MS = 10 * 60 * 1000

export interface TasasLetra {
  ticker: string
  /** Precio con el que la fuente calculó las tasas. */
  precioReferencia: number | null
  /** Tasa nominal anual. */
  tna: number | null
  /** Tasa efectiva anual. */
  tea: number | null
  /** Tasa efectiva mensual. */
  tem: number | null
  vencimiento: string | null
}

interface LetraCruda {
  ticker?: unknown
  precioArs?: unknown
  tnaPorcentaje?: unknown
  teaPorcentaje?: unknown
  temPorcentaje?: unknown
  fechaVencimiento?: unknown
}

/**
 * Número finito, o null. Las tasas pueden ser negativas, así que no se filtra
 * por signo.
 *
 * El chequeo de tipo va antes de convertir a propósito: `Number(null)` y
 * `Number("")` devuelven 0, así que un campo vacío de la fuente se publicaría
 * como una tasa de 0%, que es un dato inventado.
 */
function numeroFinito(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null
  if (typeof valor !== "string" || valor.trim() === "") return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export interface LetrasParseadas {
  letras: Map<string, TasasLetra>
  /** Momento del dato declarado por la fuente. */
  asOf: string | null
}

export function parseLetras(payload: unknown): LetrasParseadas {
  const vacio: LetrasParseadas = { letras: new Map(), asOf: null }
  if (!payload || typeof payload !== "object") return vacio

  const raiz = payload as { letras?: unknown; fechaActualizacion?: unknown }
  if (!Array.isArray(raiz.letras)) return vacio

  const asOf = typeof raiz.fechaActualizacion === "string" ? raiz.fechaActualizacion : null
  const letras = new Map<string, TasasLetra>()

  for (const fila of raiz.letras) {
    if (!fila || typeof fila !== "object") continue
    const cruda = fila as LetraCruda
    if (typeof cruda.ticker !== "string" || cruda.ticker.trim() === "") continue

    const tna = numeroFinito(cruda.tnaPorcentaje)
    const tea = numeroFinito(cruda.teaPorcentaje)
    const tem = numeroFinito(cruda.temPorcentaje)
    // Una fila sin ninguna tasa no aporta nada: se descarta para que el consumidor
    // distinga "no está en la fuente" de "está pero sin tasas".
    if (tna == null && tea == null && tem == null) continue

    const precio = numeroFinito(cruda.precioArs)
    letras.set(cruda.ticker.trim().toUpperCase(), {
      ticker: cruda.ticker.trim().toUpperCase(),
      precioReferencia: precio != null && precio > 0 ? precio : null,
      tna,
      tea,
      tem,
      vencimiento: typeof cruda.fechaVencimiento === "string" ? cruda.fechaVencimiento : null,
    })
  }

  return { letras, asOf }
}

/**
 * Decide si las tasas de la fuente describen el precio que muestra el panel.
 *
 * Devuelve null cuando los precios se despegaron más de la tolerancia: publicar
 * una TEA calculada sobre otro precio sería peor que no publicar nada, porque el
 * usuario la leería como el rendimiento de la fila que está viendo.
 *
 * Si el panel no tiene precio propio, las tasas sí se publican: no hay nada con
 * qué contradecirse, y vienen con su propio precio de referencia.
 */
export function tasasAplicables(
  tasas: TasasLetra | undefined,
  precioPanel: number | null | undefined,
  toleranciaPct: number = TOLERANCIA_PRECIO_PCT,
): TasasLetra | null {
  if (!tasas) return null
  if (precioPanel == null || precioPanel <= 0) return tasas
  if (tasas.precioReferencia == null) return tasas

  const desvioPct = Math.abs(precioPanel - tasas.precioReferencia) / tasas.precioReferencia * 100
  return desvioPct <= toleranciaPct ? tasas : null
}

let cache: { data: LetrasParseadas; expira: number } | null = null

/**
 * Trae las tasas de la fuente. Ante cualquier falla devuelve el mapa vacío: el
 * screener tiene que poder seguir mostrando precios aunque las tasas no estén.
 */
export async function fetchTasasLetras(): Promise<LetrasParseadas> {
  const ahora = Date.now()
  if (cache && cache.expira > ahora) return cache.data

  try {
    const respuesta = await fetchRegistered(URL_LETRAS, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 600 },
    })
    if (!respuesta.ok) return cache?.data ?? { letras: new Map(), asOf: null }

    const parseado = parseLetras(await respuesta.json())
    if (parseado.letras.size === 0) return cache?.data ?? parseado

    cache = { data: parseado, expira: ahora + TTL_MS }
    return parseado
  } catch {
    return cache?.data ?? { letras: new Map(), asOf: null }
  }
}

/** Solo para tests: limpia el cache de módulo. */
export function _resetCacheLetras(): void {
  cache = null
}
