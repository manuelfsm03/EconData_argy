/**
 * /api/owid — Datos históricos largos de Our World in Data
 * Fuente: CSVs de GitHub OWID (sin auth, CC-BY)
 * Endpoints:
 *   GET /api/owid?dataset=gdp_long    — GDP per cápita largo (Maddison)
 *   GET /api/owid?dataset=energy      — Energía por país (producción, matriz)
 *   GET /api/owid?dataset=oil         — Producción petróleo (serie larga)
 *   GET /api/owid?dataset=poverty     — Pobreza y Gini
 */

import { NextRequest, NextResponse } from "next/server"
import { fetchOWIDCSV } from "@/server/sources/owid-csv-fetcher"

const OWID_CONFIGS: Record<
  string,
  {
    url: string
    countries: string[]
    columns: string[]
    source: string
  }
> = {
  gdp_long: {
    url: "https://ourworldindata.org/grapher/gdp-per-capita-worldbank-constant-usd.csv?tab=table&country=ARG~BRA~CHL~AUS~ESP~USA~CAN~MEX~COL~DEU",
    countries: [
      "Argentina",
      "Brazil",
      "Chile",
      "Australia",
      "Spain",
      "United States",
      "Canada",
      "Mexico",
      "Colombia",
      "Germany",
    ],
    columns: ["GDP per capita (constant 2011 US-$)"],
    source: "World Bank + Maddison Project Database via OWID",
  },
  oil: {
    url: "https://ourworldindata.org/grapher/oil-production-by-country.csv?tab=table&country=ARG~BRA~USA~SAU~RUS~VEN~NOR~AUS",
    countries: ["Argentina", "Brazil", "United States", "Saudi Arabia", "Russia", "Venezuela", "Norway", "Australia"],
    columns: ["Oil production"],
    source: "Energy Institute Statistical Review via OWID",
  },
  energy: {
    url: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv",
    countries: ["Argentina", "Brazil", "United States", "China", "Germany"],
    columns: [
      "Oil production (TWh)",
      "Gas production (TWh)",
      "Renewables share of energy",
      "Fossil fuels share of energy",
      "Energy per capita",
    ],
    source: "Energy Institute + Ember via OWID",
  },
  poverty: {
    url: "https://raw.githubusercontent.com/owid/poverty-data/main/datasets/pip_dataset.csv",
    countries: ["Argentina", "Brazil", "Chile", "Mexico", "Colombia"],
    columns: ["gini", "headcount_ratio_international_povline", "mean"],
    source: "World Bank PIP via OWID",
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dataset = searchParams.get("dataset") ?? "gdp_long"

  try {
    const config = OWID_CONFIGS[dataset]
    if (!config) {
      return NextResponse.json(
        {
          error: `Dataset no válido. Usar: ${Object.keys(OWID_CONFIGS).join(", ")}`,
        },
        { status: 400 }
      )
    }

    const data = await fetchOWIDCSV(config.url, `owid_${dataset}`, config.countries, config.columns)
    return NextResponse.json({
      data,
      dataset,
      updated_at: new Date().toISOString(),
      source: config.source,
    })
  } catch (error) {
    console.error("[/api/owid]", error)
    return NextResponse.json(
      { error: "Error fetching OWID data", detail: String(error) },
      { status: 500 }
    )
  }
}
