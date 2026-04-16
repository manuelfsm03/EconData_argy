import { NextResponse } from "next/server"

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// ── Países de interés ─────────────────────────────────────────────────────────
const PAISES_INTERES = ["ARG", "USA", "BRA", "CHL", "COL", "MEX", "URY", "EUZ", "GBR", "CHN", "IND", "JPN", "ZAF", "TUR", "AUS"]

interface BigMacRow {
  date: string
  iso_a3: string
  name: string
  local_price: number
  dollar_price: number
  dollar_ex: number
  adj_price: number
}

interface BigMacCountry {
  iso: string
  name: string
  local_price: number
  dollar_price: number
  dollar_ex: number
  adj_price: number
  date: string
  subval_pct: number        // (dollar_price / dollar_price_usa - 1) * 100
  adj_subval_pct: number    // ajustado por PBI per cápita
}

function parseCSV(text: string): BigMacRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""))
  const getIdx = (name: string) => headers.indexOf(name)

  const idx = {
    date:         getIdx("date"),
    iso_a3:       getIdx("iso_a3"),
    name:         getIdx("name"),
    local_price:  getIdx("local_price"),
    dollar_price: getIdx("dollar_price"),
    dollar_ex:    getIdx("dollar_ex"),
    adj_price:    getIdx("adj_price"),
  }

  const rows: BigMacRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",")
    const dollar_price = parseFloat(cols[idx.dollar_price])
    if (isNaN(dollar_price) || dollar_price <= 0) continue
    rows.push({
      date:         cols[idx.date]?.trim().replace(/"/g, "") ?? "",
      iso_a3:       cols[idx.iso_a3]?.trim().replace(/"/g, "") ?? "",
      name:         cols[idx.name]?.trim().replace(/"/g, "") ?? "",
      local_price:  parseFloat(cols[idx.local_price]) || 0,
      dollar_price,
      dollar_ex:    parseFloat(cols[idx.dollar_ex]) || 1,
      adj_price:    parseFloat(cols[idx.adj_price]) || 0,
    })
  }
  return rows
}

export async function GET() {
  const cacheKey = "bigmac_main"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    // Fetch CSV de The Economist GitHub
    const csvUrl = "https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv"
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`)

    const csvText = await res.text()
    const rows = parseCSV(csvText)

    // Obtener última fecha disponible
    const ultimaFecha = rows.reduce((max, r) => r.date > max ? r.date : max, "")

    // Filtrar última fecha por país
    const latestByCountry = new Map<string, BigMacRow>()
    for (const row of rows) {
      const existing = latestByCountry.get(row.iso_a3)
      if (!existing || row.date > existing.date) {
        latestByCountry.set(row.iso_a3, row)
      }
    }

    const usaRow = latestByCountry.get("USA")
    if (!usaRow) throw new Error("USA row not found in Big Mac data")

    // Construir ranking de países de interés
    const ranking: BigMacCountry[] = []
    for (const iso of PAISES_INTERES) {
      const row = latestByCountry.get(iso)
      if (!row) continue

      const subval_pct     = ((row.dollar_price / usaRow.dollar_price) - 1) * 100
      const adj_subval_pct = row.adj_price > 0
        ? ((row.adj_price / usaRow.dollar_price) - 1) * 100
        : subval_pct

      ranking.push({
        iso,
        name:          row.name,
        local_price:   row.local_price,
        dollar_price:  row.dollar_price,
        dollar_ex:     row.dollar_ex,
        adj_price:     row.adj_price,
        date:          row.date,
        subval_pct,
        adj_subval_pct,
      })
    }

    // Datos específicos Argentina
    const argRow = latestByCountry.get("ARG")
    const argData = argRow ? {
      local_price:      argRow.local_price,
      dollar_price:     argRow.dollar_price,
      dollar_ex:        argRow.dollar_ex,   // TC implícito Big Mac
      adj_price:        argRow.adj_price,
      subval_pct:       ((argRow.dollar_price / usaRow.dollar_price) - 1) * 100,
      adj_subval_pct:   argRow.adj_price > 0
        ? ((argRow.adj_price / usaRow.dollar_price) - 1) * 100
        : null,
      // TC Big Mac implícito = precio local ARG / precio USD USA
      tc_bigmac:        argRow.local_price / usaRow.dollar_price,
      date:             argRow.date,
    } : null

    // Serie histórica ARG
    const argHistorico = rows
      .filter(r => r.iso_a3 === "ARG" && r.dollar_price > 0)
      .map(r => ({
        date:        r.date,
        dollar_price: r.dollar_price,
        subval_pct:  ((r.dollar_price / (rows.find(u => u.iso_a3 === "USA" && u.date === r.date)?.dollar_price ?? usaRow.dollar_price)) - 1) * 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const result = {
      data: {
        argentina:     argData,
        usa_precio:    usaRow.dollar_price,
        ranking:       ranking.sort((a, b) => a.subval_pct - b.subval_pct),
        historico_arg: argHistorico,
        ultima_fecha:  ultimaFecha,
      },
      updated_at: new Date().toISOString(),
      source: "The Economist Big Mac Index · github.com/TheEconomist/big-mac-data",
      nota: "Datos semestrales · No constituye análisis de inversión",
    }

    setCache(cacheKey, result, 86400) // 24h
    return NextResponse.json(result)
  } catch (err) {
    console.error("Big Mac endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch Big Mac data" }, { status: 500 })
  }
}
