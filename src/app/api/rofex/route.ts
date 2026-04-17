/**
 * /api/rofex — Futuros de dólar ROFEX
 *
 * Fuente primaria: Matba Rofex API pública
 *   https://apicem.matbarofex.com.ar/api/v2/closing-prices?market=ROFX&product=DLR
 *
 * Fuente secundaria: Prisma DB (poblada por cron scraping)
 *
 * Cálculos:
 *   devaluation (acumulada) = (precio / spot - 1) × 100
 *   monthlyDevaluation = devaluation / meses_al_vto
 *   tna = ((precio / spot)^(365 / dias_al_vto) - 1) × 100
 *   cft = tna (sin impuestos — mismo que tna en este contexto)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const MATBA_URL = "https://apicem.matbarofex.com.ar/api/v2/closing-prices?market=ROFX&product=DLR"

// In-memory cache (TTL 5 min)
let _cache: { data: RofexRow[]; expiry: number } | null = null

interface MatbaRow {
  symbol: string
  trade_date?: string
  settlement_date?: string
  settlement?: string | null
  last?: number | null
  close?: number | null
  open_interest?: number | null
  volume?: number | null
  // may have other fields
  [key: string]: unknown
}

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
  source: "matba" | "db"
}

function parseMatbaSymbol(symbol: string): { label: string; maturityDate: string } | null {
  // e.g. "DLR/ABR26" → abril 2026
  const MONTHS: Record<string, string> = {
    ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
  }
  const m = symbol.match(/DLR\/([A-Z]{3})(\d{2})/i)
  if (!m) return null
  const mon = m[1].toUpperCase()
  const yr = `20${m[2]}`
  const monNum = MONTHS[mon]
  if (!monNum) return null
  // Vencimiento: tercer viernes del mes (aproximado: día 21)
  const maturityDate = `${yr}-${monNum}-21`
  return { label: `${m[1].toUpperCase()} ${yr}`, maturityDate }
}

async function fetchFromMatba(): Promise<RofexRow[] | null> {
  try {
    const res = await fetch(MATBA_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null

    const json = await res.json()
    // La respuesta puede ser { data: [...] } o directamente [...]
    const rows: MatbaRow[] = Array.isArray(json) ? json : (json?.data ?? json?.results ?? [])
    if (!rows.length) return null

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // Spot = primer contrato (más cercano) o buscar "spot" explícito
    // Usamos el precio mínimo entre futuros < 10% del último como proxy spot
    const prices = rows.map(r => Number(r.last ?? r.close ?? 0)).filter(p => p > 0)
    const spot = prices.length ? Math.min(...prices) : null
    if (!spot) return null

    const result: RofexRow[] = []

    for (const row of rows) {
      const parsed = parseMatbaSymbol(row.symbol)
      if (!parsed) continue

      const price = Number(row.last ?? row.close ?? 0)
      if (!price || price <= 0) continue

      const maturityDate = parsed.maturityDate
      const matDate = new Date(maturityDate)
      const diasAlVto = Math.max(1, Math.round((matDate.getTime() - today.getTime()) / 86_400_000))
      const mesesAlVto = diasAlVto / 30

      const devaluation = ((price / spot) - 1) * 100
      const monthlyDevaluation = mesesAlVto > 0 ? devaluation / mesesAlVto : 0
      // TNA anualizada: (precio/spot)^(365/dias) - 1
      const tna = (Math.pow(price / spot, 365 / diasAlVto) - 1) * 100

      result.push({
        id: row.symbol,
        date: todayStr,
        position: row.symbol,
        maturity: maturityDate,
        maturityLabel: parsed.label,
        price,
        devaluation: parseFloat(devaluation.toFixed(2)),
        monthlyDevaluation: parseFloat(monthlyDevaluation.toFixed(2)),
        tna: parseFloat(tna.toFixed(2)),
        cft: parseFloat(tna.toFixed(2)),
        volume: row.volume != null ? Number(row.volume) : null,
        openInterest: row.open_interest != null ? Number(row.open_interest) : null,
        source: "matba",
      })
    }

    return result.sort((a, b) => a.maturity.localeCompare(b.maturity))
  } catch (e) {
    console.warn("[rofex] Matba API falló:", e)
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
    return futures.map(f => ({
      id: f.id,
      date: f.date.toISOString().slice(0, 10),
      position: f.position,
      maturity: f.maturity.toISOString().slice(0, 10),
      maturityLabel: f.maturityLabel,
      price: f.price,
      devaluation: f.devaluation,
      monthlyDevaluation: f.monthlyDevaluation,
      tna: f.tna,
      cft: f.cft,
      volume: null,
      openInterest: null,
      source: "db" as const,
    }))
  } catch {
    return []
  }
}

export async function GET(_req: NextRequest) {
  // Serve from cache
  if (_cache && _cache.expiry > Date.now()) {
    return NextResponse.json(_cache.data)
  }

  // Try Matba first, fall back to DB
  const matba = await fetchFromMatba()
  const data = matba?.length ? matba : await fetchFromDB()

  if (data.length) {
    _cache = { data, expiry: Date.now() + 300_000 } // 5 min
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const toMidnight = (d: string) => { const dt = new Date(d); dt.setUTCHours(0,0,0,0); return dt }

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
    _cache = null // invalidar cache
    return NextResponse.json(future)
  } catch (error) {
    console.error("[rofex POST]", error)
    return NextResponse.json({ error: "Failed to save Rofex data" }, { status: 500 })
  }
}
