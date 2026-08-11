import { NextResponse } from "next/server"
import { fetchMultipleSeries, mergeSeriesByDate, getPeriodDates } from "@/server/sources/bcra-api"
import { fetchBankingBalance, parseBankingDateRange } from "@/server/sources/bcra-banking"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const endpoint = searchParams.get("endpoint")
  if (endpoint !== "bancos") {
    return NextResponse.json({ error: `Unknown endpoint: ${endpoint ?? ""}` }, { status: 400 })
  }

  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  if (!desde || !hasta) {
    return NextResponse.json({ error: "desde and hasta are required (YYYY-MM-DD)" }, { status: 400 })
  }

  try {
    parseBankingDateRange(desde, hasta)
    const data = await fetchBankingBalance(desde, hasta)
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch banking data"
    const status = message.includes("YYYY-MM-DD") || message.includes("desde") ? 400 : 502
    console.error("BCRA banking data error:", error)
    return NextResponse.json({ error: message }, { status })
  }
}

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
