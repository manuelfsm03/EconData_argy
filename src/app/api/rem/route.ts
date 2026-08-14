/**
 * REM — Relevamiento de Expectativas de Mercado (BCRA)
 * Excel mensual BCRA. Extrae: medianas + top-10 instituciones para inflación 12M.
 */
import { NextResponse } from "next/server"
import { fetchRemExcel, parseRemExcel } from "@/server/domain/rem-data"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
  const cacheKey = "rem_v4"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const buf = await fetchRemExcel()
    const { serie, participantes } = parseRemExcel(buf)
    const ultimo = serie.at(-1)

    const result = {
      data: {
        serie,
        participantes,
        ultimo: ultimo ?? null,
        kpis: {
          inflacion_12m:  ultimo?.inflacion_12m  ?? null,
          inflacion_24m:  ultimo?.inflacion_24m  ?? null,
          nucleo_12m:     ultimo?.nucleo_12m     ?? null,
          dolar_12m:      ultimo?.dolar_12m      ?? null,
          tasa_12m:       ultimo?.tasa_12m       ?? null,
          tasa_real_12m:  ultimo?.tasa_real_12m  ?? null,
          fecha:          ultimo?.fecha          ?? null,
        },
      },
      updated_at: new Date().toISOString(),
      source: "BCRA — Relevamiento de Expectativas de Mercado",
    }

    setCache(cacheKey, result, 14400)
    return NextResponse.json(result)
  } catch (err) {
    console.error("REM endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch REM data" }, { status: 500 })
  }
}
