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
      dollar_ex:        argRow.dollar_ex,
      adj_price:        argRow.adj_price,
      subval_pct:       ((argRow.dollar_price / usaRow.dollar_price) - 1) * 100,
      adj_subval_pct:   argRow.adj_price > 0
        ? ((argRow.adj_price / usaRow.dollar_price) - 1) * 100
        : null,
      tc_bigmac:        argRow.local_price / usaRow.dollar_price,
      date:             argRow.date,
    } : null

    // ── Estimación actualizada: mismo precio ARS + TC actual ─────────────────
    let argEstimado: {
      dollar_price_oficial: number
      dollar_price_blue: number
      tc_oficial: number
      tc_blue: number
      subval_pct_oficial: number
      subval_pct_blue: number
      tc_bigmac_implicito: number
      fecha_tc: string
      fecha_precio_base: string
    } | null = null

    if (argRow) {
      try {
        const [resOficial, resBlue] = await Promise.all([
          fetch("https://dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(5000) }),
          fetch("https://dolarapi.com/v1/dolares/blue",    { signal: AbortSignal.timeout(5000) }),
        ])
        if (resOficial.ok && resBlue.ok) {
          const [dOficial, dBlue] = await Promise.all([resOficial.json(), resBlue.json()])
          const tc_oficial = parseFloat(dOficial.venta) || parseFloat(dOficial.compra)
          const tc_blue    = parseFloat(dBlue.venta)    || parseFloat(dBlue.compra)

          if (tc_oficial > 0 && tc_blue > 0) {
            const dp_oficial = argRow.local_price / tc_oficial
            const dp_blue    = argRow.local_price / tc_blue
            argEstimado = {
              dollar_price_oficial: parseFloat(dp_oficial.toFixed(2)),
              dollar_price_blue:    parseFloat(dp_blue.toFixed(2)),
              tc_oficial,
              tc_blue,
              subval_pct_oficial:   parseFloat(((dp_oficial / usaRow.dollar_price - 1) * 100).toFixed(1)),
              subval_pct_blue:      parseFloat(((dp_blue    / usaRow.dollar_price - 1) * 100).toFixed(1)),
              tc_bigmac_implicito:  parseFloat((argRow.local_price / usaRow.dollar_price).toFixed(0)),
              fecha_tc:             new Date().toISOString().slice(0, 10),
              fecha_precio_base:    argRow.date,
            }
          }
        }
      } catch {
        // estimado no disponible, continuar sin él
      }
    }

    // Serie histórica ARG + punto estimado hoy
    const usaPriceByDate = new Map(rows.filter(r => r.iso_a3 === "USA").map(r => [r.date, r.dollar_price]))
    const argHistorico = rows
      .filter(r => r.iso_a3 === "ARG" && r.dollar_price > 0)
      .map(r => ({
        date:         r.date,
        dollar_price: r.dollar_price,
        subval_pct:   ((r.dollar_price / (usaPriceByDate.get(r.date) ?? usaRow.dollar_price)) - 1) * 100,
        estimado:     false,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Agregar punto estimado con TC oficial si está disponible
    if (argEstimado) {
      argHistorico.push({
        date:         argEstimado.fecha_tc,
        dollar_price: argEstimado.dollar_price_oficial,
        subval_pct:   argEstimado.subval_pct_oficial,
        estimado:     true,
      })
    }

    const result = {
      data: {
        argentina:      argData,
        argentina_est:  argEstimado,
        usa_precio:     usaRow.dollar_price,
        ranking:        ranking.sort((a, b) => a.subval_pct - b.subval_pct),
        historico_arg:  argHistorico,
        ultima_fecha:   ultimaFecha,
      },
      updated_at: new Date().toISOString(),
      source: "The Economist Big Mac Index · github.com/TheEconomist/big-mac-data",
      nota: "Datos semestrales · Estimación actualizada con TC oficial dolarapi.com · No constituye análisis de inversión",
    }

    setCache(cacheKey, result, 3600) // 1h para que el TC se refresque
    return NextResponse.json(result)
  } catch (err) {
    console.error("Big Mac endpoint error:", err)
    return NextResponse.json({ error: "Failed to fetch Big Mac data" }, { status: 500 })
  }
}
