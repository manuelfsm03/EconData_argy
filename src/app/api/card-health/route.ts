import { NextRequest, NextResponse } from "next/server"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"

export const dynamic = "force-dynamic"

interface CachedHealth {
  expiresAt: number
  payload: CardHealthPayload
}

interface EndpointHealth {
  label: string
  path: string
  ok: boolean
  status: number | null
  latencyMs: number
}

interface CardHealthPayload {
  cardId: string
  ok: boolean
  checkedAt: string
  endpoints: EndpointHealth[]
}

const CACHE_TTL_MS = 45_000
const cache = new Map<string, CachedHealth>()

async function probe(request: NextRequest, path: string, label: string): Promise<EndpointHealth> {
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const target = new URL(path, request.nextUrl.origin)
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-lapizarra-health-check": "1" },
    })
    return {
      label,
      path,
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch {
    return {
      label,
      path,
      ok: false,
      status: null,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: NextRequest) {
  const cardId = request.nextUrl.searchParams.get("cardId") ?? ""
  const definition = DATA_CARD_BY_ID.get(cardId)

  if (!definition) {
    return NextResponse.json({ error: "Tarjeta desconocida" }, { status: 404 })
  }

  const cached = cache.get(cardId)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
    })
  }

  const endpoints = await Promise.all(
    definition.endpoints.map((endpoint) => probe(request, endpoint.path, endpoint.label))
  )
  const payload: CardHealthPayload = {
    cardId,
    ok: endpoints.length > 0 && endpoints.every((endpoint) => endpoint.ok),
    checkedAt: new Date().toISOString(),
    endpoints,
  }

  cache.set(cardId, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
  })
}
