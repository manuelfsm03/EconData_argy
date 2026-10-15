/**
 * update-establecimientos-provincias.mjs
 *
 * Descarga el Excel de empresas activas del sector privado por provincia del
 * OEDE (Ministerio de Trabajo) y genera public/data/establecimientos-provincias.json.
 *
 * Reemplaza la fuente anterior (cdn.produccion.gob.ar/cdn-cep — CEP XXI): ese
 * portal quedó abandonado desde la reestructuración ministerial de fines de
 * 2023, igual que las fuentes viejas de empleo y salarios (ver
 * update-empleo-provincias.mjs). La fuente vieja medía CUITs únicos a partir
 * de microdatos geocodificados (con conteo de sucursales); la nueva (OEDE)
 * sólo publica el stock de empresas activas por provincia y rama — se pierde
 * la distinción entre "empresas" y "sucursales" porque esta fuente no la
 * mide, pero se gana 2 años de actualidad (2022 → 2024) desde una fuente que
 * sigue viva.
 *
 * Corre mensualmente vía GitHub Actions (.github/workflows/update-datos-provinciales.yml).
 * También manual: node scripts/update-establecimientos-provincias.mjs
 *
 * Fuente: OEDE / Ministerio de Trabajo — SIPA (AFIP). Datos abiertos, uso libre.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import * as XLSX from "xlsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "establecimientos-provincias.json")

// Página del OEDE con todas las series provinciales — si cambia el nombre del
// archivo, hay que volver a buscar el link ahí
// (https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales).
const XLS_URL =
  process.env.ESTABLECIMIENTOS_PROVINCIAS_URL ??
  "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_empresas1_2.xlsx"

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales",
}

const PROVINCIAS_INDEC = {
  "02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba",
  "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos",
  "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja",
  "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro",
  "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz",
  "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego",
}

// Nombre de hoja (sin acentos, tal como viene en este workbook) → ID de
// provincia. "Partidos de GBA" + "Resto de Buenos Aires" son las dos mitades
// de la provincia de Buenos Aires en este archivo — se suman para reconstruir
// el total provincial, igual que en update-empleo-provincias.mjs.
export const HOJA_A_PROVINCIA = {
  "Capital Federal": "02",
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

export const HEADER_ROW = 3 // fila con "Ramas de actividad" y los años

async function descargarWorkbook() {
  console.log(`Descargando ${XLS_URL}`)
  const res = await fetch(XLS_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(60_000), redirect: "follow" })
  if (!res.ok) throw new Error(`Descarga del Excel: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 10_000) throw new Error(`Respuesta demasiado chica (${buffer.length} bytes) — ¿cambió la URL?`)
  // Igual que en update-salarios-provincias.mjs: parsear sólo las hojas de
  // provincia evita el OOM que da este archivo si xlsx procesa las ~29 hojas
  // completas (incluye "Hoja1", "Metodología", etc. que no se usan).
  return XLSX.read(buffer, { type: "buffer", sheets: Object.keys(HOJA_A_PROVINCIA) })
}

/** Última columna del header con un año real (las de más a la derecha vienen vacías por formato). */
export function ultimaColumnaConAnio(headerRow) {
  let last = -1
  for (let col = 0; col < headerRow.length; col += 1) {
    const anio = headerRow[col]
    if (typeof anio === "number" && Number.isInteger(anio) && anio >= 1990 && anio <= 2100) last = col
  }
  return last
}

export function filaTotal(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i]?.[1] ?? "").trim().toUpperCase() === "TOTAL") return i
  }
  return -1
}

// Algunas hojas de este portal declaran un rango roto que llega a la última
// fila posible de Excel (probablemente por un formato de celda aplicado a la
// columna entera) — sheet_to_json con defval:null materializa cada celda de
// ese rango, lo que vuelve una hoja de ~90 filas reales en cientos de
// millones de celdas y cuelga el proceso por OOM (visto en vivo en el
// archivo hermano de salarios — ver update-salarios-provincias.mjs). Se
// acota la lectura a las primeras MAX_FILAS, bien por encima de donde
// aparecen el header y la fila TOTAL en cualquier hoja real.
const MAX_FILAS = 400

function filasAcotadas(sheet) {
  const ref = sheet["!ref"]
  if (!ref) return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const rango = XLSX.utils.decode_range(ref)
  const acotado = { s: rango.s, e: { r: Math.min(rango.e.r, MAX_FILAS), c: rango.e.c } }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: acotado })
}

/** Serie [{anio, valor}] de la fila TOTAL de una hoja de provincia. */
export function parsearHoja(sheet) {
  const rows = filasAcotadas(sheet)
  const headerRow = rows[HEADER_ROW] ?? []
  const totalRow = filaTotal(rows)
  if (totalRow === -1) throw new Error("No se encontró la fila TOTAL")

  const lastCol = ultimaColumnaConAnio(headerRow)
  const serie = []
  for (let col = 2; col <= lastCol; col += 1) {
    const anio = headerRow[col]
    if (typeof anio !== "number" || !Number.isInteger(anio)) continue
    const valor = rows[totalRow][col]
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) continue
    serie.push({ anio, valor })
  }
  return serie
}

export function construirProvincias(workbook) {
  // provId -> Map<anio, suma de valores de las hojas que le corresponden>
  const acumulado = new Map()

  for (const [hoja, provId] of Object.entries(HOJA_A_PROVINCIA)) {
    const sheet = workbook.Sheets[hoja]
    if (!sheet) {
      console.warn(`  Aviso: no se encontró la hoja "${hoja}" (¿cambió el nombre?), se omite`)
      continue
    }
    const serie = parsearHoja(sheet)
    if (!acumulado.has(provId)) acumulado.set(provId, new Map())
    const porAnio = acumulado.get(provId)
    for (const { anio, valor } of serie) {
      porAnio.set(anio, (porAnio.get(anio) ?? 0) + valor)
    }
  }

  const provincias = []
  for (const [provId, porAnio] of acumulado) {
    const series = [...porAnio.entries()]
      .map(([anio, establecimientos]) => ({ anio, establecimientos }))
      .sort((a, b) => a.anio - b.anio)
    const ultimo = series.at(-1)
    if (!ultimo) continue

    provincias.push({
      id: provId,
      nombre: PROVINCIAS_INDEC[provId] ?? provId,
      ultimo_anio: ultimo.anio,
      ultimo_valor: ultimo.establecimientos,
      series,
    })
  }

  return provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)
}

async function main() {
  console.log("=== update-establecimientos-provincias ===")

  const workbook = await descargarWorkbook()
  const provincias = construirProvincias(workbook)
  if (provincias.length === 0) throw new Error("No se pudo extraer ninguna provincia del workbook")

  const todosAnios = provincias.flatMap((p) => p.series.map((s) => s.anio))
  const desdeAnio = Math.min(...todosAnios)
  const hastaAnio = Math.max(...todosAnios)

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP",
    licencia: "Datos abiertos — argentina.gob.ar/trabajo",
    unidad: "empresas del sector privado activas al cierre de cada año",
    cobertura: { desde: desdeAnio, hasta: hastaAnio },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")

  console.log(`✓ ${provincias.length} provincias | ${desdeAnio} → ${hastaAnio}`)
  console.log(`✓ Guardado en public/data/establecimientos-provincias.json`)
}

// Sólo corre al ejecutar el script directamente — al importarlo desde los
// tests (para probar las funciones puras) no debe disparar una descarga real.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("ERROR:", err.message)
    process.exit(1)
  })
}
