import { NextResponse } from "next/server"
import { fetchMultipleSeries, mergeSeriesByDate, getPeriodDates } from "@/server/sources/bcra-api"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { series_ids, period = "1y" } = body as {
      series_ids: string[]
      period?: string
    }

    if (!series_ids || series_ids.length === 0) {
      return NextResponse.json({ error: "series_ids required" }, { status: 400 })
    }

    const { start, end } = getPeriodDates(period)
    const seriesData = await fetchMultipleSeries(series_ids, start, end)
    const hasData = Object.values(seriesData).some(arr => arr.length > 0)

    if (!hasData) {
      return NextResponse.json(
        { error: "No data returned from BCRA API. The API may be temporarily unavailable.", series: series_ids },
        { status: 502 }
      )
    }

    const merged = mergeSeriesByDate(seriesData)
    // BCRA publica datos una vez por día — 1h de caché no pierde frescura
    return NextResponse.json(
      {
        data: merged,
        metadata: {
          source: "BCRA_API_v4.0",
          period,
          series: series_ids,
          last_updated: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    )
  } catch (error) {
    console.error("BCRA data error:", error)
    return NextResponse.json({ error: "Failed to fetch BCRA data" }, { status: 500 })
  }
}
