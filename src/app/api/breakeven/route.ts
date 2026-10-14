import { fetchRegistered } from "@/server/http/fetch-source"
/**
 * /api/breakeven — Inflación implícita del mercado
 *
 * Breakeven = diferencia entre la tasa nominal de LECAPs/BONCAPs (tasa fija)
 * y la tasa real de instrumentos CER (ajustables por inflación).
 * Si LECAP_TEA > CER_real, el mercado "precia" esa diferencia como inflación implícita.
 *
 * Fuentes:
 *  - BCRA API v4.0: TAMAR (referencia vigente), BADLAR (var 7), pases 1d
 *    (proxy TPM, var 150), CER (var 30)
 *  - /api/bonos?tipo=lecap: TEM/TIR de LECAPs/BONCAPs (desde DB local)
 *  - /api/rem: mediana REM analistas (benchmark)
 *
 * BADLAR y CER se migraron de datos.gob.ar a la API oficial del BCRA
 * (verificado en vivo 14/10/2026): la serie datos.gob.ar de BADLAR
 * ("89.2_TS_INTELAR_0_D_20") está congelada desde el 18/06/2026 sin importar
 * el limit pedido (no es el bug de paginación, la propia API la tiene
 * frenada ahí), y la de CER ("98.1_CER_0_D_36") fue dada de baja directamente
 * ("Serie inexistente"). La API oficial del BCRA tiene ambas al día.
 */
import { NextResponse } from "next/server"
import { parseRemExcel, REM_XLSX_URL } from "@/server/domain/rem-data"
import { prisma } from "@/server/db/prisma"
import { bcraOfficialApi } from "@/server/sources/bcra-official-api"

const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

function rangoDesde(limit: number): { from: string; today: string } {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - Math.max(limit * 2, 120))
  return { from: from.toISOString().slice(0, 10), today: today.toISOString().slice(0, 10) }
}

async function fetchTamar(limit = 60): Promise<{ fecha: string; valor: number }[]> {
  try {
    const { from, today } = rangoDesde(limit)
    const data = await bcraOfficialApi.getSeriesData(44, from, today, limit)
    return data
      .map((row) => ({ fecha: row.fecha, valor: row.valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}

// BADLAR migró de datos.gob.ar ("89.2_TS_INTELAR_0_D_20", congelada desde el
// 18/06/2026 sin importar el limit pedido — no es el bug de paginación, la
// propia serie está frenada ahí) a la API oficial del BCRA, que la tiene al día.
async function fetchBadlarVigente(limit = 60): Promise<{ fecha: string; valor: number }[]> {
  try {
    const { from, today } = rangoDesde(limit)
    const data = await bcraOfficialApi.getSeriesData(7, from, today, limit)
    return data
      .map((row) => ({ fecha: row.fecha, valor: row.valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}

// CER migró de datos.gob.ar ("98.1_CER_0_D_36", dada de baja — "Serie
// inexistente", verificado en vivo 14/10/2026) a la API oficial del BCRA
// (var 30), que la tiene al día.
async function fetchCerReferencia(limit = 60): Promise<{ fecha: string; valor: number }[]> {
  try {
    const { from, today } = rangoDesde(limit)
    const data = await bcraOfficialApi.getSeriesData(30, from, today, limit)
    return data
      .map((row) => ({ fecha: row.fecha, valor: row.valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  } catch { return [] }
}

// Var 6 ("Tasa de política monetaria") y la serie datos.gob.ar equivalente
// ("168.1_T_CAMBIA_0_0_22") fueron dadas de baja (ver src/app/api/bcra/route.ts)
// — se usa la var 150 (pases entre terceros a 1 día) como proxy vigente.
async function fetchPasesReferencia(limit = 60): Promise<{ fecha: string; valor: number }[]> {
  try {
    const { from, today } = rangoDesde(limit)
    const data = await bcraOfficialApi.getSeriesData(150, from, today, limit)
    return data
      .map((row) => ({ fecha: row.fecha, valor: row.valor }))
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
    const res = await fetchRegistered(REM_XLSX_URL, {
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
  const cacheKey = "breakeven_v2_tamar"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const [tamarSerie, badlarSerie, tpmSerie, cerSerie, lecaps, rem] = await Promise.all([
      fetchTamar(30),
      fetchBadlarVigente(30),
      fetchPasesReferencia(30),
      fetchCerReferencia(30),
      fetchLecaps(),
      fetchRem(),
    ])

    // ── Tasas nominales de referencia ─────────────────────────────────────────
    const tamarActual  = tamarSerie.at(-1)?.valor  ?? null     // TNA anual %
    const badlarActual = badlarSerie.at(-1)?.valor ?? null     // TNA anual % histórica
    const tpmActual    = tpmSerie.at(-1)?.valor    ?? null     // TNA %
    const tamarFecha   = tamarSerie.at(-1)?.fecha  ?? null
    const badlarFecha  = badlarSerie.at(-1)?.fecha ?? null

    // Convertir TNA → TEA: (1 + TNA/365)^365 - 1
    const tna2tea = (tna: number) => (Math.pow(1 + tna / 100 / 365, 365) - 1) * 100
    const tamarTEA  = tamarActual  != null ? tna2tea(tamarActual)  : null
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
          reference_name: "TAMAR",
          reference_tna: tamarActual,
          reference_tea: tamarTEA,
          tamar_tna:   tamarActual,
          tamar_tea:   tamarTEA,
          badlar_tna:  badlarActual,
          badlar_tea:  badlarTEA,
          tpm_tna:     tpmActual,
          tpm_tea:     tpmTEA,
          reference_fecha: tamarFecha,
          tamar_fecha: tamarFecha,
          // Compatibilidad: `fecha` históricamente refiere a BADLAR.
          fecha:       badlarFecha,
          badlar_fecha: badlarFecha,
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
      source: "BCRA API v4.0 (TAMAR var. 44, pases 1d var. 150 proxy TPM) · datos.gob.ar (BADLAR histórica, CER) · DB local (LECAP) · REM BCRA",
    }

    setCache(cacheKey, result, 1800)  // 30 min
    return NextResponse.json(result)
  } catch (err) {
    console.error("Breakeven endpoint error:", err)
    return NextResponse.json({ error: "Failed to compute breakeven" }, { status: 500 })
  }
}
