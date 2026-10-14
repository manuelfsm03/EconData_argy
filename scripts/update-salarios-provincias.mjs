/**
 * update-salarios-provincias.mjs
 *
 * Descarga el Excel de remuneración promedio del sector privado por provincia
 * del OEDE (Ministerio de Trabajo) y genera public/data/salarios-provincias.json.
 *
 * Reemplaza la fuente anterior (cdn.produccion.gob.ar/cdn-cep — CEP XXI): ese
 * portal quedó abandonado desde la reestructuración ministerial de fines de
 * 2023, igual que la fuente vieja de empleo (ver update-empleo-provincias.mjs).
 * La fuente real (OEDE/SIPA-AFIP) se sigue publicando en argentina.gob.ar/trabajo,
 * con datos mensuales hasta el mes en curso.
 *
 * Corre mensualmente vía GitHub Actions (.github/workflows/update-datos-provinciales.yml).
 * También manual: node scripts/update-salarios-provincias.mjs
 *
 * Fuente: OEDE / Ministerio de Trabajo — SIPA (AFIP). Datos abiertos, uso libre.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import * as XLSX from "xlsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "salarios-provincias.json")

// Página del OEDE con todas las series provinciales — si cambia el nombre del
// archivo, hay que volver a buscar el link ahí
// (https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales).
const XLS_URL =
  process.env.SALARIOS_PROVINCIAS_URL ??
  "https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx"

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

// Nombre de hoja (tal como viene en este workbook, con sus acentos propios) →
// ID de provincia. "GBA" + "Resto Pcia. Bs. As." son las dos mitades de la
// provincia de Buenos Aires en este archivo — se promedian ponderando por
// cantidad de meses presentes en cada una (en la práctica ambas tienen los
// mismos períodos, así que el promedio simple alcanza).
export const HOJA_A_PROVINCIA = {
  "CABA": "02",
  "GBA": "06",
  "Resto Pcia. Bs. As.": "06",
  "Catamarca": "10",
  "Córdoba": "14",
  "Corrientes": "18",
  "Chaco": "22",
  "Chubut": "26",
  "Entre Ríos": "30",
  "Formosa": "34",
  "Jujuy": "38",
  "La Pampa": "42",
  "La Rioja": "46",
  "Mendoza": "50",
  "Misiones": "54",
  "Neuquén": "58",
  "Río Negro": "62",
  "Salta": "66",
  "San Juan": "70",
  "San Luis": "74",
  "Santa Cruz": "78",
  "Santa Fe": "82",
  "Santiago del Estero": "86",
  "Tucumán": "90",
  "Tierra del Fuego": "94",
}

export const HEADER_ROW = 3 // fila con "Rama de Actividad" y las fechas mensuales

async function descargarWorkbook() {
  console.log(`Descargando ${XLS_URL}`)
  const res = await fetch(XLS_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(60_000), redirect: "follow" })
  if (!res.ok) throw new Error(`Descarga del Excel: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 10_000) throw new Error(`Respuesta demasiado chica (${buffer.length} bytes) — ¿cambió la URL?`)
  // El workbook trae ~30 hojas (incluye "Total" país, metodología, índice...)
  // con cientos de columnas cada una — parsearlas todas revienta la memoria
  // (probado: >4GB con el heap default de Node). Sólo se necesitan las hojas
  // de provincia, así que se filtran acá antes de que xlsx las procese.
  return XLSX.read(buffer, { type: "buffer", sheets: Object.keys(HOJA_A_PROVINCIA) })
}

/** Serial de Excel (días desde 1899-12-30) a "YYYY-MM". */
export function excelSerialAPeriodo(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null
  const fecha = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toISOString().slice(0, 7)
}

/** Última columna del header con una fecha real (las de más a la derecha vienen vacías por formato). */
export function ultimaColumnaConFecha(headerRow) {
  let last = -1
  for (let col = 0; col < headerRow.length; col += 1) {
    if (excelSerialAPeriodo(headerRow[col]) !== null) last = col
  }
  return last
}

/** Fila "Total" de la hoja — label en la columna 0, no la 1 (a diferencia del empleo). */
export function filaTotal(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i]?.[0] ?? "").trim().toLowerCase() === "total") return i
  }
  return -1
}

// Algunas hojas de este workbook declaran un rango roto que llega a la
// última fila posible de Excel (ej. Catamarca: "A1:NT1048576", probablemente
// por un formato de celda aplicado a la columna entera) — sheet_to_json con
// defval:null materializa cada celda de ese rango, lo que vuelve una hoja de
// ~90 filas reales en ~380 millones de celdas y cuelga el proceso por OOM. Se
// acota la lectura a las primeras MAX_FILAS, bien por encima de donde
// aparecen el header y la fila Total en cualquier hoja real.
const MAX_FILAS = 400

function filasAcotadas(sheet) {
  const ref = sheet["!ref"]
  if (!ref) return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null })
  const rango = XLSX.utils.decode_range(ref)
  const acotado = { s: rango.s, e: { r: Math.min(rango.e.r, MAX_FILAS), c: rango.e.c } }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: acotado })
}

/** Serie [{periodo: "2024-01", valor}] de la fila Total de una hoja de provincia. */
export function parsearHoja(sheet) {
  const rows = filasAcotadas(sheet)
  const headerRow = rows[HEADER_ROW] ?? []
  const totalRow = filaTotal(rows)
  if (totalRow === -1) throw new Error("No se encontró la fila Total")

  const lastCol = ultimaColumnaConFecha(headerRow)
  const serie = []
  for (let col = 2; col <= lastCol; col += 1) {
    const periodo = excelSerialAPeriodo(headerRow[col])
    if (periodo === null) continue
    const valor = rows[totalRow][col]
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) continue
    serie.push({ periodo, valor })
  }
  return serie
}

export function construirProvincias(workbook) {
  // provId -> Map<periodo, {suma, cuenta}> — Buenos Aires promedia sus dos hojas
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
      const prev = porPeriodo.get(periodo)
      porPeriodo.set(periodo, prev ? { suma: prev.suma + valor, cuenta: prev.cuenta + 1 } : { suma: valor, cuenta: 1 })
    }
  }

  const provincias = []
  for (const [provId, porPeriodo] of acumulado) {
    const series = [...porPeriodo.entries()]
      .map(([periodo, { suma, cuenta }]) => ({ periodo, salario: Math.round(suma / cuenta) }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))
    const ultimo = series.at(-1)
    if (!ultimo) continue

    // Interanual = mismo mes, un año antes.
    const [anioUlt, mesUlt] = ultimo.periodo.split("-")
    const periodoAnterior = `${Number(anioUlt) - 1}-${mesUlt}`
    const anterior = series.find((s) => s.periodo === periodoAnterior)

    provincias.push({
      id: provId,
      nombre: PROVINCIAS_INDEC[provId] ?? provId,
      ultimo_periodo: ultimo.periodo,
      ultimo_valor: ultimo.salario,
      variacion_interanual: anterior ? (ultimo.salario - anterior.salario) / anterior.salario : null,
      series,
    })
  }

  return provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)
}

async function main() {
  console.log("=== update-salarios-provincias ===")

  const workbook = await descargarWorkbook()
  const provincias = construirProvincias(workbook)
  if (provincias.length === 0) throw new Error("No se pudo extraer ninguna provincia del workbook")

  const primerPeriodo = provincias.flatMap((p) => p.series[0]?.periodo ?? []).sort()[0] ?? "?"
  const ultimoPeriodo = provincias.map((p) => p.ultimo_periodo).sort().at(-1) ?? "?"

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP",
    licencia: "Datos abiertos — argentina.gob.ar/trabajo",
    unidad: "pesos corrientes (remuneración promedio mensual sector privado registrado)",
    cobertura: { desde: primerPeriodo, hasta: ultimoPeriodo },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")

  console.log(`✓ ${provincias.length} provincias | ${primerPeriodo} → ${ultimoPeriodo}`)
  console.log(`✓ Guardado en public/data/salarios-provincias.json`)
}

// Sólo corre al ejecutar el script directamente — al importarlo desde los
// tests (para probar las funciones puras) no debe disparar una descarga real.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("ERROR:", err.message)
    process.exit(1)
  })
}
