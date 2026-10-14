/**
 * update-empleo-provincias.mjs
 *
 * Descarga el Excel de empleo asalariado registrado por provincia del OEDE
 * (Ministerio de Trabajo) y genera public/data/empleo-provincias.json.
 *
 * Reemplaza la fuente anterior (datos.produccion.gob.ar / CEP XXI): ese
 * portal quedó abandonado desde la reestructuración ministerial de fines de
 * 2023 — el CSV que servía seguía respondiendo 200 pero con contenido
 * congelado en 2023-11 para siempre (verificado en vivo 14/10/2026: ningún
 * dataset de ese portal tiene metadata_modified posterior a 2023). La fuente
 * real (OEDE/SIPA-AFIP) sigue viva, sólo que ahora se publica directamente
 * en argentina.gob.ar/trabajo — con datos hasta el trimestre en curso.
 *
 * Corre mensualmente vía GitHub Actions (.github/workflows/update-datos-provinciales.yml).
 * También manual: node scripts/update-empleo-provincias.mjs
 *
 * Fuente: OEDE / Ministerio de Trabajo — SIPA (AFIP). Datos abiertos, uso libre.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import * as XLSX from "xlsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "empleo-provincias.json")

// Página del OEDE con todas las series provinciales — si el BCRA/Ministerio
// cambia el nombre del archivo, hay que volver a buscar el link ahí
// (https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales).
const XLS_URL =
  process.env.EMPLEO_PROVINCIAS_URL ??
  "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_empleo_trimestral_2dig_7.xlsx"

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales",
}

// IDs oficiales de provincias argentinas (INDEC)
const PROVINCIAS_INDEC = {
  "02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba",
  "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos",
  "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja",
  "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro",
  "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz",
  "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego",
}

// Nombre de la hoja → ID de provincia. "Partidos de GBA" + "Resto de Buenos
// Aires" son las dos mitades de la provincia de Buenos Aires en este
// workbook — se suman para reconstruir el total provincial, igual que
// reportaba la fuente anterior.
export const HOJA_A_PROVINCIA = {
  "CABA": "02",
  "Partidos de GBA": "06",
  "Resto de Buenos Aires": "06",
  "Catamarca": "10",
  "Cordoba": "14",
  "Corrientes": "18",
  "Chaco": "22",
  "Chubut": "26",
  "Entre Rios": "30",
  "Formosa": "34",
  "Jujuy": "38",
  "La Pampa": "42",
  "La Rioja": "46",
  "Mendoza": "50",
  "Misiones": "54",
  "Neuquen": "58",
  "Rio Negro": "62",
  "Salta": "66",
  "San Juan": "70",
  "San Luis": "74",
  "Santa Cruz": "78",
  "Santa Fe": "82",
  "Santiago del Estero": "86",
  "Tucuman": "90",
  "Tierra del Fuego": "94",
}

export const HEADER_ROW = 3 // fila con las etiquetas de trimestre ("1° Trim 1996", ...)
export const QUARTER_RE = /^\s*([1-4])\s*°?\s*Trim\s*(\d{4})\s*$/i

async function descargarWorkbook() {
  console.log(`Descargando ${XLS_URL}`)
  const res = await fetch(XLS_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(60_000), redirect: "follow" })
  if (!res.ok) throw new Error(`Descarga del Excel: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 10_000) throw new Error(`Respuesta demasiado chica (${buffer.length} bytes) — ¿cambió la URL?`)
  return XLSX.read(buffer, { type: "buffer" })
}

/** Última columna con una etiqueta de trimestre real (las de más a la derecha vienen vacías por formato). */
export function ultimaColumnaConDato(headerRow) {
  let last = -1
  for (let col = 0; col < headerRow.length; col += 1) {
    if (typeof headerRow[col] === "string" && QUARTER_RE.test(headerRow[col])) last = col
  }
  return last
}

export function filaTotal(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i]?.[1] ?? "").trim().toUpperCase() === "TOTAL") return i
  }
  return -1
}

/** Serie [{periodo: "1996-Q1", valor}] de la fila TOTAL de una hoja de provincia. */
export function parsearHoja(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const headerRow = rows[HEADER_ROW] ?? []
  const totalRow = filaTotal(rows)
  if (totalRow === -1) throw new Error("No se encontró la fila TOTAL")

  const lastCol = ultimaColumnaConDato(headerRow)
  const serie = []
  for (let col = 2; col <= lastCol; col += 1) {
    const match = QUARTER_RE.exec(String(headerRow[col] ?? ""))
    if (!match) continue
    const [, trimestre, anio] = match
    const valor = rows[totalRow][col]
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) continue
    serie.push({ periodo: `${anio}-Q${trimestre}`, valor })
  }
  return serie
}

export function construirProvincias(workbook) {
  // provId -> Map<periodo, suma de valores de las hojas que le corresponden>
  const acumulado = new Map()

  for (const [hoja, provId] of Object.entries(HOJA_A_PROVINCIA)) {
    const sheet = workbook.Sheets[hoja]
    if (!sheet) {
      console.warn(`  Aviso: no se encontró la hoja "${hoja}" (¿cambió el nombre?), se omite`)
      continue
    }
    const serie = parsearHoja(sheet)
    if (!acumulado.has(provId)) acumulado.set(provId, new Map())
    const porPeriodo = acumulado.get(provId)
    for (const { periodo, valor } of serie) {
      porPeriodo.set(periodo, (porPeriodo.get(periodo) ?? 0) + valor)
    }
  }

  const provincias = []
  for (const [provId, porPeriodo] of acumulado) {
    const series = [...porPeriodo.entries()]
      .map(([periodo, puestos]) => ({ periodo, puestos }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
    const ultimo = series.at(-1)
    if (!ultimo) continue

    // Interanual = mismo trimestre, un año antes.
    const [anioUlt, trimUlt] = ultimo.periodo.split("-")
    const periodoAnterior = `${Number(anioUlt) - 1}-${trimUlt}`
    const anterior = series.find((s) => s.periodo === periodoAnterior)

    provincias.push({
      id: provId,
      nombre: PROVINCIAS_INDEC[provId] ?? provId,
      ultimo_periodo: ultimo.periodo,
      ultimo_valor: ultimo.puestos,
      variacion_interanual: anterior ? (ultimo.puestos - anterior.puestos) / anterior.puestos : null,
      series,
    })
  }

  return provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)
}

async function main() {
  console.log("=== update-empleo-provincias ===")

  const workbook = await descargarWorkbook()
  const provincias = construirProvincias(workbook)
  if (provincias.length === 0) throw new Error("No se pudo extraer ninguna provincia del workbook")

  const primerPeriodo = provincias
    .flatMap((p) => p.series[0]?.periodo ?? [])
    .sort()[0] ?? "?"
  const ultimoPeriodo = provincias
    .map((p) => p.ultimo_periodo)
    .sort()
    .at(-1) ?? "?"

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP",
    licencia: "Datos abiertos — argentina.gob.ar/trabajo",
    cobertura: { desde: primerPeriodo, hasta: ultimoPeriodo },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")

  console.log(`✓ ${provincias.length} provincias | ${primerPeriodo} → ${ultimoPeriodo}`)
  console.log(`✓ Guardado en public/data/empleo-provincias.json`)
}

// Sólo corre al ejecutar el script directamente — al importarlo desde los
// tests (para probar las funciones puras) no debe disparar una descarga real.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("ERROR:", err.message)
    process.exit(1)
  })
}
