/**
 * /api/rofex — Futuros de dólar ROFEX
 *
 * Fuente primaria: mercado.rava.com/api/prices/arg — JSON público sin
 * autenticación (panel gratuito "Rava Mercado"), filtrado a especies con
 * securitytype "FUT" y símbolo "DLR/MMMYY" (mismo formato que usaba la vieja
 * API de Matba). El endpoint público viejo de Matba
 * (apicem.matbarofex.com.ar) está congelado desde enero 2020 — devolvía datos
 * reales pero solo hasta esa fecha.
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

const RAVA_ARG_URL = "https://mercado.rava.com/api/prices/arg"

// In-memory cache (TTL 5 min)
let _cache: { data: RofexRow[]; expiry: number } | null = null

interface RavaRow {
  especie: string
  simbolo: string
  securitytype: string
  ultimo: string
  volnominal?: string
  fecha: string
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
  source: "rava" | "db"
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
    const res = await fetch(RAVA_ARG_URL, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 PanelDeControl/2.0" },
    })
    if (!res.ok) return null

    const json = await res.json()
    const allRows: RavaRow[] = json?.datos ?? []
    // Símbolo "DLR/MMMYY" exacto (sin variantes tipo DLR/ABR26A o DLR/ABR26M)
    const rows = allRows.filter(r => r.securitytype === "FUT" && /^DLR\/[A-Z]{3}\d{2}$/.test(r.simbolo))
    if (!rows.length) return null

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // Solo contratos vigentes (no vencidos) para spot y para el resultado
    const vigentes = rows
      .map(row => ({ row, parsed: parseMatbaSymbol(row.simbolo), price: Number(row.ultimo) }))
      .filter((r): r is { row: RavaRow; parsed: { label: string; maturityDate: string }; price: number } =>
        r.parsed != null && r.price > 0 && new Date(r.parsed.maturityDate) >= today
      )
    if (!vigentes.length) return null

    // Spot = precio del contrato más cercano a vencer (proxy, igual que antes)
    const spot = Math.min(...vigentes.map(r => r.price))
    if (!spot) return null

    const result: RofexRow[] = vigentes.map(({ row, parsed, price }) => {
      const matDate = new Date(parsed.maturityDate)
      const diasAlVto = Math.max(1, Math.round((matDate.getTime() - today.getTime()) / 86_400_000))
      const mesesAlVto = diasAlVto / 30

      const devaluation = ((price / spot) - 1) * 100
      const monthlyDevaluation = mesesAlVto > 0 ? devaluation / mesesAlVto : 0
      const tna = (Math.pow(price / spot, 365 / diasAlVto) - 1) * 100

      return {
        id: row.simbolo,
        date: todayStr,
        position: row.simbolo,
        maturity: parsed.maturityDate,
        maturityLabel: parsed.label,
        price,
        devaluation: parseFloat(devaluation.toFixed(2)),
        monthlyDevaluation: parseFloat(monthlyDevaluation.toFixed(2)),
        tna: parseFloat(tna.toFixed(2)),
        cft: parseFloat(tna.toFixed(2)),
        volume: row.volnominal != null ? Number(row.volnominal) : null,
        openInterest: null,
        source: "rava" as const,
      }
    })

    return result.sort((a, b) => a.maturity.localeCompare(b.maturity))
  } catch (e) {
    console.warn("[rofex] fetch mercado.rava.com falló:", e)
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
