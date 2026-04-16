/**
 * REM — Relevamiento de Expectativas de Mercado (BCRA)
 * Scrape del Excel publicado mensualmente en:
 * https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp
 *
 * Extrae medianas de: inflación 12M, inflación 24M, inflación núcleo 12M,
 * tipo de cambio 12M, tasa de interés 12M, tasa real (Fisher).
 */
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// ── Helpers ───────────────────────────────────────────────────────────────────
function limpiarNumero(x: unknown): number | null {
  if (x == null || x === "" || x === "nan") return null
  if (typeof x === "number") return isNaN(x) ? null : x
  const s = String(x).trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

const MESES_ES: Record<string, string> = {
  ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun",
  jul: "Jul", ago: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dec",
}

function parsearFecha(f: unknown): string | null {
  if (f == null) return null
  // Si XLSX ya lo convirtió a Date
  if (f instanceof Date) {
    if (isNaN(f.getTime())) return null
    return f.toISOString().slice(0, 7) // YYYY-MM
  }
  // Si es número (serial de Excel)
  if (typeof f === "number") {
    const d = XLSX.SSF.parse_date_code(f)
    if (!d) return null
    const mm = String(d.m).padStart(2, "0")
    return `${d.y}-${mm}`
  }
  // Si es string tipo "ene-24" o "2024-01-31"
  const s = String(f).trim().toLowerCase()
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7)
  const partes = s.split(/[-/]/)
  if (partes.length >= 2) {
    const mesKey = partes[0].slice(0, 3)
    const mesEn = MESES_ES[mesKey]
    if (mesEn) {
      const anio = partes[1].length === 2 ? `20${partes[1]}` : partes[1]
      try {
        const d = new Date(`${mesEn} 01 ${anio}`)
        if (!isNaN(d.getTime())) return `${anio}-${String(d.getMonth() + 1).padStart(2, "0")}`
      } catch { /* skip */ }
    }
  }
  return null
}

// ── Fetch del Excel BCRA ──────────────────────────────────────────────────────
async function fetchRemExcel(): Promise<Buffer> {
  const URL_HOME = "https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp"
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }

  // Buscar el link del Excel en la página
  let excelUrl: string | null = null
  try {
    const htmlRes = await fetch(URL_HOME, { headers, signal: AbortSignal.timeout(10000) })
    if (htmlRes.ok) {
      const html = await htmlRes.text()
      const match = html.match(/href="([^"]+\.xlsx)"/i)
      if (match) {
        excelUrl = match[1].startsWith("http") ? match[1] : `https://www.bcra.gob.ar${match[1]}`
      }
    }
  } catch { /* usar fallback directo */ }

  if (!excelUrl) {
    excelUrl = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/historico-relevamiento-expectativas-mercado.xlsx"
  }

  const res = await fetch(excelUrl, { headers, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar REM Excel`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Parsear Excel REM ─────────────────────────────────────────────────────────
interface RemRow {
  fecha: string          // YYYY-MM
  inflacion_12m: number | null
  inflacion_24m: number | null
  nucleo_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  tasa_real_12m: number | null
}

function parseRemExcel(buf: Buffer): RemRow[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

  if (raw.length < 3) return []

  // Fila 1 (index 1) tiene las fechas en columnas 1..N
  const fechas: (string | null)[] = (raw[1] as unknown[]).slice(1).map(parsearFecha)

  // Mapear nombres de fila a nuestras variables
  const PATTERNS: Record<string, RegExp> = {
    inflacion_12m: /IPC nivel general.*próx.*12 meses/i,
    inflacion_24m: /IPC nivel general.*próx.*24 meses/i,
    nucleo_12m:    /IPC núcleo.*próx.*12 meses/i,
    dolar_12m:     /tipo de cambio nominal.*próx.*12 meses/i,
    tasa_12m:      /tasa de interés.*próx.*12 meses/i,
  }

  const extraido: Record<string, (number | null)[]> = {}

  for (let i = 0; i < raw.length; i++) {
    const nombreCelda = String(raw[i]?.[0] ?? "").trim()
    for (const [key, regex] of Object.entries(PATTERNS)) {
      if (!(key in extraido) && regex.test(nombreCelda)) {
        // La mediana está en la fila siguiente (i+1)
        const filaMediana = raw[i + 1] ?? []
        extraido[key] = (filaMediana as unknown[]).slice(1).map(limpiarNumero)
      }
    }
  }

  // Construir filas por fecha
  const rows: RemRow[] = []
  for (let j = 0; j < fechas.length; j++) {
    const fecha = fechas[j]
    if (!fecha) continue

    const inf12  = extraido.inflacion_12m?.[j] ?? null
    const inf24  = extraido.inflacion_24m?.[j] ?? null
    const nuc12  = extraido.nucleo_12m?.[j] ?? null
    const usd12  = extraido.dolar_12m?.[j] ?? null
    const tas12  = extraido.tasa_12m?.[j] ?? null

    // Tasa real (Fisher): ((1+tasa)/(1+inflacion) - 1) * 100
    let tasaReal: number | null = null
    if (tas12 != null && inf12 != null && inf12 > 0) {
      tasaReal = ((1 + tas12 / 100) / (1 + inf12 / 100) - 1) * 100
    }

    rows.push({
      fecha, inflacion_12m: inf12, inflacion_24m: inf24,
      nucleo_12m: nuc12, dolar_12m: usd12,
      tasa_12m: tas12, tasa_real_12m: tasaReal,
    })
  }

  return rows.filter(r => r.inflacion_12m != null || r.dolar_12m != null)
             .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const cacheKey = "rem_v1"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const buf = await fetchRemExcel()
    const serie = parseRemExcel(buf)

    const ultimo = serie.at(-1)

    const result = {
      data: {
        serie,
        ultimo: ultimo ?? null,
        // KPIs del relevamiento más reciente
        kpis: {
          inflacion_12m:    ultimo?.inflacion_12m    ?? null,
          inflacion_24m:    ultimo?.inflacion_24m    ?? null,
          nucleo_12m:       ultimo?.nucleo_12m       ?? null,
          dolar_12m:        ultimo?.dolar_12m        ?? null,
          tasa_12m:         ultimo?.tasa_12m         ?? null,
          tasa_real_12m:    ultimo?.tasa_real_12m    ?? null,
          fecha:            ultimo?.fecha            ?? null,
        },
      },
      updated_at: new Date().toISOString(),
      source: "BCRA — Relevamiento de Expectativas de Mercado (Excel mensual)",
    }

    setCache(cacheKey, result, 14400) // 4h cache
    return NextResponse.json(result)
  } catch (err) {
    console.error("REM endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch REM data" }, { status: 500 })
  }
}
