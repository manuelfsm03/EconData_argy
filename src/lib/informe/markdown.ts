/**
 * Parser del texto editorial del informe semanal.
 *
 * El texto lo escribe el equipo a mano en content/informes/<AAAA>-S<semana>.md.
 * NO lo genera ninguna IA: este módulo solo lo lee. Formato:
 *
 *   ---
 *   anio: 2026
 *   semana: 42
 *   fecha_corte: 2026-10-16
 *   ---
 *   ## deuda-usd
 *   Texto de la sección...
 *   ## credito
 *   ...
 *
 * Reglas (todas pensadas para que un archivo incompleto nunca rompa la página):
 *   - El frontmatter es opcional y todos sus campos también.
 *   - Una sección faltante, vacía o con solo comentarios <!-- --> devuelve null:
 *     la página muestra el gráfico solo, sin relleno.
 *   - Un encabezado `## algo` que no es una sección conocida se ignora y se
 *     reporta en `desconocidas` (para avisarle al autor, sin romper nada).
 */

export const SECCION_IDS = ["deuda-usd", "credito", "deuda-pesos", "tipo-de-cambio", "reservas"] as const
export type SeccionIdTexto = (typeof SECCION_IDS)[number]

export interface InformeMeta {
  anio: number | null
  semana: number | null
  /** Fecha de corte ISO AAAA-MM-DD, o null si el frontmatter no la trae o no es válida. */
  fechaCorte: string | null
  titulo: string | null
}

export interface InformeTexto {
  meta: InformeMeta
  /** Bloque de texto por sección; null = sin texto (se muestra solo el gráfico). */
  secciones: Record<SeccionIdTexto, string | null>
  /** Encabezados `## x` que no corresponden a ninguna sección conocida. */
  desconocidas: string[]
}

const ES_ISO = /^\d{4}-\d{2}-\d{2}$/

function sinComentarios(texto: string): string {
  return texto.replace(/<!--[\s\S]*?-->/g, "")
}

function entero(valor: string | undefined): number | null {
  if (valor == null) return null
  const n = Number.parseInt(valor, 10)
  return Number.isFinite(n) && String(n) === valor.trim() ? n : null
}

function parseFrontmatter(bloque: string): InformeMeta {
  const campos: Record<string, string> = {}
  for (const linea of bloque.split("\n")) {
    const m = linea.match(/^([A-Za-z_]+)\s*:\s*(.*?)\s*$/)
    if (m) campos[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, "")
  }
  const fecha = campos["fecha_corte"]
  return {
    anio: entero(campos["anio"]),
    semana: entero(campos["semana"]),
    fechaCorte: fecha && ES_ISO.test(fecha) ? fecha : null,
    titulo: campos["titulo"] ? campos["titulo"] : null,
  }
}

/** "2026-S42.md" -> { anio: 2026, semana: 42 }; cualquier otro nombre -> null. */
export function parseNombreArchivo(nombre: string): { anio: number; semana: number } | null {
  const m = nombre.match(/^(\d{4})-S(\d{1,2})\.md$/)
  if (!m) return null
  const semana = Number.parseInt(m[2], 10)
  if (semana < 1 || semana > 53) return null
  return { anio: Number.parseInt(m[1], 10), semana }
}

export function parseInforme(markdown: string): InformeTexto {
  const texto = markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
  let cuerpo = texto
  let meta: InformeMeta = { anio: null, semana: null, fechaCorte: null, titulo: null }

  const fm = texto.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (fm) {
    meta = parseFrontmatter(fm[1])
    cuerpo = texto.slice(fm[0].length)
  }

  const acumulado: Partial<Record<SeccionIdTexto, string[]>> = {}
  const desconocidas: string[] = []
  let actual: SeccionIdTexto | null = null
  let enDesconocida = false

  for (const linea of sinComentarios(cuerpo).split("\n")) {
    const h = linea.match(/^##\s+(.+?)\s*$/)
    if (h) {
      const id = h[1].toLowerCase()
      if ((SECCION_IDS as readonly string[]).includes(id)) {
        actual = id as SeccionIdTexto
        enDesconocida = false
        acumulado[actual] ??= []
      } else {
        actual = null
        enDesconocida = true
        desconocidas.push(h[1])
      }
      continue
    }
    if (actual && !enDesconocida) acumulado[actual]!.push(linea)
  }

  const secciones = {} as Record<SeccionIdTexto, string | null>
  for (const id of SECCION_IDS) {
    const limpio = (acumulado[id] ?? []).join("\n").trim()
    secciones[id] = limpio.length > 0 ? limpio : null
  }
  return { meta, secciones, desconocidas }
}

/** Bloques de texto para renderizar: párrafos o listas, sin HTML (el markdown se muestra como texto). */
export type Bloque = { tipo: "parrafo"; texto: string } | { tipo: "lista"; items: string[] }

export function bloquesDeTexto(texto: string): Bloque[] {
  const bloques: Bloque[] = []
  for (const trozo of texto.split(/\n{2,}/)) {
    const lineas = trozo.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lineas.length === 0) continue
    if (lineas.every((l) => /^[-*]\s+/.test(l))) {
      bloques.push({ tipo: "lista", items: lineas.map((l) => l.replace(/^[-*]\s+/, "")) })
    } else {
      bloques.push({ tipo: "parrafo", texto: lineas.join(" ") })
    }
  }
  return bloques
}
