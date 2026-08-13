import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/deuda — Licitaciones de deuda del Tesoro
 *
 * Fuentes de datos:
 *   - argentina.gob.ar/economia/licitaciones (scraping HTML público)
 *
 * Portado desde EconData_argy/api/services/finanzas_scraper.py + routers/deuda.py
 */

import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import {
  attachQuarterlyGdp,
  buildAnnualDebtHistory,
  parseDebtSheetRows,
  type QuarterlyGdpPoint,
} from "@/server/domain/debt-stock"

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
      const res = await fetchRegistered(BASE_GOB + path, {
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
    const res = await fetchRegistered(url, {
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

  try {
    const links = await recolectarLinks(n)
    const results = await Promise.all(links.map((url) => parsearResultado(url)))
    const licitaciones = results.filter((r): r is LicitacionResult => r !== null)

    if (licitaciones.length === 0) throw new Error("SOURCE_UNAVAILABLE:LICITACIONES")
    setCache(`licitaciones_${n}`, licitaciones, 3600)
    return licitaciones
  } catch (error) {
    throw new Error("SOURCE_UNAVAILABLE:LICITACIONES", { cause: error })
  }
}

// ── Stock de Deuda Pública ─────────────────────────────────────────────────────

async function fetchDebtWorkbookRows(): Promise<unknown[][]> {
  const pageResponse = await fetchRegistered(
    `${BASE_GOB}/economia/finanzas/datos-mensuales-de-la-deuda/datos`,
    {
      headers: { "User-Agent": "PanelDeControl/2.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86_400 },
    },
  )
  if (!pageResponse.ok) throw new Error(`Finanzas page ${pageResponse.status}`)

  const html = await pageResponse.text()
  const workbookMatch = html.match(/href=["'](?:blank:#)?(https?:\/\/[^"']+\.xlsx)["']/i)
  if (!workbookMatch) throw new Error("Official debt workbook URL not found")

  const workbookResponse = await fetchRegistered(workbookMatch[1], {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    signal: AbortSignal.timeout(30000),
    next: { revalidate: 86_400 },
  })
  if (!workbookResponse.ok) throw new Error(`Debt workbook ${workbookResponse.status}`)

  const workbook = XLSX.read(new Uint8Array(await workbookResponse.arrayBuffer()), { type: "array" })
  const sheet = workbook.Sheets["A.1"]
  if (!sheet) throw new Error("Official debt workbook sheet A.1 not found")
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
}

async function fetchQuarterlyGdp(): Promise<QuarterlyGdpPoint[]> {
  const url = "https://apis.datos.gob.ar/series/api/series/?ids=9.2_PDPC_2004_T_30&limit=120&sort=asc"
  const response = await fetchRegistered(url, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 86_400 },
  })
  if (!response.ok) throw new Error(`INDEC GDP ${response.status}`)
  const payload = await response.json() as { data?: Array<[string, number | null]> }
  return (payload.data ?? []).filter(
    (point): point is QuarterlyGdpPoint => Number.isFinite(point[1]) && (point[1] ?? 0) > 0,
  )
}

async function getStockDeuda() {
  const cacheKey = "deuda_stock_v3"
  const cached = getCache<unknown>(cacheKey)
  if (cached) return cached

  const [rows, gdp] = await Promise.all([fetchDebtWorkbookRows(), fetchQuarterlyGdp()])
  const parsedDebt = parseDebtSheetRows(rows)
  if (parsedDebt.length === 0) throw new Error("SOURCE_BAD_RESPONSE:DEBT_WORKBOOK_EMPTY")

  const monthly = attachQuarterlyGdp(parsedDebt, gdp)
  const historical = buildAnnualDebtHistory(monthly)
  const latest = monthly.at(-1)
  if (!latest || historical.length === 0) throw new Error("SOURCE_BAD_RESPONSE:DEBT_HISTORY_EMPTY")

  const result = {
    data: {
      historico_pib: historical,
      series_mensual: monthly,
      ultimo: { anio: latest.date, deuda_pib: latest.deuda_pib, deuda_usd: latest.deuda_usd },
      vencimientos: [],
      vencimientos_detalle: [],
      composicion_acreedor: [],
      composicion_moneda: [],
      is_live: true,
    },
    updated_at: new Date().toISOString(),
    source: "Secretaría de Finanzas — boletín mensual de deuda · PIB USD INDEC",
  }

  setCache(cacheKey, result, 86_400)
  return result
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")

  if (endpoint === "stock") {
    try {
      const data = await getStockDeuda()
      return NextResponse.json(data)
    } catch (error) {
      console.error("[/api/deuda?endpoint=stock]", error)
      return NextResponse.json(
        { error: { code: "SOURCE_UNAVAILABLE", message: "Stock de deuda no disponible", retryable: true } },
        { status: 502 },
      )
    }
  }

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
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Licitaciones no disponibles", retryable: true } },
      { status: 502 },
    )
  }
}
