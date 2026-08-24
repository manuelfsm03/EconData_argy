/**
 * /api/bancos-centrales — Tasas de política monetaria de los principales bancos centrales.
 *
 * Fuentes en vivo (sin API key):
 *   - BCE/ECB  : ECB Statistical Data Warehouse (CSV, data-api.ecb.europa.eu)
 *   - BCB      : API do Banco Central do Brasil (série 432 = Selic meta, api.bcb.gov.br)
 *
 * Fuentes en vivo sin key (pública oficial):
 *   - Fed (USA)   : NY Fed EFFR API (markets.newyorkfed.org) — tasa efectiva diaria
 *                   Fallback: FRED (St. Louis Fed) con FRED_API_KEY opcional
 *   - Banxico     : OECD MEI Financial — tasa interbancaria 3m MX (proxy tasa objetivo)
 *                   Fallback: Banxico SIE con BMX_TOKEN opcional
 *   - BCCh (Chile): OECD MEI Financial — tasa interbancaria 3m CL (proxy TPM)
 *
 * Fuentes hardcodeadas (último recurso):
 *   - BCRA (ARG)  : remite a /api/bcra para dato en tiempo real
 *
 * Patrón de cache: stale-cache de dos niveles. TTL fresco = 1h.
 * Si una fuente en vivo falla → fallback al valor hardcodeado + esVivo:false.
 * Si el cache fresco está vigente → se sirve sin hacer requests externos.
 *
 * Nota: los hosts de ECB, BCB, FRED y Banxico no están en el SOURCE_REGISTRY.
 * Se usa fetch nativo. No hay input del usuario en las URLs → riesgo SSRF nulo.
 */

import { NextResponse } from "next/server"
import { guardarExito, leerFresco, leerUltimoBueno } from "@/server/http/stale-cache"

export const runtime = "nodejs"

const CACHE_KEY = "bancos-centrales:tasas"
const TTL_SEG = 3600 // 1 hora

// Forma del bloque que devuelve el endpoint (contrato con el frontend).
interface DatosBanco {
  pais: string
  moneda: string
  tasa: number | null
  esVivo: boolean
  fuente?: string
  updated_at?: string
  refFecha?: string
  nota?: string
}

interface DatosBancosCentrales {
  fed: DatosBanco
  bce: DatosBanco
  bcb: DatosBanco
  boe: DatosBanco
  boc: DatosBanco
  banxico: DatosBanco
  bcentral_chile: DatosBanco
  boj: DatosBanco
  rba: DatosBanco
  bcra: DatosBanco
}

// Fallback sin dato — se usa cuando todas las fuentes en vivo fallan.
// tasa: null = sin dato disponible; el frontend debe mostrar "N/D".
const FALLBACK: DatosBancosCentrales = {
  fed:            { pais: "USA",           moneda: "USD", tasa: null, esVivo: false, fuente: "sin dato" },
  bce:            { pais: "Eurozona",      moneda: "EUR", tasa: null, esVivo: false, fuente: "sin dato" },
  bcb:            { pais: "Brasil",        moneda: "BRL", tasa: null, esVivo: false, fuente: "sin dato" },
  boe:            { pais: "Reino Unido",   moneda: "GBP", tasa: null, esVivo: false, fuente: "sin dato" },
  boc:            { pais: "Canadá",        moneda: "CAD", tasa: null, esVivo: false, fuente: "sin dato" },
  banxico:        { pais: "México",        moneda: "MXN", tasa: null, esVivo: false, fuente: "sin dato" },
  bcentral_chile: { pais: "Chile",         moneda: "CLP", tasa: null, esVivo: false, fuente: "sin dato" },
  boj:            { pais: "Japón",         moneda: "JPY", tasa: null, esVivo: false, fuente: "sin dato" },
  rba:            { pais: "Australia", moneda: "AUD", tasa: null, esVivo: false, fuente: "sin dato" },
  bcra:           { pais: "Argentina", moneda: "ARS", tasa: null, esVivo: false, fuente: "/api/bcra", nota: "ver /api/bcra para datos en tiempo real" },
}

// ── Fed (USA): NY Fed EFFR API — pública sin key ──────────────────────────
// markets.newyorkfed.org/api/rates/effr/last/1.json
// Devuelve la EFFR (tasa efectiva diaria del overnight federal funds market).
// percentRate = EFFR; targetRateLow/High = target range del FOMC.
// Fallback: FRED con FRED_API_KEY si está configurado.
async function getTasaFed(): Promise<DatosBanco> {
  // Primero: NY Fed EFFR (sin key, pública oficial)
  try {
    const res = await fetch("https://markets.newyorkfed.org/api/rates/effr/last/1.json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const json = await res.json() as {
        refRates?: Array<{
          effectiveDate: string
          percentRate: string
          targetRateLow?: number
          targetRateHigh?: number
        }>
      }
      const rate = json.refRates?.[0]
      if (rate) {
        // Mostrar el target upper bound del FOMC si está disponible; si no, la EFFR
        const tasa = rate.targetRateHigh ?? parseFloat(rate.percentRate)
        if (Number.isFinite(tasa)) {
          return {
            pais: "USA",
            moneda: "USD",
            tasa: parseFloat(tasa.toFixed(2)),
            esVivo: true,
            fuente: "NY Fed EFFR",
            updated_at: rate.effectiveDate,
          }
        }
      }
    }
  } catch { /* cae al fallback */ }

  // Segundo: FRED (requiere FRED_API_KEY, libre con registro)
  const fredKey = process.env.FRED_API_KEY
  if (fredKey) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU&api_key=${fredKey}&sort_order=desc&limit=1&file_type=json`
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) })
      if (res.ok) {
        const json = await res.json() as { observations?: Array<{ date: string; value: string }> }
        const obs = json.observations?.[0]
        const tasa = parseFloat(obs?.value ?? "")
        if (Number.isFinite(tasa)) {
          return {
            pais: "USA",
            moneda: "USD",
            tasa: parseFloat(tasa.toFixed(2)),
            esVivo: true,
            fuente: "FRED — St. Louis Fed (DFEDTARU)",
            updated_at: obs?.date,
          }
        }
      }
    } catch { /* cae al fallback */ }
  }

  return FALLBACK.fed
}

// ── OECD MEI Financial — tasas interbancarias sin key ─────────────────────
// Endpoint SDMX: sdmx.oecd.org (acceso público, sin registro).
// IR3TIB01 = tasa interbancaria 3 meses — proxy de la tasa de política monetaria.
// Formato SDMX-JSON v2.
async function fetchOecdRate(
  countryCode: string,
): Promise<{ tasa: number; fecha: string } | null> {
  try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,1.0/M.${countryCode}.IR3TIB01.ST.A?format=jsondata&lastNObservations=1`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const json = await res.json() as {
      dataSets?: Array<{ observations?: Record<string, [number]> }>
      structure?: { dimensions?: { observation?: Array<{ values?: Array<{ id: string }> }> } }
    }
    const obs = json.dataSets?.[0]?.observations
    if (!obs) return null
    const keys = Object.keys(obs)
    if (keys.length === 0) return null
    const lastKey = keys[keys.length - 1]
    const tasa = obs[lastKey]?.[0]
    if (!Number.isFinite(tasa)) return null
    // La fecha viene codificada en la dimensión de tiempo
    const periodoIdx = parseInt(lastKey.split(":").pop() ?? "0", 10)
    const periodoValues = json.structure?.dimensions?.observation?.[0]?.values
    const fecha = periodoValues?.[periodoIdx]?.id ?? new Date().toISOString().slice(0, 7)
    return { tasa: parseFloat(tasa.toFixed(2)), fecha }
  } catch {
    return null
  }
}

// ── Banxico (México): OECD IR3TIB01 → fallback SIE con BMX_TOKEN ──────────
async function getTasaBanxico(): Promise<DatosBanco> {
  const oecd = await fetchOecdRate("MEX")
  if (oecd) {
    return {
      pais: "México",
      moneda: "MXN",
      tasa: oecd.tasa,
      esVivo: true,
      fuente: "OECD MEI Financial (IR3TIB01 MX)",
      updated_at: oecd.fecha,
      nota: "tasa interbancaria 3m — proxy de la tasa objetivo de Banxico",
    }
  }

  // Fallback: Banxico SIE con token opcional
  const token = process.env.BMX_TOKEN
  if (token) {
    try {
      const url = "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SR16850/datos/oportuno"
      const res = await fetch(url, {
        headers: { "Bmx-Token": token, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const json = await res.json() as {
          bmx?: { series?: Array<{ datos?: Array<{ fecha: string; dato: string }> }> }
        }
        const dato = json.bmx?.series?.[0]?.datos?.[0]
        const tasa = parseFloat(dato?.dato ?? "")
        if (Number.isFinite(tasa)) {
          return {
            pais: "México",
            moneda: "MXN",
            tasa: parseFloat(tasa.toFixed(2)),
            esVivo: true,
            fuente: "Banxico SIE (SR16850)",
            updated_at: dato?.fecha,
          }
        }
      }
    } catch { /* cae al fallback */ }
  }

  return FALLBACK.banxico
}

// ── BCCh (Chile): OECD IR3TIB01 → fallback hardcoded ─────────────────────
async function getTasaBCCh(): Promise<DatosBanco> {
  const oecd = await fetchOecdRate("CHL")
  if (oecd) {
    return {
      pais: "Chile",
      moneda: "CLP",
      tasa: oecd.tasa,
      esVivo: true,
      fuente: "OECD MEI Financial (IR3TIB01 CL)",
      updated_at: oecd.fecha,
      nota: "tasa interbancaria 3m — proxy del TPM del BCCh",
    }
  }
  return FALLBACK.bcentral_chile
}

// ── ECB/BCE: Statistical Data Warehouse CSV ────────────────────────────────
// Endpoint: FM (Financial Markets), serie MRR_RT (Main Refinancing Rate Level).
// Devuelve CSV con cabecera + fila de datos. El último valor es la tasa en %.
async function getTasaBCE(): Promise<DatosBanco> {
  try {
    const url =
      "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_RT.LEV?format=csvdata&lastNObservations=1"
    const res = await fetch(url, {
      headers: { Accept: "application/csv, text/csv, */*" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return FALLBACK.bce

    const csv = (await res.text()).trim()
    // El CSV del ECB tiene cabecera variable; buscamos la columna OBS_VALUE.
    const lines = csv.split("\n").filter((l) => l.trim() !== "")
    if (lines.length < 2) return FALLBACK.bce

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
    const obsIdx = headers.indexOf("OBS_VALUE")
    const dateIdx = headers.indexOf("TIME_PERIOD")
    if (obsIdx === -1) return FALLBACK.bce

    // La última fila de datos tiene el valor más reciente.
    const lastLine = lines[lines.length - 1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
    const rawTasa = parseFloat(lastLine[obsIdx] ?? "")
    if (!Number.isFinite(rawTasa)) return FALLBACK.bce

    const fecha = dateIdx !== -1 ? (lastLine[dateIdx] ?? undefined) : undefined

    return {
      pais: "Eurozona",
      moneda: "EUR",
      tasa: parseFloat(rawTasa.toFixed(2)),
      esVivo: true,
      fuente: "ECB SDW",
      updated_at: fecha ?? new Date().toISOString(),
    }
  } catch {
    return FALLBACK.bce
  }
}

// ── BCB: Selic meta (série 432) ────────────────────────────────────────────
// Devuelve [{ "data": "DD/MM/AAAA", "valor": "X.XX" }].
async function getTasaBCB(): Promise<DatosBanco> {
  try {
    const url =
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return FALLBACK.bcb

    const json = await res.json()
    // Espera un array: [{ data: "DD/MM/AAAA", valor: "X.XX" }]
    if (!Array.isArray(json) || json.length === 0) return FALLBACK.bcb

    const ultimo = json[0]
    const rawTasa = parseFloat(String(ultimo?.valor ?? ""))
    if (!Number.isFinite(rawTasa)) return FALLBACK.bcb

    return {
      pais: "Brasil",
      moneda: "BRL",
      tasa: parseFloat(rawTasa.toFixed(2)),
      esVivo: true,
      fuente: "BCB SGS 432",
      updated_at: ultimo?.data ?? new Date().toISOString(),
    }
  } catch {
    return FALLBACK.bcb
  }
}

// ── BoE (Reino Unido): Bank of England API pública ────────────────────────
// bankofengland.co.uk/boeapps/iadb — serie IUMABEDR (Bank Rate oficial).
// Devuelve CSV con DATE,VALUE; último valor = tasa vigente.
async function getTasaBoE(): Promise<DatosBanco> {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const hace5a = new Date(Date.now() - 5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const [d1, m1, y1] = hace5a.split("-").map(Number)
    const [d2, m2, y2] = hoy.split("-").map(Number)
    const fmtDate = (d: number, m: number, y: number) => `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
    const url = `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?CodeVer=new&xml.x=yes&Identifier=IUMABEDR&TD=${fmtDate(d1, m1, y1)}&HD=${fmtDate(d2, m2, y2)}&SERIES_MAX=10000&CSVF=TT&HideNums=-1&UsingCodes=Y&VFD=Y`
    const res = await fetch(url, {
      headers: { Accept: "text/csv, */*" },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return FALLBACK.boe
    const text = await res.text()
    const lines = text.trim().split("\n").filter((l) => l.trim() && !l.startsWith("DATE") && !l.startsWith('"DATE'))
    if (lines.length === 0) return FALLBACK.boe
    const last = lines[lines.length - 1].split(",")
    const tasa = parseFloat(last[1] ?? "")
    const fecha = last[0]?.replace(/"/g, "").trim() ?? undefined
    if (!Number.isFinite(tasa)) return FALLBACK.boe
    return {
      pais: "Reino Unido",
      moneda: "GBP",
      tasa: parseFloat(tasa.toFixed(2)),
      esVivo: true,
      fuente: "Bank of England API (IUMABEDR)",
      updated_at: fecha,
    }
  } catch {
    return FALLBACK.boe
  }
}

// ── BoC (Canadá): Bank of Canada Valet API pública ─────────────────────────
// bankofcanada.ca/valet — serie V39079 (tasa objetivo de política monetaria).
// Devuelve JSON con observaciones ordenadas por fecha.
async function getTasaBoC(): Promise<DatosBanco> {
  try {
    const url = "https://www.bankofcanada.ca/valet/observations/V39079/json?recent=1"
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return FALLBACK.boc
    const json = await res.json() as {
      observations?: Array<{ d: string; V39079: { v: string } }>
    }
    const obs = json.observations?.[0]
    if (!obs) return FALLBACK.boc
    const tasa = parseFloat(obs.V39079?.v ?? "")
    if (!Number.isFinite(tasa)) return FALLBACK.boc
    return {
      pais: "Canadá",
      moneda: "CAD",
      tasa: parseFloat(tasa.toFixed(2)),
      esVivo: true,
      fuente: "Bank of Canada Valet API (V39079)",
      updated_at: obs.d,
    }
  } catch {
    return FALLBACK.boc
  }
}

// ── BoJ (Japón): OECD IR3TIB01 JPN ───────────────────────────────────────
async function getTasaBoJ(): Promise<DatosBanco> {
  const oecd = await fetchOecdRate("JPN")
  if (oecd) {
    return {
      pais: "Japón",
      moneda: "JPY",
      tasa: oecd.tasa,
      esVivo: true,
      fuente: "OECD MEI Financial (IR3TIB01 JP)",
      updated_at: oecd.fecha,
      nota: "tasa interbancaria 3m — proxy de la tasa de política del BoJ",
    }
  }
  return FALLBACK.boj
}

// ── RBA (Australia): API pública del Reserve Bank of Australia ────────────
// rba.gov.au/statistics/tables/f1/ — serie FIRMMCRT (Cash Rate Target).
// Devuelve JSON con series históricas; tomamos el último valor disponible.
// Fallback: OECD IR3TIB01 AUS.
async function getTasaRBA(): Promise<DatosBanco> {
  try {
    const url = "https://api.rba.gov.au/statistics/tables/f1/?series_ids=FIRMMCRT"
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
    if (res.ok) {
      const json = await res.json() as {
        dataSets?: Array<{ series?: Record<string, { observations?: Record<string, [string | number]> }> }>
      }
      const series = json.dataSets?.[0]?.series
      if (series) {
        const key = Object.keys(series)[0]
        const obs = series[key]?.observations
        if (obs) {
          const periods = Object.keys(obs).sort()
          const lastPeriod = periods[periods.length - 1]
          const rawTasa = parseFloat(String(obs[lastPeriod]?.[0] ?? ""))
          if (Number.isFinite(rawTasa)) {
            return {
              pais: "Australia",
              moneda: "AUD",
              tasa: parseFloat(rawTasa.toFixed(2)),
              esVivo: true,
              fuente: "RBA Statistics (FIRMMCRT)",
              updated_at: lastPeriod,
            }
          }
        }
      }
    }
  } catch { /* cae a OECD */ }

  // Fallback: OECD IR3TIB01 AUS
  const oecd = await fetchOecdRate("AUS")
  if (oecd) {
    return {
      pais: "Australia",
      moneda: "AUD",
      tasa: oecd.tasa,
      esVivo: true,
      fuente: "OECD MEI Financial (IR3TIB01 AU)",
      updated_at: oecd.fecha,
      nota: "tasa interbancaria 3m — proxy del cash rate del RBA",
    }
  }

  return FALLBACK.rba
}

export async function GET() {
  // 1) Cache fresco vigente → servir sin tocar fuentes externas.
  const cached = leerFresco<DatosBancosCentrales>(CACHE_KEY)
  if (cached) {
    return NextResponse.json({
      data: cached,
      cached: true,
      stale: false,
      updated_at: new Date().toISOString(),
      nota: "Tasas de política monetaria de referencia. Fuentes en vivo donde hay API gratuita.",
    })
  }

  // 2) Consultar fuentes en vivo en paralelo.
  const [fed, bce, bcb, boe, boc, banxico, bcentral_chile, boj, rba] = await Promise.all([
    getTasaFed(),
    getTasaBCE(),
    getTasaBCB(),
    getTasaBoE(),
    getTasaBoC(),
    getTasaBanxico(),
    getTasaBCCh(),
    getTasaBoJ(),
    getTasaRBA(),
  ])

  // Armar la respuesta completa: vivos donde conseguimos datos, fallback null el resto.
  const data: DatosBancosCentrales = {
    fed,
    bce,
    bcb,
    boe,
    boc,
    banxico,
    bcentral_chile,
    boj,
    rba,
    bcra: FALLBACK.bcra,
  }

  // 3) ¿Alguna fuente en vivo funcionó? Si sí, guardar en cache "exitoso".
  const vivosOk = [fed, bce, bcb, boe, boc, banxico, bcentral_chile, boj, rba].filter((b) => b.esVivo).length
  if (vivosOk >= 1) {
    guardarExito(CACHE_KEY, data, TTL_SEG)
    return NextResponse.json({
      data,
      stale: false,
      updated_at: new Date().toISOString(),
      nota: "Tasas de política monetaria de referencia. Fuentes en vivo donde hay API gratuita.",
    })
  }

  // 4) Todo falló en vivo → intentar stale-cache.
  const stale = leerUltimoBueno<DatosBancosCentrales>(CACHE_KEY)
  if (stale) {
    return NextResponse.json({
      data: stale.data,
      stale: true,
      stale_since: stale.staleSince,
      updated_at: new Date().toISOString(),
      nota: "Tasas de política monetaria de referencia. Fuentes en vivo donde hay API gratuita.",
    })
  }

  // 5) Primera vez y todo falla → devolver hardcoded sin romper el contrato.
  return NextResponse.json({
    data,
    stale: false,
    updated_at: new Date().toISOString(),
    source: "hardcoded-fallback",
    nota: "Tasas de política monetaria de referencia. Fuentes en vivo donde hay API gratuita.",
  })
}
