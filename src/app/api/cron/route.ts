import { NextRequest, NextResponse } from "next/server"
import { runAllScrapers } from "@/server/scrapers"

// This endpoint is designed to be called by Vercel Cron
// Configure in vercel.json to run at 17:00 Argentina time (20:00 UTC)

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("Starting scheduled scrape at", new Date().toISOString())

  try {
    const results = await runAllScrapers()

    console.log("Scrape completed:", results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error("Cron job failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}
