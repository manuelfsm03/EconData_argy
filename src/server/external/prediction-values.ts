/**
 * prediction-values.ts — Fetcher de valores observados para resolver predicciones.
 *
 * Mapea (activo, tipoActivo, metrica) → valor actual, reusando los endpoints que
 * ya expone La Pizarra. Pre-carga las fuentes UNA vez y devuelve un ValorFetcher
 * que hace lookup en memoria (evita una request por predicción).
 *
 * Cobertura v1: bono (precio/tir/paridad), accion (precio), cripto (precio),
 * fx (precio). variacion_pct se computa desde el precio actual vs valorEntrada.
 * Lo que no se puede mapear devuelve null → la predicción queda abierta.
 */

import type { Prediccion } from "@/lib/prediction-contract"
import type { ValorFetcher, ValorObservado } from "@/server/domain/prediction-resolver"

async function getJson(origin: string, path: string): Promise<unknown> {
  try {
    const res = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function createValorFetcher(origin: string): Promise<ValorFetcher> {
  // Pre-carga de fuentes en paralelo (una sola vez por corrida de resolución)
  const [bonosJson, accionesJson, criptoJson, dolaresJson] = await Promise.all([
    getJson(origin, "/api/bonos"),
    getJson(origin, "/api/acciones"),
    getJson(origin, "/api/cripto"),
    getJson(origin, "/api/dolares"),
  ])

  // ── Bonos: ticker → { precio, tir, paridad } ──────────────────────────────
  const bonos = new Map<string, { precio: number | null; tir: number | null; paridad: number | null }>()
  const bonosArr = (bonosJson as { data?: Array<Record<string, unknown>> })?.data ?? []
  for (const b of bonosArr) {
    const t = String(b.ticker ?? "").toUpperCase()
    if (t) bonos.set(t, {
      precio:  typeof b.precio === "number" ? b.precio : null,
      tir:     typeof b.tir === "number" ? b.tir : null,
      paridad: typeof b.paridad === "number" ? b.paridad : null,
    })
  }

  // ── Acciones: ticker → lastPrice (byCategory aplanado) ────────────────────
  const acciones = new Map<string, number>()
  const byCat = (accionesJson as { data?: { byCategory?: Record<string, Array<Record<string, unknown>>> } })?.data?.byCategory ?? {}
  for (const arr of Object.values(byCat)) {
    for (const a of arr) {
      const t = String(a.ticker ?? "").toUpperCase()
      if (t && typeof a.lastPrice === "number") acciones.set(t, a.lastPrice)
    }
  }

  // ── Cripto: symbol/id → precio_usd ────────────────────────────────────────
  const cripto = new Map<string, number>()
  const criptoArr = (criptoJson as { precios?: Array<Record<string, unknown>> })?.precios ?? []
  for (const c of criptoArr) {
    const price = typeof c.precio_usd === "number" ? c.precio_usd : null
    if (price == null) continue
    for (const k of [c.symbol, c.id]) {
      if (typeof k === "string") cripto.set(k.toUpperCase(), price)
    }
  }

  // ── FX: mapa de dólares por nombre → venta ────────────────────────────────
  const rates = (dolaresJson as { rates?: Record<string, { venta?: number }> })?.rates ?? {}
  const fxVenta = (activo: string): number | null => {
    const a = activo.toUpperCase()
    let key = "oficial"
    if (a.includes("CCL") || a.includes("CONTADO")) key = "contadoconliqui"
    else if (a.includes("MEP") || a.includes("BOLSA")) key = "bolsa"
    else if (a.includes("BLUE")) key = "blue"
    else if (a.includes("MAYORISTA")) key = "mayorista"
    else if (a.includes("CRIPTO")) key = "cripto"
    else if (a.includes("TARJETA")) key = "tarjeta"
    const v = rates[key]?.venta
    return typeof v === "number" ? v : null
  }

  // Precio "base" del activo (para precio directo o para computar variación %)
  function precioBase(p: Prediccion): { valor: number; fuente: string } | null {
    const t = p.activo.toUpperCase()
    if (p.tipoActivo === "bono") {
      const v = bonos.get(t)?.precio
      if (v != null) return { valor: v, fuente: "lapizarra:/api/bonos" }
    } else if (p.tipoActivo === "accion") {
      const v = acciones.get(t)
      if (v != null) return { valor: v, fuente: "lapizarra:/api/acciones" }
    } else if (p.tipoActivo === "cripto") {
      const v = cripto.get(t)
      if (v != null) return { valor: v, fuente: "lapizarra:/api/cripto" }
    } else if (p.tipoActivo === "fx") {
      const v = fxVenta(t)
      if (v != null) return { valor: v, fuente: "lapizarra:/api/dolares" }
    }
    return null
  }

  return async (p: Prediccion): Promise<ValorObservado | null> => {
    // Métricas específicas de bono
    if (p.metrica === "tir" && p.tipoActivo === "bono") {
      const v = bonos.get(p.activo.toUpperCase())?.tir
      return v != null ? { valor: v, fuente: "lapizarra:/api/bonos" } : null
    }
    if (p.metrica === "paridad" && p.tipoActivo === "bono") {
      const v = bonos.get(p.activo.toUpperCase())?.paridad
      return v != null ? { valor: v, fuente: "lapizarra:/api/bonos" } : null
    }
    if (p.metrica === "precio") {
      return precioBase(p)
    }
    if (p.metrica === "variacion_pct") {
      const base = precioBase(p)
      if (!base || p.valorEntrada === 0) return null
      const variacion = (base.valor / p.valorEntrada - 1) * 100
      return { valor: Number(variacion.toFixed(2)), fuente: base.fuente }
    }
    // spread u otras combinaciones no cubiertas → queda abierta
    return null
  }
}
