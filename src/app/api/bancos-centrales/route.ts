/**
 * /api/bancos-centrales — Tasas de política monetaria de los principales bancos centrales.
 *
 * Fuentes en vivo (sin API key):
 *   - BCE/ECB  : ECB Statistical Data Warehouse (CSV, data-api.ecb.europa.eu)
 *   - BCB      : API do Banco Central do Brasil (série 432 = Selic meta, api.bcb.gov.br)
 *
 * Fuentes hardcodeadas (sin API pública libre confiable):
 *   - Fed (USA)   : tasa ~5.25% ref. 2025-08 (FRED/NASDAQ requieren key o bloquean bots)
 *   - Banxico     : tasa 10.50% ref. 2025-08
 *   - BCCh (Chile): tasa 5.00% ref. 2025-08
 *   - BCRA (ARG)  : remite a /api/bcra para dato en tiempo real
 *
 * Patrón de cache: stale-cache de dos niveles. TTL fresco = 1h.
 * Si una fuente en vivo falla → fallback al valor hardcodeado + esVivo:false.
 * Si el cache fresco está vigente → se sirve sin hacer requests externos.
 *
 * Nota: los hosts de ECB y BCB no están en el SOURCE_REGISTRY (fetchRegistered
 * sólo acepta hosts registrados). Se usa fetch nativo, igual que el endpoint
 * /api/internacional hace con Frankfurter y stooq. No hay input del usuario en
 * las URLs → riesgo SSRF nulo.
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
  banxico: DatosBanco
  bcentral_chile: DatosBanco
  bcra: DatosBanco
}

// Valores de referencia hardcodeados — fallback cuando la API falla.
const FALLBACK: DatosBancosCentrales = {
  fed: {
    pais: "USA",
    moneda: "USD",
    tasa: 5.25,
    esVivo: false,
    refFecha: "2025-08",
    fuente: "hardcoded",
  },
  bce: {
    pais: "Eurozona",
    moneda: "EUR",
    tasa: 3.65,
    esVivo: false,
    refFecha: "2025-08",
    fuente: "hardcoded",
  },
  bcb: {
    pais: "Brasil",
    moneda: "BRL",
    tasa: 10.50,
    esVivo: false,
    refFecha: "2025-08",
    fuente: "hardcoded",
  },
  banxico: {
    pais: "México",
    moneda: "MXN",
    tasa: 10.50,
    esVivo: false,
    refFecha: "2025-08",
    fuente: "hardcoded",
  },
  bcentral_chile: {
    pais: "Chile",
    moneda: "CLP",
    tasa: 5.00,
    esVivo: false,
    refFecha: "2025-08",
    fuente: "hardcoded",
  },
  bcra: {
    pais: "Argentina",
    moneda: "ARS",
    tasa: null,
    esVivo: false,
    fuente: "/api/bcra",
    nota: "ver /api/bcra para datos en tiempo real",
  },
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
  const [bce, bcb] = await Promise.all([getTasaBCE(), getTasaBCB()])

  // Armar la respuesta completa: vivos donde conseguimos datos, hardcoded el resto.
  const data: DatosBancosCentrales = {
    fed: FALLBACK.fed,
    bce,
    bcb,
    banxico: FALLBACK.banxico,
    bcentral_chile: FALLBACK.bcentral_chile,
    bcra: FALLBACK.bcra,
  }

  // 3) ¿Alguna fuente en vivo funcionó? Si sí, guardar en cache "exitoso".
  const vivosOk = [bce, bcb].filter((b) => b.esVivo).length
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
