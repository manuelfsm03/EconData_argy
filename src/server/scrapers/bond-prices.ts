import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import { todayUTC } from "@/lib/dates"
import { ESQUEMAS, construirCashflows } from "@/lib/bond-schedule"
import { metricasDevengadas } from "@/lib/bond-math"
import { fechaUTC, siguienteDiaHabil } from "@/lib/market-calendar"
import { fetchBymaQuotes } from "@/server/external/byma-data"

/**
 * Snapshot diario de precios de los 9 bonos con cashflow verificado
 * (ESQUEMAS) -- alimenta la tabla bond_prices para poder mostrar histórico
 * real en el frontend, en vez del placeholder "próximamente" que había.
 *
 * SovereignBond nunca se pobló (confirmado: 0 usos de prisma.sovereignBond.create
 * en todo el repo) -- este scraper la puebla vía upsert por ticker antes de
 * escribir el precio del día, así BondPrice.bondId siempre resuelve.
 */
export class BondPriceScraper extends BaseScraper {
  constructor() {
    super("bond-prices")
  }

  async scrape(): Promise<ScrapeResult> {
    const today = todayUTC()
    const hoy = new Date()
    const liquidacion = siguienteDiaHabil(fechaUTC(hoy.toISOString().slice(0, 10)))
    const bymaQuotes = await fetchBymaQuotes(ESQUEMAS.map((e) => e.ticker), { currencySuffix: "D" })

    let recordsAdded = 0
    const fallidos: string[] = []

    for (const esquema of ESQUEMAS) {
      const precio = bymaQuotes.get(esquema.ticker)?.lastPrice ?? null
      if (precio == null) {
        fallidos.push(esquema.ticker)
        continue
      }

      const cashflows = construirCashflows(esquema)
      const devengadas = metricasDevengadas(cashflows, liquidacion)
      const conAmortizacionParcial = esquema.filas.filter((f) => f.amortizacion > 0).length > 1

      const bond = await prisma.sovereignBond.upsert({
        where: { ticker: esquema.ticker },
        update: { precio },
        create: {
          ticker: esquema.ticker,
          nombre: esquema.nombre,
          moneda: esquema.moneda,
          ley: esquema.ley,
          cupon: devengadas ? Number((devengadas.tasaVigente * 100).toFixed(4)) : 0,
          amortizacion: conAmortizacionParcial ? "amortizing" : "bullet",
          emision: new Date(esquema.emision),
          vencimiento: new Date(esquema.vencimiento),
          precio,
        },
      })

      await prisma.bondPrice.upsert({
        where: { bondId_date: { bondId: bond.id, date: today } },
        update: { priceUsd: precio, source: "byma" },
        create: { bondId: bond.id, date: today, priceUsd: precio, source: "byma" },
      })
      recordsAdded++
    }

    return {
      success: recordsAdded > 0,
      recordsAdded,
      message: fallidos.length > 0 ? `${recordsAdded} bonos guardados; sin precio: ${fallidos.join(", ")}` : `${recordsAdded} bonos guardados`,
    }
  }
}
