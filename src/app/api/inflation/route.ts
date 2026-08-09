import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { toMidnightUTC } from "@/lib/dates"

type MacroIPCResponse = {
  data?: {
    ipc_var_mensual?: [string, number][]
    ipc_var_interanual?: [string, number][]
  }
}

async function fetchFallbackInflation(limit: number, offset: number, requestUrl: string) {
  const res = await fetch(new URL("/api/macro?endpoint=ipc", requestUrl), {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 3600 },
  }).catch(() => null)

  const payload = res && res.ok ? (await res.json()) as MacroIPCResponse : null
  const monthly = payload?.data?.ipc_var_mensual ?? []
  const interannual = new Map(payload?.data?.ipc_var_interanual ?? [])

  return monthly
    .slice(offset, offset + limit)
    .map(([date, monthlyValue], idx) => {
      const year = date.slice(0, 4)
      const ytdBase = monthly
        .filter(([d]) => d.startsWith(year))
        .slice(idx)
        .reduce((acc, [, v]) => acc * (1 + (v ?? 0)), 1) - 1
      return {
        id: `fallback-${date}`,
        date,
        monthly: monthlyValue,
        yearToDate: Number.isFinite(ytdBase) ? ytdBase : null,
        interannual: interannual.get(date) != null ? (interannual.get(date)! / 100) : null,
        accumulated: null,
      }
    })
}

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

    const fallback = await fetchFallbackInflation(limit, offset, request.url)
    return NextResponse.json(fallback)
  } catch (error) {
    console.error("Error fetching inflation data:", error)

    try {
      const fallback = await fetchFallbackInflation(limit, offset, request.url)
      return NextResponse.json(fallback)
    } catch (fallbackError) {
      console.error("Fallback inflation failed:", fallbackError)
      return NextResponse.json(
        { error: "Failed to fetch inflation data" },
        { status: 500 }
      )
    }
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
