/**
 * /api/breakeven — Inflación implícita del mercado
 *
 * Breakeven = TEA LECAP (tasa fija) − inflación esperada REM.
 * Si LECAP_TEA > REM_infl, el mercado precia esa diferencia como tasa real implícita.
 *
 * Fuentes verificadas:
 *  - datos.gob.ar: BADLAR (89.2_TS_INTELAR_0_D_20) · TPM (89.2_TS_INTE_PM_0_D_16)
 *                  CER diario (94.2_CD_D_0_0_10) · REM inf. 12M (431.1_EXPECTATIVANA_M_0_0_29_85)
 *  - /api/deuda?n=1: LECAP TEM desde última licitación (fallback si Prisma vacío)
 *  - /api/bonos?tipo=lecap: curva LECAP completa (Prisma, opcional)
 *  - /api/rem: participantes REM con pronósticos individuales
 */
import { NextRequest, NextResponse } from "next/server"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

const SERIES = {
  badlar:     "89.2_TS_INTELAR_0_D_20",           // BADLAR privados TNA (diario)
  tpm:        "89.2_TS_INTE_PM_0_D_16",            // Tasa Política Monetaria (diario)
  cer_diario: "94.2_CD_D_0_0_10",                  // CER diario — Subsec. Programación Macro
  rem_inf12:  "431.1_EXPECTATIVANA_M_0_0_29_85",   // REM inflación 12M mediana (mensual, BCRA)
}

async function fetchSerie(id: string, limit = 35): Promise<{ fecha: string; valor: number }[]> {
  try {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${id}&limit=${limit}&sort=desc&format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "PanelDeControl/2.0" } })
    if (!res.ok) return []
    const json = await res.json()
    return ((json.data ?? []) as [string, number | null][])
      .filter(r => r[1] != null)
      .map(r => ({ fecha: r[0], valor: r[1] as number }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

/** LECAP TEM: 1) Prisma DB  2) última licitación Sec. Finanzas */
async function fetchLecapTem(): Promise<{ tem: number; ticker: string; fecha: string } | null> {
  // 1. Prisma-based screener (requiere seed)
  try {
    const res = await fetch(`${getBaseUrl()}/api/bonos?tipo=lecap`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const json = await res.json()
      const lecaps = (json.data ?? [])
        .filter((d: Record<string, unknown>) => d.tem != null && (d.diasVencimiento as number) > 0)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.diasVencimiento as number) - (b.diasVencimiento as number))
      if (lecaps.length > 0 && lecaps[0].tem != null) {
        return { tem: lecaps[0].tem as number, ticker: lecaps[0].ticker as string, fecha: lecaps[0].vencimiento as string }
      }
    }
  } catch { /* next fallback */ }

  // 2. Última licitación Sec. Finanzas (tiene fallback hardcoded)
  try {
    const res = await fetch(`${getBaseUrl()}/api/deuda?n=2`, { signal: AbortSignal.timeout(12000) })
    if (res.ok) {
      const json = await res.json()
      for (const licit of (json.data ?? [])) {
        const instrs: { tipo: string; tem: number }[] = licit?.instrumentos ?? []
        const lecapInstr = instrs.filter(i => i.tipo === "LECAP" && i.tem > 0)
        if (lecapInstr.length > 0) {
          // Usar el TEM más alto de la licitación (proxy de corto plazo)
          const max = lecapInstr.sort((a, b) => b.tem - a.tem)[0]
          return { tem: max.tem, ticker: "LECAP (últ. licitación)", fecha: licit.fecha ?? "" }
        }
      }
    }
  } catch { /* skip */ }

  return null
}

/** Curva LECAP completa (para el gráfico — solo si Prisma tiene datos) */
async function fetchLecapsCurva(): Promise<{ ticker: string; vencimiento: string; tem: number | null; tir: number | null; diasVto: number }[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/bonos?tipo=lecap`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data ?? []).filter((d: Record<string, unknown>) => d.tir != null || d.tem != null)
  } catch { return [] }
}

/** REM participantes (del Excel BCRA) */
async function fetchRemParticipantes(): Promise<{
  inflacion_12m: number | null
  dolar_12m: number | null
  tasa_12m: number | null
  fecha: string | null
}> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/rem`, { signal: AbortSignal.timeout(14000) })
    if (!res.ok) return { inflacion_12m: null, dolar_12m: null, tasa_12m: null, fecha: null }
    const json = await res.json()
    return json.data?.kpis ?? { inflacion_12m: null, dolar_12m: null, tasa_12m: null, fecha: null }
  } catch { return { inflacion_12m: null, dolar_12m: null, tasa_12m: null, fecha: null } }
}

export async function GET(_req: NextRequest) {
  const cacheKey = "breakeven_v3"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const [badlarSerie, tpmSerie, cerSerie, remSerie, lecapResult, lecapsCurva, remExcel] = await Promise.all([
      fetchSerie(SERIES.badlar, 5),
      fetchSerie(SERIES.tpm, 5),
      fetchSerie(SERIES.cer_diario, 35),   // 35 días → trailing 30d
      fetchSerie(SERIES.rem_inf12, 3),     // últimas 3 mediciones mensuales
      fetchLecapTem(),
      fetchLecapsCurva(),
      fetchRemParticipantes(),
    ])

    // ── Tasas nominales de referencia ─────────────────────────────────────────
    const badlarActual = badlarSerie.at(-1)?.valor ?? null
    const tpmActual    = tpmSerie.at(-1)?.valor    ?? null
    const badlarFecha  = badlarSerie.at(-1)?.fecha ?? null

    const tna2tea = (tna: number) => (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100
    const badlarTEA = badlarActual != null ? tna2tea(badlarActual) : null
    const tpmTEA    = tpmActual    != null ? tna2tea(tpmActual)    : null

    // ── CER trailing 30d (variación diaria del coeficiente anualizada) ────────
    let cerInflacionAnual: number | null = null
    let cerInflacionMensual: number | null = null
    if (cerSerie.length >= 2) {
      const first = cerSerie[0].valor
      const last  = cerSerie.at(-1)!.valor
      const dias  = cerSerie.length
      const crec  = last / first
      cerInflacionAnual   = (Math.pow(crec, 365 / dias) - 1) * 100
      cerInflacionMensual = (Math.pow(crec, 30  / dias) - 1) * 100
    }
    const cerFecha = cerSerie.at(-1)?.fecha ?? null

    // ── LECAP TEA ─────────────────────────────────────────────────────────────
    const temATea = (tem: number) => (Math.pow(1 + tem / 100, 12) - 1) * 100

    const lecapCortoTEA = lecapResult?.tem != null ? temATea(lecapResult.tem) : null

    // Curva (solo si Prisma tiene datos)
    const lecapsCurvaFilt = lecapsCurva
      .filter(l => l.diasVto > 0 && l.diasVto < 365 && l.tem != null)
      .sort((a, b) => a.diasVto - b.diasVto)

    const lecapMedioTEA = lecapsCurvaFilt.length > 1
      ? temATea(lecapsCurvaFilt[Math.floor(lecapsCurvaFilt.length / 2)].tem!)
      : null

    // ── REM inflación 12M ─────────────────────────────────────────────────────
    // Primario: serie mensual datos.gob.ar (más rápida y confiable que Excel)
    // Fallback: Excel BCRA parseado por /api/rem
    const remInf12Series  = remSerie.at(-1)?.valor ?? null
    const remFechaSeries  = remSerie.at(-1)?.fecha ?? null
    const remInf12Final   = remInf12Series ?? remExcel.inflacion_12m
    const remFechaFinal   = remFechaSeries ?? remExcel.fecha

    // ── Breakeven real ────────────────────────────────────────────────────────
    const breakevenReal = lecapCortoTEA != null && remInf12Final != null
      ? parseFloat((lecapCortoTEA - remInf12Final).toFixed(1))
      : null

    const breakevenVsCER = lecapCortoTEA != null && cerInflacionAnual != null
      ? parseFloat((lecapCortoTEA - cerInflacionAnual).toFixed(1))
      : null

    const result = {
      data: {
        tasas: {
          badlar_tna:  badlarActual != null ? parseFloat(badlarActual.toFixed(2)) : null,
          badlar_tea:  badlarTEA   != null ? parseFloat(badlarTEA.toFixed(2))   : null,
          tpm_tna:     tpmActual   != null ? parseFloat(tpmActual.toFixed(2))   : null,
          tpm_tea:     tpmTEA      != null ? parseFloat(tpmTEA.toFixed(2))      : null,
          fecha:       badlarFecha,
        },
        cer: {
          inflacion_anual_trailing:   cerInflacionAnual   != null ? parseFloat(cerInflacionAnual.toFixed(1))   : null,
          inflacion_mensual_trailing: cerInflacionMensual != null ? parseFloat(cerInflacionMensual.toFixed(2)) : null,
          fecha: cerFecha,
        },
        lecaps: lecapsCurvaFilt.map(l => ({
          ticker:      l.ticker,
          vencimiento: l.vencimiento,
          dias_vto:    l.diasVto,
          tem:         l.tem,
          tea:         l.tem != null ? parseFloat(temATea(l.tem).toFixed(1)) : null,
        })),
        lecap_referencia: lecapResult ? {
          tem:    lecapResult.tem,
          tea:    lecapCortoTEA != null ? parseFloat(lecapCortoTEA.toFixed(1)) : null,
          ticker: lecapResult.ticker,
          fecha:  lecapResult.fecha,
        } : null,
        rem: {
          inflacion_12m: remInf12Final,
          dolar_12m:     remExcel.dolar_12m,
          tasa_12m:      remExcel.tasa_12m,
          fecha:         remFechaFinal,
        },
        breakeven: {
          lecap_corto_tea:  lecapCortoTEA != null ? parseFloat(lecapCortoTEA.toFixed(1)) : null,
          lecap_medio_tea:  lecapMedioTEA != null ? parseFloat(lecapMedioTEA.toFixed(1)) : null,
          real_vs_rem:      breakevenReal,
          inflac_vs_cer:    breakevenVsCER,
          interpretation:   breakevenReal != null
            ? breakevenReal > 5
              ? "Tasa real implícita POSITIVA — LECAPs rinden por encima de la inflación esperada"
              : breakevenReal > 0
              ? "Tasa real implícita levemente positiva"
              : "Tasa real implícita NEGATIVA — mercado descuenta inflación mayor que LECAP nominal"
            : null,
        },
      },
      updated_at: new Date().toISOString(),
      source: "datos.gob.ar (BADLAR, TPM, CER, REM mediana) · Sec. Finanzas (LECAP licitación) · BCRA REM Excel (FX/tasa)",
    }

    setCache(cacheKey, result, 1800)
    return NextResponse.json(result)
  } catch (err) {
    console.error("Breakeven endpoint error:", err)
    return NextResponse.json({ error: "Failed to compute breakeven" }, { status: 500 })
  }
}
