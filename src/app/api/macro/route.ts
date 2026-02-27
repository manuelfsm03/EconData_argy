/**
 * /api/macro — Macroeconomía argentina
 *
 * Fuentes de datos:
 *   - APIs de Series de Tiempo (datos.gob.ar): https://apis.datos.gob.ar/series/api/series/
 *     Datos del INDEC, BCRA, Ministerio de Economía — sin autenticación
 *
 * Endpoints:
 *   GET /api/macro?endpoint=emae      — EMAE + variaciones
 *   GET /api/macro?endpoint=ipc       — IPC nacional + componentes
 *   GET /api/macro?endpoint=ipi       — IPI manufacturero + ISAC
 *   GET /api/macro?endpoint=balanza   — Balanza comercial
 *   GET /api/macro?endpoint=fiscal    — Resultado fiscal + recaudación
 *
 * Portado desde EconData_argy/api/services/indec_scraper.py + routers/macro_ar.py
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://apis.datos.gob.ar/series/api/series/"

const WB_BASE = "https://api.worldbank.org/v2/country/AR/indicator"

const WB_INDICATORS: Record<string, string> = {
  pbi_usd:           "NY.GDP.MKTP.KD",
  pbi_percapita:     "NY.GDP.PCAP.KD",
  pnb_usd:           "NY.GNP.ATLS.CD",
  pbi_verde:         "NY.ADJ.SVNG.GN.ZS",
  gini:              "SI.POV.GINI",
  natalidad:         "SP.DYN.CBRT.IN",
  mortalidad_infantil: "SP.DYN.IMRT.IN",
  poblacion:         "SP.POP.TOTL",
  esperanza_vida:    "SP.DYN.LE00.IN",
}

// IDs verificados de la API pública datos.gob.ar
const SERIES_IDS: Record<string, string> = {
  // ACTIVIDAD
  emae: "143.3_NO_PR_2004_A_21",
  emae_desest: "143.3_NO_PR_2004_A_31",
  emae_var_mensual: "143.3_ICE_SER_VM_2004_A_34",
  emae_var_interanual: "143.3_ICE_SERVIA_2004_A_25",
  ipi: "453.1_SERIE_ORIGNAL_0_0_14_46",
  isac: "33.2_ISAC_NIVELRAL_0_M_18_63",
  // COMERCIO EXTERIOR
  exportaciones: "74.3_IET_0_M_16",
  importaciones: "74.3_IIR_0_M_23",
  saldo_comercial: "74.3_ISC_0_M_19",
  // PRECIOS IPC (base dic 2016)
  ipc_general: "148.3_INIVELNAL_DICI_M_26",
  ipc_var_mensual: "145.3_INGNACUAL_DICI_M_38",
  ipc_nucleo: "148.3_INUCLEONAL_DICI_M_19",
  ipc_estacionales: "193.2_ESTACIONALLES_2021_0_12_84",
  ipc_regulados: "148.3_IREGULANAL_DICI_M_22",
  ipc_alimentos: "146.3_IALIMENNAL_DICI_M_45",
  // FISCAL
  resultado_primario: "379.9_RESULTADO_017__31_73",
  resultado_financiero: "378.9_RESULTADO_017_0_M_18_90",
  recaudacion: "172.3_TL_RECAION_M_0_0_17",
  // MERCADO LABORAL — EPH trimestral
  tasa_desempleo:   "45.3_TD_TOTAL_0_Q_34",
  tasa_actividad:   "45.3_TA_TOTAL_0_Q_34",
  tasa_empleo:      "45.3_TE_TOTAL_0_Q_34",
  tasa_subocupacion:"45.3_TS_TOTAL_0_Q_34",
}

// In-memory cache
const _cache: Record<string, { data: unknown; expiry: number }> = {}

function getCache<T>(key: string): T | null {
  const e = _cache[key]
  if (e && e.expiry > Date.now()) return e.data as T
  return null
}
function setCache(key: string, data: unknown, ttlSec: number) {
  _cache[key] = { data, expiry: Date.now() + ttlSec * 1000 }
}

/** Fetches multiple series in a single HTTP call */
async function getMultiserie(keys: string[], limit = 36): Promise<Record<string, [string, number][]>> {
  const cacheKey = `multi_${keys.join("_")}_${limit}`
  const cached = getCache<Record<string, [string, number][]>>(cacheKey)
  if (cached) return cached

  const validKeys = keys.filter((k) => k in SERIES_IDS)
  const ids = validKeys.map((k) => SERIES_IDS[k]).join(",")
  const url = `${BASE_URL}?ids=${encodeURIComponent(ids)}&limit=${limit}&sort=desc`

  const res = await fetch(url, {
    headers: { "User-Agent": "PanelDeControl/2.0" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`datos.gob.ar ${res.status}`)

  const raw = await res.json()
  const rows: (string | number | null)[][] = raw.data || []

  const result: Record<string, [string, number][]> = {}
  for (let i = 0; i < validKeys.length; i++) {
    result[validKeys[i]] = rows
      .filter((r) => r.length > i + 1 && r[i + 1] != null)
      .map((r) => [r[0] as string, r[i + 1] as number])
  }

  setCache(cacheKey, result, 3600)
  return result
}

async function fetchWorldBank(indicatorId: string, limit = 20): Promise<[string, number][]> {
  const cacheKey = `wb_${indicatorId}_${limit}`
  const cached = getCache<[string, number][]>(cacheKey)
  if (cached) return cached

  try {
    const url = `${WB_BASE}/${indicatorId}?format=json&per_page=${limit}&mrv=${limit}`
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`World Bank API ${res.status}`)

    const json = await res.json()
    const entries: { date: string; value: number | null }[] = json[1] ?? []
    const result: [string, number][] = entries
      .filter((e) => e.value != null)
      .map((e) => [e.date, e.value as number])
      .sort((a, b) => Number(b[0]) - Number(a[0]))

    setCache(cacheKey, result, 86400)
    return result
  } catch (err) {
    console.error(`[WB] Error fetching ${indicatorId}:`, err)
    return []
  }
}

/** Calcula variación interanual desde serie de niveles */
function calcInteranual(niveles: [string, number][]): [string, number][] {
  const result: [string, number][] = []
  for (let i = 0; i < niveles.length; i++) {
    if (i + 12 < niveles.length) {
      const curr = niveles[i][1]
      const base = niveles[i + 12][1]
      if (curr != null && base) {
        result.push([niveles[i][0], parseFloat(((curr / base - 1) * 100).toFixed(2))])
      }
    }
  }
  return result
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") ?? "emae"

  try {
    if (endpoint === "emae") {
      const data = await getMultiserie(
        ["emae", "emae_var_mensual", "emae_var_interanual", "emae_desest"],
        36,
      )
      // Variaciones en proporción → convertir a porcentaje
      for (const key of ["emae_var_mensual", "emae_var_interanual"] as const) {
        if (data[key]) {
          data[key] = data[key].map(([d, v]) => [d, parseFloat((v * 100).toFixed(2))] as [string, number])
        }
      }
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar" })
    }

    if (endpoint === "ipc") {
      const data = await getMultiserie(
        ["ipc_general", "ipc_var_mensual", "ipc_nucleo", "ipc_estacionales", "ipc_regulados", "ipc_alimentos"],
        60,
      )
      // ipc_var_mensual viene en proporción → convertir a porcentaje
      if (data.ipc_var_mensual) {
        data.ipc_var_mensual = data.ipc_var_mensual.map(
          ([d, v]) => [d, parseFloat((v * 100).toFixed(2))] as [string, number],
        )
      }
      // Variación interanual calculada desde nivel general
      data.ipc_var_interanual = calcInteranual(data.ipc_general || [])
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar" })
    }

    if (endpoint === "ipi") {
      const data = await getMultiserie(["ipi", "isac"], 36)
      // Calcular variación interanual del IPI desde el nivel
      data.ipi_var_interanual = calcInteranual(data.ipi || [])
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar" })
    }

    if (endpoint === "balanza") {
      const data = await getMultiserie(["exportaciones", "importaciones", "saldo_comercial"], 24)
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar" })
    }

    if (endpoint === "fiscal") {
      const data = await getMultiserie(["resultado_primario", "resultado_financiero", "recaudacion"], 36)
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar" })
    }

    if (endpoint === "laboral") {
      const data = await getMultiserie(
        ["tasa_desempleo", "tasa_actividad", "tasa_empleo", "tasa_subocupacion"],
        40,
      )
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "apis.datos.gob.ar · INDEC EPH Continua",
        frecuencia: "trimestral",
        nota: "31 aglomerados urbanos. Población de 14 años y más.",
      })
    }

    if (endpoint === "estructural") {
      const [
        pbi_usd, pbi_percapita, pnb_usd, pbi_verde,
        gini, natalidad, mortalidad_infantil, poblacion, esperanza_vida,
      ] = await Promise.all([
        fetchWorldBank(WB_INDICATORS.pbi_usd, 15),
        fetchWorldBank(WB_INDICATORS.pbi_percapita, 15),
        fetchWorldBank(WB_INDICATORS.pnb_usd, 15),
        fetchWorldBank(WB_INDICATORS.pbi_verde, 15),
        fetchWorldBank(WB_INDICATORS.gini, 15),
        fetchWorldBank(WB_INDICATORS.natalidad, 15),
        fetchWorldBank(WB_INDICATORS.mortalidad_infantil, 15),
        fetchWorldBank(WB_INDICATORS.poblacion, 5),
        fetchWorldBank(WB_INDICATORS.esperanza_vida, 15),
      ])

      return NextResponse.json({
        data: { pbi_usd, pbi_percapita, pnb_usd, pbi_verde, gini, natalidad, mortalidad_infantil, poblacion, esperanza_vida },
        updated_at: new Date().toISOString(),
        source: "World Bank Open Data API · api.worldbank.org",
        frecuencia: "anual",
        nota: "PBI verde = Ahorro neto ajustado por recursos naturales y contaminación (% del INB). Datos anuales.",
      })
    }

    return NextResponse.json(
      { error: "endpoint no válido. Usar ?endpoint=emae|ipc|ipi|balanza|fiscal" },
      { status: 400 },
    )
  } catch (error) {
    console.error("[/api/macro]", error)
    return NextResponse.json({ error: "Error al obtener datos", detail: String(error) }, { status: 500 })
  }
}
