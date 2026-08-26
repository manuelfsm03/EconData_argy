/**
 * stale-cache.ts — Cache en memoria de dos niveles para endpoints de mercado.
 *
 * La idea es que NINGÚN endpoint devuelva 502 / error / array vacío cuando su
 * fuente de datos se cae. Para eso guardamos dos cosas por cada "clave":
 *
 * Nivel 1 — "fresco": una respuesta con vencimiento (TTL). Mientras no vence,
 *   se sirve tal cual sin volver a pegarle a la fuente (ahorra requests).
 * Nivel 2 — "último bueno" (stale): SIEMPRE guardamos la última respuesta
 *   exitosa, sin vencimiento, con su timestamp. Si todas las fuentes en vivo
 *   fallan, servimos ese dato viejo con un flag { stale: true, stale_since }
 *   en lugar de tirar un error.
 *
 * Es un Map en memoria del proceso de Node: no persiste entre reinicios ni se
 * comparte entre instancias, pero alcanza para absorber caídas transitorias de
 * las fuentes dentro de una instancia viva.
 *
 * Las claves deben ser únicas por endpoint (ej. "internacional:fx",
 * "mundo:snapshot", "ust-curve:yield") porque el Map es compartido.
 */

// Entrada del cache "fresco": el dato + el momento (epoch ms) en que vence.
type FreshEntry = { data: unknown; expiry: number }

// Entrada del "último bueno": el dato + el momento (epoch ms) en que se guardó.
type GoodEntry = { data: unknown; savedAt: number }

const _fresco = new Map<string, FreshEntry>()
const _ultimoBueno = new Map<string, GoodEntry>()

/**
 * Devuelve el dato "fresco" si todavía no venció; si venció o no existe, null.
 */
export function leerFresco<T>(clave: string): T | null {
  const e = _fresco.get(clave)
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}

/**
 * Guarda una respuesta EXITOSA. Escribe en los dos niveles:
 *  - como "fresco" con el TTL indicado (en segundos), y
 *  - como "último bueno" (sin vencimiento) para poder servirlo stale más tarde.
 * Llamar SOLO cuando el dato es válido (no guardar respuestas vacías/parciales
 * que ensuciarían el fallback).
 */
export function guardarExito<T>(clave: string, data: T, ttlSeg: number): void {
  const ahora = Date.now()
  _fresco.set(clave, { data, expiry: ahora + ttlSeg * 1000 })
  _ultimoBueno.set(clave, { data, savedAt: ahora })
}

/**
 * Devuelve el último dato bueno guardado (sin importar cuán viejo sea) junto con
 * su timestamp ISO (staleSince), o null si nunca hubo una respuesta exitosa.
 * Se usa como último recurso cuando TODAS las fuentes en vivo fallaron.
 */
export function leerUltimoBueno<T>(clave: string): { data: T; staleSince: string } | null {
  const e = _ultimoBueno.get(clave)
  if (!e) return null
  return { data: e.data as T, staleSince: new Date(e.savedAt).toISOString() }
}

/**
 * Invalida el nivel "fresco" de una clave (deja intacto el "último bueno"),
 * forzando que el próximo GET vuelva a consultar la fuente en vivo. Útil tras
 * una escritura admin que debe reflejarse sin esperar el TTL.
 */
export function borrarFresco(clave: string): void {
  _fresco.delete(clave)
}
