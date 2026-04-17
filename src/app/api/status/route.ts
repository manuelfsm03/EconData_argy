import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type HealthCheck = {
  source: string
  name: string
  url: string
}

type StatusRow = {
  name: string
  source: string
  lastRun: string | Date | null
  status: "success" | "error" | "running" | "pending"
  recordsAdded?: number
  message?: string
}

const CHECKS: HealthCheck[] = [
  { source: "rava", name: "Rava.com", url: "https://www.rava.com/perfil/gd30" },
  { source: "finanzasargy", name: "ArgentinaDatos Dólares", url: "https://api.argentinadatos.com/v1/cotizaciones/dolares" },
  { source: "criptoya", name: "DolarAPI / Cripto", url: "https://dolarapi.com/v1/dolares" },
  { source: "bcra", name: "BCRA / Macro", url: "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais" },
  { source: "indec", name: "INDEC / datos.gob.ar", url: "https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2" },
  { source: "rss", name: "RSS Feeds", url: "https://www.infobae.com/arc/outboundfeeds/rss/" },
  { source: "api-merval", name: "api-merval", url: "https://api-merval-production.up.railway.app/health/live" },
]

async function runHealthcheck(check: HealthCheck, dbError?: unknown): Promise<StatusRow> {
  try {
    const startedAt = Date.now()
    const res = await fetch(check.url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json,text/html,application/xml" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 900 },
    })
    const duration = Date.now() - startedAt
    const modePrefix = dbError ? "fallback healthcheck" : "healthcheck"

    return {
      name: check.name,
      source: check.source,
      lastRun: null,
      status: res.ok ? "success" : "error",
      recordsAdded: undefined,
      message: res.ok ? `${modePrefix} ok · ${duration}ms` : `${modePrefix} http ${res.status}`,
    }
  } catch (healthError) {
    const modePrefix = dbError ? "fallback healthcheck" : "healthcheck"
    return {
      name: check.name,
      source: check.source,
      lastRun: null,
      status: "error",
      recordsAdded: undefined,
      message: `${modePrefix} ${healthError instanceof Error ? healthError.message : "failed"}`,
    }
  }
}

export async function GET() {
  try {
    const dbStatuses = await Promise.all(
      CHECKS.map(async (sourceCfg) => {
        const log = await prisma.scrapeLog.findFirst({
          where: { source: sourceCfg.source },
          orderBy: { startedAt: "desc" },
        })

        return {
          name: sourceCfg.name,
          source: sourceCfg.source,
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
        } satisfies StatusRow
      })
    )

    return NextResponse.json(dbStatuses)
  } catch (error) {
    console.error("Error fetching status from DB:", error)

    const statuses = await Promise.all(CHECKS.map((check) => runHealthcheck(check, error)))
    return NextResponse.json(statuses)
  }
}
