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

const CSV_URLS = {
  emae_sectorial: "https://infra.datos.gob.ar/catalog/sspm/dataset/11/distribution/11.3/download/emae-apertura-por-sectores-valores-mensuales-indice-base-2004.csv",
  uci:            "https://infra.datos.gob.ar/catalog/sspm/dataset/31/distribution/31.3/download/utilizacion-capacidad-instalada-industria-valores-mensuales-base-2004.csv",
  supermercados:  "https://infra.datos.gob.ar/catalog/sspm/dataset/455/distribution/455.1/download/ventas-totales-supermercados-2.csv",
  icc_mensual:    "https://infra.datos.gob.ar/catalog/sspm/dataset/380/distribution/380.3/download/indice-confianza-consumidor-valores-mensuales.csv",
  icg_mensual:    "https://infra.datos.gob.ar/catalog/sspm/dataset/370/distribution/370.3/download/indice-confianza-gobierno-valores-mensuales.csv",
}

const WB_BASE = "https://api.worldbank.org/v2/country/AR/indicator"

// Solo esperanza de vida en World Bank (~600ms). El resto migró a datos.gob.ar
const WB_INDICATORS: Record<string, string> = {
  esperanza_vida: "SP.DYN.LE00.IN",
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
  // RECAUDACIÓN DESAGREGADA — Informe Mensual SPN, dataset 452 (R/P1M hasta 2026)
  rec_iva:           "452.2_IVA_NETO_RROS_0_T_19_67",  // IVA neto (excl. reintegros)
  rec_ganancias:     "452.2_GANANCIASIAS_0_T_9_51",     // Impuesto a las Ganancias
  rec_seg_social:    "172.3_SRIDAD_IAL_M_0_0_16",       // Seg. Social (aportes + contrib.)
  rec_deb_cred:      "452.2_DEBITOS_CRTOS_0_T_16_22",   // Débitos y Créditos bancarios
  rec_der_expo:      "452.2_DERECHOS_EION_0_T_20_42",   // Derechos de Exportación
  rec_der_impo:      "452.2_DERECHOS_IION_0_T_20_60",   // Derechos de Importación
  rec_bs_personales: "452.2_BIENES_PERLES_0_T_17_26",   // Bienes Personales
  // rec_combustibles: "452.1_COMBUSTIBLLES_0_A_12_22", // TODO: solo trimestral en datos.gob.ar
  // MERCADO LABORAL — EPH Continua trimestral (31 aglomerados)
  tasa_desempleo:   "42.3_EPH_PUNTUATAL_0_M_30",
  tasa_actividad:   "43.2_ECTAT_0_T_33",
  tasa_empleo:      "44.2_ECTET_0_T_30",
  tasa_subocupacion:"46.2_ECTST_0_T_36",
  // ESTRUCTURALES — INDEC vía datos.gob.ar (reemplazo de World Bank lento)
  pbi_usd_indec:    "9.2_PDPC_2004_T_30",    // PIB en USD corrientes (trimestral → anual)
  pbi_percapita_usd:"9.2_PPCDC_2004_T_33",   // PIB per cápita USD corrientes
  poblacion_indec:  "9.2_P_2004_T_9",         // Población Argentina
  gini_indec:       "65.1_CGI_0_0_21",         // Coeficiente Gini EPH (semestral)
  natalidad_indec:  "tn_arg",                  // Tasa de natalidad
  mortalidad_indec: "tmi_arg",                 // Tasa mortalidad infantil
  smvm:             "57.1_SMVMM_0_M_34",       // Salario Mínimo Vital y Móvil (mensual)
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
  if (cached) return structuredClone(cached)

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
  return structuredClone(result)
}

async function fetchWorldBank(indicatorId: string, limit = 20): Promise<[string, number][]> {
  const cacheKey = `wb_${indicatorId}_${limit}`
  const cached = getCache<[string, number][]>(cacheKey)
  if (cached) return cached

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)

    const url = `${WB_BASE}/${indicatorId}?format=json&per_page=${limit}&mrv=${limit}`
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`World Bank API ${res.status}`)

    const json = await res.json()
    const entries: { date: string; value: number | null }[] = json[1] ?? []
    const result: [string, number][] = entries
      .filter((e) => e.value != null)
      .map((e) => [e.date, e.value as number] as [string, number])
      .sort((a, b) => Number(b[0]) - Number(a[0]))

    setCache(cacheKey, result, 86400)
    return result
  } catch (err) {
    console.error(`[WB] Error fetching ${indicatorId}:`, err)
    return []
  }
}

async function fetchCSVData(url: string, ttlSec = 3600): Promise<Record<string, string>[]> {
  const cacheKey = `csv_${url.slice(-40)}`
  const cached = getCache<Record<string, string>[]>(cacheKey)
  if (cached) return cached
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PanelDeControl/2.0", Accept: "text/csv,text/plain,*/*" },
      next: { revalidate: ttlSec },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`CSV ${res.status}: ${url}`)
    const text = await res.text()
    const lines = text.trim().split("\n").filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",")
      return Object.fromEntries(
        headers.map((h, i) => [h, (vals[i] ?? "").trim().replace(/^"|"$/g, "")])
      )
    })
    setCache(cacheKey, rows, ttlSec)
    return rows
  } catch (err) {
    console.error(`[CSV] Error fetching ${url}:`, err)
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
  const yearParam   = searchParams.get("year")    ?? "2025"
  const countryParam = searchParams.get("country") ?? "32"

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
      // Valores vienen en proporción (0.066 = 6.6%) → convertir a porcentaje
      for (const key of ["tasa_desempleo", "tasa_actividad", "tasa_empleo", "tasa_subocupacion"] as const) {
        if (data[key]) {
          data[key] = data[key].map(([d, v]) => [d, parseFloat((v * 100).toFixed(2))] as [string, number])
        }
      }
      return NextResponse.json({
        data,
        updated_at: new Date().toISOString(),
        source: "apis.datos.gob.ar · INDEC EPH Continua",
        frecuencia: "trimestral",
        nota: "31 aglomerados urbanos. Población de 14 años y más.",
      })
    }

    if (endpoint === "estructural") {
      // 6 series INDEC en un solo request + 1 WB (esperanza vida, ~600ms)
      const [indec, esperanza_vida] = await Promise.all([
        getMultiserie(
          ["pbi_usd_indec", "pbi_percapita_usd", "poblacion_indec", "gini_indec", "natalidad_indec", "mortalidad_indec", "smvm"],
          5,
        ),
        fetchWorldBank(WB_INDICATORS.esperanza_vida, 5),
      ])

      // Gini: datos.gob.ar devuelve escala 0–1 (e.g. 0.442) → convertir a 0–100
      if (indec.gini_indec) {
        indec.gini_indec = indec.gini_indec.map(
          ([d, v]) => [d, parseFloat((v * 100).toFixed(1))] as [string, number],
        )
      }

      return NextResponse.json({
        data: {
          pbi_usd:           indec.pbi_usd_indec    || [],
          pbi_percapita:     indec.pbi_percapita_usd || [],
          poblacion:         indec.poblacion_indec   || [],
          gini:              indec.gini_indec        || [],
          natalidad:         indec.natalidad_indec   || [],
          mortalidad_infantil: indec.mortalidad_indec || [],
          smvm:              indec.smvm              || [],
          esperanza_vida,
        },
        updated_at: new Date().toISOString(),
        source: "INDEC vía apis.datos.gob.ar · World Bank (esperanza de vida)",
        frecuencia: "anual/trimestral",
        nota: "PBI y per cápita: millones/unidades de USD corrientes. Gini: EPH INDEC escala 0–100. SMVM: Ministerio de Trabajo.",
      })
    }

    // ── EMAE SECTORIAL ──────────────────────────────────────────────────────
    if (endpoint === "emae_sectorial") {
      const rows = await fetchCSVData(CSV_URLS.emae_sectorial)
      // Últimas 24 filas (2 años), mapear indice_tiempo → date para compatibilidad con BBGAreaChart
      const recent = rows.slice(-24).map(r => ({
        date: r.indice_tiempo ?? "",
        agro:         parseFloat(r.agricultura_ganaderia_caza_silvicultura ?? "") || null,
        industria:    parseFloat(r.industria_manufacturera ?? "") || null,
        construccion: parseFloat(r.construccion ?? "") || null,
        comercio:     parseFloat(r.comercio_mayorista_minorista_reparaciones ?? "") || null,
        transporte:   parseFloat(r.transporte_comunicaciones ?? "") || null,
        finanzas:     parseFloat(r.intermediacion_financiera ?? "") || null,
        energia:      parseFloat(r.electricidad_gas_agua ?? "") || null,
        turismo:      parseFloat(r.hoteles_restaurantes ?? "") || null,
      }))
      return NextResponse.json({
        data: recent,
        updated_at: new Date().toISOString(),
        source: "datos.gob.ar · INDEC · EMAE Apertura Sectorial Base 2004",
      })
    }

    // ── ACTIVIDAD (UCI + SUPERMERCADOS) ─────────────────────────────────────
    if (endpoint === "actividad") {
      const [uciRows, superRows] = await Promise.all([
        fetchCSVData(CSV_URLS.uci),
        fetchCSVData(CSV_URLS.supermercados),
      ])

      // UCI — mapear indice_tiempo → date, nivel general y sectores clave
      const uci = uciRows.slice(-24).map(r => ({
        date:          r.indice_tiempo ?? "",
        nivel_general: parseFloat(r.ucii_nivel_general ?? "") || null,
        alimentos:     parseFloat(r.ucii_productos_alimenticios_bebidas ?? "") || null,
        textiles:      parseFloat(r.ucii_productos_textiles ?? "") || null,
        quimicos:      parseFloat(r.ucii_sustancias_productos_quimicos ?? "") || null,
        automotriz:    parseFloat(r.ucii_vehiculosautomotores ?? "") || null,
        metalmecanica: parseFloat(r.ucii_metalmecanica_no_industria_automotriz ?? "") || null,
        minerales:     parseFloat(r.ucii_minerales_no_metalicos ?? "") || null,
      }))

      // Supermercados — corrientes y constantes en miles de millones
      const supermercados = superRows.slice(-24).map(r => ({
        date:           r.indice_tiempo ?? "",
        corrientes_mm:  r.ventas_precios_corrientes ? parseFloat(r.ventas_precios_corrientes) / 1000 : null,
        constantes_mm:  r.ventas_precios_constantes ? parseFloat(r.ventas_precios_constantes) / 1000 : null,
      }))

      return NextResponse.json({
        uci,
        supermercados,
        updated_at: new Date().toISOString(),
        source: "datos.gob.ar · INDEC",
        nota_uci:   "Utilización de capacidad instalada. En % sobre capacidad total. Base 2004.",
        nota_super: "Ventas de supermercados en miles de millones ARS. Constantes = precios base 2017.",
      })
    }

    // ── CONFIANZA DEL CONSUMIDOR (UTDT) ─────────────────────────────────────
    if (endpoint === "confianza") {
      const rows = await fetchCSVData(CSV_URLS.icc_mensual)
      // Mapear indice_tiempo → date, filtrar registros con dato nacional
      const data = rows
        .filter(r => r.icc_nacional && r.icc_nacional !== "")
        .slice(-36)
        .map(r => ({
          date:               r.indice_tiempo ?? "",
          icc_nacional:       parseFloat(r.icc_nacional) || null,
          situacion_personal: parseFloat(r.desagregacion_subindices_situacion_personal ?? "") || null,
          situacion_macro:    parseFloat(r.desagregacion_subindices_situacion_macro ?? "") || null,
          bienes_durables:    parseFloat(r.desagregacion_subindices_bienes_durables_inmuebles ?? "") || null,
          capital:            parseFloat(r.desagregacion_regiones_capital ?? "") || null,
          gba:                parseFloat(r.desagregacion_regiones_gba ?? "") || null,
          interior:           parseFloat(r.desagregacion_regiones_interior ?? "") || null,
        }))

      return NextResponse.json({
        data,
        ultimo: data[data.length - 1] ?? null,
        updated_at: new Date().toISOString(),
        source: "datos.gob.ar · UTDT — Universidad Torcuato Di Tella",
        nota: "Índice compuesto. Encuesta mensual a hogares. Escala: sobre 50 = optimismo.",
      })
    }

    // ── CONFIANZA EN EL GOBIERNO (UTDT) ─────────────────────────────────────
    if (endpoint === "icg") {
      const rows = await fetchCSVData(CSV_URLS.icg_mensual)
      const data = rows
        .filter(r => r.icg_nivel_general && r.icg_nivel_general !== "")
        .slice(-36)
        .map(r => ({
          date:       r.indice_tiempo ?? "",
          icg_general: parseFloat(r.icg_nivel_general) || null,
          evaluacion:  parseFloat(r.evaluacion_general) || null,
          interes:     parseFloat(r.interes_general) || null,
          eficiencia:  parseFloat(r.eficiencia) || null,
          honestidad:  parseFloat(r.honestidad) || null,
          capacidad:   parseFloat(r.capacidad) || null,
        }))
      return NextResponse.json({
        data,
        ultimo: data[data.length - 1] ?? null,
        updated_at: new Date().toISOString(),
        source: "datos.gob.ar · UTDT — Universidad Torcuato Di Tella",
        nota: "Índice compuesto. Encuesta mensual. Escala 0–5. Por encima de 2.5 = confianza relativa.",
      })
    }

    // ── PIRÁMIDE POBLACIONAL (populationpyramid.net · UN WPP 2024) ───────────
    if (endpoint === "piramide") {
      const url = `https://www.populationpyramid.net/api/pp/${countryParam}/${yearParam}/?csv=true`
      const rows = await fetchCSVData(url, 86400) // 24h — datos ONU estables
      if (!rows.length) {
        return NextResponse.json({ error: "Sin datos para ese país/año", data: [] }, { status: 404 })
      }
      let totalM = 0, totalF = 0
      const data = rows
        .filter(r => r.Age)
        .map(r => {
          const m = parseInt(r.M ?? "0") || 0
          const f = parseInt(r.F ?? "0") || 0
          totalM += m
          totalF += f
          return { age: r.Age, varones: -m, mujeres: f }
        })
      return NextResponse.json({
        data,
        year: yearParam,
        country: countryParam,
        total_m: totalM,
        total_f: totalF,
        total: totalM + totalF,
        proyeccion: parseInt(yearParam) > 2025,
        source: "populationpyramid.net · UN World Population Prospects 2024",
      })
    }

    // ── FISCAL SANKEY — recaudación desagregada ──────────────────────────────
    if (endpoint === "fiscal_sankey") {
      const data = await getMultiserie([
        "recaudacion",
        "resultado_primario",
        "resultado_financiero",
        "rec_iva",
        "rec_ganancias",
        "rec_seg_social",
        "rec_deb_cred",
        "rec_der_expo",
        "rec_der_impo",
        "rec_bs_personales",
      ], 36)
      return NextResponse.json({ data, updated_at: new Date().toISOString(), source: "apis.datos.gob.ar · ARCA · dataset 452" })
    }

    return NextResponse.json(
      { error: "endpoint no válido. Usar ?endpoint=emae|ipc|ipi|balanza|fiscal|fiscal_sankey" },
      { status: 400 },
    )
  } catch (error) {
    console.error("[/api/macro]", error)
    return NextResponse.json({ error: "Error al obtener datos", detail: String(error) }, { status: 500 })
  }
}
