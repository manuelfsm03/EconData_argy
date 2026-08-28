import { NextRequest, NextResponse } from "next/server"
import { runAllScrapers } from "@/server/scrapers"
import { ejecutarResolucion } from "@/app/api/predictions/resolve/route"

// This endpoint is designed to be called by Vercel Cron
// Configure in vercel.json to run at 17:00 Argentina time (20:00 UTC)

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("Starting scheduled scrape at", new Date().toISOString())

  try {
    const results = await runAllScrapers()

    console.log("Scrape completed:", results)

    // Resolver predicciones vencidas contra las fuentes de precios
    let predicciones = null
    try {
      predicciones = await ejecutarResolucion(new URL(request.url).origin)
      console.log("Predicciones resueltas:", predicciones.resueltas)
    } catch (e) {
      console.error("Resolución de predicciones falló:", e)
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      predicciones,
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
