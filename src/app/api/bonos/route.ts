/**
 * /api/bonos — Screener de bonos soberanos hard dollar
 *
 * Prioridad estructural:
 * - no depender exclusivamente de Prisma para renderizar la terminal
 * - si la DB no está disponible, usar metadata estática + scraping público
 * - mantener shape compatible con TabBonos
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { BOND_DEFS, CAP_INSTRUMENT_DEFS, type BondDef } from "@/lib/bonds-data"

type Cashflow = { fechaPago: Date; cupon: number; amortizacion: number; flujoTotal: number }

type BondLike = {
  id?: string
  ticker: string
  nombre: string
  ley: string
  cupon: number
  vencimiento: Date
  precio: number | null
  cashflows: Cashflow[]
}

const RAVA_HEADERS = {
  "User-Agent": "Mozilla/5.0 PanelDeControl/2.0",
  Accept: "text/html,application/json",
}

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

function parseLocaleNumber(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, " ").trim()
  const match = cleaned.match(/-?[\d.]+(?:,\d+)?/)
  if (!match) return null
  const value = Number(match[0].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function calcularTIR(precio: number, cashflows: { fechaPago: Date; flujoTotal: number }[]): number | null {
  const hoy = new Date()
  const flujos = cashflows
    .map((cf) => ({
      t: (cf.fechaPago.getTime() - hoy.getTime()) / (365.25 * 24 * 3600 * 1000),
      flujo: cf.flujoTotal,
    }))
    .filter((cf) => cf.t > 0)

  if (flujos.length === 0) return null

  const f = (r: number) => flujos.reduce((sum, { t, flujo }) => sum + flujo / Math.pow(1 + r, t), 0) - precio
  const df = (r: number) => flujos.reduce((sum, { t, flujo }) => sum - (t * flujo) / Math.pow(1 + r, t + 1), 0)

  let r = 0.1
  for (let i = 0; i < 100; i++) {
    const fr = f(r)
    const dfr = df(r)
    if (Math.abs(dfr) < 1e-10) break
    const delta = fr / dfr
    r -= delta
    if (Math.abs(delta) < 1e-8) return Number((r * 100).toFixed(4))
  }
  return null
}

function calcularDuration(precio: number, cashflows: { fechaPago: Date; flujoTotal: number }[], tir: number): number | null {
  const hoy = new Date()
  const r = tir / 100
  const flujos = cashflows
    .map((cf) => ({
      t: (cf.fechaPago.getTime() - hoy.getTime()) / (365.25 * 24 * 3600 * 1000),
      flujo: cf.flujoTotal,
    }))
    .filter((cf) => cf.t > 0)

  if (flujos.length === 0 || precio <= 0) return null

  const macaulay = flujos.reduce((sum, { t, flujo }) => {
    const pv = flujo / Math.pow(1 + r, t)
    return sum + (t * pv) / precio
  }, 0)

  return Number((macaulay / (1 + r)).toFixed(4))
}

async function scrapePrecioRava(ticker: string): Promise<{ precio: number | null; precioCci: number | null }> {
  const url = `https://www.rava.com/perfil/${ticker.toLowerCase()}`
  try {
    const res = await fetch(url, {
      headers: RAVA_HEADERS,
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return { precio: null, precioCci: null }

    const html = await res.text()
    const precio =
      parseLocaleNumber(html.match(/Precio:<\/span>\s*<span class="bolder">([^<]+)</i)?.[1]) ??
      parseLocaleNumber(html.match(/class="[^"]*precio[^"]*"[^>]*>([^<]+)</i)?.[1])

    const precioCci =
      parseLocaleNumber(html.match(/Precio\s*CCL:<\/span>\s*<span class="bolder">([^<]+)</i)?.[1]) ??
      parseLocaleNumber(html.match(/CCL[^<]{0,50}<\/span>\s*<span class="bolder">([^<]+)</i)?.[1])

    return { precio, precioCci }
  } catch {
    return { precio: null, precioCci: null }
  }
}

async function fetchCclReference(): Promise<number | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/contadoconliqui", {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json() as { venta?: number }
    return json.venta ?? null
  } catch {
    return null
  }
}

function staticBondToRuntime(bond: BondDef): BondLike {
  return {
    ticker: bond.ticker,
    nombre: bond.nombre,
    ley: bond.ley,
    cupon: bond.cupon,
    vencimiento: new Date(bond.vencimiento),
    precio: null,
    cashflows: bond.cashflows.map((cf) => ({
      fechaPago: new Date(cf.fecha),
      cupon: cf.cupon,
      amortizacion: cf.amortizacion,
      flujoTotal: cf.cupon + cf.amortizacion,
    })),
  }
}

async function loadRuntimeBonds(tickerParam: string | null): Promise<{ bonds: BondLike[]; sourceMode: string }> {
  try {
    const where = tickerParam ? { ticker: tickerParam.toUpperCase() } : {}
    const bonds = await prisma.sovereignBond.findMany({
      where,
      include: { cashflows: { orderBy: { fechaPago: "asc" } } },
      orderBy: { vencimiento: "asc" },
    })

    if (bonds.length > 0) {
      return {
        bonds: bonds.map((bond) => ({
          id: bond.id,
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          cupon: bond.cupon,
          vencimiento: bond.vencimiento,
          precio: bond.precio,
          cashflows: bond.cashflows.map((cf) => ({
            fechaPago: cf.fechaPago,
            cupon: cf.cupon,
            amortizacion: cf.amortizacion,
            flujoTotal: cf.flujoTotal,
          })),
        })),
        sourceMode: "db_local + rava",
      }
    }
  } catch {
    // noop: caer a fallback estático
  }

  const staticBonds = BOND_DEFS
    .filter((bond) => !tickerParam || bond.ticker === tickerParam.toUpperCase())
    .map(staticBondToRuntime)

  return { bonds: staticBonds, sourceMode: "fallback_estatico + rava" }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickerParam = searchParams.get("ticker")
  const tipoParam = searchParams.get("tipo")

  if (tipoParam === "lecap") {
    const cacheKey = "lecaps_screener"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), cached: true })

    const hoy = new Date()
    const screener = CAP_INSTRUMENT_DEFS
      .map((inst) => {
        const vencimiento = new Date(inst.vencimiento)
        const diasVto = Math.round((vencimiento.getTime() - hoy.getTime()) / (24 * 3600 * 1000))
        return {
          ticker: inst.ticker,
          tipo: inst.tipo,
          vencimiento: inst.vencimiento,
          diasVencimiento: diasVto,
          precio: null,
          tir: null,
          tea: null,
          tem: null,
        }
      })
      .filter((inst) => inst.diasVencimiento >= 0)

    setCache(cacheKey, screener, 300)
    return NextResponse.json({
      data: screener,
      updated_at: new Date().toISOString(),
      source: "fallback_estatico",
      nota: "las lecaps quedaron en fallback estático; faltan precios live específicos",
    })
  }

  const cacheKey = tickerParam ? `bono_${tickerParam}` : "bonos_screener"
  const cached = getCache<unknown>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), cached: true })

  try {
    const { bonds, sourceMode } = await loadRuntimeBonds(tickerParam)
    const cclReference = await fetchCclReference()

    if (bonds.length === 0) {
      return NextResponse.json(
        { error: "Bono no encontrado", ticker: tickerParam },
        { status: 404 },
      )
    }

    const hoy = new Date()
    const screener = await Promise.all(
      bonds.map(async (bond) => {
        const flujosFF = bond.cashflows.filter((cf) => cf.fechaPago > hoy)

        let precio = bond.precio
        let fuente = precio ? "db" : "rava"
        if (!precio) {
          const scraped = await scrapePrecioRava(bond.ticker)
          const precioNominal = scraped.precio
          const precioDolarizado = scraped.precioCci ?? (precioNominal && cclReference ? precioNominal / cclReference : precioNominal)
          precio = precioDolarizado && precioDolarizado > 1000 && cclReference ? precioDolarizado / cclReference : precioDolarizado
          fuente = precio ? "rava" : sourceMode.includes("fallback") ? "fallback_sin_precio" : "db_sin_precio"
        }

        const vnResidual = flujosFF.reduce((sum, cf) => sum + cf.amortizacion, 0)
        const paridad = vnResidual > 0 && precio ? (precio / vnResidual) * 100 : null
        const currentYield = precio && precio > 0 ? (bond.cupon / precio) * 100 : null

        let tir: number | null = null
        let durationMod: number | null = null
        if (precio && flujosFF.length > 0) {
          tir = calcularTIR(precio, flujosFF)
          if (tir !== null) durationMod = calcularDuration(precio, flujosFF, tir)
        }

        if (bond.id && precio) {
          prisma.sovereignBond.update({
            where: { id: bond.id },
            data: {
              precio,
              tir: tir ?? undefined,
              paridad: paridad ?? undefined,
              currentYield: currentYield ?? undefined,
              durationMod: durationMod ?? undefined,
              updatedAt: new Date(),
            },
          }).catch(() => {})
        }

        return {
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          cupon: bond.cupon,
          vencimiento: bond.vencimiento.toISOString().split("T")[0],
          precio: precio ? Number(precio.toFixed(2)) : null,
          paridad: paridad ? Number(paridad.toFixed(2)) : null,
          tir: tir ? Number(tir.toFixed(2)) : null,
          currentYield: currentYield ? Number(currentYield.toFixed(2)) : null,
          durationMod: durationMod ? Number(durationMod.toFixed(2)) : null,
          vnResidual: Number(vnResidual.toFixed(4)),
          flujosFF: tickerParam
            ? flujosFF.map((cf) => ({
                fecha: cf.fechaPago.toISOString().split("T")[0],
                cupon: cf.cupon,
                amortizacion: cf.amortizacion,
                total: cf.flujoTotal,
              }))
            : undefined,
          fuente,
        }
      }),
    )

    const payload = tickerParam ? screener[0] : screener
    setCache(cacheKey, payload, 300)

    return NextResponse.json({
      data: payload,
      count: screener.length,
      updated_at: new Date().toISOString(),
      source: sourceMode,
      nota: "si prisma no está disponible, la vista usa metadata embebida + scraping público de rava",
    })
  } catch (error) {
    console.error("[/api/bonos]", error)
    return NextResponse.json(
      { error: "Error al obtener bonos", detail: String(error) },
      { status: 500 },
    )
  }
}
