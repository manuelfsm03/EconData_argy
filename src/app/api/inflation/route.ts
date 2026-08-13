import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { toMidnightUTC } from "@/lib/dates"
import { requireAdminAuthorization } from "@/server/api/admin-auth"


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

    if (inflation.length > 0) return NextResponse.json(inflation)

    return NextResponse.json([])
  } catch (error) {
    console.error("Error fetching inflation data:", error)

    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Inflation data unavailable", retryable: true } },
      { status: 503 },
    )
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized
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
