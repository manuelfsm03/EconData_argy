import { NextResponse } from "next/server"
import { inspectRuntimeData } from "@/lib/runtime-data-health"
import { fetchRegistered } from "@/server/http/fetch-source"
import { prisma } from "@/server/db/prisma"
import { SOURCE_REGISTRY, registeredHealthchecks, type SourceId } from "@/server/sources/registry"
import type { SourceDefinition } from "@/server/sources/types"

export const dynamic = "force-dynamic"

type HealthCheck = {
  source: SourceId
  name: string
  publisher: string
  definition: SourceDefinition
  url: string | null
  expectedStatuses: readonly number[]
}

type Freshness = {
  status: "fresh" | "stale" | "expired" | "unknown"
  asOf: string | null
  ageSeconds: number | null
  reason: string
}

type Transport = {
  status: "available" | "unavailable" | "not_configured"
  httpStatus: number | null
  checkedAt: string
  latencyMs: number
  runtimeSource: string | null
  freshness: Freshness
}

type StatusRow = {
  name: string
  publisher: string
  source: string
  runtimeSource: string | null
  endpoint: string | null
  lastRun: string | Date | null
  status: "success" | "error" | "unprobed"
  recordsAdded?: number
  message: string
  transport: Omit<Transport, "runtimeSource" | "freshness">
  ingestion: {
    status: "success" | "error" | "running" | "pending" | "unavailable"
    lastRun: string | Date | null
    recordsAdded?: number
  }
  freshness: Freshness
}

function healthchecks(): HealthCheck[] {
  const configuredIds = new Set(registeredHealthchecks().map((definition) => definition.id))
  return Object.values(SOURCE_REGISTRY).map((definition) => {
    const configured = configuredIds.has(definition.id) ? definition.healthcheck : undefined
    let url: string | null = null
    if (configured) {
      const parsed = new URL(configured.path, definition.baseUrl)
      const credential = definition.credentialEnv ? process.env[definition.credentialEnv] : undefined
      if (configured.credentialQueryParam && credential) parsed.searchParams.set(configured.credentialQueryParam, credential)
      url = parsed.toString()
    }
    return {
      source: definition.id,
      name: definition.displayName,
      publisher: definition.publisher,
      definition,
      url,
      expectedStatuses: configured?.expectedStatuses ?? [],
    }
  })
}

function freshnessFor(check: HealthCheck, asOf: string | null, checkedAt: string): Freshness {
  if (!asOf) return { status: "unknown", asOf: null, ageSeconds: null, reason: "La sonda no informó fecha del dato" }
  const parsed = Date.parse(asOf)
  if (!Number.isFinite(parsed)) return { status: "unknown", asOf, ageSeconds: null, reason: "Timestamp no interpretable" }

  const ageSeconds = Math.max(0, Math.round((Date.parse(checkedAt) - parsed) / 1000))
  const { warnAfterSeconds, rejectAfterSeconds } = check.definition.freshness
  if (rejectAfterSeconds != null && ageSeconds > rejectAfterSeconds) {
    return { status: "expired", asOf, ageSeconds, reason: `Supera el límite de ${rejectAfterSeconds}s` }
  }
  if (warnAfterSeconds != null && ageSeconds > warnAfterSeconds) {
    return { status: "stale", asOf, ageSeconds, reason: `Supera el umbral de ${warnAfterSeconds}s` }
  }
  return { status: "fresh", asOf, ageSeconds, reason: "Dentro del umbral de su clase de datos" }
}

async function runHealthcheck(check: HealthCheck): Promise<Transport> {
  const checkedAt = new Date().toISOString()
  if (!check.url) {
    return {
      status: "not_configured",
      httpStatus: null,
      checkedAt,
      latencyMs: 0,
      runtimeSource: null,
      freshness: freshnessFor(check, null, checkedAt),
    }
  }

  const startedAt = Date.now()
  try {
    const response = await fetchRegistered(check.url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json,text/html,application/xml" },
      next: { revalidate: 300 },
    })
    let payload: unknown = null
    if (check.definition.kind === "json") {
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
    }
    const metadata = inspectRuntimeData(payload, response.headers)
    return {
      status: check.expectedStatuses.includes(response.status) ? "available" : "unavailable",
      httpStatus: response.status,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      runtimeSource: metadata.source,
      freshness: freshnessFor(check, metadata.timestamp, checkedAt),
    }
  } catch {
    return {
      status: "unavailable",
      httpStatus: null,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      runtimeSource: null,
      freshness: freshnessFor(check, null, checkedAt),
    }
  }
}

export async function GET() {
  const rows = await Promise.all(healthchecks().map(async (sourceCfg): Promise<StatusRow> => {
    const [runtime, logResult] = await Promise.all([
      runHealthcheck(sourceCfg),
      prisma.scrapeLog.findFirst({ where: { source: sourceCfg.source }, orderBy: { startedAt: "desc" } })
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
    const status = runtime.status === "available" ? "success" as const : runtime.status === "unavailable" ? "error" as const : "unprobed" as const

    return {
      name: sourceCfg.name,
      publisher: sourceCfg.publisher,
      source: sourceCfg.source,
      runtimeSource: runtime.runtimeSource,
      endpoint: sourceCfg.url ? new URL(sourceCfg.url).host : null,
      lastRun,
      status,
      recordsAdded: log?.recordsAdded || undefined,
      message: runtime.status === "available"
        ? `transport ok · ${runtime.latencyMs}ms`
        : runtime.status === "not_configured"
        ? "sin sonda de transporte configurada"
        : "transport unavailable",
      transport: {
        status: runtime.status,
        httpStatus: runtime.httpStatus,
        checkedAt: runtime.checkedAt,
        latencyMs: runtime.latencyMs,
      },
      ingestion: { status: ingestionStatus, lastRun, recordsAdded: log?.recordsAdded || undefined },
      freshness: runtime.freshness,
    }
  }))

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "private, max-age=0, s-maxage=60, stale-while-revalidate=120" },
  })
}
