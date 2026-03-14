/**
 * /api/bonos — Screener de bonos soberanos hard dollar
 *
 * GET /api/bonos           → screener de todos los bonos con métricas
 * GET /api/bonos?ticker=AL30 → detalle de un bono con cashflows
 * GET /api/bonos?tipo=lecap  → screener de LECAPs/BONCAPs
 *
 * Precios: api-merval (real-time)
 * Métricas: TIR, Duration Mod/Mac, Convexity, DV01, Avg Life, Accrued Interest
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── ISIN lookup (from bondterminal scrape, not in DB schema) ─────────────────

const ISIN_MAP: Record<string, string> = {
  GD29: "US040114HX11", GD30: "US040114HS26", GD35: "US040114HT09",
  GD38: "US040114HU71", GD41: "US040114HV54", GD46: "US040114HW38",
  AL29: "ARARGE3209Y4", AL30: "ARARGE3209S6", AL35: "ARARGE3209T4",
  AE38: "ARARGE3209U2",
}

// Outstanding estimado en millones USD
const OUTSTANDING: Record<string, number> = {
  GD29: 1845, GD30: 11585, GD35: 20502, GD38: 11405,
  GD41: 10482, GD46: 1949,
  AL29: 7610, AL30: 12150, AL35: 10270, AE38: 4570,
}

// ── Financial calculations ───────────────────────────────────────────────────

interface CashflowInput {
  fechaPago: Date
  cupon: number
  amortizacion: number
  flujoTotal: number
}

function yearFrac(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 3600 * 1000)
}

/**
 * Calculate YTM via Newton-Raphson.
 * Price = sum(CF_i / (1+y)^t_i)
 */
function calcYTM(
  price: number,
  cashflows: { t: number; cf: number }[],
): number | null {
  if (cashflows.length === 0 || price <= 0) return null

  const f = (r: number) =>
    cashflows.reduce((s, { t, cf }) => s + cf / Math.pow(1 + r, t), 0) - price

  const df = (r: number) =>
    cashflows.reduce((s, { t, cf }) => s - (t * cf) / Math.pow(1 + r, t + 1), 0)

  let r = 0.08
  for (let i = 0; i < 200; i++) {
    const fr = f(r)
    const dfr = df(r)
    if (Math.abs(dfr) < 1e-12) break
    const delta = fr / dfr
    r -= delta
    if (Math.abs(delta) < 1e-9) return r * 100
    if (r < -0.5 || r > 5) break // diverged
  }
  return null
}

/**
 * Calculate all duration/convexity metrics given price and YTM.
 */
function calcMetrics(
  price: number,
  cashflows: { t: number; cf: number; amort: number }[],
  ytmPct: number,
) {
  const y = ytmPct / 100

  // PV-weighted calculations
  let macaulay = 0
  let convexity = 0
  let pvTotal = 0

  for (const { t, cf } of cashflows) {
    const pv = cf / Math.pow(1 + y, t)
    pvTotal += pv
    macaulay += t * pv
    convexity += t * (t + 1) * cf / Math.pow(1 + y, t + 2)
  }

  if (pvTotal <= 0) return null

  const durationMac = macaulay / pvTotal
  const durationMod = durationMac / (1 + y)
  const conv = convexity / pvTotal

  // DV01: dollar price change per 1bp yield shift per $1000 face
  const dv01 = (durationMod * price) / 1000

  // Average life: weighted average time of principal payments
  let avgLifeNum = 0
  let avgLifeDen = 0
  for (const { t, amort } of cashflows) {
    if (amort > 0) {
      avgLifeNum += t * amort
      avgLifeDen += amort
    }
  }
  const avgLife = avgLifeDen > 0 ? avgLifeNum / avgLifeDen : null

  return { durationMac, durationMod, convexity: conv, dv01, avgLife }
}

/**
 * Calculate accrued interest.
 * Argentine sovereign bonds pay semiannually (Jan 9 / Jul 9).
 */
function calcAccruedInterest(
  settlement: Date,
  allCashflows: CashflowInput[],
): number {
  const sorted = [...allCashflows].sort(
    (a, b) => a.fechaPago.getTime() - b.fechaPago.getTime(),
  )

  let prevDate: Date | null = null
  let nextCf: CashflowInput | null = null

  for (const cf of sorted) {
    if (cf.fechaPago > settlement) {
      nextCf = cf
      break
    }
    prevDate = cf.fechaPago
  }

  if (!nextCf) return 0

  if (!prevDate) {
    const nextDate = nextCf.fechaPago
    const inferredPrev = new Date(nextDate)
    inferredPrev.setMonth(inferredPrev.getMonth() - 6)
    prevDate = inferredPrev
  }

  const periodDays =
    (nextCf.fechaPago.getTime() - prevDate.getTime()) / (24 * 3600 * 1000)
  const elapsed =
    (settlement.getTime() - prevDate.getTime()) / (24 * 3600 * 1000)

  if (periodDays <= 0 || elapsed < 0) return 0

  return (elapsed / periodDays) * nextCf.cupon
}

// ── Price fetching from api-merval ──────────────────────────────────────────

const MERVAL_BASE = "https://api-merval-production.up.railway.app/v1/quotes"

interface MervalQuote {
  price: number | null
  close: number | null
  change1D: number | null
}

async function fetchMervalPrices(
  tickers: string[],
): Promise<Map<string, MervalQuote>> {
  const result = new Map<string, MervalQuote>()
  if (tickers.length === 0) return result

  try {
    const symbols = tickers.map((t) => `${t}D:24hs`)
    const params = symbols.map((s) => `symbols=${s}`).join("&")
    const url = `${MERVAL_BASE}/batch?${params}&depth=1`

    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/3.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return result

    const json = await res.json()
    const quotes = json?.quotes ?? json?.data ?? []

    for (const q of quotes) {
      const sym = String(q.symbol ?? "")
        .replace(/D(:24hs)?$/, "")
        .replace(/:24hs$/, "")
      const md = q.marketData ?? q
      const last = md?.LA?.price != null ? parseFloat(md.LA.price) : null
      const close = md?.CL?.price != null ? parseFloat(md.CL.price) : null
      const price = last ?? close
      const change1D =
        last != null && close != null && close > 0
          ? ((last - close) / close) * 100
          : null

      if (sym) {
        result.set(sym, { price, close, change1D })
      }
    }
  } catch {
    // Silent fail - prices will be null
  }

  return result
}

// ── In-memory cache ─────────────────────────────────────────────────────────

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickerParam = searchParams.get("ticker")
  const tipoParam = searchParams.get("tipo")

  // LECAPs screener
  if (tipoParam === "lecap") {
    const cacheKey = "lecaps_screener"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached)
      return NextResponse.json({
        data: cached,
        updated_at: new Date().toISOString(),
      })

    try {
      const instrumentos = await prisma.capInstrument.findMany({
        where: { vencimiento: { gt: new Date() } },
        orderBy: { vencimiento: "asc" },
      })

      const screener = instrumentos.map((inst) => {
        const diasVto = Math.round(
          (inst.vencimiento.getTime() - Date.now()) / (24 * 3600 * 1000),
        )
        return {
          ticker: inst.ticker,
          tipo: inst.tipo,
          vencimiento: inst.vencimiento.toISOString().split("T")[0],
          diasVencimiento: diasVto,
          precio: inst.precio,
          tir: inst.tir,
          tea: inst.tea,
          tem: inst.tem,
        }
      })

      setCache(cacheKey, screener, 300)
      return NextResponse.json({
        data: screener,
        updated_at: new Date().toISOString(),
        source: "db_local + byma",
      })
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 })
    }
  }

  // Sovereign bond screener
  const cacheKey = tickerParam ? `bono_${tickerParam}` : "bonos_screener_v2"
  const cached = getCache<unknown>(cacheKey)
  if (cached)
    return NextResponse.json({
      data: cached,
      updated_at: new Date().toISOString(),
      cached: true,
    })

  try {
    const where = tickerParam ? { ticker: tickerParam.toUpperCase() } : {}
    const bonds = await prisma.sovereignBond.findMany({
      where,
      include: { cashflows: { orderBy: { fechaPago: "asc" } } },
      orderBy: { vencimiento: "asc" },
    })

    if (bonds.length === 0) {
      return NextResponse.json(
        { error: "Bono no encontrado", ticker: tickerParam },
        { status: 404 },
      )
    }

    // Fetch all prices from api-merval
    const allTickers = bonds.map((b) => b.ticker)
    const prices = await fetchMervalPrices(allTickers)

    const hoy = new Date()

    const screener = bonds.map((bond) => {
      // Future cashflows only
      const futureCFs = bond.cashflows.filter((cf) => cf.fechaPago > hoy)
      const timedCFs = futureCFs.map((cf) => ({
        t: yearFrac(hoy, cf.fechaPago),
        cf: cf.flujoTotal,
        amort: cf.amortizacion,
      }))

      // Price from merval
      const merval = prices.get(bond.ticker)
      const precio = merval?.price ?? bond.precio
      const change1D = merval?.change1D ?? null

      // VN residual
      const vnResidual = futureCFs.reduce((s, cf) => s + cf.amortizacion, 0)

      // Paridad
      const paridad =
        vnResidual > 0 && precio ? (precio / vnResidual) * 100 : null

      // Current yield = annual coupon payments / price
      const annualCoupon = futureCFs
        .filter((cf) => yearFrac(hoy, cf.fechaPago) <= 1)
        .reduce((s, cf) => s + cf.cupon, 0)
      const currentYield =
        precio && precio > 0 ? (annualCoupon / precio) * 100 : null

      // YTM
      let tir: number | null = null
      let metrics: ReturnType<typeof calcMetrics> = null
      if (precio && timedCFs.length > 0) {
        tir = calcYTM(precio, timedCFs)
        if (tir != null) {
          metrics = calcMetrics(precio, timedCFs, tir)
        }
      }

      // Accrued interest
      const accruedInterest = calcAccruedInterest(hoy, bond.cashflows)

      // Build response
      const result: Record<string, unknown> = {
        ticker: bond.ticker,
        isin: ISIN_MAP[bond.ticker] ?? null,
        nombre: bond.nombre,
        ley: bond.ley,
        cupon: bond.cupon,
        vencimiento: bond.vencimiento.toISOString().split("T")[0],
        precio: precio != null ? round(precio, 2) : null,
        tir: tir != null ? round(tir, 2) : null,
        paridad: paridad != null ? round(paridad, 2) : null,
        currentYield: currentYield != null ? round(currentYield, 2) : null,
        durationMod: metrics ? round(metrics.durationMod, 4) : null,
        durationMac: metrics ? round(metrics.durationMac, 4) : null,
        convexity: metrics ? round(metrics.convexity, 4) : null,
        dv01: metrics ? round(metrics.dv01, 4) : null,
        avgLife: metrics?.avgLife != null ? round(metrics.avgLife, 2) : null,
        accruedInterest: round(accruedInterest, 4),
        change1D: change1D != null ? round(change1D, 2) : null,
        outstanding: OUTSTANDING[bond.ticker] ?? 0,
        vnResidual: round(vnResidual, 4),
        fuente: merval?.price != null ? "api-merval" : "db",
      }

      // Include cashflows for single-ticker queries
      if (tickerParam) {
        result.cashflows = bond.cashflows.map((cf) => ({
          fecha: cf.fechaPago.toISOString().split("T")[0],
          cupon: cf.cupon,
          amortizacion: cf.amortizacion,
          total: cf.flujoTotal,
          remaining: parseFloat(
            (
              bond.cashflows
                .filter((c) => c.fechaPago >= cf.fechaPago)
                .reduce((s, c) => s + c.amortizacion, 0)
            ).toFixed(2),
          ),
        }))
      }

      // Persist metrics to DB (fire and forget)
      if (precio) {
        prisma.sovereignBond
          .update({
            where: { id: bond.id },
            data: {
              precio,
              tir: tir ?? undefined,
              paridad: paridad ?? undefined,
              currentYield: currentYield ?? undefined,
              durationMod: metrics?.durationMod ?? undefined,
            },
          })
          .catch(() => {})
      }

      return result
    })

    const responseData = tickerParam ? screener[0] : screener
    setCache(cacheKey, responseData, 300)

    return NextResponse.json({
      data: responseData,
      count: screener.length,
      updated_at: new Date().toISOString(),
      source: "api-merval + bondterminal cashflows",
    })
  } catch (error) {
    console.error("[/api/bonos]", error)
    return NextResponse.json(
      { error: "Error al obtener bonos", detail: String(error) },
      { status: 500 },
    )
  }
}

function round(v: number, dec: number): number {
  const m = Math.pow(10, dec)
  return Math.round(v * m) / m
}
