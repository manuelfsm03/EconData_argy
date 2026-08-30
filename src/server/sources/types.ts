export type SourceKind = "json" | "csv" | "xlsx" | "rss" | "html" | "xml"
export type DataClass = "intraday_market" | "daily_market" | "official_daily" | "official_monthly" | "annual" | "news"
export type RetryReason = "timeout" | "429" | "5xx"

export type SourceDefinition<Id extends string = string> = {
  id: Id
  displayName: string
  publisher: string
  kind: SourceKind
  dataClass: DataClass
  baseUrl?: string
  allowedHosts: readonly string[]
  allowedRedirectSourceIds: readonly string[]
  cookieForwardSourceIds: readonly string[]
  timeoutMs: number
  maxResponseBytes: number
  retry: { attempts: 0 | 1; retryOn: readonly RetryReason[] }
  cache: {
    freshSeconds: number
    staleWhileRevalidateSeconds: number
    staleIfErrorSeconds: number
  }
  freshness: { warnAfterSeconds: number | null; rejectAfterSeconds: number | null }
  credentialEnv?: string
  fallbackSourceIds: readonly string[]
  healthcheck?: {
    path: string
    expectedStatuses: readonly number[]
    credentialQueryParam?: string
  }
}
