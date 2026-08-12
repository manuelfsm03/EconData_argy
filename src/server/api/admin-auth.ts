import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

function equalSecret(received: string, expected: string): boolean {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function requireAdminAuthorization(request: NextRequest): NextResponse | null {
  const secret = process.env.INGEST_SECRET ?? process.env.CRON_SECRET
  const authorization = request.headers.get("authorization") ?? ""
  if (!secret || !authorization.startsWith("Bearer ") || !equalSecret(authorization.slice(7), secret)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized", retryable: false } },
      { status: 401 },
    )
  }
  return null
}
