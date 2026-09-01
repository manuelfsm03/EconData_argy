import { fetchRegistered } from "@/server/http/fetch-source"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { toMidnightUTC } from "@/lib/dates"
import { requireAdminAuthorization } from "@/server/api/admin-auth"

export const dynamic = "force-dynamic"

type DollarRow = {
  casa: string
  compra: number
  venta: number
  fecha: string
}

function buildFallbackRows(rows: DollarRow[], limit: number, offset: number) {
  const byDate = new Map<string, Partial<Record<string, DollarRow>>>()

  for (const row of rows) {
    const bucket = byDate.get(row.fecha) ?? {}
    bucket[row.casa] = row
    byDate.set(row.fecha, bucket)
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(offset, offset + limit)
    .map(([date, casas]) => ({
      id: `fallback-${date}`,
      date,
      blue: casas.blue?.venta ?? null,
      cclLibre: casas.contadoconliqui?.venta ?? null,
      cclControlado: null,
      mepLibre: casas.bolsa?.venta ?? null,
      mepControlado: null,
      oficial: casas.oficial?.venta ?? null,
      mayorista: casas.mayorista?.venta ?? null,
      a3500: casas.mayorista?.venta ?? casas.oficial?.venta ?? null,
      solidario: casas.solidario?.venta ?? casas.tarjeta?.venta ?? null,
      cripto: casas.cripto?.venta ?? null,
    }))
}

async function fetchFallbackExchangeRates(limit: number, offset: number) {
  const res = await fetchRegistered("https://api.argentinadatos.com/v1/cotizaciones/dolares", {
    headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`argentinadatos ${res.status}`)
  const rows = (await res.json()) as DollarRow[]
  return buildFallbackRows(rows, limit, offset)
}

function latestDate(rows: Array<{ date: string | Date }>): string | null {
  const value = rows[0]?.date
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : String(value)
}

function rowsResponse<T extends { date: string | Date }>(rows: T[], source: string) {
  const timestamp = latestDate(rows)
  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "X-Data-Source": source,
      ...(timestamp ? { "X-Data-As-Of": timestamp } : {}),
      "X-Data-Freshness": timestamp ? "fresh" : "unknown",
    },
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "30")
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })
    try {
      const fallbackRates = await fetchFallbackExchangeRates(limit, offset)
      const databaseAsOf = latestDate(rates)
      const fallbackAsOf = latestDate(fallbackRates)
      if (fallbackRates.length > 0 && (!databaseAsOf || (fallbackAsOf && Date.parse(fallbackAsOf) > Date.parse(databaseAsOf)))) {
        return rowsResponse(fallbackRates, "ArgentinaDatos")
      }
    } catch (fallbackError) {
      console.error("Fallback exchange rates freshness check failed:", fallbackError)
    }

    if (rates.length > 0) return rowsResponse(rates, "PostgreSQL exchangeRate")
    const fallbackRates = await fetchFallbackExchangeRates(limit, offset)
    return rowsResponse(fallbackRates, "ArgentinaDatos")
  } catch (error) {
    console.error("Error fetching exchange rates:", error)

    try {
      const fallbackRates = await fetchFallbackExchangeRates(limit, offset)
      return rowsResponse(fallbackRates, "ArgentinaDatos")
    } catch (fallbackError) {
      console.error("Fallback exchange rates failed:", fallbackError)
      return NextResponse.json(
        { error: "Failed to fetch exchange rates" },
        { status: 500 }
      )
    }
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized
  try {
    const data = await request.json()

    const rate = await prisma.exchangeRate.upsert({
      where: { date: toMidnightUTC(data.date) },
      update: {
        blue: data.blue,
        cclLibre: data.cclLibre,
        cclControlado: data.cclControlado,
        mepLibre: data.mepLibre,
        mepControlado: data.mepControlado,
        oficial: data.oficial,
        mayorista: data.mayorista,
        a3500: data.a3500,
        solidario: data.solidario,
        cripto: data.cripto,
      },
      create: {
        date: toMidnightUTC(data.date),
        blue: data.blue,
        cclLibre: data.cclLibre,
        cclControlado: data.cclControlado,
        mepLibre: data.mepLibre,
        mepControlado: data.mepControlado,
        oficial: data.oficial,
        mayorista: data.mayorista,
        a3500: data.a3500,
        solidario: data.solidario,
        cripto: data.cripto,
      },
    })

    return NextResponse.json(rate)
  } catch (error) {
    console.error("Error saving exchange rate:", error)
    return NextResponse.json(
      { error: "Failed to save exchange rates" },
      { status: 500 }
    )
  }
}
