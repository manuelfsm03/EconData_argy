import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Get the latest scrape log for each source
    const sources = ["rava", "finanzasargy", "criptoya", "bcra", "indec", "rss"]

    const status = await Promise.all(
      sources.map(async (source) => {
        const log = await prisma.scrapeLog.findFirst({
          where: { source },
          orderBy: { startedAt: "desc" },
        })

        const sourceNames: Record<string, string> = {
          rava: "Rava.com",
          finanzasargy: "FinanzasArgy",
          criptoya: "CriptoYa",
          bcra: "BCRA",
          indec: "INDEC",
          rss: "RSS Feeds",
        }

        return {
          name: sourceNames[source] || source,
          source,
          lastRun: log?.completedAt || log?.startedAt || null,
          status: log?.status === "success"
            ? "success"
            : log?.status === "error"
            ? "error"
            : log?.completedAt === null && log?.startedAt
            ? "running"
            : "pending",
          recordsAdded: log?.recordsAdded || undefined,
          message: log?.message || undefined,
        }
      })
    )

    return NextResponse.json(status)
  } catch (error) {
    console.error("Error fetching status:", error)
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    )
  }
}
