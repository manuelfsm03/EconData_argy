/**
 * update-salarios-provincias.mjs
 *
 * Descarga el CSV de salario promedio del sector privado por provincia del OEDE
 * (Ministerio de Trabajo / SIPA-AFIP) y genera public/data/salarios-provincias.json.
 *
 * Estrategia de descarga (en orden, falla al siguiente si no funciona):
 *   1. URL directa con headers de browser (CDN acepta Referer correcto)
 *   2. CKAN API → URL real del recurso → fetch directo
 *   3. Playwright headless (browser real — bypasea hotlinking, garantiza éxito)
 *
 * Fuente: OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP
 * URL: cdn.produccion.gob.ar/cdn-cep/datos-por-provincia/por-provincia/salarios/w_mean_priv.csv
 * Cobertura: 24 jurisdicciones, mensual 2007-presente, pesos corrientes
 * Actualización: mensual
 *
 * Corre vía GitHub Actions. También manual:
 *   node scripts/update-salarios-provincias.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "salarios-provincias.json")

const CKAN_BASE = "https://datos.produccion.gob.ar"
const CKAN_PACKAGE_ID = "260b4fcf-d637-45ca-8e37-332face2c5ec"

const URLS_DIRECTAS = [
  "https://cdn.produccion.gob.ar/cdn-cep/datos-por-provincia/por-provincia/salarios/w_mean_priv.csv",
  "https://cdn.produccion.gob.ar/cdn-cep/datos-por-provincia/por-provincia/salarios/w_mean_todos.csv",
]

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://datos.produccion.gob.ar/",
  "Accept": "text/csv,text/plain,*/*",
  "Accept-Language": "es-AR,es;q=0.9",
}

const PROVINCIAS_INDEC = {
  "02": "CABA", "06": "Buenos Aires", "10": "Catamarca", "14": "Córdoba",
  "18": "Corrientes", "22": "Chaco", "26": "Chubut", "30": "Entre Ríos",
  "34": "Formosa", "38": "Jujuy", "42": "La Pampa", "46": "La Rioja",
  "50": "Mendoza", "54": "Misiones", "58": "Neuquén", "62": "Río Negro",
  "66": "Salta", "70": "San Juan", "74": "San Luis", "78": "Santa Cruz",
  "82": "Santa Fe", "86": "Santiago del Estero", "90": "Tucumán", "94": "Tierra del Fuego",
}

const NOMBRE_A_ID = {
  "BUENOS AIRES": "06", "CAPITAL FEDERAL": "02", "CABA": "02",
  "CATAMARCA": "10", "CORDOBA": "14", "CÓRDOBA": "14",
  "CORRIENTES": "18", "CHACO": "22", "CHUBUT": "26",
  "ENTRE RIOS": "30", "ENTRE RÍOS": "30", "FORMOSA": "34",
  "JUJUY": "38", "LA PAMPA": "42", "LA RIOJA": "46",
  "MENDOZA": "50", "MISIONES": "54", "NEUQUEN": "58", "NEUQUÉN": "58",
  "RIO NEGRO": "62", "RÍO NEGRO": "62", "SALTA": "66",
  "SAN JUAN": "70", "SAN LUIS": "74", "SANTA CRUZ": "78",
  "SANTA FE": "82", "SANTIAGO DEL ESTERO": "86",
  "TUCUMAN": "90", "TUCUMÁN": "90", "TIERRA DEL FUEGO": "94",
}

// ── Estrategia 1: URL directa con headers de browser ─────────────────────────

async function intentarDirecto() {
  console.log("[1] Intentando URLs directas...")
  for (const url of URLS_DIRECTAS) {
    console.log(`  → ${url}`)
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(60_000) })
      if (!res.ok) { console.warn(`     ${res.status} ${res.statusText}`); continue }
      const texto = await res.text()
      if (texto.length < 1000 || !texto.includes(",")) { console.warn(`     Respuesta inválida (${texto.length} bytes)`); continue }
      console.log(`     OK (${(texto.length / 1024).toFixed(0)} KB)`)
      return texto
    } catch (err) {
      console.warn(`     Error: ${err.message}`)
    }
  }
  throw new Error("Todas las URLs directas fallaron")
}

// ── Estrategia 2: CKAN API ────────────────────────────────────────────────────

async function intentarCKAN() {
  console.log("[2] Intentando CKAN API...")
  const url = `${CKAN_BASE}/api/3/action/package_show?id=${CKAN_PACKAGE_ID}`
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`CKAN package_show: HTTP ${res.status}`)

  const json = await res.json()
  if (!json.success) throw new Error("CKAN: respuesta no exitosa")

  const recursos = json.result?.resources ?? []
  const csvProv = recursos.find(r => r.url?.includes("por-provincia/salarios/w_mean_priv") || r.name?.toLowerCase().includes("privado"))
  if (!csvProv?.url) throw new Error("CKAN: no encontró recurso de salarios por provincia")

  console.log(`  → URL: ${csvProv.url}`)
  const csvRes = await fetch(csvProv.url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(60_000) })
  if (!csvRes.ok) throw new Error(`CSV desde CKAN: HTTP ${csvRes.status}`)

  const texto = await csvRes.text()
  if (texto.length < 1000 || !texto.includes(",")) throw new Error(`CSV inválido (${texto.length} bytes)`)
  console.log(`  → OK (${(texto.length / 1024).toFixed(0)} KB)`)
  return texto
}

// ── Estrategia 3: Playwright headless ────────────────────────────────────────

async function intentarPlaywright() {
  console.log("[3] Usando Playwright headless (browser real)...")
  const { chromium } = await import("playwright")

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ userAgent: BROWSER_HEADERS["User-Agent"], locale: "es-AR" })
  const page = await context.newPage()

  let csvTexto = null

  page.on("response", async (response) => {
    const url = response.url()
    if (url.includes("w_mean_priv") || (url.includes("salarios") && url.includes(".csv"))) {
      try {
        const body = await response.body()
        const texto = body.toString("utf8")
        if (texto.length > 1000 && texto.includes(",")) {
          csvTexto = texto
          console.log(`  → CSV interceptado: ${url} (${(texto.length / 1024).toFixed(0)} KB)`)
        }
      } catch { /* ignorar respuestas binarias */ }
    }
  })

  try {
    await page.goto(`${CKAN_BASE}/dataset/${CKAN_PACKAGE_ID}`, { waitUntil: "networkidle", timeout: 30_000 })
    const link = page.locator("a[href*='w_mean_priv'], a[href*='salarios']").first()
    if (await link.count() > 0) {
      const descarga = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null)
      await link.click()
      const dl = await descarga
      if (dl) {
        const path = await dl.path()
        const { readFileSync } = await import("node:fs")
        const texto = readFileSync(path, "utf8")
        if (texto.length > 1000) csvTexto = texto
      }
    }
    if (!csvTexto) {
      await page.goto(URLS_DIRECTAS[0], { waitUntil: "networkidle", timeout: 30_000 })
      await page.waitForTimeout(2000)
    }
  } finally {
    await browser.close()
  }

  if (!csvTexto) throw new Error("Playwright: no se pudo obtener el CSV")
  console.log("  → OK vía Playwright")
  return csvTexto
}

// ── Parseo del CSV ────────────────────────────────────────────────────────────

function parsearCSV(texto) {
  const lineas = texto.trim().split(/\r?\n/)
  const encabezado = lineas[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""))

  const col = (...nombres) => {
    for (const n of nombres) {
      const idx = encabezado.indexOf(n)
      if (idx !== -1) return idx
    }
    return -1
  }

  const iFecha    = col("fecha", "date")
  const iProvNom  = col("zona_prov", "provincia", "nombre_provincia")
  const iProvId   = col("codigo_provincia", "provincia_id", "cod_prov")
  const iAnio     = col("anio", "año", "year")
  const iMes      = col("mes", "month")
  const iSalario  = col("w_mean", "salario_promedio", "salario", "remuneracion_promedio")

  if (iSalario === -1) throw new Error(`Columna de salario no encontrada. Encabezado: ${encabezado.join(", ")}`)
  if (iFecha === -1 && (iAnio === -1 || iMes === -1)) throw new Error(`Sin columnas de fecha. Encabezado: ${encabezado.join(", ")}`)

  const mapa = new Map()

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(",").map(c => c.trim().replace(/"/g, ""))
    if (cols.length < 2) continue

    let periodo
    if (iFecha !== -1) {
      const fecha = cols[iFecha]
      const [anio, mes] = fecha.split("-")
      if (!anio || !mes) continue
      periodo = `${anio}-${mes}`
    } else {
      const anio = parseInt(cols[iAnio], 10)
      const mes  = parseInt(cols[iMes], 10)
      if (isNaN(anio) || isNaN(mes)) continue
      periodo = `${anio}-${String(mes).padStart(2, "0")}`
    }

    const [anioNum] = periodo.split("-").map(Number)
    if (anioNum < 2007 || anioNum > 2030) continue

    const salario = parseInt(cols[iSalario], 10)
    if (isNaN(salario) || salario <= 0) continue

    let provId
    if (iProvId !== -1 && cols[iProvId]) {
      provId = cols[iProvId].padStart(2, "0")
    } else if (iProvNom !== -1) {
      const key = cols[iProvNom].trim().toUpperCase()
      provId = NOMBRE_A_ID[key] ?? "00"
    } else {
      continue
    }

    if (provId === "00") continue
    const clave = `${provId}|${periodo}`
    // Si hay múltiples filas por provincia/periodo (diferentes clae2), promediar
    const prev = mapa.get(clave)
    if (prev) {
      mapa.set(clave, { salario: Math.round((prev.salario + salario) / 2), count: prev.count + 1 })
    } else {
      mapa.set(clave, { salario, count: 1 })
    }
  }

  const porProvincia = new Map()
  for (const [clave, { salario }] of mapa) {
    const [provId, periodo] = clave.split("|")
    if (!porProvincia.has(provId)) porProvincia.set(provId, { id: provId, nombre: PROVINCIAS_INDEC[provId] ?? provId, series: [] })
    porProvincia.get(provId).series.push({ periodo, salario })
  }

  const provincias = []
  for (const prov of porProvincia.values()) {
    prov.series.sort((a, b) => a.periodo.localeCompare(b.periodo))
    const ultimo = prov.series.at(-1)
    if (!ultimo) continue

    const [anioUlt, mesUlt] = ultimo.periodo.split("-")
    const periodoAnterior = `${Number(anioUlt) - 1}-${mesUlt}`
    const anterior = prov.series.find(s => s.periodo === periodoAnterior)

    provincias.push({
      id: prov.id,
      nombre: prov.nombre,
      ultimo_periodo: ultimo.periodo,
      ultimo_valor: ultimo.salario,
      variacion_interanual: anterior ? (ultimo.salario - anterior.salario) / anterior.salario : null,
      series: prov.series,
    })
  }

  return provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== update-salarios-provincias ===")

  let texto
  const estrategias = [intentarDirecto, intentarCKAN, intentarPlaywright]

  for (const estrategia of estrategias) {
    try {
      texto = await estrategia()
      break
    } catch (err) {
      console.warn(`  Falló: ${err.message}`)
    }
  }

  if (!texto) {
    console.error("ERROR: Todas las estrategias de descarga fallaron")
    process.exit(1)
  }

  const provincias = parsearCSV(texto)
  const primerPeriodo = provincias[0]?.series[0]?.periodo ?? "?"
  const ultimoPeriodo = provincias[0]?.ultimo_periodo ?? "?"

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP",
    licencia: "Datos abiertos — datos.gob.ar",
    unidad: "pesos corrientes (salario promedio mensual sector privado registrado)",
    cobertura: { desde: primerPeriodo, hasta: ultimoPeriodo },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")
  console.log(`✓ ${provincias.length} provincias | ${primerPeriodo} → ${ultimoPeriodo}`)
  console.log(`✓ Guardado en public/data/salarios-provincias.json`)
}

main().catch(err => { console.error("ERROR:", err.message); process.exit(1) })
