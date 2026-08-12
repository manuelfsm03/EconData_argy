import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { registeredHealthchecks, type SourceId } from "@/server/sources/registry"

export const dynamic = "force-dynamic"

type HealthCheck = {
  source: SourceId
  name: string
  url: string
  expectedStatuses: readonly number[]
}

type StatusRow = {
  name: string
  source: string
  lastRun: string | Date | null
  status: "success" | "error"
  recordsAdded?: number
  message: string
  transport: {
    status: "available" | "unavailable"
    httpStatus: number | null
    checkedAt: string
    latencyMs: number
  }
  ingestion: {
    status: "success" | "error" | "running" | "pending" | "unavailable"
    lastRun: string | Date | null
    recordsAdded?: number
  }
  freshness: {
    status: "unknown"
    asOf: null
    reason: string
  }
}

const healthchecks = (): HealthCheck[] => registeredHealthchecks().map((definition) => ({
  source: definition.id,
  name: definition.displayName,
  url: new URL(definition.healthcheck!.path, definition.baseUrl).toString(),
  expectedStatuses: definition.healthcheck!.expectedStatuses,
}))

async function runHealthcheck(check: HealthCheck) {
  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()
  try {
    const response = await fetchRegistered(check.url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json,text/html,application/xml" },
      next: { revalidate: 900 },
    })
    return {
      status: check.expectedStatuses.includes(response.status) ? "available" as const : "unavailable" as const,
      httpStatus: response.status,
      checkedAt,
      latencyMs: Date.now() - startedAt,
    }
  } catch {
    return {
      status: "unavailable" as const,
      httpStatus: null,
      checkedAt,
      latencyMs: Date.now() - startedAt,
    }
  }
}

export async function GET() {
  const rows = await Promise.all(
    healthchecks().map(async (sourceCfg): Promise<StatusRow> => {
      const [transport, logResult] = await Promise.all([
        runHealthcheck(sourceCfg),
        prisma.scrapeLog.findFirst({
          where: { source: sourceCfg.source },
          orderBy: { startedAt: "desc" },
        })
          .then((log) => ({ log, available: true as const }))
          .catch(() => ({ log: null, available: false as const })),
      ])
      const log = logResult.log
      const ingestionStatus = !logResult.available
        ? "unavailable" as const
        : log?.status === "success"
        ? "success" as const
        : log?.status === "error"
        ? "error" as const
        : log?.completedAt === null && log?.startedAt
        ? "running" as const
        : "pending" as const
      const lastRun = log?.completedAt || log?.startedAt || null

      return {
        name: sourceCfg.name,
        source: sourceCfg.source,
        lastRun,
        status: transport.status === "available" ? "success" : "error",
        recordsAdded: log?.recordsAdded || undefined,
        message: transport.status === "available"
          ? `transport ok · ${transport.latencyMs}ms`
          : "transport unavailable",
        transport,
        ingestion: {
          status: ingestionStatus,
          lastRun,
          recordsAdded: log?.recordsAdded || undefined,
        },
        freshness: {
          status: "unknown",
          asOf: null,
          reason: "Dataset as-of is reported by dataset responses, not transport health",
        },
      }
    }),
  )

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "private, max-age=0, s-maxage=60, stale-while-revalidate=120" },
  })
}
