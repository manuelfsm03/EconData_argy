import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toMidnightUTC } from "@/lib/dates"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "24")
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const inflation = await prisma.inflation.findMany({
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(inflation)
  } catch (error) {
    console.error("Error fetching inflation data:", error)
    return NextResponse.json(
      { error: "Failed to fetch inflation data" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const inflation = await prisma.inflation.upsert({
      where: { date: toMidnightUTC(data.date) },
      update: {
        monthly: data.monthly,
        yearToDate: data.yearToDate,
        interannual: data.interannual,
        accumulated: data.accumulated,
      },
      create: {
        date: toMidnightUTC(data.date),
        monthly: data.monthly,
        yearToDate: data.yearToDate,
        interannual: data.interannual,
        accumulated: data.accumulated,
      },
    })

    return NextResponse.json(inflation)
  } catch (error) {
    console.error("Error saving inflation data:", error)
    return NextResponse.json(
      { error: "Failed to save inflation data" },
      { status: 500 }
    )
  }
}
