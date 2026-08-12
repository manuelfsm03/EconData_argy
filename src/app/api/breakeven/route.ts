import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/breakeven — Inflación implícita del mercado
 *
 * Breakeven = diferencia entre la tasa nominal de LECAPs/BONCAPs (tasa fija)
 * y la tasa real de instrumentos CER (ajustables por inflación).
 * Si LECAP_TEA > CER_real, el mercado "precia" esa diferencia como inflación implícita.
 *
 * Fuentes:
 *  - BCRA datos.gob.ar: BADLAR, TPM, tasas de referencia
 *  - datos.gob.ar: CER diario (coeficiente de estabilización de referencia)
 *  - /api/bonos?tipo=lecap: TEM/TIR de LECAPs/BONCAPs (desde DB local)
 *  - /api/rem: mediana REM analistas (benchmark)
 */
import { NextResponse } from "next/server"
import { parseRemExcel } from "@/server/domain/rem-data"
import { prisma } from "@/server/db/prisma"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// IDs de series datos.gob.ar
const SERIES = {
  badlar:      "89.2_TS_INTELAR_0_D_20",   // BADLAR privados TNA
  tpm:         "168.1_T_CAMBIA_0_0_22",     // Tasa política monetaria
  cer_diario:  "98.1_CER_0_D_36",           // CER diario (coeficiente)
}

async function fetchSerie(id: string, limit = 60): Promise<{ fecha: string; valor: number }[]> {
  try {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${id}&limit=${limit}&sort=desc&format=json`
    const res = await fetchRegistered(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 300 } })
    if (!res.ok) return []
    const json = await res.json()
    return ((json.data ?? []) as [string, number | null][])
      .filter(r => r[1] != null)
      .map(r => ({ fecha: r[0], valor: r[1] as number }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}

async function fetchLecaps(): Promise<{ ticker: string; vencimiento: string; tem: number | null; tir: number | null; diasVto: number }[]> {
  try {
    const instruments = await prisma.capInstrument.findMany({
      where: { vencimiento: { gt: new Date() } },
      orderBy: { vencimiento: "asc" },
    })
    return instruments.map((instrument) => ({
      ticker: instrument.ticker,
      vencimiento: instrument.vencimiento.toISOString().slice(0, 10),
      tem: instrument.tem,
      tir: instrument.tir,
      diasVto: Math.round((instrument.vencimiento.getTime() - Date.now()) / 86_400_000),
    }))
  } catch { return [] }
}

async function fetchRem(): Promise<{ inflacion_12m: number | null; dolar_12m: number | null; tasa_12m: number | null; fecha: string | null }> {
  try {
    const res = await fetchRegistered("https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/historico-relevamiento-expectativas-mercado.xlsx", {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`BCRA REM ${res.status}`)
    const { serie } = parseRemExcel(Buffer.from(await res.arrayBuffer()))
    const latest = serie.at(-1)
    return {
      inflacion_12m: latest?.inflacion_12m ?? null,
      dolar_12m: latest?.dolar_12m ?? null,
      tasa_12m: latest?.tasa_12m ?? null,
      fecha: latest?.fecha ?? null,
    }
  } catch { return { inflacion_12m: null, dolar_12m: null, tasa_12m: null, fecha: null } }
}

export async function GET() {
  const cacheKey = "breakeven_v1"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const [badlarSerie, tpmSerie, cerSerie, lecaps, rem] = await Promise.all([
      fetchSerie(SERIES.badlar, 30),
      fetchSerie(SERIES.tpm, 30),
      fetchSerie(SERIES.cer_diario, 30),
      fetchLecaps(),
      fetchRem(),
    ])

    // ── Tasas nominales de referencia ─────────────────────────────────────────
    const badlarActual = badlarSerie.at(-1)?.valor ?? null     // TNA anual %
    const tpmActual    = tpmSerie.at(-1)?.valor    ?? null     // TNA %
    const badlarFecha  = badlarSerie.at(-1)?.fecha ?? null

    // Convertir TNA → TEA: (1 + TNA/365)^365 - 1
    const tna2tea = (tna: number) => (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100
    const badlarTEA = badlarActual != null ? tna2tea(badlarActual) : null
    const tpmTEA    = tpmActual    != null ? tna2tea(tpmActual)    : null

    // ── CER: variación del coeficiente → inflación trailing ──────────────────
    // CER cae los mismos cambios que el IPC rezagado 2 meses.
    // Anualizar la variación diaria promedio de los últimos 30 días.
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

    // ── Breakeven desde LECAP TEM ─────────────────────────────────────────────
    // TEA implícita del LECAP más corto (proxy de expectativa de corto plazo)
    const lecapsCurva = lecaps
      .filter(l => l.diasVto > 0 && l.diasVto < 365 && l.tem != null)
      .sort((a, b) => a.diasVto - b.diasVto)

    const lecapCorto  = lecapsCurva[0]  ?? null   // vto más próximo
    const lecapMedio  = lecapsCurva[Math.floor(lecapsCurva.length / 2)] ?? null  // vto medio

    const temATea = (tem: number) => (Math.pow(1 + tem / 100, 12) - 1) * 100

    const lecapCortoTEA = lecapCorto?.tem != null ? temATea(lecapCorto.tem) : null
    const lecapMedioTEA = lecapMedio?.tem != null ? temATea(lecapMedio.tem) : null

    // Breakeven real = LECAP_TEA - REM_inflacion_12M  (superávit real implícito)
    const breakevenReal = lecapCortoTEA != null && rem.inflacion_12m != null
      ? lecapCortoTEA - rem.inflacion_12m
      : null

    // Breakeven inflación implícita desde LECAP vs tasa real asumida = 0
    // (si CER está disponible, usamos CER como base de comparación)
    const breakevenVsCER = lecapCortoTEA != null && cerInflacionAnual != null
      ? lecapCortoTEA - cerInflacionAnual
      : null

    const result = {
      data: {
        // Tasas nominales de referencia
        tasas: {
          badlar_tna:  badlarActual,
          badlar_tea:  badlarTEA,
          tpm_tna:     tpmActual,
          tpm_tea:     tpmTEA,
          fecha:       badlarFecha,
        },
        // Inflación observada en CER (trailing, rezagada ~2 meses)
        cer: {
          inflacion_anual_trailing:   cerInflacionAnual,
          inflacion_mensual_trailing: cerInflacionMensual,
          fecha: cerFecha,
        },
        // Curva LECAP/BONCAP (tasa fija mercado)
        lecaps: lecapsCurva.map(l => ({
          ticker:     l.ticker,
          vencimiento: l.vencimiento,
          dias_vto:   l.diasVto,
          tem:        l.tem,
          tea:        l.tem != null ? temATea(l.tem) : null,
        })),
        // REM — expectativas analistas
        rem: {
          inflacion_12m: rem.inflacion_12m,
          dolar_12m:     rem.dolar_12m,
          tasa_12m:      rem.tasa_12m,
          fecha:         rem.fecha,
        },
        // Breakeven calculado
        breakeven: {
          lecap_corto_tea:    lecapCortoTEA,
          lecap_medio_tea:    lecapMedioTEA,
          real_vs_rem:        breakevenReal,        // = LECAP_TEA - inflac_REM → tasa real implícita
          inflac_vs_cer:      breakevenVsCER,       // = LECAP_TEA - CER_trailing → "prima sobre CER"
          // Resumen legible
          interpretation: breakevenReal != null
            ? breakevenReal > 5
              ? "Tasa real implícita POSITIVA — LECAPs rinden por encima de la inflación esperada"
              : breakevenReal > 0
              ? "Tasa real implícita levemente positiva"
              : "Tasa real implícita NEGATIVA — mercado descuenta inflación mayor que LECAP nominal"
            : null,
        },
      },
      updated_at: new Date().toISOString(),
      source: "BCRA datos.gob.ar (BADLAR, TPM, CER) · DB local (LECAP) · REM BCRA",
    }

    setCache(cacheKey, result, 1800)  // 30 min
    return NextResponse.json(result)
  } catch (err) {
    console.error("Breakeven endpoint error:", err)
    return NextResponse.json({ error: "Failed to compute breakeven" }, { status: 500 })
  }
}
