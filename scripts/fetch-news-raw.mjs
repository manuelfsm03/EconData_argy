#!/usr/bin/env node
/**
 * fetch-news-raw.mjs
 *
 * Scraper de RSS de fuentes económicas argentinas para el News Summarizer.
 * Corre 2 veces por día desde GitHub Actions (7am y 12pm hora AR).
 *
 * Uso:
 *   node scripts/fetch-news-raw.mjs [morning|noon]
 *
 * Output: public/data/news-raw-YYYY-MM-DD-{morning|noon}.json
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Parser from "rss-parser"

// ── Config ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, "..")
const OUT_DIR = resolve(REPO_ROOT, "public", "data")

// Ventana de frescura: últimas 24 horas.
const HOURS_WINDOW = 24

// Timeout por feed en ms.
const FEED_TIMEOUT_MS = 10_000

// Fuentes AR económicas. Marcadas con nombre corto para citar en los bullets.
const FUENTES = [
  { nombre: "Cronista",  url: "https://www.cronista.com/files/rss/economia.xml" },
  { nombre: "Cronista",  url: "https://www.cronista.com/files/rss/finanzas-mercados.xml" },
  { nombre: "Cronista",  url: "https://www.cronista.com/files/rss/news.xml" }, // fallback amplio
  { nombre: "Ámbito",    url: "https://www.ambito.com/rss/pages/economia.xml" },
  { nombre: "Ámbito",    url: "https://www.ambito.com/rss/pages/finanzas.xml" },
  { nombre: "Ámbito",    url: "https://www.ambito.com/rss/economia.xml" }, // fallback path corto
  { nombre: "Ámbito",    url: "https://www.ambito.com/rss/finanzas.xml" },
  { nombre: "BAE",       url: "https://www.baenegocios.com/rss/pages/BAENegocios.xml" },
  { nombre: "BAE",       url: "https://www.baenegocios.com/feed/" }, // fallback
  { nombre: "Infobae",   url: "https://www.infobae.com/economia/feeds/rss/" },
  { nombre: "Infobae",   url: "https://www.infobae.com/arc/outboundfeeds/rss/category/economia/" }, // fallback
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolverCorte(argv) {
  const arg = (argv[2] || "").toLowerCase()
  if (arg === "morning" || arg === "noon") return arg
  // Auto: por hora UTC (7am AR = 10 UTC, 12pm AR = 15 UTC).
  const horaUtc = new Date().getUTCHours()
  return horaUtc < 13 ? "morning" : "noon"
}

function normalizarTitulo(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
}

function limpiarHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

function fechaISO(d) {
  return new Date(d).toISOString()
}

function fechaHoy() {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

// ── Fetch de un feed con timeout ────────────────────────────────────────────

async function fetchFeed(fuente, parser) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS)
  try {
    const res = await fetch(fuente.url, {
      signal: controller.signal,
      headers: { "User-Agent": "LaPizarra-NewsBrief/1.0 (+https://lapizarra.ar)" },
    })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, items: [] }
    }
    const xml = await res.text()
    const feed = await parser.parseString(xml)
    return { ok: true, items: feed.items || [] }
  } catch (err) {
    return { ok: false, error: err.message || String(err), items: [] }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const corte = resolverCorte(process.argv)
  const fecha = fechaHoy()
  const parser = new Parser({ timeout: FEED_TIMEOUT_MS })

  console.log(`[news-raw] corte=${corte} fecha=${fecha}`)
  console.log(`[news-raw] intentando ${FUENTES.length} feeds…`)

  const ventanaMs = HOURS_WINDOW * 60 * 60 * 1000
  const ahora = Date.now()

  const resultadosPorFuente = new Map()
  const noticias = []

  for (const fuente of FUENTES) {
    const r = await fetchFeed(fuente, parser)
    if (!r.ok) {
      console.warn(`[news-raw] WARN feed caido — ${fuente.url} — ${r.error}`)
      const acumulado = resultadosPorFuente.get(fuente.url) || { nombre: fuente.nombre, url: fuente.url, titulos_recibidos: 0, error: r.error }
      resultadosPorFuente.set(fuente.url, acumulado)
      continue
    }

    let usados = 0
    for (const item of r.items) {
      const titulo = limpiarHtml(item.title)
      const link = (item.link || "").trim()
      if (!titulo || !link) continue

      const pub = item.isoDate || item.pubDate
      const ts = pub ? Date.parse(pub) : NaN
      if (!Number.isFinite(ts)) continue
      if (ahora - ts > ventanaMs) continue

      const descripcion = limpiarHtml(item.contentSnippet || item.content || item.summary || "").slice(0, 400)

      noticias.push({
        fuente: fuente.nombre,
        titulo,
        descripcion,
        url: link,
        fecha: fechaISO(pub),
        _norm: normalizarTitulo(titulo),
      })
      usados++
    }
    resultadosPorFuente.set(fuente.url, { nombre: fuente.nombre, url: fuente.url, titulos_recibidos: usados })
  }

  // ── Deduplicación por título normalizado + URL ─────────────────────────────
  const seen = new Set()
  const dedup = []
  for (const n of noticias) {
    const key = n._norm.length > 20 ? n._norm : n.url
    if (seen.has(key)) continue
    seen.add(key)
    delete n._norm
    dedup.push(n)
  }

  // Orden desc por fecha.
  dedup.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))

  const fuentes = Array.from(resultadosPorFuente.values())
  const feedsOK = fuentes.filter((f) => f.titulos_recibidos > 0).length

  if (feedsOK === 0) {
    console.error(`[news-raw] ERROR — ningún feed devolvió items. Abortando.`)
    process.exit(2)
  }

  const salida = {
    generado_en: new Date().toISOString(),
    corte_horario: corte,
    fuentes,
    noticias: dedup,
    total_noticias: dedup.length,
  }

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = resolve(OUT_DIR, `news-raw-${fecha}-${corte}.json`)
  await writeFile(outPath, JSON.stringify(salida, null, 2), "utf8")
  console.log(`[news-raw] OK — ${dedup.length} noticias únicas de ${feedsOK} feeds — ${outPath}`)
}

main().catch((err) => {
  console.error(`[news-raw] FATAL —`, err)
  process.exit(1)
})
