import { NextRequest, NextResponse } from "next/server"
import { runAllScrapers } from "@/server/scrapers"

// This endpoint is designed to be called by Vercel Cron
// Configure in vercel.json to run at 17:00 Argentina time (20:00 UTC)

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (optional but recommended)
  const authHeader = request.headers.get("authorization")

  // In production, you might want to verify the cron secret
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if no secret is set
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
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
