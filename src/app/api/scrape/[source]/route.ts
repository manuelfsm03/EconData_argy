import { NextRequest, NextResponse } from "next/server"
import { getScraper, runAllScrapers, ScraperName } from "@/scrapers"

function requireAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  // Acepta header directo o cookie de sesión admin
  if (req.headers.get("x-admin-password") === expected) return true
  if (req.cookies.get("lapizarra_admin")?.value === expected) return true
  return false
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

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
