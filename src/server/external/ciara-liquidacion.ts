/**
 * Liquidación de divisas del agro — CIARA-CEC (parser puro).
 *
 * ESTADO: NO VERIFICADO EN VIVO. Escrito sin acceso a ciaracec.com.ar (la
 * máquina de desarrollo no puede consultar hosts externos). Los parsers son
 * deliberadamente tolerantes y se validaron SOLO contra fixtures sintéticos.
 * Si el formato real del comunicado difiere, el parser devuelve null (no
 * inventa) y el script conserva el último dato bueno.
 *
 * Qué es: CIARA (oleaginosas) y CEC (cerealeros) publican cada mes un
 * comunicado con los dólares (en millones de USD) que liquidó el complejo
 * agroexportador. Es uno de los flujos más importantes de oferta de dólares
 * en el mercado de cambios argentino.
 *
 * Este módulo NO hace red: recibe texto/HTML y devuelve datos. Lo consume
 * scripts/update-agro-liquidacion.ts (corre en GitHub Actions).
 */

export type LiquidacionMensual = {
  /** Período "YYYY-MM". */
  periodo: string
  /** Millones de USD liquidados en el mes. */
  monto_musd: number
  /** URL del comunicado de donde salió el dato (trazabilidad). */
  fuente_url?: string
}

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12",
}

/** Rango de sanidad (millones de USD/mes). Fuera de esto se rechaza el dato. */
export const CIARA_RANGO_PLAUSIBLE_MUSD = { min: 100, max: 15_000 }

/** Saca etiquetas, scripts/estilos y entidades básicas; deja texto plano. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()
}

/** "2.346,5" -> 2346.5 ; "2.346.543.451" -> 2346543451 ; "2,5" -> 2.5. null si no es número. */
export function parseNumeroEs(raw: string): number | null {
  const s = raw.trim().replace(/[^\d.,]/g, "")
  if (!s || !/\d/.test(s)) return null
  let normalizado: string
  if (s.includes(".") && s.includes(",")) {
    // El último separador es el decimal.
    normalizado = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "")
  } else if (s.includes(",")) {
    normalizado = s.replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalizado = s.replace(/\./g, "") // puntos como separador de miles
  } else {
    normalizado = s
  }
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/** Primer "mes año" del texto -> "YYYY-MM", o null. */
export function detectarPeriodo(texto: string): string | null {
  const re = new RegExp(`\\b(${Object.keys(MESES).join("|")})\\s+(?:de\\s+|del\\s+)?(20\\d{2})\\b`, "i")
  const m = texto.match(re)
  return m ? `${m[2]}-${MESES[m[1].toLowerCase()]}` : null
}

/**
 * Busca el monto liquidado en MILLONES de USD. Acepta formas como
 * "US$ 2.346 millones", "USD 2.346,5 millones", "2.346 millones de dólares",
 * "USD 2.346.543.451" (dólares enteros), "US$ 2,3 mil millones".
 * Prioriza menciones cercanas a "liquid". Devuelve null si nada es plausible.
 */
export function detectarMontoMusd(texto: string): number | null {
  const patrones: RegExp[] = [
    /(?:US\$|USD|U\$S|u\$s)\s*([\d.,]+)\s*(mil\s+millones|millones|MM)?/gi,
    /([\d.,]+)\s*(mil\s+millones|millones)\s+de\s+(?:d[oó]lares|USD|US\$|U\$S)/gi,
  ]
  const candidatos: Array<{ valor: number; distancia: number }> = []
  const posLiquid = texto.search(/liquid/i)

  for (const re of patrones) {
    for (const m of texto.matchAll(re)) {
      const num = parseNumeroEs(m[1])
      if (num == null) continue
      const unidad = (m[2] ?? "").toLowerCase().replace(/\s+/g, " ")
      let musd: number
      if (unidad === "mil millones") musd = num * 1000
      else if (unidad === "millones" || unidad === "mm") musd = num
      else musd = num >= 1_000_000 ? num / 1_000_000 : num // dólares enteros -> millones
      const { min, max } = CIARA_RANGO_PLAUSIBLE_MUSD
      if (musd < min || musd > max) continue
      const distancia = posLiquid < 0 || m.index == null ? 1e9 : Math.abs(m.index - posLiquid)
      candidatos.push({ valor: Math.round(musd * 100) / 100, distancia })
    }
  }
  if (candidatos.length === 0) return null
  candidatos.sort((a, b) => a.distancia - b.distancia)
  return candidatos[0].valor
}

/** Parsea UN comunicado (HTML o texto). null si no se puede determinar período Y monto. */
export function parseComunicadoCiara(contenido: string, fuenteUrl?: string): LiquidacionMensual | null {
  const texto = htmlATexto(contenido)
  const periodo = detectarPeriodo(texto)
  const monto = detectarMontoMusd(texto)
  if (!periodo || monto == null) return null
  return { periodo, monto_musd: monto, ...(fuenteUrl ? { fuente_url: fuenteUrl } : {}) }
}

/**
 * Links candidatos a comunicados de liquidación dentro de una página de
 * listado. Filtra por texto/href que mencione "liquid" y resuelve relativos.
 */
export function extraerLinksComunicados(html: string, baseUrl: string, max = 12): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const texto = htmlATexto(m[2])
    if (!/liquid/i.test(href) && !/liquid/i.test(texto)) continue
    try {
      const abs = new URL(href, baseUrl).toString()
      if (!vistos.has(abs)) { vistos.add(abs); out.push(abs) }
    } catch { /* href inválido: se ignora */ }
    if (out.length >= max) break
  }
  return out
}

/** Une dos series por período; lo nuevo pisa a lo viejo del mismo mes. Ordenada ascendente. */
export function fusionarSeries(
  existente: LiquidacionMensual[],
  nuevo: LiquidacionMensual[],
): LiquidacionMensual[] {
  const porPeriodo = new Map<string, LiquidacionMensual>()
  for (const f of existente) porPeriodo.set(f.periodo, f)
  for (const f of nuevo) porPeriodo.set(f.periodo, f)
  return [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
}
