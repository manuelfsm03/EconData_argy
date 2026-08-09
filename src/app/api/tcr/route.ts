import { NextResponse } from "next/server"
import { bcraOfficialApi } from "@/lib/bcra-official-api"

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// ── BCRA: Variables TCR ───────────────────────────────────────────────────────
// Variable 5  = ITCRM Multilateral
// Variable 6  = ITCR vs USD
// Variable 7  = ITCR vs BRL (Brasil)
// Variable 8  = ITCR vs EUR (Europa)
// Nota: Los ids de BCRA API v4.0 para ITCRM pueden variar —
//       se busca en estadísticas de tipo de cambio real

const TCR_VARIABLES = {
  itcrm: 5,   // ITCRM multilateral
  usd:   6,   // ITCR bilateral USD
  brl:   7,   // ITCR bilateral BRL
  eur:   8,   // ITCR bilateral EUR
}

async function fetchTCRVar(idVariable: number, from: string): Promise<{ fecha: string; valor: number }[]> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const data = await bcraOfficialApi.getSeriesData(idVariable, from, today, 2000)
    return data
      .map(p => ({ fecha: p.fecha, valor: p.valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch {
    return []
  }
}

// Fallback: fetch desde datos.gob.ar serie del BCRA para TCR
async function fetchTCRFallback(): Promise<{ fecha: string; itcrm: number }[]> {
  // Serie ID 174.1_ITCRM_2010_D_23 — ITCRM base dic 2010
  const url = "https://apis.datos.gob.ar/series/api/series/?ids=174.1_ITCRM_2010_D_23&limit=5000&format=json"
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } })
  if (!res.ok) return []
  const json = await res.json()
  if (!json.data) return []
  return (json.data as [string, number | null][])
    .filter(r => r[1] != null)
    .map(r => ({ fecha: r[0], itcrm: r[1] as number }))
}

export async function GET() {
  const cacheKey = "tcr_main"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const from3y = (() => {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 3)
      return d.toISOString().slice(0, 10)
    })()

    // Intentar BCRA API
    const [itcrmData, usdData, brlData, eurData] = await Promise.all([
      fetchTCRVar(TCR_VARIABLES.itcrm, from3y),
      fetchTCRVar(TCR_VARIABLES.usd,   from3y),
      fetchTCRVar(TCR_VARIABLES.brl,   from3y),
      fetchTCRVar(TCR_VARIABLES.eur,   from3y),
    ])

    // Si BCRA API no devuelve ITCRM, usar fallback datos.gob.ar
    let itcrm = itcrmData
    if (itcrm.length === 0) {
      const fallback = await fetchTCRFallback().catch(() => [])
      itcrm = fallback.map(r => ({ fecha: r.fecha, valor: r.itcrm }))
    }

    // Merge para gráfico con las 4 series
    const merged: Record<string, Record<string, number>> = {}
    const addSerie = (arr: { fecha: string; valor: number }[], key: string) => {
      for (const r of arr) {
        merged[r.fecha] = { ...(merged[r.fecha] ?? {}), [key]: r.valor }
      }
    }
    addSerie(itcrm,   "ITCRM")
    addSerie(usdData, "ITCR-USD")
    addSerie(brlData, "ITCR-BRL")
    addSerie(eurData, "ITCR-EUR")

    const serie = Object.entries(merged)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => ({ fecha, ...vals }))

    // KPIs: último valor + variación mensual
    const ultItcrm     = itcrm.at(-1)
    const penUltItcrm  = itcrm.at(-2)
    const hace30       = itcrm.length > 22 ? itcrm.at(-22) : null // ~1 mes de días hábiles

    const itcrmActual  = ultItcrm?.valor ?? null
    const itcrmVarMes  = itcrmActual && hace30 ? ((itcrmActual / hace30.valor) - 1) * 100 : null
    const itcrUsd      = usdData.at(-1)?.valor ?? null
    const itcrBrl      = brlData.at(-1)?.valor ?? null

    const result = {
      data: {
        serie,
        kpis: {
          itcrm:         itcrmActual,
          itcrm_var_mes: itcrmVarMes,
          itcr_usd:      itcrUsd,
          itcr_brl:      itcrBrl,
          fecha:         ultItcrm?.fecha ?? null,
        },
        fuentes: { itcrm, usd: usdData, brl: brlData, eur: eurData },
      },
      updated_at: new Date().toISOString(),
      source: "BCRA API v4.0 (Variables 5,6,7,8) + datos.gob.ar fallback",
    }

    setCache(cacheKey, result, 3600)
    return NextResponse.json(result)
  } catch (err) {
    console.error("TCR endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch TCR data" }, { status: 500 })
  }
}
