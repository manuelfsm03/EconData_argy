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

const MESES_ES: Record<string, string> = {
  ene: "Jan", feb: "Feb", mar: "Mar", abr: "Apr", may: "May", jun: "Jun",
  jul: "Jul", ago: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dec",
}

function parsearFecha(f: unknown): string | null {
  if (f == null) return null
  if (f instanceof Date) {
    if (isNaN(f.getTime())) return null
    return f.toISOString().slice(0, 7)
  }
  if (typeof f === "number") {
    try { const d = XLSX.SSF.parse_date_code(f); return d ? `${d.y}-${String(d.m).padStart(2, "0")}` : null } catch { return null }
  }
  const s = String(f).trim().toLowerCase()
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7)
  const partes = s.split(/[-\/]/)
  if (partes.length >= 2) {
    const mesEn = MESES_ES[partes[0].slice(0, 3)]
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

async function fetchRemExcel(): Promise<Buffer> {
  const URL_HOME = "https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp"
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  let excelUrl: string | null = null
  try {
    const htmlRes = await fetch(URL_HOME, { headers, signal: AbortSignal.timeout(10000) })
    if (htmlRes.ok) {
      const html = await htmlRes.text()
      const match = html.match(/href="([^"]+\.xlsx)"/i)
      if (match) excelUrl = match[1].startsWith("http") ? match[1] : `https://www.bcra.gob.ar${match[1]}`
    }
  } catch { /* fallback */ }
  if (!excelUrl) {
    excelUrl = "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/historico-relevamiento-expectativas-mercado.xlsx"
  }
  const res = await fetch(excelUrl, { headers, signal: AbortSignal.timeout(15000) })
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
function parseRemExcel(buf: Buffer): { serie: RemRow[]; participantes: RemParticipante[] } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

  if (raw.length < 3) return { serie: [], participantes: [] }

  const fechas: (string | null)[] = (raw[1] as unknown[]).slice(1).map(parsearFecha)
  const lastColIdx = fechas.length  // última columna = más reciente

  const PATTERNS: Record<string, RegExp> = {
    inflacion_12m: /IPC nivel general.*próx.*12 meses/i,
    inflacion_24m: /IPC nivel general.*próx.*24 meses/i,
    nucleo_12m:    /IPC núcleo.*próx.*12 meses/i,
    dolar_12m:     /tipo de cambio nominal.*próx.*12 meses/i,
    tasa_12m:      /tasa de interés.*próx.*12 meses/i,
  }

  const extraido: Record<string, (number | null)[]> = {}
  // Para top-10: guardamos el índice de fila donde empieza cada bloque de participantes
  const participanteBlocks: Record<string, number> = {}

  for (let i = 0; i < raw.length; i++) {
    const nombreCelda = String(raw[i]?.[0] ?? "").trim()
    for (const [key, regex] of Object.entries(PATTERNS)) {
      if (!(key in extraido) && regex.test(nombreCelda)) {
        // Fila i+1 = Mediana (o primera fila de datos)
        // Detectar si fila i+1 dice "Mediana" o similar
        const labelSig = String(raw[i + 1]?.[0] ?? "").trim().toLowerCase()
        const filaMediana = labelSig.includes("mediana") || labelSig.includes("media") ? i + 1 : i + 1
        const rowData = raw[filaMediana] as unknown[]
        extraido[key] = rowData.slice(1).map(limpiarNumero)
        // Bloque de participantes empieza en fila i+2 (o i+3 si había "Mediana")
        participanteBlocks[key] = filaMediana + 1
      }
    }
  }

  // ── Serie histórica ────────────────────────────────────────────────────────
  const serie: RemRow[] = []
  for (let j = 0; j < fechas.length; j++) {
    const fecha = fechas[j]
    if (!fecha) continue
    const inf12  = extraido.inflacion_12m?.[j] ?? null
    const inf24  = extraido.inflacion_24m?.[j] ?? null
    const nuc12  = extraido.nucleo_12m?.[j] ?? null
    const usd12  = extraido.dolar_12m?.[j] ?? null
    const tas12  = extraido.tasa_12m?.[j] ?? null
    let tasaReal: number | null = null
    if (tas12 != null && inf12 != null && inf12 > 0) {
      tasaReal = ((1 + tas12 / 100) / (1 + inf12 / 100) - 1) * 100
    }
    serie.push({ fecha, inflacion_12m: inf12, inflacion_24m: inf24, nucleo_12m: nuc12, dolar_12m: usd12, tasa_12m: tas12, tasa_real_12m: tasaReal })
  }

  // ── Top participantes (último relevamiento = última columna) ──────────────
  const participantes: RemParticipante[] = []
  const infBlock = participanteBlocks["inflacion_12m"] ?? 0
  const usdBlock = participanteBlocks["dolar_12m"] ?? 0
  const tasBlock = participanteBlocks["tasa_12m"] ?? 0

  if (infBlock > 0) {
    for (let i = infBlock; i < Math.min(infBlock + 30, raw.length); i++) {
      const row = raw[i] as unknown[]
      const nombre = String(row?.[0] ?? "").trim()
      // Terminar si la fila está vacía o es el siguiente bloque de variable
      if (!nombre || nombre.length === 0) break
      // Saltar filas que parezcan headers de variable
      if (/IPC|tipo de cambio|tasa|inflac/i.test(nombre) && nombre.length > 30) break

      const inf12   = limpiarNumero(row[lastColIdx])
      // Buscar el valor en la misma fila en los bloques de USD y tasa
      const usdRow  = (raw[usdBlock + (i - infBlock)] as unknown[]) ?? []
      const tasRow  = (raw[tasBlock + (i - infBlock)] as unknown[]) ?? []
      const usd12   = limpiarNumero(usdRow[lastColIdx])
      const tasa12  = limpiarNumero(tasRow[lastColIdx])

      if (inf12 != null && nombre.length > 2) {
        participantes.push({ institucion: nombre, inflacion_12m: inf12, dolar_12m: usd12, tasa_12m: tasa12 })
      }
    }
  }

  // Ordenar participantes por inflación 12M ascendente
  participantes.sort((a, b) => (a.inflacion_12m ?? 0) - (b.inflacion_12m ?? 0))

  return {
    serie: serie.filter(r => r.inflacion_12m != null || r.dolar_12m != null)
               .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    participantes: participantes.slice(0, 20),  // máx 20
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const cacheKey = "rem_v2"
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
