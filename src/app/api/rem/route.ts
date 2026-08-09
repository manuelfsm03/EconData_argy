/**
 * REM — Relevamiento de Expectativas de Mercado (BCRA)
 * Excel mensual BCRA. Extrae: medianas + top-10 instituciones para inflación 12M.
 */
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

function limpiarNumero(x: unknown): number | null {
  if (x == null || x === "" || (typeof x === "string" && x.trim().toLowerCase() === "nan")) return null
  if (typeof x === "number") return isNaN(x) ? null : x
  const s = String(x).trim().replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// URL estable del acumulado histórico completo (incluye la hoja "Base de Datos
// Completa" en formato largo). El link "último informe" de la página del REM
// cambia de nombre cada mes (…-jul-2026.xlsx) y sólo trae un resumen del mes,
// sin la serie histórica — por eso usamos directamente el acumulado.
const REM_XLSX_URL = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/historico-relevamiento-expectativas-mercado.xlsx"

async function fetchRemExcel(): Promise<Buffer> {
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  const res = await fetch(REM_XLSX_URL, { headers, signal: AbortSignal.timeout(20000), cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Tipos ────────────────────────────────────────────────────────────────────
interface RemRow {
  fecha: string
  inflacion_12m: number | null
  inflacion_24m: number | null
  nucleo_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  tasa_real_12m: number | null
}

interface RemParticipante {
  institucion: string
  inflacion_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
}

// ── Parsear ───────────────────────────────────────────────────────────────────
// Formato actual del Excel BCRA (2026+): hoja "Base de Datos Completa" en
// formato largo — una fila por (Fecha de pronóstico, Variable, Referencia, Período).
// Los pronósticos rolling ("próximos 12/24 meses") tienen el Período en texto
// literal ("Próx. 12 meses" / "Próx. 24 meses"), no una fecha calendario.
// BCRA dejó de publicar el desagregado por institución en este archivo
// consolidado, así que "participantes" queda vacío (la UI lo maneja bien).
interface RemLongRow {
  fechaPronostico: Date
  variable: string
  referencia: string
  periodo: string
  mediana: number | null
}

function parseRemExcel(buf: Buffer): { serie: RemRow[]; participantes: RemParticipante[] } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const ws = wb.Sheets["Base de Datos Completa"]
  if (!ws) {
    console.error(`[rem] Hoja "Base de Datos Completa" no encontrada. Hojas disponibles: ${wb.SheetNames.join(", ")}`)
    return { serie: [], participantes: [] }
  }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

  const rows: RemLongRow[] = []
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i]
    if (!r || !(r[0] instanceof Date)) continue
    rows.push({
      fechaPronostico: r[0] as Date,
      variable: String(r[1] ?? ""),
      referencia: String(r[2] ?? ""),
      periodo: String(r[3] ?? ""),
      mediana: limpiarNumero(r[4]),
    })
  }

  const fechasUnicas = [...new Set(rows.map(r => r.fechaPronostico.getTime()))].sort((a, b) => a - b)

  function buscar(fechaMs: number, variable: string, refPrefix: string, periodo: string): number | null {
    const match = rows.find(r =>
      r.fechaPronostico.getTime() === fechaMs &&
      r.variable === variable &&
      r.referencia.startsWith(refPrefix) &&
      r.periodo === periodo
    )
    return match?.mediana ?? null
  }

  const serie: RemRow[] = fechasUnicas.map(ms => {
    const fecha = new Date(ms).toISOString().slice(0, 7)
    const inf12 = buscar(ms, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const inf24 = buscar(ms, "Precios minoristas (IPC nivel general; INDEC)", "var. % i.a.", "Próx. 24 meses")
    const nuc12 = buscar(ms, "Precios minoristas (IPC núcleo; INDEC)", "var. % i.a.", "Próx. 12 meses")
    const usd12 = buscar(ms, "Tipo de cambio nominal", "$/USD", "Próx. 12 meses")
    // La tasa de referencia surveada cambió de nombre a través de los años
    // (Lebac → Pases → LELIQ → BADLAR → TAMAR); tomamos la que exista para esa fecha.
    const tasaVariables = [
      "Tasa de interés (TAMAR)", "Tasa de interés (BADLAR)", "Tasa de interés (LELIQ)",
      "Tasa de política monetaria (LELIQ)", "Tasa de política monetaria (Pase 7 días)",
      "Tasa de política monetaria (Lebac)",
    ]
    let tas12: number | null = null
    for (const v of tasaVariables) {
      tas12 = buscar(ms, v, "", "Próx. 12 meses")
      if (tas12 != null) break
    }
    let tasaReal: number | null = null
    if (tas12 != null && inf12 != null && inf12 > 0) {
      tasaReal = ((1 + tas12 / 100) / (1 + inf12 / 100) - 1) * 100
    }
    return { fecha, inflacion_12m: inf12, inflacion_24m: inf24, nucleo_12m: nuc12, dolar_12m: usd12, tasa_12m: tas12, tasa_real_12m: tasaReal }
  })

  return {
    serie: serie.filter(r => r.inflacion_12m != null || r.dolar_12m != null)
               .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    participantes: [],
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const cacheKey = "rem_v4"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const buf = await fetchRemExcel()
    const { serie, participantes } = parseRemExcel(buf)
    const ultimo = serie.at(-1)

    const result = {
      data: {
        serie,
        participantes,
        ultimo: ultimo ?? null,
        kpis: {
          inflacion_12m:  ultimo?.inflacion_12m  ?? null,
          inflacion_24m:  ultimo?.inflacion_24m  ?? null,
          nucleo_12m:     ultimo?.nucleo_12m     ?? null,
          dolar_12m:      ultimo?.dolar_12m      ?? null,
          tasa_12m:       ultimo?.tasa_12m       ?? null,
          tasa_real_12m:  ultimo?.tasa_real_12m  ?? null,
          fecha:          ultimo?.fecha          ?? null,
        },
      },
      updated_at: new Date().toISOString(),
      source: "BCRA — Relevamiento de Expectativas de Mercado",
    }

    setCache(cacheKey, result, 14400)
    return NextResponse.json(result)
  } catch (err) {
    console.error("REM endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch REM data" }, { status: 500 })
  }
}
