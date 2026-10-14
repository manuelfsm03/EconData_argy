/**
 * update-mora-bcra.ts
 *
 * Descarga el archivo de series de calidad de cartera del BCRA (Informe sobre
 * Bancos) y genera public/data/mora-bcra.json con la irregularidad del crédito
 * al sector privado (total, familias, empresas), mensual.
 *
 * Solo series agregadas del sistema. NO usa la Central de Deudores.
 *
 * URL configurable (SUPUESTO NO VERIFICADO, ver docs/fuentes/mora-bcra.md):
 *   MORA_BCRA_URL  (default: InfBanc_Anexo.xlsx, el mismo anexo que usa bcra-banking)
 *
 * Si la fuente falla NO inventa datos: conserva el JSON previo (si existe)
 * marcado estado="fuente_caida" y termina con código 1.
 *
 * Corre vía GitHub Actions (.github/workflows/update-mora-bcra.yml). Manual:
 *   npx tsx scripts/update-mora-bcra.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { parseIrregularidadWorkbook, type MoraRow } from "../src/server/sources/bcra-irregularidad"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "mora-bcra.json")

const DEFAULT_URL = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/InfBanc_Anexo.xlsx"
const URL_FUENTE = process.env.MORA_BCRA_URL?.trim() || DEFAULT_URL

function marcarFuenteCaida(motivo: string): void {
  if (!existsSync(OUT_PATH)) {
    console.error("Sin JSON previo: no se escribe nada (no se inventan datos).")
    return
  }
  const previo = JSON.parse(readFileSync(OUT_PATH, "utf8"))
  previo.estado = "fuente_caida"
  previo.ultimo_error = { mensaje: motivo, intento_en: new Date().toISOString() }
  writeFileSync(OUT_PATH, JSON.stringify(previo, null, 2), "utf8")
}

async function main(): Promise<void> {
  console.log(`=== update-mora-bcra ===\nURL: ${URL_FUENTE}`)
  const res = await fetch(URL_FUENTE, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0)", Referer: "https://www.bcra.gob.ar/" },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  descargado: ${(buf.byteLength / 1024).toFixed(0)} KB`)

  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const hojas: Record<string, MoraRow[]> = {}
  for (const nombre of wb.SheetNames as string[]) {
    hojas[nombre] = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null, raw: true })
  }
  const parsed = parseIrregularidadWorkbook(hojas)

  const todos = Object.values(parsed.series).flat().map((p) => p!.periodo).sort()
  const output = {
    generado_en: new Date().toISOString(),
    estado: "ok",
    fuente: "BCRA — Informe sobre Bancos / series de calidad de cartera",
    url_fuente: URL_FUENTE,
    hoja: parsed.hoja,
    unidad: "% de la cartera de financiaciones (ratio de cartera irregular)",
    frecuencia: "mensual",
    cobertura: { desde: todos[0] ?? null, hasta: todos.at(-1) ?? null },
    filas_origen: parsed.filas_origen,
    series: parsed.series,
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")
  for (const [id, s] of Object.entries(parsed.series)) {
    console.log(`  ${id.padEnd(14)} ${s!.length} meses, último ${s!.at(-1)!.periodo} = ${s!.at(-1)!.valor}%`)
  }
  console.log("Guardado en public/data/mora-bcra.json")
}

main().catch((err: Error) => {
  console.error("ERROR:", err.message)
  marcarFuenteCaida(err.message)
  process.exit(1)
})
