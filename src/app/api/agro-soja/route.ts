import { fetchRegistered } from "@/server/http/fetch-source"
import { NextResponse } from "next/server"

// Datos de OWID son anuales; 7 días de caché no pierde nada relevante
const CACHE = "public, s-maxage=604800, stale-while-revalidate=1209600"

const OWID_URL = "https://ourworldindata.org/grapher/soybean-production.csv?tab=chart"

const COUNTRIES = [
  "Brazil", "Argentina", "United States", "China",
  "Paraguay", "India", "Bolivia", "Indonesia", "Canada",
]

export async function GET() {
  try {
    const res = await fetchRegistered(OWID_URL, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`OWID HTTP ${res.status}`)

    const text = await res.text()
    const lines = text.trim().split("\n")
    if (lines.length < 2) throw new Error("CSV vacío")

    // Columnas: Entity, Code, Year, Soybean production (tonnes)
    const byYear: Record<string, Record<string, unknown>> = {}

    for (const line of lines.slice(1)) {
      const parts = line.split(",")
      const entity = parts[0]?.replace(/"/g, "").trim() ?? ""
      if (!COUNTRIES.includes(entity)) continue
      const year = parts[2]?.trim() ?? ""
      const tonnes = parseFloat(parts[3]?.trim() ?? "")
      if (!year || isNaN(tonnes)) continue
      if (!byYear[year]) byYear[year] = { date: `${year}-01-01` }
      // Convertir a millones de toneladas (igual que hacía el frontend)
      byYear[year][entity] = parseFloat((tonnes / 1_000_000).toFixed(2))
    }

    const data = Object.values(byYear).sort(
      (a, b) => (a.date as string).localeCompare(b.date as string)
    )

    return NextResponse.json(
      { data, source: "Our World in Data / FAO", unit: "millones de toneladas" },
      { headers: { "Cache-Control": CACHE } }
    )
  } catch (err) {
    console.error("[agro-soja] Error OWID:", err)
    return NextResponse.json({ error: "No se pudo obtener datos de producción de soja" }, { status: 502 })
  }
}
