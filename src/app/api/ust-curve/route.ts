import { fetchRegistered } from "@/server/http/fetch-source"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * /api/ust-curve — Curva de rendimientos del Tesoro de EEUU
 *
 * Fuente PRIMARIA: home.treasury.gov (CSV del año en curso).
 *
 * REDUNDANCIA:
 *   1) Si el CSV del año en curso falla o viene vacío (típico a principios de
 *      enero), reintentamos con el CSV del año ANTERIOR.
 *   2) Para la curva par (yield) probamos además el FEED XML del mismo Tesoro
 *      (formato distinto al CSV): si el endpoint CSV cambia o rompe, el XML nos
 *      cubre. Es redundancia "horizontal" real (otra ruta/otro formato).
 *   3) STALE-CACHE robusto: la curva se publica UNA vez por día hábil, así que
 *      servir la última buena (aunque sea de ayer) es perfectamente válido. Si
 *      TODAS las fuentes fallan, devolvemos el último dato bueno con flag
 *      { stale: true, stale_since } en vez de un 502.
 *
 * Todas las fuentes viven en home.treasury.gov (host registrado en el registry),
 * así que usamos fetchRegistered en todos los casos.
 */

// La curva del Tesoro se publica una vez por día en días hábiles
// 12h de caché es razonable sin perder frescura
const CACHE = "public, s-maxage=43200, stale-while-revalidate=86400"
const FRESH_TTL_SEG = 43200 // 12 h de cache fresco en memoria

const MATURITIES = [
  { label: "1M",  field: "1 Mo"  },
  { label: "2M",  field: "2 Mo"  },
  { label: "3M",  field: "3 Mo"  },
  { label: "4M",  field: "4 Mo"  },
  { label: "6M",  field: "6 Mo"  },
  { label: "1Y",  field: "1 Yr"  },
  { label: "2Y",  field: "2 Yr"  },
  { label: "3Y",  field: "3 Yr"  },
  { label: "5Y",  field: "5 Yr"  },
  { label: "7Y",  field: "7 Yr"  },
  { label: "10Y", field: "10 Yr" },
  { label: "20Y", field: "20 Yr" },
  { label: "30Y", field: "30 Yr" },
]

// Dataset separado de Treasury.gov: tasas de licitación secundaria de LETRAS
// (T-Bills), no la curva par. Se usa "coupon equivalent" (rendimiento
// anualizado comparable a un bono) en vez de "bank discount" (convención de
// cotización distinta, no comparable directo con la curva de arriba).
const BILL_MATURITIES = [
  { label: "4S",  field: "4 WEEKS COUPON EQUIVALENT"  },
  { label: "6S",  field: "6 WEEKS COUPON EQUIVALENT"  },
  { label: "8S",  field: "8 WEEKS COUPON EQUIVALENT"  },
  { label: "13S", field: "13 WEEKS COUPON EQUIVALENT" },
  { label: "17S", field: "17 WEEKS COUPON EQUIVALENT" },
  { label: "26S", field: "26 WEEKS COUPON EQUIVALENT" },
  { label: "52S", field: "52 WEEKS COUPON EQUIVALENT" },
]

// Mapeo etiqueta → campo del FEED XML (curva par). Los nombres XML difieren de
// los del CSV (BC_XXX en vez de "X Yr").
const XML_YIELD_FIELDS: { label: string; tag: string }[] = [
  { label: "1M",  tag: "BC_1MONTH" },
  { label: "2M",  tag: "BC_2MONTH" },
  { label: "3M",  tag: "BC_3MONTH" },
  { label: "4M",  tag: "BC_4MONTH" },
  { label: "6M",  tag: "BC_6MONTH" },
  { label: "1Y",  tag: "BC_1YEAR" },
  { label: "2Y",  tag: "BC_2YEAR" },
  { label: "3Y",  tag: "BC_3YEAR" },
  { label: "5Y",  tag: "BC_5YEAR" },
  { label: "7Y",  tag: "BC_7YEAR" },
  { label: "10Y", tag: "BC_10YEAR" },
  { label: "20Y", tag: "BC_20YEAR" },
  { label: "30Y", tag: "BC_30YEAR" },
]

type CurvePoint = { label: string; yield: number | null }
type CurveResult = { date: string | null; curve: CurvePoint[]; source: string }

// ── PRIMARIA / SECUNDARIA A: CSV del Tesoro (por año) ───────────────────────
async function fetchTreasuryCsvRow(type: string, year: number): Promise<Record<string, string>> {
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
    `?type=${type}&field_tdr_date_value=${year}&csv=true`

  const res = await fetchRegistered(url, {
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Treasury HTTP ${res.status}`)

  const csv = await res.text()
  const lines = csv.trim().split("\n")
  if (lines.length < 2) throw new Error("CSV vacío")

  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""))
  const dateIndex = headers.indexOf("Date")
  if (dateIndex < 0) throw new Error("CSV sin columna Date")
  const latestLine = lines.slice(1)
    .map(line => line.split(",").map(v => v.trim().replace(/"/g, "")))
    .filter(values => Number.isFinite(Date.parse(values[dateIndex] ?? "")))
    .sort((a, b) => Date.parse(b[dateIndex]) - Date.parse(a[dateIndex]))[0]
  if (!latestLine) throw new Error("CSV sin filas válidas")

  const row: Record<string, string> = {}
  headers.forEach((h, i) => { row[h] = latestLine[i] })
  return row
}

// Arma la curva a partir de una fila del CSV y la lista de vencimientos.
function curveFromRow(row: Record<string, string>, maturities: { label: string; field: string }[]): CurvePoint[] {
  return maturities.map(m => {
    const val = parseFloat(row[m.field] ?? "")
    return { label: m.label, yield: isNaN(val) ? null : val }
  }).filter(p => p.yield !== null)
}

// Intenta CSV del año en curso y, si falla o queda vacío, del año anterior.
async function fetchCsvCurve(type: string, maturities: { label: string; field: string }[]): Promise<CurveResult> {
  const year = new Date().getFullYear()
  for (const y of [year, year - 1]) {
    try {
      const row = await fetchTreasuryCsvRow(type, y)
      const curve = curveFromRow(row, maturities)
      if (curve.length) {
        return { date: row["Date"] ?? null, curve, source: y === year ? "treasury_csv" : "treasury_csv_prev_year" }
      }
    } catch {
      // probamos el siguiente año
    }
  }
  throw new Error("CSV del Tesoro no disponible")
}

// ── SECUNDARIA B: FEED XML del Tesoro (sólo curva par) ──────────────────────
function extractTag(block: string, tag: string): string | null {
  // Los campos vienen como <d:BC_10YEAR ...>4.25</d:BC_10YEAR>
  const m = block.match(new RegExp(`<d:${tag}[^>]*>([^<]*)</d:${tag}>`))
  return m ? m[1].trim() : null
}

async function fetchXmlYieldCurve(): Promise<CurveResult> {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml` +
    `?data=daily_treasury_yield_curve&field_tdr_date_value_month=${yyyymm}`

  const res = await fetchRegistered(url, {
    headers: { Accept: "application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Treasury XML HTTP ${res.status}`)

  const xml = await res.text()
  // Cada día es un bloque <m:properties>...</m:properties>. Elegimos el más nuevo.
  const blocks = xml.split("<m:properties>").slice(1).map(b => b.split("</m:properties>")[0])
  if (!blocks.length) throw new Error("XML sin entradas")

  let mejor: { date: string; block: string } | null = null
  for (const b of blocks) {
    const fecha = extractTag(b, "NEW_DATE")
    if (!fecha || !Number.isFinite(Date.parse(fecha))) continue
    if (!mejor || Date.parse(fecha) > Date.parse(mejor.date)) mejor = { date: fecha, block: b }
  }
  if (!mejor) throw new Error("XML sin fechas válidas")

  const curve = XML_YIELD_FIELDS.map(f => {
    const raw = extractTag(mejor!.block, f.tag)
    const val = parseFloat(raw ?? "")
    return { label: f.label, yield: isNaN(val) ? null : val }
  }).filter(p => p.yield !== null)
  if (!curve.length) throw new Error("XML sin valores de curva")

  // NEW_DATE viene como ISO datetime; nos quedamos con la fecha (YYYY-MM-DD).
  const date = mejor.date.split("T")[0]
  return { date, curve, source: "treasury_xml" }
}

// Orquesta las fuentes en vivo de la curva par: CSV (2 años) → XML.
async function fetchYieldCurve(): Promise<CurveResult> {
  try {
    return await fetchCsvCurve("daily_treasury_yield_curve", MATURITIES)
  } catch {
    // CSV cayó → probamos el feed XML (formato distinto).
    return await fetchXmlYieldCurve()
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tipoParam = searchParams.get("tipo")
  const esBills = tipoParam === "bills"
  const cacheKey = esBills ? "ust-curve:bills" : "ust-curve:yield"

  // 1) Cache fresco en memoria (12 h).
  const fresco = leerFresco<{ date: string | null; curve: CurvePoint[]; nota?: string; source?: string }>(cacheKey)
  if (fresco) {
    return NextResponse.json({ ...fresco, stale: false, cached: true }, { headers: { "Cache-Control": CACHE } })
  }

  try {
    if (esBills) {
      // Letras (T-Bills): CSV año en curso → año anterior. (Sin XML: el feed de
      // bills tiene otro esquema de campos; el stale-cache cubre el resto.)
      const { date, curve, source } = await fetchCsvCurve("daily_treasury_bill_rates", BILL_MATURITIES)
      const payload = {
        date,
        curve,
        nota: "Coupon equivalent (rendimiento anualizado comparable a bonos), no bank discount.",
        source,
      }
      guardarExito(cacheKey, payload, FRESH_TTL_SEG)
      return NextResponse.json({ ...payload, stale: false }, { headers: { "Cache-Control": CACHE } })
    }

    // Curva par (yield): CSV (2 años) → XML.
    const { date, curve, source } = await fetchYieldCurve()
    const payload = { date, curve, source }
    guardarExito(cacheKey, payload, FRESH_TTL_SEG)
    return NextResponse.json({ ...payload, stale: false }, { headers: { "Cache-Control": CACHE } })
  } catch (err) {
    console.error("UST curve error:", err)
    // 2) TODAS las fuentes en vivo fallaron → servir el último dato bueno (stale).
    const prev = leerUltimoBueno<{ date: string | null; curve: CurvePoint[]; nota?: string; source?: string }>(cacheKey)
    if (prev) {
      return NextResponse.json(
        { ...prev.data, stale: true, stale_since: prev.staleSince, source: "stale-cache" },
        { headers: { "Cache-Control": CACHE } },
      )
    }
    // Nunca hubo dato bueno: recién ahí devolvemos error.
    return NextResponse.json({ error: "No se pudo obtener la curva del Tesoro" }, { status: 502 })
  }
}
