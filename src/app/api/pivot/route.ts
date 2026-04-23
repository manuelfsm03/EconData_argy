/**
 * GET /api/pivot?series=emae,ipc_var_mensual,tc_blue&period=1y
 *
 * Sirve múltiples series normalizadas para PIVOT.
 * Todas las series retornan { date: string, value: number }[]
 * ordenadas cronológicamente ASC.
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function getBase() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return `http://localhost:${process.env.PORT ?? "3000"}`
}

async function apiFetch(path: string) {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { "x-internal-agent": "pivot" },
    signal:  AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

type DataPoint = { date: string; value: number }

// ── Fetchers por serie ────────────────────────────────────────────────────────

async function fetchMacroSerie(endpoint: string, key: string): Promise<DataPoint[]> {
  const d = await apiFetch(`/api/macro?endpoint=${endpoint}`) as { data?: Record<string, [string, number][]> }
  const serie = d.data?.[key] ?? []
  return serie
    .map(([date, value]) => ({ date, value }))
    .reverse()
}

async function fetchTCHistorico(key: "blue" | "oficial" | "bolsa" | "contadoconliqui" | "mayorista", period: string): Promise<DataPoint[]> {
  const d = await apiFetch(`/api/tc-historico?period=${period}`) as Record<string, { fecha: string; valor: number }[]>
  return (d[key] ?? []).map(p => ({ date: p.fecha, value: p.valor }))
}

async function fetchMundo(ticker: string): Promise<DataPoint[]> {
  const d = await apiFetch(`/api/mundo?ticker=${ticker}&hist=1y`) as { historico?: { date: string; close: number }[] }
  return (d.historico ?? []).map(p => ({ date: p.date, value: p.close }))
}

async function fetchBCRA(seriesId: string): Promise<DataPoint[]> {
  const d = await apiFetch(`/api/bcra-data`) as { data?: Record<string, { fecha: string; valor: number }[]> }
  return (d.data?.[seriesId] ?? []).map(p => ({ date: p.fecha, value: p.valor }))
}

// ── Mapa completo serie_id → fetcher ─────────────────────────────────────────

const SERIES_MAP: Record<string, (period: string) => Promise<DataPoint[]>> = {
  // Macro
  emae:                  () => fetchMacroSerie("emae",    "emae"),
  emae_var_mensual:      () => fetchMacroSerie("emae",    "emae_var_mensual"),
  emae_var_interanual:   () => fetchMacroSerie("emae",    "emae_var_interanual"),
  ipc_general:           () => fetchMacroSerie("ipc",     "ipc_general"),
  ipc_var_mensual:       () => fetchMacroSerie("ipc",     "ipc_var_mensual"),
  ipc_nucleo:            () => fetchMacroSerie("ipc",     "ipc_nucleo"),
  ipc_regulados:         () => fetchMacroSerie("ipc",     "ipc_regulados"),
  ipc_alimentos:         () => fetchMacroSerie("ipc",     "ipc_alimentos"),
  ipi:                   () => fetchMacroSerie("ipi",     "ipi"),
  ipi_var_interanual:    () => fetchMacroSerie("ipi",     "ipi_var_interanual"),
  exportaciones:         () => fetchMacroSerie("balanza", "exportaciones"),
  importaciones:         () => fetchMacroSerie("balanza", "importaciones"),
  saldo_comercial:       () => fetchMacroSerie("balanza", "saldo_comercial"),
  resultado_primario:    () => fetchMacroSerie("fiscal",  "resultado_primario"),
  resultado_financiero:  () => fetchMacroSerie("fiscal",  "resultado_financiero"),
  recaudacion:           () => fetchMacroSerie("fiscal",  "recaudacion"),
  // TC histórico
  tc_blue:      (p) => fetchTCHistorico("blue",            p),
  tc_oficial:   (p) => fetchTCHistorico("oficial",         p),
  tc_mep:       (p) => fetchTCHistorico("bolsa",           p),
  tc_ccl:       (p) => fetchTCHistorico("contadoconliqui", p),
  tc_mayorista: (p) => fetchTCHistorico("mayorista",       p),
  // Mercados
  sp500:    () => fetchMundo("sp500"),
  nasdaq:   () => fetchMundo("nasdaq"),
  vix:      () => fetchMundo("vix"),
  petroleo: () => fetchMundo("petroleo"),
  soja:     () => fetchMundo("soja"),
  oro:      () => fetchMundo("oro"),
  us10y:    () => fetchMundo("us10y"),
  bitcoin:  () => fetchMundo("bitcoin"),
  // BCRA
  reservas_bcra: () => fetchBCRA("reservas"),
  badlar:        () => fetchBCRA("badlar"),
}

// ── Catálogo de metadata ──────────────────────────────────────────────────────

export const SERIES_CATALOG = [
  // Actividad
  { id: "emae",               label: "EMAE (Actividad)",        unidad: "índice",    categoria: "Actividad",  frecuencia: "mensual" },
  { id: "emae_var_mensual",   label: "EMAE Var. Mensual",       unidad: "%",         categoria: "Actividad",  frecuencia: "mensual" },
  { id: "emae_var_interanual",label: "EMAE Var. Interanual",    unidad: "%",         categoria: "Actividad",  frecuencia: "mensual" },
  { id: "ipi",                label: "IPI Manufacturero",       unidad: "índice",    categoria: "Actividad",  frecuencia: "mensual" },
  { id: "ipi_var_interanual", label: "IPI Var. Interanual",     unidad: "%",         categoria: "Actividad",  frecuencia: "mensual" },
  // Precios
  { id: "ipc_general",        label: "IPC General (nivel)",     unidad: "índice",    categoria: "Precios",    frecuencia: "mensual" },
  { id: "ipc_var_mensual",    label: "IPC Var. Mensual",        unidad: "%",         categoria: "Precios",    frecuencia: "mensual" },
  { id: "ipc_nucleo",         label: "IPC Núcleo",              unidad: "índice",    categoria: "Precios",    frecuencia: "mensual" },
  { id: "ipc_regulados",      label: "IPC Regulados",           unidad: "índice",    categoria: "Precios",    frecuencia: "mensual" },
  { id: "ipc_alimentos",      label: "IPC Alimentos",           unidad: "índice",    categoria: "Precios",    frecuencia: "mensual" },
  // Comercio
  { id: "exportaciones",      label: "Exportaciones",           unidad: "USD mill.", categoria: "Comercio",   frecuencia: "mensual" },
  { id: "importaciones",      label: "Importaciones",           unidad: "USD mill.", categoria: "Comercio",   frecuencia: "mensual" },
  { id: "saldo_comercial",    label: "Saldo Comercial",         unidad: "USD mill.", categoria: "Comercio",   frecuencia: "mensual" },
  // Fiscal
  { id: "resultado_primario",   label: "Resultado Primario",    unidad: "ARS mill.", categoria: "Fiscal",     frecuencia: "mensual" },
  { id: "resultado_financiero", label: "Resultado Financiero",  unidad: "ARS mill.", categoria: "Fiscal",     frecuencia: "mensual" },
  { id: "recaudacion",          label: "Recaudación",           unidad: "ARS mill.", categoria: "Fiscal",     frecuencia: "mensual" },
  // Tipo de cambio
  { id: "tc_blue",     label: "Dólar Blue",     unidad: "ARS/USD", categoria: "Cambiario", frecuencia: "diaria" },
  { id: "tc_oficial",  label: "Dólar Oficial",  unidad: "ARS/USD", categoria: "Cambiario", frecuencia: "diaria" },
  { id: "tc_mep",      label: "Dólar MEP",      unidad: "ARS/USD", categoria: "Cambiario", frecuencia: "diaria" },
  { id: "tc_ccl",      label: "Dólar CCL",      unidad: "ARS/USD", categoria: "Cambiario", frecuencia: "diaria" },
  { id: "tc_mayorista",label: "Dólar Mayorista",unidad: "ARS/USD", categoria: "Cambiario", frecuencia: "diaria" },
  // Mercados
  { id: "sp500",    label: "S&P 500",   unidad: "puntos",     categoria: "Mercados", frecuencia: "diaria" },
  { id: "nasdaq",   label: "NASDAQ",    unidad: "puntos",     categoria: "Mercados", frecuencia: "diaria" },
  { id: "vix",      label: "VIX",       unidad: "índice",     categoria: "Mercados", frecuencia: "diaria" },
  { id: "petroleo", label: "Petróleo",  unidad: "USD/barril", categoria: "Mercados", frecuencia: "diaria" },
  { id: "soja",     label: "Soja",      unidad: "USD/bushel", categoria: "Mercados", frecuencia: "diaria" },
  { id: "oro",      label: "Oro",       unidad: "USD/oz",     categoria: "Mercados", frecuencia: "diaria" },
  { id: "us10y",    label: "UST 10Y",   unidad: "% anual",    categoria: "Mercados", frecuencia: "diaria" },
  { id: "bitcoin",  label: "Bitcoin",   unidad: "USD",        categoria: "Mercados", frecuencia: "diaria" },
  // BCRA
  { id: "reservas_bcra", label: "Reservas BCRA", unidad: "USD mill.", categoria: "BCRA", frecuencia: "diaria" },
  { id: "badlar",        label: "BADLAR TNA",    unidad: "% anual",   categoria: "BCRA", frecuencia: "diaria" },
]

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params  = req.nextUrl.searchParams
  const seriesQ = params.get("series") ?? ""
  const period  = params.get("period") ?? "1y"

  // Catálogo puro
  if (seriesQ === "catalog") {
    return NextResponse.json({ catalog: SERIES_CATALOG })
  }

  const ids = seriesQ.split(",").map(s => s.trim()).filter(Boolean).slice(0, 5)
  if (!ids.length) return NextResponse.json({ error: "Parámetro 'series' requerido" }, { status: 400 })

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const fetcher = SERIES_MAP[id]
      if (!fetcher) return { id, error: "Serie no encontrada", data: [] }
      const data = await fetcher(period)
      return { id, data }
    })
  )

  const series = results.map((r) =>
    r.status === "fulfilled" ? r.value : { id: "error", data: [], error: String(r.reason) }
  )

  return NextResponse.json({ series, period })
}
