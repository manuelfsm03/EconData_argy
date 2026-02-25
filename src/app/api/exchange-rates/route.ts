import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toMidnightUTC } from "@/lib/dates"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "30")
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(rates)
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const rate = await prisma.exchangeRate.upsert({
      where: { date: toMidnightUTC(data.date) },
      update: {
        blue: data.blue,
        cclLibre: data.cclLibre,
        cclControlado: data.cclControlado,
        mepLibre: data.mepLibre,
        mepControlado: data.mepControlado,
        oficial: data.oficial,
        mayorista: data.mayorista,
        a3500: data.a3500,
        solidario: data.solidario,
        cripto: data.cripto,
      },
      create: {
        date: toMidnightUTC(data.date),
        blue: data.blue,
        cclLibre: data.cclLibre,
        cclControlado: data.cclControlado,
        mepLibre: data.mepLibre,
        mepControlado: data.mepControlado,
        oficial: data.oficial,
        mayorista: data.mayorista,
        a3500: data.a3500,
        solidario: data.solidario,
        cripto: data.cripto,
      },
    })

    return NextResponse.json(rate)
  } catch (error) {
    console.error("Error saving exchange rate:", error)
    return NextResponse.json(
      { error: "Failed to save exchange rate" },
      { status: 500 }
    )
  }
}
