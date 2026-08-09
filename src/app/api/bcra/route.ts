import { NextResponse } from "next/server"
import { bcraOfficialApi } from "@/server/sources/bcra-official-api"

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

// ── Handler principal ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get("endpoint") ?? "plazofijo"

  try {
    let data: unknown
    switch (endpoint) {
      case "plazofijo": data = await getPlazoFijo(); break
      case "agregados": data = await getAgregados(); break
      case "reservas":  data = await getReservas();  break
      case "compras":   data = await getCompras();   break
      case "tasas":     data = await getTasas();     break
      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error(`BCRA endpoint ${endpoint} error:`, err)
    return NextResponse.json({ error: "Failed to fetch BCRA data" }, { status: 500 })
  }
}
