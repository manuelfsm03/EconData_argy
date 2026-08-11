import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      status: "retired",
      reason: "El mapa histórico mezclaba exportaciones verificadas con importaciones estimadas. Use /api/balanza-socios para el ranking exportador trazable.",
    },
    { status: 410 },
  )
}
