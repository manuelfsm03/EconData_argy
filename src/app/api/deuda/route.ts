/**
 * /api/deuda — Licitaciones de deuda del Tesoro
 *
 * Fuentes de datos:
 *   - argentina.gob.ar/economia/licitaciones (scraping HTML público)
 *
 * Portado desde EconData_argy/api/services/finanzas_scraper.py + routers/deuda.py
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_GOB = "https://www.argentina.gob.ar"

const ARCHIVE_PATHS = [
  "/economia/licitaciones",
  "/economia/finanzas/licitaciones-de-letras-del-tesoro",
]

// In-memory cache
const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

interface LicitacionResult {
  fecha: string
  adjudicado_bn: number | null
  vencimientos_bn: number | null
  rollover_pct: number | null
  instrumentos: { tipo: string; tem: number }[]
  url: string
}

async function recolectarLinks(n: number): Promise<string[]> {
  const links: string[] = []
  for (const path of ARCHIVE_PATHS) {
    try {
      const res = await fetch(BASE_GOB + path, {
        headers: { "User-Agent": "PanelDeControl/2.0" },
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue
      const html = await res.text()

      // Parse href attributes manually (no cheerio in edge runtime)
      const hrefRegex = /href="([^"]+)"/g
      let match
      while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1]
        const hrefL = href.toLowerCase()
        if (
          hrefL.includes("licitaci") &&
          !hrefL.includes(".pdf") &&
          href !== "#"
        ) {
          const url = href.startsWith("/") ? BASE_GOB + href : href
          if (!links.includes(url)) links.push(url)
        }
        if (links.length >= n) break
      }
    } catch {
      continue
    }
    if (links.length >= n) break
  }
  return links.slice(0, n)
}

function extraerMonto(texto: string, patron: RegExp): number | null {
  const m = texto.match(patron)
  if (!m) return null
  const num = m[1].replace(/\./g, "").replace(",", ".")
  const parsed = parseFloat(num)
  return isNaN(parsed) ? null : parsed
}

async function parsearResultado(url: string): Promise<LicitacionResult | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const html = await res.text()

    // Strip HTML tags for text extraction
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

    const adjudicado = extraerMonto(
      texto,
      /adjudic[aáoó][^$\n]{0,40}\$\s*([\d.,]+)/i,
    )
    const vencimientos = extraerMonto(
      texto,
      /venc[imiento]{0,9}[^$\n]{0,40}\$\s*([\d.,]+)/i,
    )
    const rollover =
      adjudicado && vencimientos
        ? parseFloat(((adjudicado / vencimientos) * 100).toFixed(1))
        : null

    const fechaM = texto.match(/(\d{1,2}) de (\w+) de (\d{4})/)
    const fecha = fechaM ? fechaM[0] : ""

    const instrumentos: { tipo: string; tem: number }[] = []
    const instRe =
      /(LECAP|BONCAP|LECER|BONCER|LELINK|LETAMAR|LETES)[^T]{0,30}TEM[^\d]{0,5}(\d+[,.]\d+)%/gi
    let m
    while ((m = instRe.exec(texto)) !== null) {
      instrumentos.push({
        tipo: m[1].toUpperCase(),
        tem: parseFloat(m[2].replace(",", ".")),
      })
      if (instrumentos.length >= 6) break
    }

    return { fecha, adjudicado_bn: adjudicado, vencimientos_bn: vencimientos, rollover_pct: rollover, instrumentos, url }
  } catch {
    return null
  }
}

async function getUltimasLicitaciones(n: number): Promise<LicitacionResult[]> {
  const cached = getCache<LicitacionResult[]>(`licitaciones_${n}`)
  if (cached) return cached

  const links = await recolectarLinks(n)
  const results = await Promise.all(links.map((url) => parsearResultado(url)))
  const licitaciones = results.filter((r): r is LicitacionResult => r !== null)

  setCache(`licitaciones_${n}`, licitaciones, 3600)
  return licitaciones
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const n = Math.min(parseInt(searchParams.get("n") ?? "6"), 12)

  try {
    const data = await getUltimasLicitaciones(n)
    return NextResponse.json({
      data,
      updated_at: new Date().toISOString(),
      source: "argentina.gob.ar",
    })
  } catch (error) {
    console.error("[/api/deuda]", error)
    return NextResponse.json({ error: "Error al obtener licitaciones", detail: String(error) }, { status: 500 })
  }
}
