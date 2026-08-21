import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { toMidnightUTC } from "@/lib/dates"
import { requireAdminAuthorization } from "@/server/api/admin-auth"
import { fetchRegistered } from "@/server/http/fetch-source"
import { leerFresco, guardarExito, leerUltimoBueno } from "@/server/http/stale-cache"

// Fuente secundaria de inflación: argentinadatos.com
const SECONDARY_URL = "https://api.argentinadatos.com/v1/finanzas/indices/inflacion"

interface ArgentinaDatosInflacion {
  fecha: string
  valor: number
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "24")
  const offset = parseInt(searchParams.get("offset") || "0")

  const cacheKey = `inflation:${limit}:${offset}`

  // Nivel 1 — fresco: dentro del TTL, sin ir a la fuente
  const fresco = leerFresco<unknown[]>(cacheKey)
  if (fresco) return NextResponse.json(fresco)

  try {
    // Fuente primaria: Prisma DB
    const inflation = await prisma.inflation.findMany({
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    if (inflation.length > 0) {
      guardarExito(cacheKey, inflation, 1800) // 30 min de TTL fresco
      return NextResponse.json(inflation)
    }

    // DB vacía para este rango → intentar fuente secundaria
    throw new Error("PRISMA_EMPTY_RESULT")
  } catch (error) {
    console.error("Error fetching inflation data (primary):", error)

    // Fuente secundaria: argentinadatos.com — array de {fecha, valor} (variación mensual %)
    try {
      const res = await fetchRegistered(SECONDARY_URL, {
        headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const raw: ArgentinaDatosInflacion[] = await res.json()
        if (raw.length > 0) {
          // Parsear al mismo shape que Prisma (campos no disponibles → null)
          const parsed = raw
            .sort((a, b) => (a.fecha > b.fecha ? -1 : 1)) // desc, igual que Prisma
            .slice(offset, offset + limit)
            .map((item, idx) => ({
              id: -(idx + 1 + offset), // ID sintético negativo para distinguir de DB
              date: new Date(item.fecha + "T00:00:00.000Z"),
              monthly: item.valor,
              yearToDate: null,
              interannual: null,
              accumulated: null,
            }))
          if (parsed.length > 0) {
            guardarExito(cacheKey, parsed, 1800)
            return NextResponse.json(parsed)
          }
        }
      }
    } catch (secondaryError) {
      console.error("Error fetching inflation data (secondary):", secondaryError)
    }

    // Nivel 2 — stale: último dato bueno sin importar antigüedad
    const stale = leerUltimoBueno<unknown[]>(cacheKey)
    if (stale) {
      return NextResponse.json(stale.data, {
        headers: { "X-Data-Source": "stale-cache", "X-Stale-Since": stale.staleSince },
      })
    }

    return NextResponse.json(
      { error: { code: "SOURCE_UNAVAILABLE", message: "Inflation data unavailable", retryable: true } },
      { status: 503 },
    )
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized
  try {
    const data = await request.json()

    const inflation = await prisma.inflation.upsert({
      where: { date: toMidnightUTC(data.date) },
      update: {
        monthly: data.monthly,
        yearToDate: data.yearToDate,
        interannual: data.interannual,
        accumulated: data.accumulated,
      },
      create: {
        date: toMidnightUTC(data.date),
        monthly: data.monthly,
        yearToDate: data.yearToDate,
        interannual: data.interannual,
        accumulated: data.accumulated,
      },
    })

    return NextResponse.json(inflation)
  } catch (error) {
    console.error("Error saving inflation data:", error)
    return NextResponse.json(
      { error: "Failed to save inflation data" },
      { status: 500 }
    )
  }
}
