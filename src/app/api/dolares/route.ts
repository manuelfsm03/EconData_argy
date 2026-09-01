import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"


interface DolarAPIResponse {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

interface BluelyticsEvolution {
  date: string
  source: string
  value_sell: number
  value_buy: number
}


// Real-time dollar rates from DolarAPI + historical variation
export async function GET() {
  try {
    // Fetch current rates and historical data in parallel
    const [dolarApiRes, bluelyticsRes] = await Promise.all([
      fetchRegistered("https://dolarapi.com/v1/dolares", {
        headers: { "User-Agent": "PanelDeControl/1.0" },
        next: { revalidate: 60 },
      }),
      fetchRegistered("https://api.bluelytics.com.ar/v2/evolution.json?days=7", {
        headers: { "User-Agent": "PanelDeControl/1.0" },
        next: { revalidate: 300 },
      }),
    ])

    if (!dolarApiRes.ok) {
      throw new Error(`DolarAPI returned ${dolarApiRes.status}`)
    }

    const data: DolarAPIResponse[] = await dolarApiRes.json()
    
    // Parse historical data for variation calculation
    const previousRates: Record<string, { compra: number; venta: number }> = {}
    if (bluelyticsRes.ok) {
      const evolution: BluelyticsEvolution[] = await bluelyticsRes.json()
      const today = new Date().toISOString().split('T')[0]
      
      // Group by source and get yesterday's values
      const bySource: Record<string, BluelyticsEvolution[]> = {}
      for (const item of evolution) {
        if (!bySource[item.source]) bySource[item.source] = []
        bySource[item.source].push(item)
      }
      
      for (const [source, items] of Object.entries(bySource)) {
        // Sort by date desc and find first entry that's not today
        const sorted = items.sort((a, b) => b.date.localeCompare(a.date))
        const yesterday = sorted.find(i => i.date !== today)
        if (yesterday) {
          const key = source.toLowerCase()
          previousRates[key] = { compra: yesterday.value_buy, venta: yesterday.value_sell }
        }
      }
    }

    // Transform to cleaner format with variation
    const rates: Record<string, {
      compra: number
      venta: number
      nombre: string
      actualizacion: string
      variacion: number | null
    }> = {}

    const nameMap: Record<string, string> = {
      blue: "Blue",
      oficial: "Oficial",
      bolsa: "MEP",
      contadoconliqui: "CCL",
      mayorista: "Mayorista",
      cripto: "Cripto",
      tarjeta: "Tarjeta/Solidario",
    }

    for (const item of data) {
      const key = item.casa
      const prevKey = key === "bolsa" ? "mep" : key === "contadoconliqui" ? "ccl" : key
      const prev = previousRates[prevKey]
      
      let variacion: number | null = null
      if (prev && prev.venta > 0) {
        variacion = ((item.venta - prev.venta) / prev.venta) * 100
      }

      rates[key] = {
        compra: item.compra,
        venta: item.venta,
        nombre: nameMap[key] || item.nombre,
        actualizacion: item.fechaActualizacion,
        variacion,
      }
    }

    // Calculate spreads
    const oficial = rates.oficial?.venta || 0
    const blue = rates.blue?.venta || 0
    const mep = rates.bolsa?.venta || 0
    const ccl = rates.contadoconliqui?.venta || 0

    const spreads = {
      brechaBlueOficial: oficial ? ((blue - oficial) / oficial) * 100 : null,
      brechaMepOficial: oficial ? ((mep - oficial) / oficial) * 100 : null,
      brechaCclOficial: oficial ? ((ccl - oficial) / oficial) * 100 : null,
      brechaCclMep: mep ? ((ccl - mep) / mep) * 100 : null,
    }


    const asOf = Object.values(rates)
      .map((rate) => rate.actualizacion)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
    const source = "DolarAPI"

    return NextResponse.json({
      success: true,
      source,
      timestamp: asOf,
      as_of: asOf,
      checked_at: new Date().toISOString(),
      rates,
      spreads,
    }, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
        "X-Data-Source": source,
        ...(asOf ? { "X-Data-As-Of": asOf } : {}),
        "X-Data-Freshness": "fresh",
      },
    })
  } catch (error) {
    console.error("Error fetching dollar rates:", error)
    
    // Try fallback
    try {
      const fallback = await fetchRegistered("https://api.bluelytics.com.ar/v2/latest")
      if (fallback.ok) {
        const data = await fallback.json()
        const asOf = typeof data.last_update === "string" ? data.last_update : null
        const source = "Bluelytics"
        return NextResponse.json({
          success: true,
          source,
          timestamp: asOf,
          as_of: asOf,
          checked_at: new Date().toISOString(),
          rates: {
            blue: { compra: data.blue.value_buy, venta: data.blue.value_sell, nombre: "Blue", actualizacion: asOf, variacion: null },
            oficial: { compra: data.oficial.value_buy, venta: data.oficial.value_sell, nombre: "Oficial", actualizacion: asOf, variacion: null },
          },
          spreads: {
            brechaBlueOficial: ((data.blue.value_sell - data.oficial.value_sell) / data.oficial.value_sell) * 100,
          },
        }, {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
            "X-Data-Source": source,
            ...(asOf ? { "X-Data-As-Of": asOf } : {}),
            "X-Data-Freshness": asOf ? "fresh" : "unknown",
          },
        })
      }
    } catch {
      // Fallback also failed
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch rates" },
      { status: 500 }
    )
  }
}
