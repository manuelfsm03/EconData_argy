/**
 * /api/calendario/fomc — Fechas de reuniones FOMC (Fed) 2026.
 * Dato estático y público (no requiere fetch en vivo): ver fuente citada
 * en src/server/domain/fomc-calendar.ts.
 */

import { NextRequest, NextResponse } from "next/server"
import { FOMC_MEETINGS_2026, fomcMeetingsFrom, FUENTE_FOMC } from "@/server/domain/fomc-calendar"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const soloFuturas = searchParams.get("futuras") === "1"
  const hoy = new Date().toISOString().slice(0, 10)

  const data = soloFuturas ? fomcMeetingsFrom(hoy) : FOMC_MEETINGS_2026

  return NextResponse.json({
    data,
    count: data.length,
    source: FUENTE_FOMC,
    is_live: false,
    nota: "Calendario oficial publicado con antelación por la Fed; no cambia, no requiere fetch en vivo.",
    updated_at: new Date().toISOString(),
  })
}
