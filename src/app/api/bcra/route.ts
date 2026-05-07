import { NextResponse } from "next/server"
import { bcraOfficialApi } from "@/lib/bcra-official-api"

// ── Cache en memoria ──────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(key: string) {
  const e = cache.get(key)
  if (e && Date.now() < e.expiry) return e.data
  return null
}
function setCache(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

// ── Fecha N años atrás ────────────────────────────────────────────────────────
function dateYearsAgo(n: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}

// ── Fetch BCRA variable ───────────────────────────────────────────────────────
async function fetchVar(idVariable: number, from: string): Promise<{ fecha: string; valor: number }[]> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const data = await bcraOfficialApi.getSeriesData(idVariable, from, today, 2000)
    return data
      .map(p => ({ fecha: p.fecha, valor: p.valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch {
    return []
  }
}

// ── Endpoint Plazo Fijo ───────────────────────────────────────────────────────
async function getPlazoFijo() {
  const cacheKey = "bcra_plazofijo"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const from = dateYearsAgo(2)
  const [badlar, tm20, tpm, pf30] = await Promise.all([
    fetchVar(7, from),   // BADLAR bancos privados (TNA)
    fetchVar(8, from),   // TM20 bancos privados (TNA)
    fetchVar(6, from),   // Tasa de política monetaria
    fetchVar(12, from),  // Tasa depósitos 30d sector privado
  ])

  const result = { data: { badlar, tm20, tpm, pf30 }, updated_at: new Date().toISOString() }
  setCache(cacheKey, result, 3600)
  return result
}

// ── Endpoint Agregados Monetarios ─────────────────────────────────────────────
async function getAgregados() {
  const cacheKey = "bcra_agregados"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const from = dateYearsAgo(3)
  // Variables BCRA API v4.0:
  // 15 = Base Monetaria (millones ARS)
  // 16 = Circulación Monetaria (sin encajes)
  // 17 = Billetes y monedas en poder del público
  // 21 = Depósitos en cta cte sector privado (vista)
  // 22 = Cajas de ahorro
  // 23 = Depósitos a plazo (incl. plazos fijos)
  const [base, circulacion, billetes, dep_cc, cajas_ahorro, dep_plazo] = await Promise.all([
    fetchVar(15, from),
    fetchVar(16, from),
    fetchVar(17, from),
    fetchVar(21, from),
    fetchVar(22, from),
    fetchVar(23, from),
  ])

  const result = {
    data: { base, circulacion, billetes, dep_cc, cajas_ahorro, dep_plazo },
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 · Variables 15,16,17,21,22,23",
  }
  setCache(cacheKey, result, 3600)
  return result
}

// ── Endpoint Reservas Internacionales ────────────────────────────────────────
async function getReservas() {
  const cacheKey = "bcra_reservas"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const from = dateYearsAgo(2)
  const brutas = await fetchVar(1, from) // Reservas internacionales brutas (USD MM)

  // Intentar obtener datos de reservas netas desde argentinadatos.com
  let netasData: { fecha: string; brutas: number; netas: number; swap_china: number; encajes: number }[] = []
  try {
    const res = await fetch("https://argentinadatos.com/api/v1/finanzas/reservas", {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const json = await res.json()
      // Argentinadatos devuelve array de objetos con fecha, reservas_netas, reservas_brutas
      if (Array.isArray(json)) {
        netasData = json
          .filter((r: Record<string, unknown>) => r.fecha && r.reservas_brutas != null)
          .map((r: Record<string, unknown>) => ({
            fecha:      String(r.fecha),
            brutas:     Number(r.reservas_brutas) * 1e6,
            netas:      Number(r.reservas_netas ?? r.reservas_brutas) * 1e6,
            swap_china: Number(r.swap_china ?? 0) * 1e6,
            encajes:    Number(r.encajes ?? 0) * 1e6,
          }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .slice(-24)
      }
    }
  } catch {
    // Fallback: construir desde brutas con estimaciones
  }

  // Si no hay netas, construir desde brutas con ajustes estimados
  if (netasData.length === 0 && brutas.length > 0) {
    // Componentes a descontar (estimados en miles de millones USD):
    // - Swap China activado: ~19B
    // - Encajes USD bancos privados: ~7B
    // - DEGs FMI: ~3B
    const DESCUENTO_ESTIMADO = 28_000 // USD millones
    netasData = brutas.slice(-24).map(r => ({
      fecha:      r.fecha,
      brutas:     r.valor,
      netas:      r.valor - DESCUENTO_ESTIMADO,
      swap_china: 19_000,
      encajes:    7_000,
    }))
  }

  const ultimo = brutas.at(-1)
  const pen = brutas.at(-6)  // ~1 semana atrás (si hay datos diarios)
  const varSemanal = ultimo && pen ? ultimo.valor - pen.valor : null

  const netasUltimo = netasData.at(-1)

  const result = {
    data: {
      brutas,
      netas: netasData,
      ultima: {
        brutas: ultimo?.valor ?? null,
        netas:  netasUltimo?.netas ?? null,
        fecha:  ultimo?.fecha ?? null,
        var_semanal_brutas: varSemanal,
      },
    },
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 + argentinadatos.com",
  }
  setCache(cacheKey, result, 1800)
  return result
}

// ── Endpoint Compras / Ventas BCRA (MULC) ────────────────────────────────────
async function getCompras() {
  const cacheKey = "bcra_compras"
  const cached = getCache(cacheKey)
  if (cached) return cached

  let datos: { fecha: string; monto: number; acumulado_mensual: number }[] = []

  try {
    const res = await fetch("https://argentinadatos.com/api/v1/finanzas/compras-dolar-bcra", {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) {
        // Calcular acumulado mensual
        let mesActual = ""
        let acum = 0
        datos = json
          .filter((r: Record<string, unknown>) => r.fecha && r.compra != null)
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
            String(a.fecha).localeCompare(String(b.fecha)))
          .map((r: Record<string, unknown>) => {
            const mes = String(r.fecha).slice(0, 7)
            if (mes !== mesActual) { mesActual = mes; acum = 0 }
            const monto = Number(r.compra)
            acum += monto
            return { fecha: String(r.fecha), monto, acumulado_mensual: acum }
          })
          .slice(-60)
      }
    }
  } catch {
    // Sin datos
  }

  const ultimos30 = datos.slice(-30)
  const mesActualData = datos.filter(r => r.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7))
  const anoActual = datos.filter(r => r.fecha.startsWith(new Date().getFullYear().toString()))

  const result = {
    data: {
      datos: ultimos30,
      resumen: {
        mes_actual:           mesActualData.at(-1)?.acumulado_mensual ?? null,
        acumulado_anual:      anoActual.reduce((s, r) => s + r.monto, 0),
        mayor_compra_periodo: Math.max(...ultimos30.filter(r => r.monto > 0).map(r => r.monto), 0),
        mayor_venta_periodo:  Math.min(...ultimos30.filter(r => r.monto < 0).map(r => r.monto), 0),
      },
    },
    updated_at: new Date().toISOString(),
    source: "argentinadatos.com",
  }
  setCache(cacheKey, result, 900) // 15 min
  return result
}

// ── Endpoint Tasas de Referencia ──────────────────────────────────────────────
async function getTasas() {
  const cacheKey = "bcra_tasas"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const from = dateYearsAgo(2)
  const [tamar, badlar, dep30, adelantos, prestamos] = await Promise.all([
    fetchVar(44, from),  // TAMAR bancos privados TNA
    fetchVar(7,  from),  // BADLAR bancos privados TNA
    fetchVar(12, from),  // Tasa depósitos 30d
    fetchVar(13, from),  // Adelantos en cta. cte.
    fetchVar(14, from),  // Préstamos personales
  ])

  const result = {
    data: { tamar, badlar, dep30, adelantos, prestamos },
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 · Variables 44, 7, 12, 13, 14",
  }
  setCache(cacheKey, result, 3600)
  return result
}

// ── Helper: fetch todas las páginas de una variable BCRA ─────────────────────
async function fetchVarCompleto(idVariable: number, desde = "1990-01-01"): Promise<{ fecha: string; valor: number }[]> {
  const BASE = "https://api.bcra.gob.ar/estadisticas/v4.0"
  const PAGE = 3000
  const today = new Date().toISOString().slice(0, 10)
  type Pt = { fecha: string; valor: number }
  let todos: Pt[] = []
  try {
    const url = `${BASE}/monetarias/${idVariable}?desde=${desde}&hasta=${today}&limit=${PAGE}&offset=0`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const j = await res.json()
    const total: number = j.metadata?.resultset?.count ?? 0
    todos = (j.results?.[0]?.detalle ?? []).map((p: Pt) => ({ fecha: p.fecha, valor: p.valor }))
    const paginas = Math.ceil(total / PAGE)
    for (let i = 1; i < paginas; i++) {
      try {
        const r2 = await fetch(
          `${BASE}/monetarias/${idVariable}?desde=${desde}&hasta=${today}&limit=${PAGE}&offset=${i * PAGE}`,
          { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }, signal: AbortSignal.timeout(15000) }
        )
        if (r2.ok) {
          const j2 = await r2.json()
          todos = [...todos, ...(j2.results?.[0]?.detalle ?? []).map((p: Pt) => ({ fecha: p.fecha, valor: p.valor }))]
        }
      } catch { /* partial data */ }
    }
  } catch { /* API unavailable */ }
  return todos.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ── Reservas Históricas — Pipeline completo (Excel BCRA + API) ───────────────
//
// FUENTES:
//   • series.xlsm  (BCRA) → RESERVAS sheet → desde 2003-01-02
//       Col C (Var74) = Reservas excl. DEG 2009
//       Col D (Var75) = Oro, divisas, colocaciones (excl. swap y DEG) ← base netas
//       Col E (Var76) = Pase pasivo USD exterior (swap China/otros)
//       Col N (Var83) = DEG asignaciones 2009
//       Brutas = Col C + Col N
//   • BCRA API v4.0 Var1 → datos pre-2003 (desde 2000)
//   • BCRA API v4.0 Var1200 → Efectivo ME en entidades (encaje cash, desde 1996)
//   • BCRA API v4.0 Var1243 → CC ME en BCRA (encaje depositado, desde 2003)
//
// METODOLOGÍA F. MACHADO:
//   Netas = Var75 − Var1200 − Var1243
//   (Var75 ya excluye swap activado y DEGs; los encajes bancarios en USD se restan aparte)
//
// NOTA: la diferencia vs argentinadatos.com (~7-8B) es el saldo neto con el FMI,
// no disponible como variable directa en la API del BCRA.

type ReservasPt = { fecha: string; brutas: number; netas: number }

// Convierte serial de Excel (días desde 30-dic-1899) a YYYY-MM-DD
function xlSerialToDate(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10)
}

// Lookup con fill hacia adelante (retorna último valor conocido antes de la fecha)
function lookupFF(sorted: { fecha: string; valor: number }[], fecha: string): number {
  let lo = 0, hi = sorted.length - 1, best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].fecha <= fecha) { best = sorted[mid].valor; lo = mid + 1 }
    else hi = mid - 1
  }
  return best
}

async function getReservasHistorico() {
  const cacheKey = "bcra_reservas_historico"
  const cached = getCache(cacheKey)
  if (cached) return cached

  // ── 1. Descargar series.xlsm del BCRA ──────────────────────────────────────
  const XLSX_URL = "https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/series.xlsm"
  type ExcelPt = { fecha: string; brutas: number; var75: number }
  let excelSerie: ExcelPt[] = []
  let excelOK = false

  try {
    const res = await fetch(XLSX_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(40000),
    })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require("xlsx") as typeof import("xlsx")
      const wb = XLSX.read(buf, { type: "buffer" })
      const ws = wb.Sheets["RESERVAS"]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

      excelSerie = rows
        .filter(r => typeof r[0] === "number" && (r[0] as number) > 30000 && r[2] != null)
        .map(r => {
          const a = r as (number | null)[]
          const var74 = a[2] ?? 0
          const var75 = a[3] ?? var74  // fallback a var74 si falta
          const deg   = a[13] ?? 0
          return {
            fecha:  xlSerialToDate(a[0] as number),
            brutas: (var74 + deg),
            var75,
          }
        })
        .filter(p => p.brutas > 0)
      excelOK = excelSerie.length > 0
    }
  } catch { /* fallback al API */ }

  // ── 2. Fetch encajes (Var1200 + Var1243) en paralelo con Var1 pre-Excel ────
  const excelPrimerFecha = excelSerie[0]?.fecha ?? "2003-01-02"

  const [v1200, v1243, v1pre] = await Promise.all([
    fetchVarCompleto(1200),          // Efectivo ME en entidades — desde 1996
    fetchVarCompleto(1243),          // CC ME en BCRA (encajes depositados) — desde 2003
    excelOK
      ? fetchVarCompleto(1, "2000-01-01")  // Var1 para pre-2003 (o full si Excel falló)
      : fetchVarCompleto(1),               // full si Excel no disponible
  ])

  // ── 3. Construir serie pre-Excel desde Var1 (2000-01-01 hasta excelPrimerFecha) ──
  const preExcel: ExcelPt[] = excelOK
    ? v1pre
        .filter(p => p.fecha >= "2000-01-01" && p.fecha < excelPrimerFecha)
        .map(p => ({ fecha: p.fecha, brutas: p.valor, var75: p.valor }))
    : v1pre.map(p => ({ fecha: p.fecha, brutas: p.valor, var75: p.valor }))

  // ── 4. Combinar: [pre-2003 Var1] + [2003+ Excel] ──────────────────────────
  const base: ExcelPt[] = [...preExcel, ...excelSerie]

  // ── 5. Calcular Netas (F. Machado): Var75 − Var1200 − Var1243 ──────────────
  const serie: ReservasPt[] = base.map(pt => {
    const ef = lookupFF(v1200, pt.fecha)  // efectivo ME en entidades
    const cc = lookupFF(v1243, pt.fecha)  // CC ME en BCRA (principal encaje)
    const netas = pt.var75 - ef - cc
    return {
      fecha:  pt.fecha,
      brutas: Math.round(pt.brutas),
      netas:  Math.round(netas),
    }
  })

  const meta = {
    primera_fecha:        serie[0]?.fecha ?? null,
    ultima_fecha:         serie.at(-1)?.fecha ?? null,
    n_puntos:             serie.length,
    primera_fecha_netas:  v1243[0]?.fecha ?? null,
    excel_ok:             excelOK,
    fuente_brutas:        excelOK
      ? "series.xlsm BCRA (Col C+N) + API Var1 pre-2003"
      : "BCRA API v4.0 · idVariable=1",
    fuente_netas:
      "Var75 (series.xlsm Col D) − Var1200 − Var1243 · Metodología F. Machado",
    nota_diferencia:
      "Diferencia vs otras metodologías: saldo neto FMI (~7-8B USD) no disponible como variable BCRA directa",
  }

  const result = {
    data: { serie, meta },
    updated_at: new Date().toISOString(),
    source: excelOK
      ? "BCRA series.xlsm + BCRA API v4.0"
      : "BCRA API v4.0",
  }
  setCache(cacheKey, result, 14400)
  return result
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get("endpoint") ?? "plazofijo"

  try {
    let data: unknown
    switch (endpoint) {
      case "plazofijo":          data = await getPlazoFijo();         break
      case "agregados":          data = await getAgregados();         break
      case "reservas":           data = await getReservas();          break
      case "reservas_historico": data = await getReservasHistorico(); break
      case "compras":            data = await getCompras();           break
      case "tasas":              data = await getTasas();             break
      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error(`BCRA endpoint ${endpoint} error:`, err)
    return NextResponse.json({ error: "Failed to fetch BCRA data" }, { status: 500 })
  }
}
