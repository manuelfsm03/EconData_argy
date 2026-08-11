import { NextResponse } from "next/server"
import { buildBcraPurchaseSeries, summarizeBcraPurchases } from "@/server/domain/bcra-fx-purchases"
import { bcraOfficialApi } from "@/server/sources/bcra-official-api"
import { fetchReserveSeries, latestMeasuredNetReserves } from "@/server/sources/bcra-reserves"

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
async function getReservas(historico = false) {
  const cacheKey = historico ? "bcra_reservas_historico" : "bcra_reservas"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const desde = historico ? "2000-01-01" : dateYearsAgo(2)
  const hasta = new Date().toISOString().slice(0, 10)
  const netasData = await fetchReserveSeries(desde, hasta)
  const brutas = netasData.map(row => ({ fecha: row.fecha, valor: row.brutas }))

  const ultimo = brutas.at(-1)
  const penultimoSemanal = brutas.at(-6)
  const ultimaNeta = latestMeasuredNetReserves(netasData)
  const primeraNeta = netasData.find(row => row.netas !== null)

  const result = {
    data: {
      brutas,
      netas: netasData,
      historico,
      metadata: {
        primera_fecha: brutas[0]?.fecha ?? null,
        ultima_fecha: ultimo?.fecha ?? null,
        primera_fecha_netas: primeraNeta?.fecha ?? null,
        n_puntos: brutas.length,
        metodologia_netas: "BCRA Var75 − Var1200 − Var1243 (metodología F. Machado)",
        nota_netas: "No incluye un ajuste inventado por saldo neto con el FMI; si falta un componente diario, netas es null.",
      },
      ultima: {
        brutas: ultimo?.valor ?? null,
        netas: ultimaNeta?.netas ?? null,
        fecha: ultimo?.fecha ?? null,
        fecha_netas: ultimaNeta?.fecha ?? null,
        var_semanal_brutas: ultimo && penultimoSemanal ? ultimo.valor - penultimoSemanal.valor : null,
      },
    },
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 · Variables 1, 75, 1200 y 1243",
  }
  setCache(cacheKey, result, historico ? 14_400 : 1_800)
  return result
}

// ── Variación de reservas por compra de divisas — BCRA Var. 78 ─────────────
async function getCompras() {
  const cacheKey = "bcra_compras"
  const cached = getCache(cacheKey)
  if (cached) return cached

  const raw = await fetchVar(78, dateYearsAgo(2))
  const series = buildBcraPurchaseSeries(raw)

  if (series.length === 0) {
    const unavailable = {
      status: "degraded" as const,
      error: "La serie oficial BCRA 78 no está disponible en este momento.",
      data: null,
      updated_at: new Date().toISOString(),
      source: "BCRA API v4.0 · Variable 78",
    }
    setCache(cacheKey, unavailable, 300)
    return unavailable
  }

  const summary = summarizeBcraPurchases(series, 30)
  const result = {
    status: "ok" as const,
    data: {
      ...summary,
      metadata: {
        id_variable: 78,
        descripcion: "Variación de reservas internacionales por compra de divisas",
        tipo_serie: "Flujo diario",
        unidad: "millones de USD",
        nota: "El signo y el valor corresponden a la variación de reservas atribuida por el BCRA a compras de divisas; no representan todo el resultado cambiario ni el MULC.",
      },
    },
    updated_at: new Date().toISOString(),
    source: "BCRA API v4.0 · Variable 78",
  }
  setCache(cacheKey, result, 900)
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
  const historico = endpoint === "reservas"
    && ["1", "true"].includes(searchParams.get("historico") ?? "")

  try {
    let data: unknown
    let status = 200
    switch (endpoint) {
      case "plazofijo": data = await getPlazoFijo(); break
      case "agregados": data = await getAgregados(); break
      case "reservas":  data = await getReservas(historico); break
      case "compras":
        data = await getCompras()
        if ((data as { status?: string }).status === "degraded") status = 503
        break
      case "tasas":     data = await getTasas();     break
      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 })
    }
    return NextResponse.json(data, { status })
  } catch (err) {
    console.error(`BCRA endpoint ${endpoint} error:`, err)
    return NextResponse.json({ error: "Failed to fetch BCRA data" }, { status: 500 })
  }
}
