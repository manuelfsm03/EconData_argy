/**
 * update-fiscal-provincias.mjs
 *
 * Descarga el XLSX de ejecución presupuestaria provincial del Ministerio de
 * Economía (Secretaría de Hacienda) y genera public/data/fiscal-provincias.json.
 *
 * Fuente: Dirección Nacional de Asuntos Provinciales — Min. Economía
 * URL: argentina.gob.ar/sites/default/files/serie_aif-apnf-2025.xlsx
 * Cobertura: 24 jurisdicciones, acumulado anual 2005-2025, en millones de pesos
 * Actualización: anual (Q4 acumulado del año anterior, ~marzo siguiente)
 *
 * Corre vía GitHub Actions. También manual:
 *   node scripts/update-fiscal-provincias.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "fiscal-provincias.json")

const XLSX_URL = "https://www.argentina.gob.ar/sites/default/files/serie_aif-apnf-2025.xlsx"

// Mapa nombre de hoja → ID INDEC
const HOJA_A_ID = {
  "Ciudad": "02", "Buenos Aires": "06", "Catamarca": "10", "Córdoba": "14",
  "Corrientes": "18", "Chaco": "22", "Chubut": "26", "Entre Ríos": "30",
  "Formosa": "34", "Jujuy": "38", "La Pampa": "42", "La Rioja": "46",
  "Mendoza": "50", "Misiones": "54", "Neuquén": "58", "Río Negro": "62",
  "Salta": "66", "San Juan": "70", "San Luis": "74", "Santa Cruz": "78",
  "Santa Fe": "82", "Santiago del  Estero": "86", "Tucumán": "90", "Tierra del Fuego": "94",
}

const HOJA_A_NOMBRE = {
  "Ciudad": "CABA", "Buenos Aires": "Buenos Aires", "Santiago del  Estero": "Santiago del Estero",
}

// Índices de fila dentro de cada hoja (0-indexed)
const FILAS = {
  anios: 7,             // encabezado: CONCEPTO | 2005 | 2006 | ...
  ingresos: 8,          // I. INGRESOS CORRIENTES
  coparticipacion: 11,  // De Orígen Nacional (RON / coparticipación + transferencias)
  gastos: 23,           // II. GASTOS CORRIENTES
  ingresos_totales: 47, // VI. INGRESOS TOTALES
  gastos_totales: 48,   // VII. GASTOS TOTALES
  resultado_financiero: 49, // VIII. RESULTADO FINANCIERO
  resultado_primario: 50,   // IX. RESULTADO PRIMARIO
}

async function descargarXLSX() {
  console.log("Descargando XLSX de Hacienda...")
  const res = await fetch(XLSX_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0)",
      "Referer": "https://www.argentina.gob.ar/",
      "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    },
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar XLSX`)
  const buf = await res.arrayBuffer()
  console.log(`  → OK (${(buf.byteLength / 1024).toFixed(0)} KB)`)
  return Buffer.from(buf)
}

function parsearHoja(ws, nombreHoja) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })

  const filaAnios = rows[FILAS.anios] ?? []
  // Años: columnas 1 en adelante (col 0 = "CONCEPTO")
  const anios = filaAnios.slice(1).map(Number).filter(a => a >= 2005 && a <= 2030)
  if (anios.length === 0) return null

  function extraerSerie(idxFila) {
    const fila = rows[idxFila] ?? []
    return anios.map((anio, i) => {
      const val = fila[i + 1]
      const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."))
      return { anio, valor: isNaN(num) ? null : Math.round(num * 10) / 10 }
    })
  }

  return {
    ingresos_corrientes:    extraerSerie(FILAS.ingresos),
    coparticipacion:        extraerSerie(FILAS.coparticipacion),
    gastos_corrientes:      extraerSerie(FILAS.gastos),
    ingresos_totales:       extraerSerie(FILAS.ingresos_totales),
    gastos_totales:         extraerSerie(FILAS.gastos_totales),
    resultado_financiero:   extraerSerie(FILAS.resultado_financiero),
    resultado_primario:     extraerSerie(FILAS.resultado_primario),
  }
}

async function main() {
  console.log("=== update-fiscal-provincias ===")

  const buf = await descargarXLSX()
  const wb = XLSX.read(buf, { type: "buffer" })

  const provincias = []
  for (const [hoja, id] of Object.entries(HOJA_A_ID)) {
    const ws = wb.Sheets[hoja]
    if (!ws) { console.warn(`  ! Hoja no encontrada: ${hoja}`); continue }

    const series = parsearHoja(ws, hoja)
    if (!series) { console.warn(`  ! Sin datos en hoja: ${hoja}`); continue }

    const nombre = HOJA_A_NOMBRE[hoja] ?? hoja

    // Último año disponible con dato no null
    const ultimoAnio = [...series.resultado_financiero].reverse().find(d => d.valor !== null)?.anio ?? null
    const ultimoResultado = series.resultado_financiero.find(d => d.anio === ultimoAnio)?.valor ?? null
    const ultimosIngresos = series.ingresos_totales.find(d => d.anio === ultimoAnio)?.valor ?? null

    provincias.push({ id, nombre, ultimo_anio: ultimoAnio, ultimo_resultado_financiero: ultimoResultado, ultimo_ingresos_totales: ultimosIngresos, series })
    console.log(`  ✓ ${nombre.padEnd(28)} ${ultimoAnio} | resultado: ${ultimoResultado?.toFixed(0) ?? "n/a"}`)
  }

  // Ordenar por resultado financiero del último año (superávit primero)
  provincias.sort((a, b) => (b.ultimo_resultado_financiero ?? -Infinity) - (a.ultimo_resultado_financiero ?? -Infinity))

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "Secretaría de Hacienda — Dirección Nacional de Asuntos Provinciales",
    licencia: "Datos abiertos — argentina.gob.ar",
    unidad: "millones de pesos corrientes",
    cobertura: { desde: 2005, hasta: provincias[0]?.ultimo_anio ?? null },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")
  console.log(`\n✓ ${provincias.length} provincias | 2005-${output.cobertura.hasta}`)
  console.log(`✓ Guardado en public/data/fiscal-provincias.json`)
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1) })
