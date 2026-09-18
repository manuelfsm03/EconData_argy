/**
 * update-establecimientos-provincias.mjs
 *
 * Descarga el CSV de distribución de establecimientos productivos por provincia
 * del CEP XXI (Secretaría de Industria / Ministerio de Economía) y genera
 * public/data/establecimientos-provincias.json.
 *
 * Estrategia de descarga:
 *   - Fetch directo con headers de browser (Referer requerido para evitar 403)
 *   - El CSV pesa ~96MB y tiene ~1.4M filas — se procesa vía stream/readline
 *
 * Agrega por provincia_id + anio:
 *   - establecimientos: CUITs únicos (una empresa = un CUIT, aunque tenga varias sucursales)
 *   - sucursales: total de filas (cada row es una sucursal/establecimiento físico)
 *
 * Corre vía GitHub Actions. También manual:
 *   node scripts/update-establecimientos-provincias.mjs
 *
 * Fuente: OEDE — Ministerio de Trabajo / CEP XXI (Secretaría de Industria)
 * URL: cdn.produccion.gob.ar/cdn-cep/establecimientos-productivos/
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"
import { Readable } from "node:stream"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "establecimientos-provincias.json")

// URL directa del CSV (el CDN requiere Referer para no devolver 403)
const CSV_URL =
  "https://cdn.produccion.gob.ar/cdn-cep/establecimientos-productivos/distribucion_establecimientos_productivos_sexo.csv"

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://datos.produccion.gob.ar/",
  Accept: "text/csv,text/plain,*/*",
  "Accept-Language": "es-AR,es;q=0.9",
}

// IDs oficiales de provincias argentinas (INDEC, con padding a 2 dígitos)
const PROVINCIAS_INDEC = {
  "02": "CABA",
  "06": "Buenos Aires",
  "10": "Catamarca",
  "14": "Córdoba",
  "18": "Corrientes",
  "22": "Chaco",
  "26": "Chubut",
  "30": "Entre Ríos",
  "34": "Formosa",
  "38": "Jujuy",
  "42": "La Pampa",
  "46": "La Rioja",
  "50": "Mendoza",
  "54": "Misiones",
  "58": "Neuquén",
  "62": "Río Negro",
  "66": "Salta",
  "70": "San Juan",
  "74": "San Luis",
  "78": "Santa Cruz",
  "82": "Santa Fe",
  "86": "Santiago del Estero",
  "90": "Tucumán",
  "94": "Tierra del Fuego",
}

// ── Descarga streaming del CSV ────────────────────────────────────────────────

async function descargarCSV() {
  console.log(`[1] Descargando CSV desde:\n    ${CSV_URL}`)
  const res = await fetch(CSV_URL, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(300_000), // 5 min — son 96MB
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} al descargar el CSV`)
  }

  const contentLength = res.headers.get("content-length")
  if (contentLength) {
    console.log(`  → Content-Length: ${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)} MB`)
  }

  return res
}

// ── Parseo del CSV en modo streaming ─────────────────────────────────────────
//
// El CSV tiene ~1.4M filas — se procesa línea por línea para no acumular todo
// en memoria de una vez.
//
// Header esperado:
//   cuit,sucursal,anio,lat,lon,clae6,in_departamentos,provincia_id,quintil,empleo,proporcion_mujeres
//
// Agrega por clave (provincia_id padded, anio):
//   - cuits: Set de CUITs únicos = establecimientos (empresas)
//   - sucursales: contador de filas = establecimientos físicos

async function parsearCSVStream(response) {
  // Convierte el ReadableStream web (fetch) al Readable de Node.js
  const nodeStream = Readable.fromWeb(response.body)
  const rl = createInterface({ input: nodeStream, crlfDelay: Infinity })

  // mapa: "provId|anio" → { cuits: Set<string>, sucursales: number }
  const mapa = new Map()

  let lineaActual = 0
  let encabezado = null
  let iCuit = -1
  let iAnio = -1
  let iProvId = -1
  let filasSaltadas = 0

  for await (const linea of rl) {
    lineaActual++

    // ── Encabezado ────────────────────────────────────────────────────────────
    if (lineaActual === 1) {
      encabezado = linea.split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))
      iCuit   = encabezado.indexOf("cuit")
      iAnio   = encabezado.indexOf("anio")
      iProvId = encabezado.indexOf("provincia_id")

      if (iCuit === -1 || iAnio === -1 || iProvId === -1) {
        throw new Error(
          `Columnas requeridas no encontradas. Encabezado: ${encabezado.join(", ")}`
        )
      }
      console.log(`  → Encabezado OK: ${encabezado.join(", ")}`)
      continue
    }

    // ── Filas de datos ────────────────────────────────────────────────────────
    const cols = linea.split(",")
    if (cols.length < Math.max(iCuit, iAnio, iProvId) + 1) {
      filasSaltadas++
      continue
    }

    const cuit    = cols[iCuit].trim().replace(/"/g, "")
    const anioRaw = cols[iAnio].trim().replace(/"/g, "")
    const provRaw = cols[iProvId].trim().replace(/"/g, "")

    if (!cuit || !anioRaw || !provRaw) { filasSaltadas++; continue }

    const anio  = parseInt(anioRaw, 10)
    if (isNaN(anio) || anio < 2000 || anio > 2030) { filasSaltadas++; continue }

    // El CSV usa IDs sin padding ('2' → '02', '6' → '06')
    const provId = provRaw.padStart(2, "0")
    if (!PROVINCIAS_INDEC[provId]) { filasSaltadas++; continue }

    // Acumular en el mapa
    const clave = `${provId}|${anio}`
    if (!mapa.has(clave)) {
      mapa.set(clave, { cuits: new Set(), sucursales: 0 })
    }
    const entrada = mapa.get(clave)
    entrada.cuits.add(cuit)
    entrada.sucursales++

    // Log de progreso cada 100k filas
    if (lineaActual % 100_000 === 0) {
      console.log(`  → Procesadas ${(lineaActual / 1_000).toFixed(0)}k filas...`)
    }
  }

  console.log(`  → Total filas leídas: ${lineaActual.toLocaleString("es-AR")} (saltadas: ${filasSaltadas})`)

  return mapa
}

// ── Construir estructura de salida ────────────────────────────────────────────

function construirOutput(mapa) {
  // Agrupar por provincia
  const porProvincia = new Map()

  for (const [clave, { cuits, sucursales }] of mapa) {
    const [provId, anioStr] = clave.split("|")
    const anio = parseInt(anioStr, 10)
    const establecimientos = cuits.size // CUITs únicos = empresas

    if (!porProvincia.has(provId)) {
      porProvincia.set(provId, {
        id: provId,
        nombre: PROVINCIAS_INDEC[provId],
        series: [],
      })
    }
    porProvincia.get(provId).series.push({ anio, establecimientos, sucursales })
  }

  // Ordenar series por año y calcular último valor
  const provincias = []
  for (const prov of porProvincia.values()) {
    prov.series.sort((a, b) => a.anio - b.anio)
    const ultimo = prov.series.at(-1)

    provincias.push({
      id: prov.id,
      nombre: prov.nombre,
      ultimo_anio: ultimo.anio,
      ultimo_valor: ultimo.establecimientos,
      series: prov.series,
    })
  }

  // Ordenar por último valor descendente (más establecimientos primero)
  provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)

  return provincias
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== update-establecimientos-provincias ===")

  // 1. Descargar
  const response = await descargarCSV()

  // 2. Parsear en modo streaming (evita cargar los 96MB como string en RAM)
  console.log("[2] Procesando CSV en streaming...")
  const mapa = await parsearCSVStream(response)

  // 3. Construir salida
  console.log("[3] Construyendo JSON de salida...")
  const provincias = construirOutput(mapa)

  if (provincias.length === 0) {
    console.error("ERROR: No se encontraron provincias en el CSV")
    process.exit(1)
  }

  // Calcular cobertura temporal global
  const todosAnios = provincias.flatMap((p) => p.series.map((s) => s.anio))
  const desdeAnio  = Math.min(...todosAnios)
  const hastaAnio  = Math.max(...todosAnios)

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo / CEP XXI (Secretaría de Industria)",
    licencia: "Datos abiertos — datos.gob.ar",
    cobertura: { desde: desdeAnio, hasta: hastaAnio },
    total_provincias: provincias.length,
    provincias,
  }

  // 4. Guardar
  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")

  console.log(`\n✓ ${provincias.length} provincias | ${desdeAnio} → ${hastaAnio}`)
  console.log(`✓ Guardado en public/data/establecimientos-provincias.json`)

  // Resumen por provincia (top 5)
  console.log("\nTop 5 por establecimientos únicos (último año):")
  for (const p of provincias.slice(0, 5)) {
    console.log(`  ${p.nombre.padEnd(20)} ${p.ultimo_valor.toLocaleString("es-AR").padStart(8)} establecimientos (${p.ultimo_anio})`)
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message)
  process.exit(1)
})
