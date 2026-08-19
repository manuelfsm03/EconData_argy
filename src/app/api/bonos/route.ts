import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/bonos — Screener de bonos soberanos hard dollar
 *
 * Prioridad estructural:
 * - no depender exclusivamente de Prisma para renderizar la terminal
 * - si la DB no está disponible, usar metadata estática + scraping público
 * - mantener shape compatible con TabBonos
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { BOND_DEFS, CAP_INSTRUMENT_DEFS, type BondDef } from "@/server/domain/bonds-data"
import { metricasDeMercado, metricasDevengadas } from "@/lib/bond-math"
import { construirCashflows, GD30 } from "@/lib/bond-schedule"
import { fechaUTC, siguienteDiaHabil } from "@/lib/market-calendar"
import { fetchRavaBondPrices, type RavaBondPrice } from "@/server/external/rava-prices"
import { PESO_BOND_TICKERS } from "@/server/domain/peso-bonds"
import { fetchBymaCapInstruments, fetchBymaQuotes, marketMetaForRows } from "@/server/external/byma-data"

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

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
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
  const prices = await fetchRavaBondPrices()
  return {
    precio: prices.get(ticker.toUpperCase())?.precio ?? null,
    precioCci: prices.get(`${ticker.toUpperCase()}D`)?.precio ?? null,
  }
}

async function fetchCclReference(): Promise<number | null> {
  try {
    const res = await fetchRegistered("https://dolarapi.com/v1/dolares/contadoconliqui", {
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
        bonds: bonds.map((bond: typeof bonds[number]) => ({
          id: bond.id,
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          cupon: bond.cupon,
          vencimiento: bond.vencimiento,
          precio: bond.precio,
          cashflows: bond.cashflows.map((cf: typeof bond.cashflows[number]) => ({
            fechaPago: cf.fechaPago,
            cupon: cf.cupon,
            amortizacion: cf.amortizacion,
            flujoTotal: cf.flujoTotal,
          })),
        })),
        sourceMode: "db_local + byma_data",
      }
    }
  } catch {
    // noop: caer a fallback estático
  }

  const staticBonds = BOND_DEFS
    .filter((bond) => !tickerParam || bond.ticker === tickerParam.toUpperCase())
    .map(staticBondToRuntime)

  return { bonds: staticBonds, sourceMode: "fallback_estatico + byma_data" }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickerParam = searchParams.get("ticker")
  const tipoParam = searchParams.get("tipo")

  if (tipoParam === "pesos") {
    const cacheKey = "bonos_pesos_screener"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), cached: true, ...marketMetaForRows(cached) })

    const [ravaPrices, bymaQuotes] = await Promise.all([
      fetchRavaBondPrices(),
      fetchBymaQuotes([...PESO_BOND_TICKERS]),
    ])
    const screener = PESO_BOND_TICKERS.map((ticker) => {
      const q = ravaPrices.get(ticker)
      const byma = bymaQuotes.get(ticker)
      return {
        ticker,
        nombre: q?.nombre ?? ticker,
        precio: byma?.lastPrice ?? q?.precio ?? null,
        tir: q?.tir ?? null,
        dm: q?.dm ?? null,
        paridad: q?.paridad ?? null,
        valorTecnico: q?.valorTecnico ?? null,
        currentYield: q?.currentYield ?? null,
        vencimiento: q?.vencimiento ? q.vencimiento.slice(0, 10) : null,
        fechaCotizacion: q?.fecha ? q.fecha.slice(0, 10) : null,
        change1D: byma?.change1D ?? null,
        asOf: byma?.asOf ?? q?.fecha ?? null,
        fuente: byma ? "byma_data_open" : q ? "rava" : "fuente no conectada",
      }
    })

    setCache(cacheKey, screener, 300)
    return NextResponse.json({
      data: screener,
      count: screener.length,
      updated_at: new Date().toISOString(),
      ...marketMetaForRows(screener),
      dataQuality: "rava_passthrough_unverified",
      nota: "Precio priorizado desde BYMA Data; TIR, duration modificada y paridad se conservan tal como las publica Rava. Son bonos ajustados por CER (y CER/TAMAR en los Bono DUAL); no pasan por el motor propio de bond-math.",
    })
  }

  if (tipoParam === "lecap") {
    const cacheKey = "lecaps_screener"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), cached: true, ...marketMetaForRows(cached) })

    let cclActual: number | null = null
    try {
      const dolarRes = await fetchRegistered("https://dolarapi.com/v1/dolares", {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 60 },
      })
      if (dolarRes.ok) {
        const dolarData = await dolarRes.json() as Array<{ casa?: string; venta?: number }>
        const ccl = dolarData.find((d) => d.casa === "contadoconliqui")
        cclActual = ccl?.venta ?? null
      }
    } catch {
      // noop
    }

    const bymaCatalog = await fetchBymaCapInstruments()
    let dbInstruments: Awaited<ReturnType<typeof prisma.capInstrument.findMany>> = []
    try {
      dbInstruments = await prisma.capInstrument.findMany({
        where: { vencimiento: { gt: new Date() } },
        orderBy: { vencimiento: "asc" },
      })
    } catch {
      // BYMA abierto sigue siendo suficiente para catálogo y precios.
    }

    if (dbInstruments.length > 0 || bymaCatalog.length > 0) {
      const dbByTicker = new Map(dbInstruments.map((instrumento) => [instrumento.ticker, instrumento]))
      const instruments = bymaCatalog.length > 0
        ? bymaCatalog
        : dbInstruments.map((instrumento) => ({
            ticker: instrumento.ticker,
            tipo: instrumento.tipo as "LECAP" | "BONCAP",
            vencimiento: instrumento.vencimiento.toISOString().slice(0, 10),
          }))
      const bymaQuotes = await fetchBymaQuotes(instruments.map((instrumento) => instrumento.ticker))
      const screener = instruments.map((instrument) => {
        const inst = dbByTicker.get(instrument.ticker)
        const maturity = new Date(instrument.vencimiento)
        const hoy = new Date()
        const diasVto = Math.round((maturity.getTime() - hoy.getTime()) / (24 * 3600 * 1000))
        const byma = bymaQuotes.get(instrument.ticker)
        const tcImplicito =
          cclActual != null && inst?.tem != null && diasVto > 0
            ? Number((cclActual * Math.pow(1 + inst.tem / 100, diasVto / 30)).toFixed(2))
            : null

        return {
          ticker: instrument.ticker,
          tipo: instrument.tipo,
          vencimiento: instrument.vencimiento,
          diasVencimiento: diasVto,
          precio: byma?.lastPrice ?? inst?.precio ?? null,
          tir: inst?.tir ?? null,
          tea: inst?.tea ?? null,
          tem: inst?.tem ?? null,
          tcImplicito,
          change1D: byma?.change1D ?? null,
          asOf: byma?.asOf ?? null,
          fuente: byma ? "byma_data_open" : inst ? "db_local" : "fuente no conectada",
        }
      })
      setCache(cacheKey, screener, 300)
      return NextResponse.json({
        data: screener,
        updated_at: new Date().toISOString(),
        ...marketMetaForRows(screener),
        nota: "catálogo y precios priorizados desde BYMA Data; métricas complementarias desde DB local cuando existen",
      })
    }

    const hoy = new Date()
    const activeDefinitions = CAP_INSTRUMENT_DEFS
      .filter((inst) => new Date(inst.vencimiento).getTime() >= hoy.getTime())
    const bymaQuotes = await fetchBymaQuotes(activeDefinitions.map((instrumento) => instrumento.ticker))
    const screener = activeDefinitions
      .map((inst) => {
        const vencimiento = new Date(inst.vencimiento)
        const diasVto = Math.round((vencimiento.getTime() - hoy.getTime()) / (24 * 3600 * 1000))
        const byma = bymaQuotes.get(inst.ticker)
        const tcImplicito =
          cclActual != null && inst.tem != null && diasVto > 0
            ? Number((cclActual * Math.pow(1 + inst.tem / 100, diasVto / 30)).toFixed(2))
            : null

        return {
          ticker: inst.ticker,
          tipo: inst.tipo,
          vencimiento: inst.vencimiento,
          diasVencimiento: diasVto,
          precio: byma?.lastPrice ?? null,
          tir: null,
          tea: null,
          tem: inst.tem ?? null,
          tcImplicito,
          change1D: byma?.change1D ?? null,
          asOf: byma?.asOf ?? null,
          fuente: byma ? "byma_data_open" : "fuente no conectada",
        }
      })

    setCache(cacheKey, screener, 300)
    return NextResponse.json({
      data: screener,
      updated_at: new Date().toISOString(),
      ...marketMetaForRows(screener),
      nota: "precios desde BYMA Data con metadata estática cuando la DB local no está disponible",
    })
  }

  const cacheKey = tickerParam ? `bono_${tickerParam}` : "bonos_screener"
  const cached = getCache<unknown>(cacheKey)
  if (cached) return NextResponse.json({
    data: cached,
    updated_at: new Date().toISOString(),
    cached: true,
    ...marketMetaForRows(cached),
  })

  try {
    const { bonds, sourceMode } = await loadRuntimeBonds(tickerParam)
    const [cclReference, bymaQuotes] = await Promise.all([
      fetchCclReference(),
      fetchBymaQuotes(bonds.map((bond: BondLike) => bond.ticker), { currencySuffix: "D" }),
    ])

    if (bonds.length === 0) {
      return NextResponse.json(
        { error: "Bono no encontrado", ticker: tickerParam },
        { status: 404 },
      )
    }

    const hoy = new Date()
    const liquidacion = siguienteDiaHabil(fechaUTC(hoy.toISOString().slice(0, 10)))
    const screener = await Promise.all(
      bonds.map(async (bond: BondLike) => {
        const esquemaVerificado = bond.ticker === GD30.ticker ? GD30 : null
        const cashflowsVerificados = esquemaVerificado ? construirCashflows(esquemaVerificado) : null
        const devengadas = cashflowsVerificados
          ? metricasDevengadas(cashflowsVerificados, liquidacion)
          : null
        const flujosFF: Cashflow[] = cashflowsVerificados
          ? cashflowsVerificados
              .filter((cf) => cf.fechaDevengamiento > liquidacion)
              .map((cf) => ({
                fechaPago: cf.fechaPago,
                cupon: cf.cupon,
                amortizacion: cf.amortizacion,
                flujoTotal: cf.cupon + cf.amortizacion,
              }))
          : bond.cashflows.filter((cf) => cf.fechaPago > hoy)

        const byma = bymaQuotes.get(bond.ticker)
        let precio = byma?.lastPrice ?? bond.precio
        let fuente = byma ? "byma_data_open" : precio ? "db" : "byma_data_open"
        if (!precio) {
          const scraped = await scrapePrecioRava(bond.ticker)
          const precioNominal = scraped.precio
          const precioDolarizado = scraped.precioCci ?? (precioNominal && cclReference ? precioNominal / cclReference : precioNominal)
          precio = precioDolarizado && precioDolarizado > 1000 && cclReference ? precioDolarizado / cclReference : precioDolarizado
          fuente = precio ? "rava" : sourceMode.includes("fallback") ? "fallback_sin_precio" : "db_sin_precio"
        }

        const vnResidual = devengadas?.valorResidual ?? flujosFF.reduce((sum, cf) => sum + cf.amortizacion, 0)
        let paridad = vnResidual > 0 && precio ? (precio / vnResidual) * 100 : null
        let currentYield = precio && precio > 0 ? (bond.cupon / precio) * 100 : null

        let tir: number | null = null
        let durationMod: number | null = null
        let precioDirty: number | null = null
        if (precio && cashflowsVerificados && devengadas) {
          // Las cotizaciones de mercado se tratan como clean; el motor verificado
          // suma los intereses corridos para descontar contra precio dirty.
          precioDirty = precio + devengadas.interesesCorridos
          const mercado = metricasDeMercado(precioDirty, cashflowsVerificados, liquidacion)
          tir = mercado?.tir ?? null
          durationMod = mercado?.durationMod ?? null
          paridad = mercado?.paridad ?? null
          currentYield = mercado?.currentYield ?? null
        } else if (precio && flujosFF.length > 0) {
          tir = calcularTIR(precio, flujosFF)
          if (tir !== null) durationMod = calcularDuration(precio, flujosFF, tir)
        }

        return {
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          cupon: devengadas ? Number((devengadas.tasaVigente * 100).toFixed(4)) : bond.cupon,
          vencimiento: bond.vencimiento.toISOString().split("T")[0],
          precio: precio ? Number(precio.toFixed(2)) : null,
          precioDirty: precioDirty != null ? Number(precioDirty.toFixed(4)) : null,
          paridad: paridad != null ? Number(paridad.toFixed(2)) : null,
          tir: tir != null ? Number(tir.toFixed(2)) : null,
          currentYield: currentYield != null ? Number(currentYield.toFixed(2)) : null,
          durationMod: durationMod != null ? Number(durationMod.toFixed(2)) : null,
          vnResidual: Number(vnResidual.toFixed(4)),
          interesesCorridos: devengadas ? Number(devengadas.interesesCorridos.toFixed(4)) : null,
          valorTecnico: devengadas ? Number(devengadas.valorTecnico.toFixed(4)) : null,
          proximoPago: devengadas?.proximoPago.toISOString().split("T")[0] ?? null,
          vidaPromedio: devengadas ? Number(devengadas.vidaPromedio.toFixed(4)) : null,
          plazoResidual: devengadas ? Number(devengadas.plazoResidual.toFixed(4)) : null,
          calculationModel: esquemaVerificado ? "excel_parity_verified" : "legacy_unverified_schedule",
          dataQuality: esquemaVerificado
            ? "prospectus_schedule_verified"
            : "legacy_schedule_pending_source_verification",
          change1D: byma?.change1D ?? null,
          asOf: byma?.asOf ?? null,
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
      ...marketMetaForRows(screener),
      nota: "GD30 usa el motor verificado contra la planilla; los demás bonos conservan el cálculo legado y se marcan como pendientes de validar contra fuente primaria",
    })
  } catch (error) {
    console.error("[/api/bonos]", error)
    return NextResponse.json(
      { error: "Error al obtener bonos", detail: String(error) },
      { status: 500 },
    )
  }
}
