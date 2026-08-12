export type Freshness = "fresh" | "stale" | "expired" | "static"
export type Completeness = "complete" | "partial"
export type SourceMode = "live" | "cache_fresh" | "cache_stale" | "fallback" | "curated_static"
export type ErrorCode =
  | "INVALID_INPUT"
  | "SOURCE_TIMEOUT"
  | "SOURCE_BAD_RESPONSE"
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_NOT_CONFIGURED"
  | "DATA_EXPIRED"
  | "INTERNAL_ERROR"

export type SourceProvenance = {
  id: string
  publisher: string
  mode: SourceMode
  retrievedAt: string
  fallbackFrom: string | null
}

type CommonMeta = {
  requestId: string
  dataset: string
  generatedAt: string
}

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "Invalid input",
  SOURCE_TIMEOUT: "Source timed out",
  SOURCE_BAD_RESPONSE: "Source returned an invalid response",
  SOURCE_UNAVAILABLE: "Source is unavailable",
  SOURCE_NOT_CONFIGURED: "Source is not configured",
  DATA_EXPIRED: "Data is expired",
  INTERNAL_ERROR: "Internal error",
}

export function buildSuccessEnvelope<T>(input: {
  requestId: string
  dataset: string
  data: T
  generatedAt?: string
  asOf: string
  freshness: Freshness
  completeness: Completeness
  source: SourceProvenance
  warnings?: string[]
}) {
  return {
    ok: true as const,
    data: input.data,
    meta: {
      requestId: input.requestId,
      dataset: input.dataset,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      asOf: input.asOf,
      freshness: input.freshness,
      completeness: input.completeness,
      source: input.source,
      warnings: input.warnings ?? [],
    },
  }
}

export function buildErrorEnvelope(input: CommonMeta & {
  code: ErrorCode
  message?: string
  retryable: boolean
}) {
  return {
    ok: false as const,
    error: {
      code: input.code,
      message: SAFE_MESSAGES[input.code],
      retryable: input.retryable,
    },
    meta: {
      requestId: input.requestId,
      dataset: input.dataset,
      generatedAt: input.generatedAt,
    },
  }
}
