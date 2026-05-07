import { NextResponse } from "next/server"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(key: string) {
  const e = cache.get(key)
  if (e && Date.now() < e.expiry) return e.data
  return null
}
function setCache(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

const EXCEL_URL =
  "https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/InfBanc_Anexo.xlsx"

function xlSerialToYearMonth(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    .toISOString()
    .slice(0, 7)
}

function v(row: (number | null | string)[] | undefined, col: number): number {
  if (!row) return 0
  const val = row[col]
  return typeof val === "number" && isFinite(val) ? val : 0
}

async function getBancosBalance() {
  const cacheKey = "bancos_balance"
  const cached = getCache(cacheKey)
  if (cached) return cached

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx")

  const res = await fetch(EXCEL_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error(`Excel download failed: ${res.status}`)

  const buf = Buffer.from(await res.arrayBuffer())
  const wb = XLSX.read(buf, { type: "buffer" })
  const ws = wb.Sheets["Estado de Sit. Financiera"]
  const rows = XLSX.utils.sheet_to_json<(number | string | null)[]>(ws, {
    header: 1,
    defval: null,
  }) as (number | string | null)[][]

  // Row 3 has the date serials in columns 1..N
  const dateRow = rows[3] ?? []
  const dates: { idx: number; fecha: string }[] = []
  for (let i = 1; i < dateRow.length; i++) {
    const d = dateRow[i]
    if (typeof d === "number" && d > 30000) {
      dates.push({ idx: i, fecha: xlSerialToYearMonth(d) })
    }
  }

  // Balance sheet rows (0-indexed, Sistema Financiero section)
  const rActivo      = rows[5]   // Activo total
  const rDisp        = rows[6]   // Disponibilidades
  const rTitulosPub  = rows[7]   // Títulos públicos total
  const rInstBCRA    = rows[9]   // Instrumentos BCRA tenencia propia (LELIQ/LEFI)
  const rPasesAct    = rows[10]  // Pases activos BCRA
  const rTitulosPriv = rows[11]  // Títulos privados
  const rPrestSPub   = rows[13]  // Préstamos sector público
  const rPrestSPriv  = rows[14]  // Préstamos sector privado
  const rPasivo      = rows[28]  // Pasivo total
  const rDepTotal    = rows[29]  // Depósitos total
  const rDepPub      = rows[30]  // Depósitos sector público
  const rDepPriv     = rows[31]  // Depósitos sector privado total
  const rDepCC       = rows[32]  // Cta corriente
  const rDepCA       = rows[33]  // Caja de ahorros
  const rDepPF       = rows[34]  // Plazo fijo
  const rONLineas    = rows[39]  // Obligaciones negociables
  const rLineasExt   = rows[40]  // Líneas del exterior
  const rObligBCRA   = rows[38]  // Obligaciones con el BCRA
  const rOtrosPas    = rows[43]  // Otros pasivos
  const rObligSub    = rows[42]  // Obligaciones subordinadas
  const rObligInter  = rows[37]  // Obligaciones interfinancieras
  const rPN          = rows[45]  // Patrimonio neto

  type Period = {
    fecha: string
    // Assets (% del activo)
    disponibilidades: number
    inst_bcra:        number
    titulos_pub:      number
    cred_pub:         number
    cred_priv:        number
    otros_activos:    number
    // Funding (% del activo = fondeo)
    dep_priv_vista:   number
    dep_priv_plazo:   number
    dep_priv_otros:   number
    dep_pub:          number
    on_lineas_ext:    number
    oblig_bcra:       number
    otros_pasivos:    number
    pn:               number
    // Absolutos (ARS millones)
    activo_mm:        number
  }

  const serie: Period[] = dates.map(({ idx, fecha }) => {
    const activo = v(rActivo, idx)
    if (activo <= 0) return null

    // ACTIVO
    const disp        = v(rDisp, idx)
    const instBcra    = v(rInstBCRA, idx) + v(rPasesAct, idx)
    const titulosPub  = Math.max(0, v(rTitulosPub, idx) - instBcra)  // otros tít. públicos
    const credPub     = v(rPrestSPub, idx)
    const credPriv    = v(rPrestSPriv, idx)
    const otrosActivo = activo - disp - instBcra - titulosPub - credPub - credPriv

    // FUNDING
    const pasivo       = v(rPasivo, idx)
    const depCC        = v(rDepCC, idx)
    const depCA        = v(rDepCA, idx)
    const depPF        = v(rDepPF, idx)
    const depPrivTotal = v(rDepPriv, idx)
    const depPrivOtros = Math.max(0, depPrivTotal - depCC - depCA - depPF)
    const depPub       = v(rDepPub, idx)
    const onExt        = v(rONLineas, idx) + v(rLineasExt, idx)
    const obligBcra    = v(rObligBCRA, idx)
    // "otros_pasivos" catches interfinancieras + otros obligaciones + subordinadas + otros pasivos
    const otrosPas     = Math.max(
      0,
      pasivo - v(rDepTotal, idx) - onExt - obligBcra
    )
    const pn           = v(rPN, idx)

    const pct = (x: number) => parseFloat(((x / activo) * 100).toFixed(2))

    return {
      fecha,
      disponibilidades: pct(disp),
      inst_bcra:        pct(instBcra),
      titulos_pub:      pct(titulosPub),
      cred_pub:         pct(credPub),
      cred_priv:        pct(credPriv),
      otros_activos:    pct(Math.max(0, otrosActivo)),
      dep_priv_vista:   pct(depCC + depCA),
      dep_priv_plazo:   pct(depPF),
      dep_priv_otros:   pct(depPrivOtros),
      dep_pub:          pct(depPub),
      on_lineas_ext:    pct(onExt),
      oblig_bcra:       pct(obligBcra),
      otros_pasivos:    pct(otrosPas),
      pn:               pct(pn),
      activo_mm:        Math.round(activo),
    }
  }).filter(Boolean) as Period[]

  const result = {
    data: {
      serie,
      ultima_fecha: serie.at(-1)?.fecha ?? null,
      n_periodos:   serie.length,
    },
    updated_at: new Date().toISOString(),
    source: "BCRA — InfBanc_Anexo.xlsx · Estado de Sit. Financiera",
  }
  setCache(cacheKey, result, 86400) // 24h — publicación mensual
  return result
}

export async function GET() {
  try {
    const data = await getBancosBalance()
    return NextResponse.json(data)
  } catch (err) {
    console.error("bancos route error:", err)
    return NextResponse.json({ error: "Failed to fetch banking data" }, { status: 500 })
  }
}
