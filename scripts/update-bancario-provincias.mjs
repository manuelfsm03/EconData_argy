/**
 * update-bancario-provincias.mjs
 *
 * Descarga locser.xls del BCRA y genera public/data/bancario-provincias.json.
 * Extrae participación % de cada provincia en el total nacional de
 * préstamos y depósitos del sector privado en pesos (trimestral, 1990-presente).
 *
 * Fuente: BCRA — Gerencia de Estadísticas Monetarias
 * URL: bcra.gob.ar/Pdfs/PublicacionesEstadisticas/locser.xls
 * Cobertura: 24 jurisdicciones, trimestral desde 1990
 * Actualización: trimestral (BCRA publica con ~1 trimestre de rezago)
 *
 * Corre vía GitHub Actions. También manual:
 *   node scripts/update-bancario-provincias.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import https from "node:https"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "bancario-provincias.json")

const XLS_URL = "https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/locser.xls"

// Nombres de hojas que se extraen (sector privado en pesos)
const HOJAS = {
  prestamos_privados_ars: "Ser.priv.$prest",
  depositos_privados_ars: "Sec.priv$.dep.",
}

// Índices de fila dentro de cada hoja (0-indexed)
const FILAS = {
  anios: 8,       // años repetidos 4x por trimestre
  trimestres: 10, // I, II, III, IV
  primer_provincia: 27, // Capital Federal
  ultimo_provincia: 52, // Tucumán (R54 es TOTAL)
}

// Filas a ignorar (subtotales de Gran Buenos Aires / Resto PBA)
const FILAS_IGNORAR = new Set([29, 30, 53])

// Mapa nombre BCRA → ID INDEC de provincia
const NOMBRE_A_ID = {
  "Capital Federal": "02",
  "Provincia de Buenos Aires": "06",
  "Provincia de Catamarca": "10",
  "Provincia de Córdoba": "14",
  "Provincia de Corrientes": "18",
  "Provincia del Chaco": "22",
  "Provincia del Chubut": "26",
  "Provincia de Entre Ríos": "30",
  "Provincia de Formosa": "34",
  "Provincia de Jujuy": "38",
  "Provincia de La Pampa": "42",
  "Provincia de La Rioja": "46",
  "Provincia de Mendoza": "50",
  "Provincia de Misiones": "54",
  "Provincia del Neuquén": "58",
  "Provincia de Río Negro": "62",
  "Provincia de Salta": "66",
  "Provincia de San Juan": "70",
  "Provincia de San Luis": "74",
  "Provincia de Santa Cruz": "78",
  "Provincia de Santa Fe": "82",
  "Provincia de Santiago del Estero": "86",
  "Provincia de Tierra del Fuego ": "94",
  "Provincia de Tierra del Fuego": "94",
  "Provincia de Tucumán": "90",
}

const NOMBRE_DISPLAY = {
  "02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba",
  "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos",
  "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja",
  "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro",
  "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz",
  "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego",
}

async function descargarXLS() {
  console.log("Descargando locser.xls del BCRA...")

  function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
      const u = new URL(url)
      const chunks = []
      const req = https.get({
        hostname: u.hostname, path: u.pathname + u.search,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0)",
          "Referer": "https://www.bcra.gob.ar/",
        },
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400) {
          return fetchBuffer(res.headers.location).then(resolve).catch(reject)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        res.on("data", c => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks)))
      })
      req.on("error", reject)
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error("timeout")) })
    })
  }

  const buf = await fetchBuffer(XLS_URL)
  console.log(`  → OK (${(buf.byteLength / 1024).toFixed(0)} KB)`)
  return buf
}

function parsearHoja(ws, nombreMetrica) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })

  // Construir array de periodos desde R8 (año) y R10 (trimestre)
  const filaAnios = rows[FILAS.anios] ?? []
  const filaTrim = rows[FILAS.trimestres] ?? []

  const periodos = []
  for (let col = 1; col < filaAnios.length; col++) {
    const anio = typeof filaAnios[col] === "number" ? filaAnios[col] : parseInt(filaAnios[col])
    const trim = String(filaTrim[col] ?? "").trim()
    if (!anio || anio < 1990 || anio > 2030) continue
    if (!["I", "II", "III", "IV"].includes(trim)) continue
    const numTrim = { I: 1, II: 2, III: 3, IV: 4 }[trim]
    periodos.push({ col, periodo: `${anio}-Q${numTrim}` })
  }

  const resultado = {}

  for (let rowIdx = FILAS.primer_provincia; rowIdx <= FILAS.ultimo_provincia; rowIdx++) {
    if (FILAS_IGNORAR.has(rowIdx)) continue
    const row = rows[rowIdx] ?? []
    const nombre = String(row[0] ?? "").trim()
    if (!nombre || nombre.startsWith("TOTAL") || nombre.startsWith("  ")) continue

    const id = NOMBRE_A_ID[nombre]
    if (!id) { console.warn(`  ! Sin mapeo para: "${nombre}"`); continue }

    const series = periodos.map(({ col, periodo }) => {
      const val = row[col]
      const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."))
      return { periodo, valor: isNaN(num) ? null : Math.round(num * 1000) / 1000 }
    }).filter(d => d.valor !== null)

    resultado[id] = series
  }

  return { periodos: periodos.map(p => p.periodo), series: resultado }
}

async function main() {
  console.log("=== update-bancario-provincias ===")

  const buf = await descargarXLS()
  const wb = XLSX.read(buf, { type: "buffer" })

  // Parsear cada hoja
  const metricasParsed = {}
  for (const [metrica, nombreHoja] of Object.entries(HOJAS)) {
    const ws = wb.Sheets[nombreHoja]
    if (!ws) { console.warn(`  ! Hoja no encontrada: ${nombreHoja}`); continue }
    metricasParsed[metrica] = parsearHoja(ws, metrica)
    console.log(`  ✓ ${metrica}: ${metricasParsed[metrica].periodos.length} trimestres`)
  }

  // Identificar provincias comunes
  const todasIds = new Set()
  for (const { series } of Object.values(metricasParsed)) {
    Object.keys(series).forEach(id => todasIds.add(id))
  }

  // Construir output por provincia
  const provincias = []
  for (const id of [...todasIds].sort()) {
    const nombre = NOMBRE_DISPLAY[id] ?? id
    const provincia = { id, nombre }

    for (const [metrica, { periodos, series }] of Object.entries(metricasParsed)) {
      const seriesProv = series[id] ?? []
      const ultimo = seriesProv.at(-1)
      provincia[metrica] = {
        ultimo_periodo: ultimo?.periodo ?? null,
        ultimo_valor: ultimo?.valor ?? null,
        series: seriesProv,
      }
    }

    provincias.push(provincia)
    const dep = provincia.depositos_privados_ars
    const prest = provincia.prestamos_privados_ars
    console.log(
      `  ✓ ${nombre.padEnd(24)} dep: ${dep?.ultimo_valor?.toFixed(2) ?? "n/a"}%  prest: ${prest?.ultimo_valor?.toFixed(2) ?? "n/a"}%  (${prest?.ultimo_periodo ?? "?"})`
    )
  }

  // Ordenar por participación en depósitos (mayor primero)
  provincias.sort((a, b) =>
    (b.depositos_privados_ars?.ultimo_valor ?? 0) - (a.depositos_privados_ars?.ultimo_valor ?? 0)
  )

  const ultimoPeriodo = provincias[0]?.depositos_privados_ars?.ultimo_periodo ?? null
  const primerPeriodo = metricasParsed.depositos_privados_ars?.periodos[0] ?? null

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "BCRA — Gerencia de Estadísticas Monetarias",
    licencia: "Datos abiertos — bcra.gob.ar",
    unidad: "participación porcentual en el total nacional",
    metricas: Object.keys(HOJAS),
    cobertura: { desde: primerPeriodo, hasta: ultimoPeriodo },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")
  console.log(`\n✓ ${provincias.length} provincias | ${primerPeriodo} → ${ultimoPeriodo}`)
  console.log(`✓ Guardado en public/data/bancario-provincias.json`)
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1) })
