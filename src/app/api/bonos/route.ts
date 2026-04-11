/**
 * /api/bonos — Screener de bonos soberanos hard dollar
 *
 * Fuentes de datos:
 *   - Rava Bursátil: https://www.rava.com/perfil/{ticker} (scraping HTML)
 *   - BYMA DATA (si está disponible): precios de cierre oficiales
 *   - Flujos de pago: base de datos local (prisma/seed-bonds.ts)
 *
 * Endpoints:
 *   GET /api/bonos           — screener completo con métricas calculadas
 *   GET /api/bonos?ticker=AL30  — detalle de un bono específico
 *   GET /api/bonos?tipo=lecap   — screener de LECAPs/BONCAPs
 *
 * Fase 1 — M1.1 del ROADMAP
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ── Cálculos financieros ───────────────────────────────────────────────────────

/**
 * Calcula la TIR de un bono por Newton-Raphson dado un precio y flujos de caja.
 * @param precio - Precio limpio (% del VN, ej: 70 = 70%)
 * @param cashflows - [{fecha, flujoTotal}] futuros a partir de hoy
 * @returns TIR anual en porcentaje, o null si no converge
 */
function calcularTIR(
  precio: number,
  cashflows: { fechaPago: Date; flujoTotal: number }[],
): number | null {
  const hoy = new Date()
  const flujos = cashflows
    .map((cf) => ({
      t: (cf.fechaPago.getTime() - hoy.getTime()) / (365.25 * 24 * 3600 * 1000), // años
      flujo: cf.flujoTotal,
    }))
    .filter((cf) => cf.t > 0)

  if (flujos.length === 0) return null

  // Precio como valor presente: -precio (salida) + suma(PV de flujos)
  const f = (r: number) => {
    const pv = flujos.reduce((sum, { t, flujo }) => sum + flujo / Math.pow(1 + r, t), 0)
    return pv - precio
  }

  const df = (r: number) => {
    return flujos.reduce((sum, { t, flujo }) => sum - (t * flujo) / Math.pow(1 + r, t + 1), 0)
  }

  let r = 0.1 // Inicial 10% anual
  for (let i = 0; i < 100; i++) {
    const fr = f(r)
    const dfr = df(r)
    if (Math.abs(dfr) < 1e-10) break
    const delta = fr / dfr
    r -= delta
    if (Math.abs(delta) < 1e-8) return parseFloat((r * 100).toFixed(4))
  }
  return null
}

/**
 * Duration modificada (Macaulay / (1 + y))
 */
function calcularDuration(
  precio: number,
  cashflows: { fechaPago: Date; flujoTotal: number }[],
  tir: number,
): number | null {
  const hoy = new Date()
  const r = tir / 100
  const flujos = cashflows
    .map((cf) => ({
      t: (cf.fechaPago.getTime() - hoy.getTime()) / (365.25 * 24 * 3600 * 1000),
      flujo: cf.flujoTotal,
    }))
    .filter((cf) => cf.t > 0)

  if (flujos.length === 0 || precio <= 0) return null

  const macaulay =
    flujos.reduce((sum, { t, flujo }) => {
      const pv = flujo / Math.pow(1 + r, t)
      return sum + (t * pv) / precio
    }, 0)

  const durMod = macaulay / (1 + r)
  return parseFloat(durMod.toFixed(4))
}

// ── Price scraping ─────────────────────────────────────────────────────────────

/**
 * Scrape precio de Rava Bursátil (HTML público)
 * Intenta varias URL patterns.
 */
async function scrapePrecioRava(ticker: string): Promise<{ precio: number | null; precioCci: number | null }> {
  const urls = [
    `https://api.rava.com/app/cotiz/getCotizacion?ticker=${ticker}`,
    `https://www.rava.com/cotizaciones/getCotizacion?ticker=${ticker}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 PanelDeControl/2.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 300 },
      })
      if (!res.ok) continue

      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("json")) {
        const j = await res.json()
        // Rava devuelve diferentes estructuras — intentar varias
        const precio =
          j?.ultimo ?? j?.price ?? j?.cierre ?? j?.data?.ultimo ?? j?.data?.price ?? null
        const precioCci = j?.ultimoCci ?? j?.priceCci ?? null
        if (precio) return { precio: parseFloat(precio), precioCci: precioCci ? parseFloat(precioCci) : null }
      }
    } catch {
      continue
    }
  }

  // Fallback: scraping HTML de página de perfil
  try {
    const res = await fetch(`https://www.rava.com/perfil/${ticker.toLowerCase()}`, {
      headers: { "User-Agent": "Mozilla/5.0 PanelDeControl/2.0" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const html = await res.text()
      // Buscar precio en el HTML (estructura común de Rava)
      const priceMatch = html.match(/class="[^"]*precio[^"]*"[^>]*>([\d,. ]+)</)
      if (priceMatch) {
        const precio = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."))
        if (!isNaN(precio) && precio > 0) return { precio, precioCci: null }
      }
    }
  } catch {
    // Scraping failed
  }

  return { precio: null, precioCci: null }
}

// ── In-memory cache ────────────────────────────────────────────────────────────

const _cache: Record<string, { data: unknown; expiry: number }> = {}
function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickerParam = searchParams.get("ticker")
  const tipoParam = searchParams.get("tipo")

  // LECAPs screener
  if (tipoParam === "lecap") {
    const cacheKey = "lecaps_screener_v2"
    const cached = getCache<unknown[]>(cacheKey)
    if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString() })

    try {
      // Fetch CCL actual para calcular TC implícito
      let cclActual: number | null = null
      try {
        const dolarRes = await fetch("https://dolarapi.com/v1/dolares", {
          headers: { "User-Agent": "PanelDeControl/1.0" },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 60 },
        })
        if (dolarRes.ok) {
          const dolarData: { casa: string; venta: number }[] = await dolarRes.json()
          const ccl = dolarData.find((d) => d.casa === "contadoconliqui")
          cclActual = ccl?.venta ?? null
        }
      } catch { /* ignore — tcImplicito quedará null */ }

      const instrumentos = await prisma.capInstrument.findMany({
        where: { vencimiento: { gt: new Date() } },
        orderBy: { vencimiento: "asc" },
      })

      const screener = instrumentos.map((inst) => {
        const hoy = new Date()
        const diasVto = Math.round((inst.vencimiento.getTime() - hoy.getTime()) / (24 * 3600 * 1000))

        // TC implícito: nivel de CCL al vencimiento que iguala rendimiento LECAP vs dolarización
        // tcImplicito = CCL_hoy × (1 + TEM/100)^(diasVto/30)
        const tcImplicito =
          cclActual != null && inst.tem != null && diasVto > 0
            ? parseFloat((cclActual * Math.pow(1 + inst.tem / 100, diasVto / 30)).toFixed(2))
            : null

        return {
          ticker: inst.ticker,
          tipo: inst.tipo,
          vencimiento: inst.vencimiento.toISOString().split("T")[0],
          diasVencimiento: diasVto,
          precio: inst.precio,
          tir: inst.tir,
          tea: inst.tea,
          tem: inst.tem,
          tcImplicito,
        }
      })

      setCache(cacheKey, screener, 300)
      return NextResponse.json({
        data: screener,
        updated_at: new Date().toISOString(),
        source: "db_local + byma",
        nota: "Precios se actualizan via cron diario. Para actualizar manualmente: POST /api/bonos/sync",
      })
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 })
    }
  }

  // Screener completo de soberanos
  const cacheKey = tickerParam ? `bono_${tickerParam}` : "bonos_screener"
  const cached = getCache<unknown>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, updated_at: new Date().toISOString(), cached: true })

  try {
    const where = tickerParam ? { ticker: tickerParam.toUpperCase() } : {}
    const bonds = await prisma.sovereignBond.findMany({
      where,
      include: { cashflows: { orderBy: { fechaPago: "asc" } } },
      orderBy: { vencimiento: "asc" },
    })

    if (bonds.length === 0) {
      return NextResponse.json(
        { error: "Bono no encontrado. Verificar que el seed fue ejecutado.", ticker: tickerParam },
        { status: 404 },
      )
    }

    const hoy = new Date()
    const screener = await Promise.all(
      bonds.map(async (bond) => {
        // Flujos futuros
        const flujosFF = bond.cashflows.filter((cf) => cf.fechaPago > hoy)

        // Precio: intentar desde DB primero, luego scraping
        let precio = bond.precio
        let fuente = "db"
        if (!precio) {
          const { precio: precioRava } = await scrapePrecioRava(bond.ticker)
          if (precioRava) {
            precio = precioRava
            fuente = "rava"
            // Guardar precio en DB
            await prisma.sovereignBond.update({
              where: { id: bond.id },
              data: { precio: precioRava, updatedAt: new Date() },
            }).catch(() => {})
          }
        }

        // VN residual (suma de amortizaciones futuras)
        const vnResidual = flujosFF.reduce((sum, cf) => sum + cf.amortizacion, 0)

        // Paridad = precio / VN residual * 100
        const paridad = vnResidual > 0 && precio ? (precio / vnResidual) * 100 : null

        // Current yield = (cupon anual / precio) * 100
        const cuponAnual = bond.cupon
        const currentYield = precio && precio > 0 ? (cuponAnual / precio) * 100 : null

        // TIR (solo si tenemos precio)
        let tir: number | null = null
        let durationMod: number | null = null
        if (precio && flujosFF.length > 0) {
          tir = calcularTIR(precio, flujosFF)
          if (tir !== null) {
            durationMod = calcularDuration(precio, flujosFF, tir)
          }
          // Persistir métricas
          await prisma.sovereignBond.update({
            where: { id: bond.id },
            data: {
              tir: tir ?? undefined,
              paridad: paridad ?? undefined,
              currentYield: currentYield ?? undefined,
              durationMod: durationMod ?? undefined,
            },
          }).catch(() => {})
        }

        return {
          ticker: bond.ticker,
          nombre: bond.nombre,
          ley: bond.ley,
          cupon: bond.cupon,
          vencimiento: bond.vencimiento.toISOString().split("T")[0],
          precio: precio ? parseFloat(precio.toFixed(2)) : null,
          paridad: paridad ? parseFloat(paridad.toFixed(2)) : null,
          tir: tir ? parseFloat(tir.toFixed(2)) : null,
          currentYield: currentYield ? parseFloat(currentYield.toFixed(2)) : null,
          durationMod: durationMod ? parseFloat(durationMod.toFixed(2)) : null,
          vnResidual: parseFloat(vnResidual.toFixed(4)),
          flujosFF: tickerParam ? flujosFF.map((cf) => ({
            fecha: cf.fechaPago.toISOString().split("T")[0],
            cupon: cf.cupon,
            amortizacion: cf.amortizacion,
            total: cf.flujoTotal,
          })) : undefined,
          fuente,
        }
      }),
    )

    setCache(cacheKey, tickerParam ? screener[0] : screener, 300)

    return NextResponse.json({
      data: tickerParam ? screener[0] : screener,
      count: screener.length,
      updated_at: new Date().toISOString(),
      source: "db_local + rava (precios)",
      nota: "Precios de Rava. Para seed de flujos: ts-node prisma/seed-bonds.ts",
    })
  } catch (error) {
    console.error("[/api/bonos]", error)
    return NextResponse.json(
      { error: "Error al obtener bonos", detail: String(error) },
      { status: 500 },
    )
  }
}
