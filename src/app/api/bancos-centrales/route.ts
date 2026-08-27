import { NextResponse } from "next/server"
import { CENTRAL_BANK_NOTE, CENTRAL_BANK_UNAVAILABLE_NOTE, loadCentralBankRates } from "@/server/domain/central-bank-rates"

export const runtime = "nodejs"

export async function GET() {
  const result = await loadCentralBankRates()
  return NextResponse.json({
    data: result.data,
    ...(result.cached ? { cached: true } : {}),
    stale: result.stale,
    ...(result.staleSince ? { stale_since: result.staleSince } : {}),
    updated_at: new Date().toISOString(),
    nota: result.allFailed ? CENTRAL_BANK_UNAVAILABLE_NOTE : CENTRAL_BANK_NOTE,
  })
}
