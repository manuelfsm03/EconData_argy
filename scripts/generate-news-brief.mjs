#!/usr/bin/env node
/**
 * generate-news-brief.mjs
 *
 * Toma el JSON crudo de fetch-news-raw.mjs y llama a Claude Haiku 4.5 para
 * armar un "morning brief" de 4 secciones (dólar, tasas, deuda, actividad).
 *
 * Uso:
 *   ANTHROPIC_API_KEY=... node scripts/generate-news-brief.mjs [morning|noon]
 *
 * Output: public/data/news-brief-YYYY-MM-DD-{morning|noon}.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, "..")
const DATA_DIR = resolve(REPO_ROOT, "public", "data")

const MODELO = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 2000
const ENDPOINT = "https://api.anthropic.com/v1/messages"

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolverCorte(argv) {
  const arg = (argv[2] || "").toLowerCase()
  if (arg === "morning" || arg === "noon") return arg
  const horaUtc = new Date().getUTCHours()
  return horaUtc < 13 ? "morning" : "noon"
}

function fechaHoy() {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function fechaDisplay(fechaISO) {
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
  const d = new Date(fechaISO)
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function horaDisplay(corte) {
  return corte === "morning" ? "07:00 AR" : "12:00 AR"
}

function seccionVacia() {
  return [{ texto: "Sin novedades destacadas hoy.", fuente: null, url: null }]
}

// Extrae el primer bloque JSON balanceado de un texto (Haiku a veces envuelve con prosa).
function extractJson(texto) {
  const inicio = texto.indexOf("{")
  const fin = texto.lastIndexOf("}")
  if (inicio === -1 || fin === -1 || fin <= inicio) return null
  const bruto = texto.slice(inicio, fin + 1)
  try {
    return JSON.parse(bruto)
  } catch {
    return null
  }
}

// ── Prompt para Claude Haiku 4.5 ────────────────────────────────────────────

function armarPrompt(noticias) {
  // Enviamos solo lo indispensable — Haiku es barato pero no queremos gastar tokens en HTML.
  const inputAgente = noticias.map((n, i) => ({
    id: i,
    fuente: n.fuente,
    titulo: n.titulo,
    descripcion: (n.descripcion || "").slice(0, 220),
    url: n.url,
  }))

  const instrucciones = `Sos un editor económico argentino. Recibís un listado de titulares y descripciones de las últimas 24hs de fuentes AR (Cronista, Ámbito, BAE, Infobae).

TU TAREA:
Armar un "morning brief" agrupando la información en 4 secciones temáticas:
  - dolar_cambiario: tipo de cambio (oficial, blue, MEP, CCL), brecha, cepo, reservas, intervención BCRA
  - tasas_monetario: política monetaria BCRA, tasas de interés, TAMAR, BADLAR, LECAPs, emisión, base monetaria
  - deuda_fiscal: deuda pública, riesgo país, licitaciones Tesoro, resultado fiscal, FMI, gastos e ingresos del Estado
  - actividad_inflacion: IPC / inflación, EMAE, actividad económica, salarios, empleo, consumo, industria

REGLAS DURAS:
1. Escribí 3 a 5 bullets por sección. Cada bullet: 15-25 palabras, tono neutro periodístico.
2. NO inventes datos que no estén en las noticias que te paso.
3. NO opines, no adjetives ("preocupante", "histórico"), no proyectes ("podría"): resumí lo que dicen.
4. Si una sección no tiene noticias relevantes, devolvé un solo bullet: "Sin novedades destacadas hoy."
5. Cada bullet DEBE citar la nota fuente usando el "id" del listado (así se rastrea la URL).
6. NO mezcles secciones: si una noticia toca dólar y tasas, elegí la sección dominante.
7. Preferí noticias con datos concretos (cifras, porcentajes, montos) por sobre opiniones.

FORMATO DE SALIDA:
Devolvé SOLO un objeto JSON válido con esta forma (sin texto antes ni después):
{
  "dolar_cambiario":     [{ "texto": "…", "id_fuente": 12 }, …],
  "tasas_monetario":     [{ "texto": "…", "id_fuente": 3 },  …],
  "deuda_fiscal":        [{ "texto": "…", "id_fuente": 27 }, …],
  "actividad_inflacion": [{ "texto": "…", "id_fuente": 8 },  …]
}

LISTADO DE NOTICIAS (JSON):
${JSON.stringify(inputAgente, null, 2)}`

  return instrucciones
}

// ── Llamada a Claude Haiku ──────────────────────────────────────────────────

async function llamarHaiku(prompt, apiKey) {
  const body = {
    model: MODELO,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 500)}`)
  }

  const data = await res.json()
  const bloqueTexto = (data.content || []).find((c) => c.type === "text")
  if (!bloqueTexto) throw new Error("Respuesta sin bloque de texto")
  return bloqueTexto.text
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("ERROR: falta ANTHROPIC_API_KEY. Setealo en Vercel/Actions secrets.")
    process.exit(1)
  }

  const corte = resolverCorte(process.argv)
  const fecha = fechaHoy()
  const rawPath = resolve(DATA_DIR, `news-raw-${fecha}-${corte}.json`)

  console.log(`[news-brief] corte=${corte} fecha=${fecha}`)
  console.log(`[news-brief] leyendo raw: ${rawPath}`)

  let raw
  try {
    const contenido = await readFile(rawPath, "utf8")
    raw = JSON.parse(contenido)
  } catch (err) {
    console.error(`[news-brief] ERROR — no se pudo leer ${rawPath}: ${err.message}`)
    console.error(`[news-brief] correr antes: node scripts/fetch-news-raw.mjs ${corte}`)
    process.exit(2)
  }

  const noticias = raw.noticias || []
  if (noticias.length === 0) {
    console.error(`[news-brief] ERROR — raw sin noticias, abortando.`)
    process.exit(2)
  }

  console.log(`[news-brief] pidiendo resumen a ${MODELO} sobre ${noticias.length} noticias…`)

  const prompt = armarPrompt(noticias)
  const respuestaTexto = await llamarHaiku(prompt, apiKey)

  const parsed = extractJson(respuestaTexto)
  if (!parsed) {
    console.error(`[news-brief] ERROR — respuesta del modelo no es JSON parseable.`)
    console.error(respuestaTexto.slice(0, 1000))
    process.exit(3)
  }

  // Enriquecer con URL y fuente reales usando id_fuente
  function enriquecer(seccion) {
    if (!Array.isArray(seccion) || seccion.length === 0) return seccionVacia()
    return seccion
      .map((b) => {
        const idx = typeof b.id_fuente === "number" ? b.id_fuente : null
        const nota = idx != null ? noticias[idx] : null
        return {
          texto: String(b.texto || "").trim(),
          fuente: nota?.fuente || null,
          url: nota?.url || null,
        }
      })
      .filter((b) => b.texto.length > 0)
  }

  const secciones = {
    dolar_cambiario:     enriquecer(parsed.dolar_cambiario),
    tasas_monetario:     enriquecer(parsed.tasas_monetario),
    deuda_fiscal:        enriquecer(parsed.deuda_fiscal),
    actividad_inflacion: enriquecer(parsed.actividad_inflacion),
  }

  const totalBullets = Object.values(secciones).reduce(
    (acc, arr) => acc + arr.filter((b) => b.fuente !== null || !b.texto.startsWith("Sin novedades")).length,
    0,
  )

  const salida = {
    generado_en: new Date().toISOString(),
    corte_horario: corte,
    fecha_display: fechaDisplay(new Date().toISOString()),
    hora_display: horaDisplay(corte),
    modelo: MODELO,
    total_noticias_input: noticias.length,
    secciones,
    total_bullets: totalBullets,
  }

  await mkdir(DATA_DIR, { recursive: true })
  const outPath = resolve(DATA_DIR, `news-brief-${fecha}-${corte}.json`)
  await writeFile(outPath, JSON.stringify(salida, null, 2), "utf8")
  console.log(`[news-brief] OK — ${totalBullets} bullets — ${outPath}`)
}

main().catch((err) => {
  console.error(`[news-brief] FATAL —`, err)
  process.exit(1)
})
