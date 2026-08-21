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
import { getUltimasLicitaciones } from "@/server/external/tesoro-licitaciones"
import { leerFresco, guardarExito, leerUltimoBueno } from "@/server/http/stale-cache"

const BASE_GOB = "https://www.argentina.gob.ar"

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
  // El sitio pasó de linkear el .xlsx con URL absoluta a una ruta relativa
  // (/sites/default/files/...) -- se acepta cualquiera de las dos formas.
  const workbookMatch = html.match(/href=["'](?:blank:#)?((?:https?:\/\/[^"']+|\/[^"']+)\.xlsx)["']/i)
  if (!workbookMatch) throw new Error("Official debt workbook URL not found")
  const workbookUrl = workbookMatch[1].startsWith("/") ? BASE_GOB + workbookMatch[1] : workbookMatch[1]

  const workbookResponse = await fetchRegistered(workbookUrl, {
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

  // Nivel 1 — fresco: dentro del TTL no volver a la fuente
  const fresco = leerFresco<object>(cacheKey)
  if (fresco) return { ...fresco, cached: true }

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

  guardarExito(cacheKey, result, 86_400)
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
      // Fallback stale — datos de deuda no cambian a diario, cache indefinido
      const stale = leerUltimoBueno<object>("deuda_stock_v3")
      if (stale) {
        return NextResponse.json(
          { ...stale.data, cached: true, stale: true, stale_since: stale.staleSince },
          { headers: { "X-Data-Source": "stale-cache" } },
        )
      }
      return NextResponse.json(
        { error: { code: "SOURCE_UNAVAILABLE", message: "Stock de deuda no disponible", retryable: true } },
        { status: 502 },
      )
    }
  }

  const n = Math.min(parseInt(searchParams.get("n") ?? "6"), 12)
  const cacheKey = `licitaciones:${n}`

  try {
    // Nivel 1 — fresco
    const fresco = leerFresco<Awaited<ReturnType<typeof getUltimasLicitaciones>>>(cacheKey)
    if (fresco) {
      return NextResponse.json({
        data: fresco,
        cached: true,
        updated_at: new Date().toISOString(),
        source: "stale-cache (fresco)",
      })
    }

    const data = await getUltimasLicitaciones(n)
    if (data.length === 0) throw new Error("SOURCE_UNAVAILABLE:LICITACIONES")
    guardarExito(cacheKey, data, 21_600) // 6h; el cron de Vercel lo mantiene tibio
    return NextResponse.json({
      data,
      updated_at: new Date().toISOString(),
      source: "argentina.gob.ar — Secretaría de Finanzas (notas de resultado de licitación)",
    })
  } catch (error) {
    console.error("[/api/deuda]", error)
    // Fallback stale — licitaciones cambian poco
    const stale = leerUltimoBueno<Awaited<ReturnType<typeof getUltimasLicitaciones>>>(cacheKey)
    if (stale) {
      return NextResponse.json(
        {
          data: stale.data,
          cached: true,
          stale: true,
          stale_since: stale.staleSince,
          updated_at: new Date().toISOString(),
          source: "stale-cache",
        },
        { headers: { "X-Data-Source": "stale-cache" } },
      )
    }
    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Licitaciones no disponibles", retryable: true } },
      { status: 502 },
    )
  }
}
