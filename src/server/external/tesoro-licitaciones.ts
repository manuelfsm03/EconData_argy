import { fetchRegistered } from "@/server/http/fetch-source"

/**
 * Resultados de licitaciones del Tesoro Nacional.
 *
 * Fuente: notas de resultado en argentina.gob.ar/noticias/resultado-de-la-licitacion-...
 * (antes se scrapeaban páginas individuales que el sitio dio de baja; ahora los
 * resultados se publican como notas HTML con un formato estructurado estable).
 *
 * El texto de cada nota trae:
 *   - "Se recibieron ofertas por un total de valor efectivo de $ X billones,
 *      y se adjudicó un total de valor efectivo $ Y billones."
 *   - Por instrumento: "... (TICKER - reapertura/nueva) $ VNOof $ VNOadj $ VEadj
 *      $ PrecioCorte TIREA% $ VNOcirc"  (o USD para los dolarizados)
 */

const BASE_GOB = "https://www.argentina.gob.ar"
const FEED_NOTICIAS = `${BASE_GOB}/economia/finanzas/noticias`

export interface InstrumentoLicitado {
  ticker: string
  tirea: number | null
}

export interface LicitacionResultado {
  fecha: string        // ISO YYYY-MM-DD (o "" si no se pudo parsear)
  fechaLabel: string   // "12 de agosto de 2026"
  moneda: "ARS" | "USD"
  ofertado: number | null
  adjudicado: number | null
  unidad: string       // "billones $" | "millones USD"
  coberturaPct: number | null   // ofertado / adjudicado * 100 (demanda vs adjudicado)
  instrumentos: InstrumentoLicitado[]
  url: string
  pdfUrl: string | null
}

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12",
}

/** "12 de agosto de 2026" -> "2026-08-12" */
function fechaAISO(label: string): string {
  const m = label.match(/(\d{1,2}) de (\w+) de (\d{4})/i)
  if (!m) return ""
  const mes = MESES[m[2].toLowerCase()]
  if (!mes) return ""
  return `${m[3]}-${mes}-${m[1].padStart(2, "0")}`
}

/** "6,49" -> 6.49 ; "3.631.315" -> 3631315 (formato es-AR: . miles, , decimal) */
function parseNum(s: string): number | null {
  const limpio = s.trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : null
}

/** Junta el feed de noticias y devuelve los links de resultados de licitación. */
export async function fetchLicitacionLinks(n: number): Promise<string[]> {
  const res = await fetchRegistered(FEED_NOTICIAS, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    next: { revalidate: 21_600 },
  })
  if (!res.ok) throw new Error(`feed noticias ${res.status}`)
  const html = await res.text()

  const links: string[] = []
  const re = /href="(\/noticias\/resultado-de-la-(?:licitacion-por-efectivo|segunda-vuelta)[^"]*)"/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const url = BASE_GOB + m[1]
    if (!links.includes(url)) links.push(url)
  }
  return links.slice(0, n)
}

export async function parsearResultado(url: string): Promise<LicitacionResultado | null> {
  const res = await fetchRegistered(url, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    next: { revalidate: 21_600 },
  })
  if (!res.ok) return null
  const rawHtml = await res.text()

  // Link de descarga (PDF con el detalle completo), si está.
  const pdfMatch = rawHtml.match(/href="(https?:\/\/[^"]*sites\/default\/files[^"]*\.pdf)"/i)
  const pdfUrl = pdfMatch ? pdfMatch[1] : null

  // Texto plano colapsado.
  const texto = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

  // Fecha: la nota trae un <time> con "X de mes de YYYY" cerca del encabezado.
  const fechaM = texto.match(/(\d{1,2} de \w+ de \d{4})/)
  const fechaLabel = fechaM ? fechaM[1] : ""
  const fecha = fechaLabel ? fechaAISO(fechaLabel) : ""

  // Titular con ofertado y adjudicado (formato de las licitaciones por efectivo).
  const head = texto.match(
    /ofertas por un total de valor efectivo de\s*(\$|USD)\s*([\d.,]+)\s*(billones|millones).{0,80}?adjudic\S*\s*(?:un total de valor efectivo)?\s*(\$|USD)?\s*([\d.,]+)\s*(billones|millones)/i,
  )
  let ofertado: number | null = null
  let adjudicado: number | null = null
  let moneda: "ARS" | "USD" = "ARS"
  let unidad = ""
  if (head) {
    moneda = head[1].toUpperCase() === "USD" ? "USD" : "ARS"
    ofertado = parseNum(head[2])
    adjudicado = parseNum(head[5])
    unidad = `${head[6].toLowerCase()} ${moneda === "USD" ? "USD" : "$"}`
  } else {
    // Segundas vueltas: el titular solo trae el ofertado; el adjudicado aparece
    // en la fila "Total Valor Efectivo Adjudicado (*) USD X".
    const of = texto.match(/valor efectivo de\s*(\$|USD)\s*([\d.,]+)\s*(billones|millones)/i)
    const adj = texto.match(/Total Valor Efectivo Adjudicado\s*\(\*\)\s*(\$|USD)\s*([\d.,]+)/i)
    if (of) { moneda = of[1].toUpperCase() === "USD" ? "USD" : "ARS"; ofertado = parseNum(of[2]); unidad = `${of[3].toLowerCase()} ${moneda === "USD" ? "USD" : "$"}` }
    if (adj) { adjudicado = parseNum(adj[2]); if (!of) moneda = adj[1].toUpperCase() === "USD" ? "USD" : "ARS" }
  }

  const coberturaPct =
    ofertado != null && adjudicado != null && adjudicado > 0
      ? Number(((ofertado / adjudicado) * 100).toFixed(0))
      : null

  // Instrumentos: "(TICKER - reapertura|nueva) ... TIREA%"
  const instrumentos: InstrumentoLicitado[] = []
  const instRe = /\(([A-Z]{1,4}\d{1,2}[A-Z]?\d?)\s*[-–]\s*(?:reapertura|nueva)\)([^()]*?)(\d{1,3},\d{1,2})\s*%/gi
  let im
  while ((im = instRe.exec(texto)) !== null) {
    const ticker = im[1].toUpperCase()
    if (!instrumentos.some((i) => i.ticker === ticker)) {
      instrumentos.push({ ticker, tirea: parseNum(im[3]) })
    }
    if (instrumentos.length >= 12) break
  }

  // Si no se pudo sacar nada útil, descartar (no es una nota de resultado válida).
  if (!fecha && adjudicado == null && instrumentos.length === 0) return null

  return { fecha, fechaLabel, moneda, ofertado, adjudicado, unidad, coberturaPct, instrumentos, url, pdfUrl }
}

/** Últimas N licitaciones con resultado, ordenadas de más nueva a más vieja. */
export async function getUltimasLicitaciones(n: number): Promise<LicitacionResultado[]> {
  const links = await fetchLicitacionLinks(n * 2) // pedimos de más por si alguna no parsea
  const parsed = await Promise.all(links.map((u) => parsearResultado(u)))
  const ok = parsed.filter((r): r is LicitacionResultado => r !== null)
  ok.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return ok.slice(0, n)
}
