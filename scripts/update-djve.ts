/**
 * update-djve.ts
 *
 * Baja el dataset de DJVE (Declaraciones Juradas de Venta al Exterior) del
 * portal de datos abiertos del Ministerio de Agricultura (CKAN) y genera
 * public/data/djve-mensual.json: toneladas registradas por cultivo y mes.
 *
 * ESTADO: NO VERIFICADO EN VIVO. Se escribió sin poder consultar
 * datos.magyp.gob.ar desde la máquina de desarrollo. Corre en GitHub Actions
 * (.github/workflows/update-djve.yml). Validar la primera corrida a mano con
 * `gh workflow run update-djve.yml` y revisar el log.
 *
 * Patrón CKAN (igual que origin/fix/agro-siia-ckan): se pregunta al catálogo
 * (package_show) cuál es el CSV vigente, en vez de fijar una URL de descarga.
 *
 * Configuración por env (todo opcional):
 *   DJVE_CSV_URL            URL directa del CSV (salta CKAN)
 *   DJVE_CKAN_BASE          default https://datos.magyp.gob.ar
 *   DJVE_CKAN_PACKAGE_ID    slug/id del dataset (default "declaraciones-juradas-de-venta-al-exterior" — SUPUESTO, confirmar)
 *   DJVE_RESOURCE_REGEX     filtro de nombre del recurso (default: cualquier CSV)
 *   DJVE_DESDE              "YYYY-MM" inicio del agregado (default 2019-01)
 *
 * Degradación: si algo falla NO se toca el JSON (último dato bueno) y se emite
 * un warning visible en Actions. Nunca se escriben datos inventados.
 *
 * Uso manual: npx tsx scripts/update-djve.ts
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { agregarDjvePorMes, decodificarCsv, elegirRecursoCkan, parseDjveCsv } from "../src/server/external/djve"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "djve-mensual.json")

const CKAN_BASE = process.env.DJVE_CKAN_BASE ?? "https://datos.magyp.gob.ar"
const PACKAGE_ID = process.env.DJVE_CKAN_PACKAGE_ID ?? "declaraciones-juradas-de-venta-al-exterior"
const DESDE = process.env.DJVE_DESDE ?? "2019-01"
const HEADERS = { "User-Agent": "EconData-La-Pizarra/1.0 (+datos abiertos; uso no comercial)", Accept: "*/*" }

function advertir(msg: string): void {
  console.warn(`::warning::[djve] ${msg}`)
}

async function resolverUrl(): Promise<string> {
  if (process.env.DJVE_CSV_URL) return process.env.DJVE_CSV_URL
  const res = await fetch(`${CKAN_BASE}/api/3/action/package_show?id=${encodeURIComponent(PACKAGE_ID)}`, {
    headers: { ...HEADERS, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`CKAN package_show HTTP ${res.status}`)
  const nombre = process.env.DJVE_RESOURCE_REGEX ? new RegExp(process.env.DJVE_RESOURCE_REGEX, "i") : undefined
  const url = elegirRecursoCkan(await res.json(), { nombre })
  if (!url) throw new Error(`CKAN: sin recurso CSV en el dataset "${PACKAGE_ID}"`)
  return url
}

async function main(): Promise<void> {
  console.log("=== update-djve ===")
  const url = await resolverUrl()
  console.log(`  CSV vigente: ${url}`)
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120_000), redirect: "follow" })
  if (!res.ok) throw new Error(`CSV HTTP ${res.status}`)

  const filas = parseDjveCsv(decodificarCsv(new Uint8Array(await res.arrayBuffer())))
  if (filas.length === 0) throw new Error("el CSV no tiene filas válidas")
  const mensual = agregarDjvePorMes(filas, DESDE)
  if (mensual.length === 0) throw new Error(`ninguna fila posterior a ${DESDE}`)

  const periodos = mensual.map((r) => r.periodo)
  const salida = {
    generado_en: new Date().toISOString(),
    fuente: "Ministerio de Agricultura, Ganadería y Pesca — DJVE (datos abiertos)",
    fuente_url: url,
    unidad: "toneladas registradas en DJVE por cultivo y mes de registro",
    atribucion: "Fuente: MAGyP, datos abiertos. Procesamiento: La Pizarra.",
    verificacion: "Parser NO verificado contra el CSV real al momento de escribirlo; validar primera corrida.",
    cobertura: { desde: periodos[0], hasta: periodos[periodos.length - 1] },
    filas_origen: filas.length,
    serie: mensual,
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(salida, null, 2) + "\n", "utf8")
  console.log(`Guardado ${mensual.length} registros mes-cultivo (${filas.length} DJVE) -> public/data/djve-mensual.json`)
}

main().catch((err) => {
  advertir(`${err.message}. Se conserva el JSON anterior (si existe).`)
})
