import { createHmac } from "node:crypto"
import { isIP } from "node:net"

export const FORUM_RATE_LIMIT_SECONDS = 20
export const FORUM_PAGE_SIZE = 20
export const MAX_FORUM_TICKER_LENGTH = 15
export const MAX_FORUM_VARIABLE_LENGTH = 64

const SAFE_TICKER = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/

export class ForumConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForumConfigurationError"
  }
}

export function normalizeForumTicker(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  if (normalized.length === 0 || normalized.length > MAX_FORUM_TICKER_LENGTH) return null
  return SAFE_TICKER.test(normalized) ? normalized : null
}

export function normalizeForumVariable(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  if (normalized.length === 0 || normalized.length > MAX_FORUM_VARIABLE_LENGTH) return null
  return SAFE_TICKER.test(normalized) ? normalized : null
}

export function normalizeForumSearch(value: string | null): string {
  return (value ?? "").trim().slice(0, 100)
}

export function getTrustedClientIp(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): string | null {
  let candidate: string | null = null

  if (env.VERCEL === "1") {
    candidate = headers.get("x-vercel-forwarded-for")
  } else if (env.FORUM_TRUST_PROXY === "1") {
    candidate = headers.get("x-real-ip")
  }

  if (!candidate || candidate !== candidate.trim() || candidate.includes(",") || isIP(candidate) === 0) {
    return null
  }
  return candidate
}

export function requireForumRateLimitSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.FORUM_RATE_LIMIT_SECRET
  if (!secret || secret.length < 32) {
    throw new ForumConfigurationError("FORUM_RATE_LIMIT_SECRET must contain at least 32 characters")
  }
  return secret
}

export function deriveForumIdentity(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`forum-rate-limit:v1:${ip}`).digest("hex")
}
