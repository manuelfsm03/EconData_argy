import { NextResponse } from "next/server"

// La curva del Tesoro se publica una vez por día en días hábiles
// 12h de caché es razonable sin perder frescura
const CACHE = "public, s-maxage=43200, stale-while-revalidate=86400"

const MATURITIES = [
  { label: "1M",  field: "1 Mo"  },
  { label: "2M",  field: "2 Mo"  },
  { label: "3M",  field: "3 Mo"  },
  { label: "4M",  field: "4 Mo"  },
  { label: "6M",  field: "6 Mo"  },
  { label: "1Y",  field: "1 Yr"  },
  { label: "2Y",  field: "2 Yr"  },
  { label: "3Y",  field: "3 Yr"  },
  { label: "5Y",  field: "5 Yr"  },
  { label: "7Y",  field: "7 Yr"  },
  { label: "10Y", field: "10 Yr" },
  { label: "20Y", field: "20 Yr" },
  { label: "30Y", field: "30 Yr" },
]

export async function GET() {
  const year = new Date().getFullYear()
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
    `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&csv=true`

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Treasury HTTP ${res.status}`)

    const csv = await res.text()
    const lines = csv.trim().split("\n")
    if (lines.length < 2) throw new Error("CSV vacío")

    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""))
    const lastLine = lines[lines.length - 1].split(",").map(v => v.trim().replace(/"/g, ""))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = lastLine[i] })

    const date = row["Date"] ?? null
    const curve = MATURITIES.map(m => {
      const val = parseFloat(row[m.field] ?? "")
      return { label: m.label, yield: isNaN(val) ? null : val }
    }).filter(p => p.yield !== null)

    return NextResponse.json(
      { date, curve },
      { headers: { "Cache-Control": CACHE } }
    )
  } catch (err) {
    console.error("UST curve error:", err)
    return NextResponse.json({ error: "No se pudo obtener la curva del Tesoro" }, { status: 502 })
  }
}
