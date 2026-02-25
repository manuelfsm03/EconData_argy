import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toMidnightUTC } from "@/lib/dates"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get("date")

  try {
    const whereClause = date
      ? { date: toMidnightUTC(date) }
      : {}

    // Get the latest date's futures
    const latestFuture = await prisma.rofexFuture.findFirst({
      orderBy: { date: "desc" },
    })

    const futures = await prisma.rofexFuture.findMany({
      where: latestFuture ? { date: latestFuture.date } : whereClause,
      orderBy: { maturity: "asc" },
    })

    return NextResponse.json(futures)
  } catch (error) {
    console.error("Error fetching Rofex data:", error)
    return NextResponse.json(
      { error: "Failed to fetch Rofex data" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const future = await prisma.rofexFuture.upsert({
      where: {
        date_position: {
          date: toMidnightUTC(data.date),
          position: data.position,
        },
      },
      update: {
        maturity: new Date(data.maturity),
        maturityLabel: data.maturityLabel,
        price: data.price,
        devaluation: data.devaluation,
        monthlyDevaluation: data.monthlyDevaluation,
        tna: data.tna,
        cft: data.cft,
      },
      create: {
        date: toMidnightUTC(data.date),
        position: data.position,
        maturity: new Date(data.maturity),
        maturityLabel: data.maturityLabel,
        price: data.price,
        devaluation: data.devaluation,
        monthlyDevaluation: data.monthlyDevaluation,
        tna: data.tna,
        cft: data.cft,
      },
    })

    return NextResponse.json(future)
  } catch (error) {
    console.error("Error saving Rofex data:", error)
    return NextResponse.json(
      { error: "Failed to save Rofex data" },
      { status: 500 }
    )
  }
}
