import { NextResponse } from "next/server"

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiry: number }>()
function getCache(k: string) { const e = cache.get(k); return e && Date.now() < e.expiry ? e.data : null }
function setCache(k: string, d: unknown, ttl: number) { cache.set(k, { data: d, expiry: Date.now() + ttl * 1000 }) }

// ── Fallback hardcodeado — top 15 socios comerciales ARG 2023/2024 ─────────────
// Fuente: INDEC / Secretaría de Comercio — miles de millones USD
const SOCIOS_FALLBACK: Record<string, { nombre: string; expo: number; impo: number; iso2: string }> = {
  BRA: { nombre: "Brasil",          expo: 11800, impo: 14200, iso2: "BR" },
  CHN: { nombre: "China",           expo:  8900, impo: 18500, iso2: "CN" },
  USA: { nombre: "EE.UU.",          expo:  7400, impo:  8600, iso2: "US" },
  CHL: { nombre: "Chile",           expo:  4200, impo:  2100, iso2: "CL" },
  IND: { nombre: "India",           expo:  3800, impo:  1200, iso2: "IN" },
  DEU: { nombre: "Alemania",        expo:  1100, impo:  2800, iso2: "DE" },
  NLD: { nombre: "Países Bajos",    expo:  2600, impo:   400, iso2: "NL" },
  VNM: { nombre: "Vietnam",         expo:  2100, impo:   300, iso2: "VN" },
  URY: { nombre: "Uruguay",         expo:  1800, impo:  1500, iso2: "UY" },
  BOL: { nombre: "Bolivia",         expo:   800, impo:  1600, iso2: "BO" },
  PRY: { nombre: "Paraguay",        expo:  1200, impo:   900, iso2: "PY" },
  ESP: { nombre: "España",          expo:   950, impo:  1400, iso2: "ES" },
  IDN: { nombre: "Indonesia",       expo:  1700, impo:   200, iso2: "ID" },
  EGY: { nombre: "Egipto",          expo:  1500, impo:   150, iso2: "EG" },
  THA: { nombre: "Tailandia",       expo:  1300, impo:   180, iso2: "TH" },
}

interface SocioRow {
  iso: string
  nombre: string
  expo: number   // USD millones
  impo: number   // USD millones
  saldo: number
  total: number
  iso2: string
}

export async function GET() {
  const cacheKey = "balanza_socios"
  const cached = getCache(cacheKey)
  if (cached) return NextResponse.json(cached)

  let socios: SocioRow[]
  let source = "INDEC — datos estimados 2023/2024"
  let isLive = false

  // Intentar UN Comtrade API v2
  try {
    const anio = new Date().getFullYear() - 1
    const url = `https://comtradeapi.un.org/data/v2/get/C/A/HS/ARG/ALL?period=${anio}&cmdCode=TOTAL&flowCode=X,M&maxRecords=50`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (res.ok) {
      const json = await res.json()
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        // Agrupar por partner (iso3)
        const porPais = new Map<string, { expo: number; impo: number; nombre: string }>()
        for (const r of json.data as Record<string, unknown>[]) {
          const iso3    = String(r.partnerCode ?? r.reporterCode ?? "")
          const nombre  = String(r.partnerDesc ?? r.reporterDesc ?? iso3)
          const flow    = String(r.flowCode ?? r.rgCode ?? "")
          const monto   = Number(r.primaryValue ?? r.TradeValue ?? 0)
          if (!iso3 || iso3 === "000" || iso3 === "WLD") continue
          const existing = porPais.get(iso3) ?? { expo: 0, impo: 0, nombre }
          if (flow === "X" || flow === "1") porPais.set(iso3, { ...existing, expo: monto / 1e6 })
          if (flow === "M" || flow === "2") porPais.set(iso3, { ...existing, impo: monto / 1e6 })
        }

        socios = Array.from(porPais.entries())
          .map(([iso, d]) => ({
            iso,
            nombre: d.nombre,
            expo:   d.expo,
            impo:   d.impo,
            saldo:  d.expo - d.impo,
            total:  d.expo + d.impo,
            iso2:   SOCIOS_FALLBACK[iso]?.iso2 ?? iso.slice(0, 2).toLowerCase(),
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 15)

        source = `UN Comtrade API v2 — datos ${anio}`
        isLive = true
      }
    }
  } catch {
    // Usar fallback
  }

  // Fallback si Comtrade falló o no devolvió datos
  if (!isLive) {
    socios = Object.entries(SOCIOS_FALLBACK).map(([iso, d]) => ({
      iso,
      nombre: d.nombre,
      expo:   d.expo,
      impo:   d.impo,
      saldo:  d.expo - d.impo,
      total:  d.expo + d.impo,
      iso2:   d.iso2,
    })).sort((a, b) => b.total - a.total)
  }

  const result = {
    data: {
      socios: socios!,
      top_exportacion: [...socios!].sort((a, b) => b.expo - a.expo).slice(0, 10),
      top_importacion: [...socios!].sort((a, b) => b.impo - a.impo).slice(0, 10),
      is_live: isLive,
    },
    updated_at: new Date().toISOString(),
    source,
  }

  setCache(cacheKey, result, 86400)
  return NextResponse.json(result)
}
