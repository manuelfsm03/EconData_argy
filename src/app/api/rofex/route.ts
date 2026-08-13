import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/rofex — Futuros de dólar ROFEX
 *
 * Fuente primaria: Rava JSON público, filtrado a especies DLR canónicas,
 * vigentes y con cotización reciente. La API Matba configurada anteriormente
 * devolvía por defecto una página histórica de 2020 con esquema incompatible.
 *
 * No se calcula devaluación/TNA sin un spot mayorista compatible y medido.
 */

import { NextRequest, NextResponse } from "next/server"
import { parseRavaDlrFutures } from "@/server/domain/rofex-rava"
import { prisma } from "@/server/db/prisma"
import { requireAdminAuthorization } from "@/server/api/admin-auth"

export const runtime = "nodejs"

const RAVA_URL = "https://mercado.rava.com/api/prices/arg"
let cache: { data: RofexRow[]; expiry: number } | null = null

interface RofexRow {
  id: string
  date: string
  position: string
  maturity: string
  maturityLabel: string | null
  price: number | null
  devaluation: number | null
  monthlyDevaluation: number | null
  tna: number | null
  cft: number | null
  volume: number | null
  openInterest: number | null
  source: "rava" | "db"
  priceType?: "last" | "bid_ask_mid"
}

async function fetchFromRava(): Promise<RofexRow[] | null> {
  try {
    const response = await fetchRegistered(RAVA_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      next: { revalidate: 300 },
    })
    if (!response.ok) return null

    const payload = await response.json()
    const rawRows = Array.isArray(payload) ? payload : payload?.datos
    if (!Array.isArray(rawRows)) return null

    const asOfDate = new Date().toISOString().slice(0, 10)
    const futures = parseRavaDlrFutures(rawRows, asOfDate, 7)
    if (futures.length === 0) return null

    return futures.map(future => ({
      id: future.symbol,
      date: future.quoteDate,
      position: future.symbol,
      maturity: future.maturity,
      maturityLabel: future.label,
      price: future.price,
      devaluation: null,
      monthlyDevaluation: null,
      tna: null,
      cft: null,
      volume: null,
      openInterest: null,
      source: "rava",
      priceType: future.priceType,
    }))
  } catch (error) {
    console.warn("[rofex] Rava API falló:", error)
    return null
  }
}

async function fetchFromDB(): Promise<RofexRow[]> {
  try {
    const latest = await prisma.rofexFuture.findFirst({ orderBy: { date: "desc" } })
    if (!latest) return []
    const futures = await prisma.rofexFuture.findMany({
      where: { date: latest.date },
      orderBy: { maturity: "asc" },
    })
    return futures.map(future => ({
      id: future.id,
      date: future.date.toISOString().slice(0, 10),
      position: future.position,
      maturity: future.maturity.toISOString().slice(0, 10),
      maturityLabel: future.maturityLabel,
      price: future.price,
      devaluation: future.devaluation,
      monthlyDevaluation: future.monthlyDevaluation,
      tna: future.tna,
      cft: future.cft,
      volume: null,
      openInterest: null,
      source: "db" as const,
    }))
  } catch {
    return []
  }
}

export async function GET() {
  if (cache && cache.expiry > Date.now()) return NextResponse.json(cache.data)

  const live = await fetchFromRava()
  const data = live?.length ? live : await fetchFromDB()
  if (data.length) cache = { data, expiry: Date.now() + 300_000 }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized
  try {
    const body = await request.json()
    const toMidnight = (date: string) => {
      const parsed = new Date(date)
      parsed.setUTCHours(0, 0, 0, 0)
      return parsed
    }

    const future = await prisma.rofexFuture.upsert({
      where: { date_position: { date: toMidnight(body.date), position: body.position } },
      update: {
        maturity: new Date(body.maturity),
        maturityLabel: body.maturityLabel,
        price: body.price,
        devaluation: body.devaluation,
        monthlyDevaluation: body.monthlyDevaluation,
        tna: body.tna,
        cft: body.cft,
      },
      create: {
        date: toMidnight(body.date),
        position: body.position,
        maturity: new Date(body.maturity),
        maturityLabel: body.maturityLabel,
        price: body.price,
        devaluation: body.devaluation,
        monthlyDevaluation: body.monthlyDevaluation,
        tna: body.tna,
        cft: body.cft,
      },
    })
    cache = null
    return NextResponse.json(future)
  } catch (error) {
    console.error("[rofex POST]", error)
    return NextResponse.json({ error: "Failed to save Rofex data" }, { status: 500 })
  }
}
