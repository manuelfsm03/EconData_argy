import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

/**
 * Histórico de precios de un bono soberano verificado, alimentado por el
 * snapshot diario de src/server/scrapers/bond-prices.ts (tabla bond_prices).
 * Puede devolver pocos o cero puntos hasta que el cron corra unos días --
 * eso se reporta tal cual, no se rellena con nada inventado.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()
  const { searchParams } = new URL(request.url)
  const dias = Number(searchParams.get("dias") ?? "180")

  try {
    const bond = await prisma.sovereignBond.findUnique({ where: { ticker } })
    if (!bond) {
      return NextResponse.json({ ticker, history: [], nota: "Todavía no hay ningún snapshot guardado para este ticker" })
    }

    const desde = new Date()
    desde.setUTCDate(desde.getUTCDate() - dias)

    const precios = await prisma.bondPrice.findMany({
      where: { bondId: bond.id, date: { gte: desde } },
      orderBy: { date: "asc" },
    })

    return NextResponse.json({
      ticker,
      history: precios.map((p: typeof precios[number]) => ({
        date: p.date.toISOString().slice(0, 10),
        priceUsd: p.priceUsd,
        priceArs: p.priceArs,
      })),
      count: precios.length,
      nota: precios.length < 5 ? "Serie corta -- el snapshot diario recién arrancó, se va a ir completando" : undefined,
    })
  } catch (error) {
    console.error("[/api/bonos/[ticker]/historico]", error)
    return NextResponse.json({ error: "Error al obtener histórico", detail: String(error) }, { status: 500 })
  }
}
