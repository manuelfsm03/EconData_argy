/**
 * update-balance-cambiario.mjs
 *
 * Descarga el anexo "Evolución del Mercado de Cambios y Balance Cambiario" del
 * BCRA (XLS) y genera public/data/balance-cambiario.json (mensual, por
 * concepto/sector, millones de USD).
 *
 * NO VERIFICADO contra la fuente en vivo (se diseñó sin acceso a bcra.gob.ar):
 *  - URL por defecto supuesta; sobreescribible con BALANCE_CAMBIARIO_URL.
 *  - Hoja: BALANCE_CAMBIARIO_HOJA (nombre exacto); si no se define se prueban
 *    todas las hojas y se usa la que el parser reconoce con más conceptos.
 *  - Unidad supuesta: millones de USD (BALANCE_CAMBIARIO_UNIDAD).
 *
 * Degradación honesta: si la descarga o el parseo fallan NO se escribe ni se
 * pisa el JSON existente y el proceso sale con código 1 (el workflow queda rojo).
 * No se generan datos de relleno.
 *
 *   node scripts/update-balance-cambiario.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import https from "node:https"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, "..", "public", "data", "balance-cambiario.json")

// SUPUESTO: URL pública del anexo del BCRA. Configurable por env.
const XLS_URL = process.env.BALANCE_CAMBIARIO_URL
  ?? "https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/ECBalCamb.xls"
const HOJA = process.env.BALANCE_CAMBIARIO_HOJA ?? null
const UNIDAD = process.env.BALANCE_CAMBIARIO_UNIDAD ?? "millones de USD"
const MIN_CONCEPTOS = Number(process.env.BALANCE_CAMBIARIO_MIN_CONCEPTOS ?? 10)

function fetchBuffer(url, redirecciones = 0) {
  return new Promise((resolve, reject) => {
    if (redirecciones > 5) return reject(new Error("demasiadas redirecciones"))
    const u = new URL(url)
    const chunks = []
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0)", Referer: "https://www.bcra.gob.ar/" },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(new URL(res.headers.location, url).href, redirecciones + 1).then(resolve, reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} en ${url}`))
      res.on("data", c => chunks.push(c))
      res.on("end", () => resolve(Buffer.concat(chunks)))
    })
    req.on("error", reject)
    req.setTimeout(60_000, () => { req.destroy(); reject(new Error("timeout")) })
  })
}

async function main() {
  console.log("=== update-balance-cambiario ===")
  // El parser es TypeScript puro; se carga con tsx (devDependency del repo).
  const { tsImport } = await import("tsx/esm/api")
  const mod = await tsImport("../src/server/domain/balance-cambiario.ts", import.meta.url)
  // tsx expone el módulo como namespace o bajo "default" según la interop CJS/ESM
  const { parsearBalanceCambiario } = mod.parsearBalanceCambiario ? mod : mod.default

  console.log(`Descargando ${XLS_URL}`)
  const buf = await fetchBuffer(XLS_URL)
  console.log(`  OK (${(buf.byteLength / 1024).toFixed(0)} KB)`)
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })

  const hojas = HOJA ? [HOJA] : wb.SheetNames
  let resultado = null
  let hojaUsada = null
  const errores = []
  for (const nombre of hojas) {
    const ws = wb.Sheets[nombre]
    if (!ws) { errores.push(`${nombre}: hoja inexistente`); continue }
    try {
      const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
      const parsed = parsearBalanceCambiario(filas)
      if (parsed.conceptos.length >= MIN_CONCEPTOS && (!resultado || parsed.conceptos.length > resultado.conceptos.length)) {
        resultado = parsed
        hojaUsada = nombre
      }
    } catch (e) { errores.push(`${nombre}: ${e.message}`) }
  }
  if (!resultado) {
    throw new Error(`Ninguna hoja reconocida (>= ${MIN_CONCEPTOS} conceptos). Hojas: ${wb.SheetNames.join(" | ")}. ${errores.join("; ")}`)
  }

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "BCRA — Evolución del Mercado de Cambios y Balance Cambiario",
    url: XLS_URL,
    hoja: hojaUsada,
    unidad: UNIDAD,
    nota: "Conceptos tal como los publica el BCRA; 'categoria' es una heurística por etiqueta (null = sin clasificar).",
    cobertura: { desde: resultado.periodos[0], hasta: resultado.periodos.at(-1) },
    total_conceptos: resultado.conceptos.length,
    conceptos: resultado.conceptos,
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")
  console.log(`OK ${output.total_conceptos} conceptos | ${output.cobertura.desde} -> ${output.cobertura.hasta} | hoja "${hojaUsada}"`)
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1) })
