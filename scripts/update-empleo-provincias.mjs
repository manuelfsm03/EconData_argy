/**
 * update-empleo-provincias.mjs
 *
 * Descarga el CSV de puestos de trabajo registrados por provincia del OEDE
 * (Ministerio de Trabajo / SIPA-AFIP) y genera public/data/empleo-provincias.json.
 *
 * Corre mensualmente vía GitHub Actions (.github/workflows/update-datos-provinciales.yml).
 * También se puede correr manualmente: node scripts/update-empleo-provincias.mjs
 *
 * Fuente: Observatorio de Empleo y Dinámica Empresarial (OEDE)
 * Datos: puestos asalariados privados registrados por provincia, mensual 2007-presente
 * Licencia: datos.gob.ar — uso libre con atribución
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..")
const OUT_PATH = join(REPO_ROOT, "public", "data", "empleo-provincias.json")

// URLs candidatas en orden de preferencia
const URLS_CANDIDATAS = [
  // CDN directo con Referer del portal
  "https://cdn.produccion.gob.ar/cdn-cep/datos-por-provincia/por-provincia/puestos/puestos_priv.csv",
  // Portal de datos abiertos (puede tener redirect al CDN)
  "https://datos.produccion.gob.ar/dataset/4a2e72bf-7376-43c8-bead-31bb1f7b6703/resource/8bb3b5ef-f6f1-476e-b28f-f02e0f65e33e/download/puestos_priv.csv",
]

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; LaPizarra/1.0; datos publicos)",
  "Referer": "https://datos.produccion.gob.ar/",
  "Accept": "text/csv,text/plain,*/*",
}

// IDs oficiales de provincias argentinas (INDEC)
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

async function descargarCSV() {
  let ultimoError
  for (const url of URLS_CANDIDATAS) {
    console.log(`Intentando: ${url}`)
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: "follow" })
      if (!res.ok) {
        console.warn(`  → ${res.status} ${res.statusText}`)
        ultimoError = new Error(`HTTP ${res.status}`)
        continue
      }
      const texto = await res.text()
      if (texto.length < 1000 || !texto.includes(",")) {
        console.warn(`  → Respuesta inválida (${texto.length} bytes)`)
        ultimoError = new Error("Respuesta inválida")
        continue
      }
      console.log(`  → OK (${(texto.length / 1024).toFixed(0)} KB)`)
      return texto
    } catch (err) {
      console.warn(`  → Error: ${err.message}`)
      ultimoError = err
    }
  }
  throw ultimoError ?? new Error("Todas las URLs fallaron")
}

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n")
  const encabezado = lineas[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))

  // Detectar columnas clave (el CSV puede variar en nombre)
  const col = (nombres) => {
    for (const n of nombres) {
      const idx = encabezado.indexOf(n)
      if (idx !== -1) return idx
    }
    return -1
  }

  const iProvId    = col(["codigo_provincia", "provincia_id", "cod_prov", "id_provincia"])
  const iProvNom   = col(["nombre_provincia", "provincia", "provincia_nombre", "nom_prov"])
  const iAnio      = col(["anio", "año", "year"])
  const iMes       = col(["mes", "month"])
  const iPuestos   = col(["puestos", "puestos_de_trabajo", "cantidad_puestos", "total_puestos"])

  if (iAnio === -1 || iMes === -1 || iPuestos === -1) {
    throw new Error(`Columnas no encontradas. Encabezado: ${encabezado.join(", ")}`)
  }

  // Agregar por provincia + período (sumar sectores)
  const mapa = new Map() // key: "provId|YYYY-MM" → puestos

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(",").map((c) => c.trim().replace(/"/g, ""))
    if (cols.length < Math.max(iAnio, iMes, iPuestos) + 1) continue

    const provId  = iProvId !== -1 ? cols[iProvId].padStart(2, "0") : "00"
    const anio    = parseInt(cols[iAnio], 10)
    const mes     = parseInt(cols[iMes], 10)
    const puestos = parseInt(cols[iPuestos], 10)

    if (isNaN(anio) || isNaN(mes) || isNaN(puestos)) continue
    if (anio < 2007 || anio > 2030) continue

    const periodo = `${anio}-${String(mes).padStart(2, "0")}`
    const clave = `${provId}|${periodo}`
    mapa.set(clave, (mapa.get(clave) ?? 0) + puestos)

    // Si no tenemos nombre, guardarlo
    if (iProvNom !== -1 && !PROVINCIAS_INDEC[provId]) {
      PROVINCIAS_INDEC[provId] = cols[iProvNom]
    }
  }

  // Estructurar por provincia
  const porProvincia = new Map()
  for (const [clave, puestos] of mapa) {
    const [provId, periodo] = clave.split("|")
    if (!porProvincia.has(provId)) {
      porProvincia.set(provId, { id: provId, nombre: PROVINCIAS_INDEC[provId] ?? provId, series: [] })
    }
    porProvincia.get(provId).series.push({ periodo, puestos })
  }

  // Ordenar series cronológicamente y calcular variación interanual
  const provincias = []
  for (const prov of porProvincia.values()) {
    prov.series.sort((a, b) => a.periodo.localeCompare(b.periodo))

    const ultimo = prov.series.at(-1)
    if (!ultimo) continue

    // Variación interanual: mismo mes del año anterior
    const [anioUlt, mesUlt] = ultimo.periodo.split("-")
    const periodoAnterior = `${Number(anioUlt) - 1}-${mesUlt}`
    const anterior = prov.series.find((s) => s.periodo === periodoAnterior)
    const variacion_interanual = anterior
      ? (ultimo.puestos - anterior.puestos) / anterior.puestos
      : null

    provincias.push({
      id: prov.id,
      nombre: prov.nombre,
      ultimo_periodo: ultimo.periodo,
      ultimo_valor: ultimo.puestos,
      variacion_interanual,
      series: prov.series,
    })
  }

  // Ordenar por último valor descendente
  provincias.sort((a, b) => b.ultimo_valor - a.ultimo_valor)

  return provincias
}

async function main() {
  console.log("=== update-empleo-provincias ===")

  const texto = await descargarCSV()
  const provincias = parsearCSV(texto)

  const primerPeriodo = provincias[0]?.series[0]?.periodo ?? "?"
  const ultimoPeriodo = provincias[0]?.ultimo_periodo ?? "?"

  const output = {
    generado_en: new Date().toISOString(),
    fuente: "OEDE — Ministerio de Trabajo, Empleo y Seguridad Social / SIPA-AFIP",
    licencia: "Datos abiertos — datos.gob.ar",
    cobertura: { desde: primerPeriodo, hasta: ultimoPeriodo },
    total_provincias: provincias.length,
    provincias,
  }

  mkdirSync(join(REPO_ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8")

  console.log(`✓ ${provincias.length} provincias | ${primerPeriodo} → ${ultimoPeriodo}`)
  console.log(`✓ Guardado en public/data/empleo-provincias.json`)
}

main().catch((err) => {
  console.error("ERROR:", err.message)
  process.exit(1)
})
