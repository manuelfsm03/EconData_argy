/**
 * GET /api/admin/completitud
 * ─────────────────────────────────────────────────────────
 * Agente interno de completitud: verifica que cada endpoint
 * del dashboard tenga datos reales, frescos y no hardcodeados.
 *
 * Auth: header x-admin-password
 * ─────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"

export const runtime    = "nodejs"
export const maxDuration = 30

function requireAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  if (req.headers.get("x-admin-password") === expected) return true
  if (req.cookies.get("lapizarra_admin")?.value === expected) return true
  return false
}

function getBase(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const port = process.env.PORT ?? "3000"
  return `http://localhost:${port}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "stale" | "empty" | "hardcoded" | "error"

interface CheckResult {
  id:          string
  label:       string
  categoria:   string
  status:      CheckStatus
  mensaje:     string
  detalle?:    string
  freshnessMs?: number
  hardcoded?:  string[]
  latency_ms:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ping(path: string, timeoutMs = 8000): Promise<{ ok: boolean; data: unknown; latency: number; error?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${getBase()}${path}`, {
      headers: { "x-internal-agent": "completitud" },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const latency = Date.now() - t0
    if (!res.ok) return { ok: false, data: null, latency, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, data, latency }
  } catch (e) {
    return { ok: false, data: null, latency: Date.now() - t0, error: String(e).slice(0, 100) }
  }
}

function ageMs(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Date.now() - d.getTime()
}

function staleLabel(ms: number): string {
  const h = Math.round(ms / 3_600_000)
  if (h < 1)  return `hace ${Math.round(ms / 60_000)} min`
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.round(h / 24)} días`
}

// ── Checks individuales ───────────────────────────────────────────────────────

async function checkDolares(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/dolares")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "dolares", label: "Tipos de cambio", categoria: "Cambiario", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d = data as Record<string, unknown>
  const rates = d.rates as Record<string, { venta: number; actualizacion: string }> | undefined
  if (!rates || Object.keys(rates).length === 0)
    return { ...base, status: "empty", mensaje: "No hay cotizaciones" }

  const blue = rates.blue
  const age  = ageMs(blue?.actualizacion)
  const hc: string[] = []
  if (!rates.oficial?.venta || !rates.blue?.venta)
    hc.push("oficial o blue ausentes")

  if (age !== null && age > 6 * 3_600_000)
    return { ...base, status: "stale", mensaje: `Dato desactualizado (${staleLabel(age)})`, freshnessMs: age, hardcoded: hc }

  return { ...base, status: "ok", mensaje: `${Object.keys(rates).length} cotizaciones · ${staleLabel(age ?? 0)}`, freshnessMs: age ?? 0, hardcoded: hc }
}

async function checkMacroEndpoint(
  endpoint: string, label: string, serieKey: string, maxStaleDays: number
): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping(`/api/macro?endpoint=${endpoint}`)
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: `macro_${endpoint}`, label, categoria: "Macro", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d  = data as Record<string, unknown>
  const dd = d.data as Record<string, [string, number][]> | undefined
  const serie = dd?.[serieKey]
  if (!serie?.length)
    return { ...base, status: "empty", mensaje: `Serie '${serieKey}' vacía` }

  const lastDate = serie[0][0]
  const age = ageMs(lastDate)
  if (age !== null && age > maxStaleDays * 86_400_000)
    return { ...base, status: "stale", mensaje: `Último dato: ${lastDate} (${staleLabel(age)})`, freshnessMs: age }

  return { ...base, status: "ok", mensaje: `Último dato: ${lastDate}`, freshnessMs: age ?? 0 }
}

async function checkRiesgoPais(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/riesgo-pais")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "riesgo_pais", label: "Riesgo País (EMBI)", categoria: "Cambiario", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d = data as Record<string, unknown>
  if (!d.embi) return { ...base, status: "empty", mensaje: "EMBI ausente" }

  // Detectar regionales hardcodeados
  const reg = d.regionales as Record<string, { bps: number }> | undefined
  const hc: string[] = []
  if (reg?.brasil?.bps === 225 && reg?.chile?.bps === 70)
    hc.push("regionales fijos (brasil:225, chile:70) — actualizar con fuente real")

  const age = ageMs((d as Record<string, unknown>).fecha as string)
  if (age !== null && age > 2 * 3_600_000)
    return { ...base, status: "stale", mensaje: `EMBI ${d.embi} bps · ${staleLabel(age)}`, freshnessMs: age, hardcoded: hc }

  return { ...base, status: "ok", mensaje: `EMBI ${d.embi} bps`, hardcoded: hc, freshnessMs: age ?? 0 }
}

async function checkMundo(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/mundo")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "mundo", label: "Mercados Globales", categoria: "Mercados", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d = data as Record<string, unknown>
  const keys = Object.keys(d).filter(k => k !== "fuente" && k !== "timestamp")
  const nullCount = keys.filter(k => (d[k] as Record<string, unknown>)?.price == null).length

  if (keys.length === 0) return { ...base, status: "empty", mensaje: "Sin datos de mercados" }
  if (nullCount > keys.length / 2)
    return { ...base, status: "stale", mensaje: `${nullCount}/${keys.length} tickers sin precio (¿mercado cerrado?)` }

  return { ...base, status: "ok", mensaje: `${keys.length - nullCount}/${keys.length} tickers con precio` }
}

async function checkAcciones(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/acciones?category=all")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "acciones", label: "Acciones Merval", categoria: "Mercados", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).quotes as unknown[]
  if (!arr?.length) return { ...base, status: "empty", mensaje: "Sin cotizaciones" }

  const withPrice = (arr as Record<string, unknown>[]).filter(q => q.price != null).length
  if (withPrice === 0) return { ...base, status: "stale", mensaje: "Todas las acciones sin precio" }

  return { ...base, status: "ok", mensaje: `${withPrice}/${arr.length} acciones con precio` }
}

async function checkRSSNews(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/rss-news", 12000)
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "rss_news", label: "Noticias RSS", categoria: "Noticias", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const items = Array.isArray(data) ? data : []
  if (items.length === 0) return { ...base, status: "empty", mensaje: "Sin noticias" }

  const newest = items[0] as Record<string, string>
  const age    = ageMs(newest?.pubDate)
  if (age !== null && age > 4 * 3_600_000)
    return { ...base, status: "stale", mensaje: `Última noticia ${staleLabel(age)}`, freshnessMs: age }

  return { ...base, status: "ok", mensaje: `${items.length} noticias · última ${staleLabel(age ?? 0)}`, freshnessMs: age ?? 0 }
}

async function checkDeuda(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/deuda")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "deuda", label: "Deuda / Licitaciones", categoria: "Fiscal", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d    = data as Record<string, unknown>
  const lics = (d.licitaciones ?? d.data) as unknown[] | undefined
  if (!lics?.length) return { ...base, status: "empty", mensaje: "Sin licitaciones — scraping posiblemente caído" }

  const hc: string[] = []
  const primera = lics[0] as Record<string, string>
  const age = ageMs(primera?.fecha)
  if (age !== null && age > 90 * 86_400_000)
    hc.push("licitaciones posiblemente hardcodeadas (>90 días de antigüedad)")

  return {
    ...base,
    status:   hc.length ? "hardcoded" : "ok",
    mensaje:  `${lics.length} licitaciones · última: ${primera?.fecha ?? "?"}`,
    hardcoded: hc,
  }
}

async function checkTCHistorico(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/tc-historico?period=1m")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "tc_historico", label: "TC Histórico", categoria: "Cambiario", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d    = data as Record<string, unknown>
  const blue = d.blue as { fecha: string; valor: number }[] | undefined
  if (!blue?.length) return { ...base, status: "empty", mensaje: "Serie blue vacía" }

  const lastDate = blue[blue.length - 1]?.fecha
  const age = ageMs(lastDate)
  if (age !== null && age > 3 * 86_400_000)
    return { ...base, status: "stale", mensaje: `Último punto: ${lastDate} (${staleLabel(age)})`, freshnessMs: age }

  return { ...base, status: "ok", mensaje: `${blue.length} puntos · último: ${lastDate}`, freshnessMs: age ?? 0 }
}

async function checkGeopolitica(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/geopolitica", 12000)
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "geopolitica", label: "Geopolítica RSS", categoria: "Noticias", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const items = Array.isArray(data) ? data : (data as Record<string, unknown>).items as unknown[] ?? []
  if (items.length === 0) return { ...base, status: "empty", mensaje: "Sin noticias geopolíticas" }

  const newest = items[0] as Record<string, string>
  const age    = ageMs(newest?.pubDate ?? newest?.date)
  if (age !== null && age > 6 * 3_600_000)
    return { ...base, status: "stale", mensaje: `Última noticia ${staleLabel(age)}`, freshnessMs: age }

  return { ...base, status: "ok", mensaje: `${items.length} noticias · última ${staleLabel(age ?? 0)}`, freshnessMs: age ?? 0 }
}

async function checkBonos(): Promise<CheckResult> {
  const { ok, data, latency, error } = await ping("/api/bonos?ticker=AL30")
  const base: Omit<CheckResult, "status" | "mensaje" | "detalle"> = {
    id: "bonos", label: "Bonos (AL30)", categoria: "Mercados", latency_ms: latency,
  }
  if (!ok) return { ...base, status: "error", mensaje: error ?? "Sin respuesta" }

  const d = data as Record<string, unknown>
  if (!d.price && !d.last) return { ...base, status: "empty", mensaje: "AL30 sin precio" }

  return { ...base, status: "ok", mensaje: `AL30 precio disponible` }
}

// ── Runner principal ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!requireAdmin(req))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tStart = Date.now()

  const results = await Promise.all([
    checkDolares(),
    checkMacroEndpoint("emae",    "EMAE Actividad",       "emae",            45),
    checkMacroEndpoint("ipc",     "IPC Inflación",        "ipc_var_mensual",  45),
    checkMacroEndpoint("ipi",     "IPI Manufacturero",    "ipi",             60),
    checkMacroEndpoint("balanza", "Balanza Comercial",    "exportaciones",   60),
    checkMacroEndpoint("fiscal",  "Resultado Fiscal",     "resultado_primario", 60),
    checkRiesgoPais(),
    checkMundo(),
    checkAcciones(),
    checkRSSNews(),
    checkDeuda(),
    checkTCHistorico(),
    checkGeopolitica(),
    checkBonos(),
  ])

  const summary = {
    ok:        results.filter(r => r.status === "ok").length,
    stale:     results.filter(r => r.status === "stale").length,
    empty:     results.filter(r => r.status === "empty").length,
    hardcoded: results.filter(r => r.status === "hardcoded").length,
    error:     results.filter(r => r.status === "error").length,
    total:     results.length,
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    elapsed_ms:   Date.now() - tStart,
    summary,
    checks:       results,
  })
}
