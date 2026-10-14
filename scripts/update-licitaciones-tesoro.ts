/**
 * update-licitaciones-tesoro.ts
 *
 * Descarga los comunicados de resultado de las licitaciones del Tesoro
 * (Secretaría de Finanzas, Min. Economía) y genera public/data/licitaciones-tesoro.json.
 *
 * Corre SOLO en GitHub Actions (o a mano en un entorno que pueda salir a la red):
 *   npx tsx scripts/update-licitaciones-tesoro.ts
 *
 * Configuración por variables de entorno (las URLs son SUPUESTAS, no verificadas):
 *   LICITACIONES_INDEX_URL  página índice con links a los comunicados
 *                           (default: https://www.argentina.gob.ar/economia/finanzas/licitaciones)
 *   LICITACIONES_URLS       lista separada por comas de comunicados puntuales (saltea el índice)
 *   LICITACIONES_MAX        máximo de comunicados a procesar por corrida (default 6)
 *
 * Degradación honesta: si no se obtiene/parsea ninguna licitación, NO se escribe
 * el JSON (se conserva el anterior) y el script sale con código 1. Las filas con
 * campos faltantes se guardan marcadas `incompleta: true`; nunca se inventan datos.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { extraerLinksComunicados, mergeLicitaciones, parseLicitacion, type Licitacion } from "../src/lib/licitaciones-tesoro"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, "..", "public", "data", "licitaciones-tesoro.json")

const INDEX_URL = process.env.LICITACIONES_INDEX_URL ?? "https://www.argentina.gob.ar/economia/finanzas/licitaciones"
const MAX = Number(process.env.LICITACIONES_MAX ?? 6)
const EXPLICIT = (process.env.LICITACIONES_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean)

async function descargar(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0)", Accept: "text/html,*/*" },
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}

async function main() {
  let urls = EXPLICIT
  if (urls.length === 0) {
    console.log(`Indice: ${INDEX_URL}`)
    const links = extraerLinksComunicados(await descargar(INDEX_URL), INDEX_URL)
    console.log(`  ${links.length} links candidatos`)
    urls = links.map((l) => l.url).slice(0, MAX)
  }

  const nuevas: Licitacion[] = []
  for (const url of urls.slice(0, MAX)) {
    try {
      const l = parseLicitacion(await descargar(url), { fuenteUrl: url })
      if (!l.fecha || l.instrumentos.length === 0) {
        console.warn(`  descartado (sin fecha o sin instrumentos): ${url}`)
        continue
      }
      console.log(`  ${l.fecha}: ${l.instrumentos.length} instrumentos${l.incompleta ? " [INCOMPLETA: " + l.faltantes.join(",") + "]" : ""}`)
      nuevas.push(l)
    } catch (e) {
      console.warn(`  fallo ${url}: ${(e as Error).message}`)
    }
  }

  if (nuevas.length === 0) {
    console.error("Sin licitaciones validas: se conserva el JSON anterior.")
    process.exit(1)
  }

  const previas: Licitacion[] = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, "utf8")).licitaciones ?? [] : []
  const licitaciones = mergeLicitaciones(previas, nuevas)
  const out = {
    fuente: { nombre: "Secretaría de Finanzas — Ministerio de Economía", url: INDEX_URL },
    unidad: "millones de pesos (VN) [supuesto, no verificado]",
    generado_en: new Date().toISOString(),
    cobertura: { desde: licitaciones[licitaciones.length - 1].fecha, hasta: licitaciones[0].fecha },
    total_licitaciones: licitaciones.length,
    licitaciones,
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8")
  console.log(`OK: ${licitaciones.length} licitaciones -> ${OUT_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
