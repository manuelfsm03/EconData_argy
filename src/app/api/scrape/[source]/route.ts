import { NextRequest, NextResponse } from "next/server"
import { getScraper, runAllScrapers, ScraperName } from "@/server/scrapers"

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { source } = await params

  try {
    if (source === "all") {
      const results = await runAllScrapers()
      return NextResponse.json(results)
    }

    const scraper = getScraper(source as ScraperName)

    if (!scraper) {
      return NextResponse.json(
        { error: `Unknown scraper: ${source}` },
        { status: 400 }
      )
    }

    const result = await scraper.run()
    return NextResponse.json(result)
  } catch (error) {
    console.error(`Error running scraper ${source}:`, error)
    return NextResponse.json(
      {
        error: "Scraper failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
