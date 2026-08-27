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
import { CAP_INSTRUMENT_DEFS, type BondDef } from "@/server/domain/bonds-data"
import { metricasDeMercado, metricasDevengadas } from "@/lib/bond-math"
import { construirCashflows, ESQUEMAS } from "@/lib/bond-schedule"
import { INSTRUMENTOS_BONOS, getInstrumentoBono } from "@/lib/bond-instrument-catalog"
import { fechaUTC, siguienteDiaHabil } from "@/lib/market-calendar"
import { fetchRavaBondPrices } from "@/server/external/rava-prices"
import { pesoBondsVigentes } from "@/server/domain/peso-bonds"
import { fetchBymaCapInstruments, fetchBymaQuotes, marketMetaForRows } from "@/server/external/byma-data"
import { chooseFreshPrice, gateMarketPrice, type SelectedMarketPrice } from "@/server/domain/market-freshness"

type Cashflow = { fechaPago: Date; cupon: number; amortizacion: number; flujoTotal: number }

type BondLike = {
  id?: string
  ticker: string
  nombre: string
  ley: string
  cupon: number
  vencimiento: Date
  precio: number | null
  asOf: string | null
  cashflows: Cashflow[]
}

// Bonos con precio en mercado pero sin flujos verificados contra prospecto todavía.
// Se incluyen siempre en el screener para mostrar precio y variación.
const SUPPLEMENTAL_BONDS: Array<{
  ticker: string
  nombre: string
  ley: string
  vencimiento: string
}> = [
  // GD29 y AL41 tienen esquema verificado en ESQUEMAS pero no siempre están en
  // la DB local -- se agregan acá para garantizar que el screener los muestre
  // con métricas completas (el motor los reconoce por su ESQUEMA).
  { ticker: "GD29", nombre: "Bono Global USD Ley NY 1% 2029", ley: "NY", vencimiento: "2029-07-09" },
  { ticker: "GD38", nombre: "Global USD Ley NY 2038", ley: "NY", vencimiento: "2038-01-09" },
  { ticker: "GD46", nombre: "Global USD Ley NY 2046", ley: "NY", vencimiento: "2046-07-09" },
  { ticker: "AL41", nombre: "Bono Soberano USD Ley Argentina 2041", ley: "local", vencimiento: "2041-07-09" },
  { ticker: "AO27", nombre: "BONTE USD 2027", ley: "local", vencimiento: "2027-07-15" },
  { ticker: "AO28", nombre: "BONTE USD 2028", ley: "local", vencimiento: "2028-07-15" },
  { ticker: "AO29", nombre: "BONTE USD 2029", ley: "local", vencimiento: "2029-07-15" },
]

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

// Convierte TIR efectiva anual a TNA semestral (convención USD soberanos)
function tirToTna(tir: number | null): number | null {
  if (tir == null) return null
  return Number((2 * (Math.pow(1 + tir / 100, 0.5) - 1) * 100).toFixed(4))
}

async function scrapePrecioRava(ticker: string): Promise<{
  precio: number | null
  precioCci: number | null
  asOf: string | null
  asOfNominal: string | null
  asOfCci: string | null
}> {
  const prices = await fetchRavaBondPrices()
  const nominal = prices.get(ticker.toUpperCase())
  const cci = prices.get(`${ticker.toUpperCase()}D`)
  return {
    precio: nominal?.precio ?? null,
    precioCci: cci?.precio ?? null,
    asOf: nominal?.fecha ?? cci?.fecha ?? null,
    asOfNominal: nominal?.fecha ?? null,
    asOfCci: cci?.fecha ?? null,
  }
}

function asOfFromDate(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null
}

function sourceLabel(selected: SelectedMarketPrice, fallback = "fuente no conectada"): string {
  if (selected.price == null) return fallback
  if (selected.source === "byma_data_open") return "byma_data_open"
  if (selected.source === "rava_market") return selected.sourceMode === "fallback" ? "rava_fallback" : "rava"
  if (selected.source === "db_local") return selected.sourceMode === "fallback" ? "db_fallback" : "db"
  return selected.source
}

function sourceIdForLabel(label: string): string {
  if (label.startsWith("rava")) return "rava_market"
  if (label.startsWith("db")) return "db_local"
  return "byma_data_open"
}

function invalidateMarketRow<T extends Record<string, unknown>>(row: T): T {
  if (row.precio == null || row.asOf == null) return row
  const gate = gateMarketPrice(sourceIdForLabel(String(row.fuente ?? "")), row.asOf)
  if (gate.accepted) return { ...row, priceStatus: "fresh" } as T
  return {
    ...row,
    precio: null,
    precioDirty: null,
    paridad: null,
    tir: null,
    currentYield: null,
    durationMod: null,
    valorTecnico: null,
    change1D: null,
    asOf: null,
    priceAsOf: null,
    priceStatus: gate.freshness,
    priceSourceMode: "unavailable",
  } as T
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
    asOf: null,
    cashflows: bond.cashflows.map((cf) => ({
      fechaPago: new Date(cf.fecha),
      cupon: cf.cupon,
      amortizacion: cf.amortizacion,
      flujoTotal: cf.cupon + cf.amortizacion,
    })),
  }
}

function esquemaToBondDef(esquema: (typeof ESQUEMAS)[number]): BondDef {
  const cashflows = construirCashflows(esquema)
  return {
    ticker: esquema.ticker,
    nombre: esquema.nombre,
    moneda: esquema.moneda,
    ley: esquema.ley,
    cupon: Math.max(...esquema.filas.map((fila) => fila.tasa)) * 100,
    amortizacion: "amortizing",
    emision: esquema.emision,
    vencimiento: esquema.vencimiento,
    cashflows: cashflows.map((cashflow) => ({
      fecha: cashflow.fechaPago.toISOString().slice(0, 10),
      cupon: cashflow.cupon,
      amortizacion: cashflow.amortizacion,
    })),
  }
}

const VERIFIED_STATIC_BONDS = INSTRUMENTOS_BONOS
  .filter((instrumento) => instrumento.estado === "habilitado" && instrumento.esquema)
  .map((instrumento) => esquemaToBondDef(instrumento.esquema!))

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
          asOf: asOfFromDate(bond.updatedAt),
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

  const staticBonds = VERIFIED_STATIC_BONDS
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
    if (cached) {
      const freshCached = cached.map((row) => invalidateMarketRow(row as Record<string, unknown>))
      return NextResponse.json({ data: freshCached, updated_at: new Date().toISOString(), cached: true, ...marketMetaForRows(freshCached) })
    }

    // Se resuelve acá adentro y no en un const de módulo: si el server queda
    // levantado semanas, un instrumento que vence el martes tiene que dejar de
    // aparecer el miércoles, no en el próximo deploy.
    const vigentes = pesoBondsVigentes()

    const [ravaPrices, bymaQuotes] = await Promise.all([
      fetchRavaBondPrices(),
      fetchBymaQuotes(vigentes.map((b) => b.ticker)),
    ])
    const screener = vigentes.map(({ ticker, vencimiento: vencimientoEmision }) => {
      const q = ravaPrices.get(ticker)
      const byma = bymaQuotes.get(ticker)
      const selected = chooseFreshPrice([
        ...(byma ? [{ source: "byma_data_open", price: byma.lastPrice, asOf: byma.asOf }] : []),
        ...(q ? [{ source: "rava_market", price: q.precio, asOf: q.fecha }] : []),
      ])
      const bymaGate = gateMarketPrice("byma_data_open", byma?.asOf)
      const ravaFresh = gateMarketPrice("rava_market", q?.fecha).accepted
      return {
        ticker,
        nombre: q?.nombre ?? ticker,
        precio: selected.price,
        tir: ravaFresh ? q?.tir ?? null : null,
        dm: ravaFresh ? q?.dm ?? null : null,
        paridad: ravaFresh ? q?.paridad ?? null : null,
        valorTecnico: ravaFresh ? q?.valorTecnico ?? null : null,
        currentYield: ravaFresh ? q?.currentYield ?? null : null,
        // De la condición de emisión, no de la fuente: es un dato que no
        // cambia, y la fuente deja de publicarlo cuando el papel se acerca al
        // final (TZX26 y TZXM6 ya venían sin fecha).
        vencimiento: vencimientoEmision,
        fechaCotizacion: ravaFresh && q?.fecha ? q.fecha.slice(0, 10) : null,
        change1D: bymaGate.accepted ? byma?.change1D ?? null : null,
        asOf: selected.asOf,
        priceAsOf: selected.asOf,
        priceStatus: selected.freshness,
        priceSourceMode: selected.sourceMode,
        priceFallbackFrom: selected.fallbackFrom,
        retrievedAt: new Date().toISOString(),
        fuente: sourceLabel(selected),
      }
    })

    setCache(cacheKey, screener, 300)
    return NextResponse.json({
      data: screener,
      count: screener.length,
      updated_at: new Date().toISOString(),
      ...marketMetaForRows(screener),
      universo: { vigentes: vigentes.length, total: 33 },
      dataQuality: "market_freshness_gated",
      nota: "Precio priorizado desde BYMA Data; las métricas Rava solo se muestran con asOf fresco. Precios stale, futuros o sin fecha quedan unavailable y todo fallback queda rotulado.",
    })
  }

  if (tipoParam === "lecap") {
    const cacheKey = "lecaps_screener"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached) {
      const freshCached = cached.map((row) => invalidateMarketRow(row as Record<string, unknown>))
      return NextResponse.json({ data: freshCached, updated_at: new Date().toISOString(), cached: true, ...marketMetaForRows(freshCached) })
    }

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
        const dbAsOf = asOfFromDate(inst?.updatedAt)
        const dbGate = gateMarketPrice("db_local", dbAsOf)
        const selected = chooseFreshPrice([
          ...(byma ? [{ source: "byma_data_open", price: byma.lastPrice, asOf: byma.asOf }] : []),
          ...(inst?.precio != null ? [{ source: "db_local", price: inst.precio, asOf: dbAsOf }] : []),
        ])
        const tcImplicito =
          cclActual != null && dbGate.accepted && inst?.tem != null && diasVto > 0
            ? Number((cclActual * Math.pow(1 + inst.tem / 100, diasVto / 30)).toFixed(2))
            : null

        return {
          ticker: instrument.ticker,
          tipo: instrument.tipo,
          vencimiento: instrument.vencimiento,
          diasVencimiento: diasVto,
          precio: selected.price,
          tir: dbGate.accepted ? inst?.tir ?? null : null,
          tea: dbGate.accepted ? inst?.tea ?? null : null,
          tem: dbGate.accepted ? inst?.tem ?? null : null,
          tcImplicito,
          change1D: gateMarketPrice("byma_data_open", byma?.asOf).accepted ? byma?.change1D ?? null : null,
          asOf: selected.asOf,
          priceAsOf: selected.asOf,
          priceStatus: selected.freshness,
          priceSourceMode: selected.sourceMode,
          priceFallbackFrom: selected.fallbackFrom,
          retrievedAt: new Date().toISOString(),
          fuente: sourceLabel(selected),
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
        const selected = chooseFreshPrice(byma ? [{ source: "byma_data_open", price: byma.lastPrice, asOf: byma.asOf }] : [])
        const tcImplicito =
          cclActual != null && selected.price != null && inst.tem != null && diasVto > 0
            ? Number((cclActual * Math.pow(1 + inst.tem / 100, diasVto / 30)).toFixed(2))
            : null

        return {
          ticker: inst.ticker,
          tipo: inst.tipo,
          vencimiento: inst.vencimiento,
          diasVencimiento: diasVto,
          precio: selected.price,
          tir: null,
          tea: null,
          tem: inst.tem ?? null,
          tcImplicito,
          change1D: selected.price != null ? byma?.change1D ?? null : null,
          asOf: selected.asOf,
          priceAsOf: selected.asOf,
          priceStatus: selected.freshness,
          priceSourceMode: selected.sourceMode,
          priceFallbackFrom: selected.fallbackFrom,
          retrievedAt: new Date().toISOString(),
          fuente: sourceLabel(selected),
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
  if (cached) {
    const freshCached = Array.isArray(cached)
      ? cached.map((row) => invalidateMarketRow(row as Record<string, unknown>))
      : invalidateMarketRow(cached as Record<string, unknown>)
    return NextResponse.json({
      data: freshCached,
      updated_at: new Date().toISOString(),
      cached: true,
      ...marketMetaForRows(freshCached),
    })
  }

  try {
    const { bonds, sourceMode } = await loadRuntimeBonds(tickerParam)

    // Bonos del DB + supplementales que no estén ya en el set
    const loadedTickers = new Set(bonds.map((b: BondLike) => b.ticker))
    const supplementalBonds: BondLike[] = SUPPLEMENTAL_BONDS
      .filter((s) => !loadedTickers.has(s.ticker))
      .map((s) => ({
        ticker: s.ticker,
        nombre: s.nombre,
        ley: s.ley,
        cupon: 0,
        vencimiento: new Date(s.vencimiento),
        precio: null,
        asOf: null,
        cashflows: [],
      }))
    const allBonds: BondLike[] = [...bonds, ...supplementalBonds]
    const allTickers = allBonds.map((b: BondLike) => b.ticker)

    const [cclReference, bymaQuotesMep, bymaQuotesCcl, bymaQuotesArs] = await Promise.all([
      fetchCclReference(),
      fetchBymaQuotes(allTickers, { currencySuffix: "D" }),
      fetchBymaQuotes(allTickers, { currencySuffix: "C" }),
      fetchBymaQuotes(allTickers, { currencySuffix: "" }),
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
      allBonds.map(async (bond: BondLike) => {
        const esquemaVerificado = ESQUEMAS.find((e) => e.ticker === bond.ticker) ?? null
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

        const byma = bymaQuotesMep.get(bond.ticker)
        const instrumento = getInstrumentoBono(bond.ticker)
        const initialPriceCandidates = [
          ...(byma ? [{ source: "byma_data_open", price: byma.lastPrice, asOf: byma.asOf }] : []),
          ...(bond.precio != null ? [{ source: "db_local", price: bond.precio, asOf: bond.asOf }] : []),
        ]
        let selected = chooseFreshPrice(initialPriceCandidates)
        if (selected.price == null) {
          const scraped = await scrapePrecioRava(bond.ticker)
          const precioNominal = scraped.precio
          const useCci = scraped.precioCci != null
          const precioDolarizado = useCci
            ? scraped.precioCci
            : precioNominal && cclReference
              ? precioNominal / cclReference
              : precioNominal
          const ravaPrice = precioDolarizado && precioDolarizado > 1000 && cclReference
            ? precioDolarizado / cclReference
            : precioDolarizado
          selected = chooseFreshPrice([
            ...initialPriceCandidates,
            { source: "rava_market", price: ravaPrice, asOf: useCci ? scraped.asOfCci : scraped.asOfNominal },
          ])
        }
        const precio = selected.price
        const fuente = sourceLabel(selected, sourceMode.includes("fallback") ? "fallback_sin_precio" : "db_sin_precio")

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

        // TNA/TEA (convención semestral para soberanos USD)
        const tea = tir
        const tna = tirToTna(tir)

        // Métricas en modalidad cable (CCL): mismo motor, con el precio de la
        // especie "C". Todas las métricas de rendimiento se recalculan con este
        // precio para poder compararlas contra las de MEP.
        const bymaCcl = bymaQuotesCcl.get(bond.ticker)
        const precioCleanCcl = bymaCcl?.lastPrice ?? null
        let tirCcl: number | null = null
        let tnaCcl: number | null = null
        let durationModCcl: number | null = null
        let paridadCcl: number | null = null
        let precioDirtyCclVal: number | null = null
        if (precioCleanCcl && cashflowsVerificados && devengadas) {
          precioDirtyCclVal = precioCleanCcl + devengadas.interesesCorridos
          const mercadoCcl = metricasDeMercado(precioDirtyCclVal, cashflowsVerificados, liquidacion)
          tirCcl = mercadoCcl?.tir ?? null
          tnaCcl = tirToTna(tirCcl)
          durationModCcl = mercadoCcl?.durationMod ?? null
          paridadCcl = mercadoCcl?.paridad ?? null
        }

        // Canje MEP/CCL: un solo número = precio en cable / precio en MEP.
        const bymaArs = bymaQuotesArs.get(bond.ticker)
        const precioArs = bymaArs?.lastPrice ?? null
        const canje = precioCleanCcl && precio ? Number((precioCleanCcl / precio).toFixed(4)) : null

        return {
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          dayCount: instrumento?.dayCount ?? null,
          frecuencia: instrumento?.frecuencia ?? null,
          fuentePrimaria: instrumento?.fuentePrimaria ?? null,
          instrumentStatus: instrumento?.estado ?? "no_catalogado",
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
          change1D: gateMarketPrice("byma_data_open", byma?.asOf).accepted ? byma?.change1D ?? null : null,
          asOf: selected.asOf,
          priceAsOf: selected.asOf,
          priceStatus: selected.freshness,
          priceSourceMode: selected.sourceMode,
          priceFallbackFrom: selected.fallbackFrom,
          retrievedAt: new Date().toISOString(),
          flujosFF: tickerParam
            ? flujosFF.map((cf) => ({
                fecha: cf.fechaPago.toISOString().split("T")[0],
                cupon: cf.cupon,
                amortizacion: cf.amortizacion,
                total: cf.flujoTotal,
              }))
            : undefined,
          fuente,
          // Rendimientos MEP (precio de la especie "D" = px dirty mostrado)
          teaMep: tea != null ? Number(tea.toFixed(2)) : null,
          tnaMep: tna != null ? Number(tna.toFixed(2)) : null,
          // Rendimientos CCL (precio de la especie "C")
          teaCcl: tirCcl != null ? Number(tirCcl.toFixed(2)) : null,
          tnaCcl: tnaCcl != null ? Number(tnaCcl.toFixed(2)) : null,
          durationModCcl: durationModCcl != null ? Number(durationModCcl.toFixed(2)) : null,
          paridadCcl: paridadCcl != null ? Number(paridadCcl.toFixed(2)) : null,
          precioMep: precio ? Number(precio.toFixed(2)) : null,
          precioCcl: precioCleanCcl != null ? Number(precioCleanCcl.toFixed(2)) : null,
          precioDirtyCcl: precioDirtyCclVal != null ? Number(precioDirtyCclVal.toFixed(4)) : null,
          precioArs: precioArs != null ? Number(precioArs.toFixed(2)) : null,
          canje,
          change1DCcl: bymaCcl?.change1D ?? null,
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
      nota: "GD30, AL30, GD29, AL29, GD35, AL35, GD41, AL41, AE38 y GD38 usan el motor verificado contra el decreto oficial del canje 2020; S30S6 está enumerado en el catálogo PR76 pero excluido de TEA hasta contar con cashflow primario verificable",
    })
  } catch (error) {
    console.error("[/api/bonos]", error)
    return NextResponse.json(
      { error: "Error al obtener bonos", detail: String(error) },
      { status: 500 },
    )
  }
}
