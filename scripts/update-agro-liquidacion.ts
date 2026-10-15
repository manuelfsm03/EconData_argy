/**
 * update-agro-liquidacion.ts
 *
 * Baja los comunicados mensuales de liquidación de divisas de CIARA-CEC y
 * actualiza public/data/agro-liquidacion-ciara.json (millones de USD por mes).
 *
 * ESTADO: NO VERIFICADO EN VIVO. Se escribió sin poder consultar
 * ciaracec.com.ar desde la máquina de desarrollo. Corre en GitHub Actions
 * (.github/workflows/update-agro-liquidacion.yml). Primera corrida = validar a
 * mano con `gh workflow run update-agro-liquidacion.yml` y revisar el log.
 *
 * Configuración por env (todo opcional):
 *   CIARA_URLS            lista separada por comas de URLs de comunicados (salta el listado)
 *   CIARA_LISTING_URL     página donde se listan los comunicados (default: home de CIARA-CEC)
 *   CIARA_MAX_COMUNICADOS tope de comunicados a bajar por corrida (default 8)
 *
 * Degradación: si la fuente falla o nada parsea, NO se toca el JSON (se
 * conserva el último dato bueno) y se emite un warning visible en Actions.
 * Nunca se escriben datos inventados.
 *
 * Uso manual: npx tsx scripts/update-agro-liquidacion.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  extraerLinksComunicados,
  fusionarSeries,
  parseComunicadoCiara,
  type LiquidacionMensual,
} from "../src/server/external/ciara-liquidacion"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "agro-liquidacion-ciara.json")

const LISTING_URL = process.env.CIARA_LISTING_URL ?? "https://www.ciaracec.com.ar/"
const MAX = Number(process.env.CIARA_MAX_COMUNICADOS ?? 8)
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) EconData-La-Pizarra/1.0 (+datos abiertos; uso no comercial)",
  Accept: "text/html,*/*",
  "Accept-Language": "es-AR,es;q=0.9",
}

function advertir(msg: string): void {
  console.warn(`::warning::[agro-liquidacion] ${msg}`)
}

async function bajar(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000), redirect: "follow" })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}

function leerExistente(): LiquidacionMensual[] {
  if (!existsSync(OUT_PATH)) return []
  try {
    const j = JSON.parse(readFileSync(OUT_PATH, "utf8")) as { serie?: LiquidacionMensual[] }
    return Array.isArray(j.serie) ? j.serie : []
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  console.log("=== update-agro-liquidacion (CIARA-CEC) ===")
  const existente = leerExistente()

  let urls: string[]
  if (process.env.CIARA_URLS) {
    urls = process.env.CIARA_URLS.split(",").map((s) => s.trim()).filter(Boolean)
  } else {
    try {
      urls = extraerLinksComunicados(await bajar(LISTING_URL), LISTING_URL, MAX)
    } catch (err) {
      advertir(`no se pudo leer el listado ${LISTING_URL}: ${(err as Error).message}. Se conserva el JSON anterior.`)
      return
    }
  }
  if (urls.length === 0) {
    advertir("el listado no devolvió links de comunicados de liquidación (¿cambió el sitio?). Se conserva el JSON anterior.")
    return
  }

  const nuevos: LiquidacionMensual[] = []
  for (const url of urls.slice(0, MAX)) {
    try {
      const fila = parseComunicadoCiara(await bajar(url), url)
      if (fila) { nuevos.push(fila); console.log(`  OK ${fila.periodo}: USD ${fila.monto_musd} M  (${url})`) }
      else console.warn(`  sin período/monto reconocible en ${url}`)
    } catch (err) {
      console.warn(`  falló ${url}: ${(err as Error).message}`)
    }
  }
  if (nuevos.length === 0) {
    advertir("ningún comunicado se pudo parsear. Se conserva el JSON anterior. Revisar parser contra el formato real.")
    return
  }

  const serie = fusionarSeries(existente, nuevos)
  const salida = {
    generado_en: new Date().toISOString(),
    fuente: "CIARA-CEC — Cámara de la Industria Aceitera / Centro de Exportadores de Cereales",
    fuente_url: "https://www.ciaracec.com.ar/",
    unidad: "millones de USD liquidados en el mes (sector agroexportador)",
    atribucion: "Fuente: CIARA-CEC. Procesamiento: La Pizarra.",
    verificacion: "Parser NO verificado contra el sitio real al momento de escribirlo; validar primera corrida.",
    cobertura: { desde: serie[0].periodo, hasta: serie[serie.length - 1].periodo },
    serie,
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(salida, null, 2) + "\n", "utf8")
  console.log(`Guardado ${serie.length} meses -> public/data/agro-liquidacion-ciara.json`)
}

main().catch((err) => { advertir(`error inesperado: ${err.message}. Se conserva el JSON anterior.`) })
