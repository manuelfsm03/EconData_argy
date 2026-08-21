/**
 * mock-profiles.ts
 * Datos mock de la comunidad de La Pizarra.
 * El backend real reemplaza esto — el contrato de tipos se mantiene.
 */

import type { Prediccion } from "@/lib/prediction-contract"

// ── Types ──────────────────────────────────────────────────────────────────────

export type BadgeLevel = "Novato" | "Analista" | "Trader" | "Pro" | "Experto" | "Quant"

export type PerfilRiesgo = "conservador" | "moderado" | "agresivo"

export interface UserProfile {
  id: string
  nombre: string
  handle: string
  bio: string
  linkedin?: string
  foto?: string              // URL de imagen de avatar (opcional, tiene prioridad sobre initials)
  avatarBg: string
  topAcciones: { ticker: string; conviccion: number }[]
  intereses: string[]        // lista plana legacy (display en cards)
  interesesRentaFija?: string[]    // e.g. ["Bonos soberanos", "LECAPs"]
  interesesRentaVariable?: string[] // e.g. ["Acciones", "Panel líder"]
  perfilRiesgo?: PerfilRiesgo
  stats: {
    posts: number
    seguidores: number
    aciertos: number          // predicciones con estado "acertada"
    totalPrediciones: number  // acertada + errada (abiertas no cuentan)
    puntos: number
  }
  nivel: BadgeLevel
  fechaAlta: string
  streak: number
  isCurrentUser?: boolean
  predicciones?: Prediccion[]
}

// ── Interest categories (para el edit form) ────────────────────────────────────

export const INTEREST_CATEGORIES = {
  rentaFija: [
    "Bonos soberanos", "Renta fija", "LECAPs", "BONCAPs", "CER",
    "Tasas", "Paridad", "Curva", "Duración",
  ],
  rentaVariable: [
    "Acciones", "Panel líder", "CEDEARs", "Bancos", "Energía",
    "Cripto", "Análisis técnico", "Volumen",
  ],
  macro: [
    "Macro", "FX", "Monetarismo", "Política económica",
    "Inflación", "BCRA", "Outstanding",
  ],
  otros: [
    "IA aplicada", "Fintech", "Portafolios", "Riesgo",
    "Oil & Gas", "Utilities", "Quant", "Vaca Muerta", "Infraestructura",
  ],
} as const

// ── Level thresholds ───────────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS: Record<BadgeLevel, number> = {
  Novato: 0, Analista: 201, Trader: 501, Pro: 901, Experto: 1301, Quant: 1801,
}

const LEVEL_ORDER: BadgeLevel[] = ["Novato", "Analista", "Trader", "Pro", "Experto", "Quant"]

export function nextLevel(current: BadgeLevel, pts: number): { nivel: BadgeLevel | null; ptsNecesarios: number } {
  const idx = LEVEL_ORDER.indexOf(current)
  if (idx === LEVEL_ORDER.length - 1) return { nivel: null, ptsNecesarios: 0 }
  const sig = LEVEL_ORDER[idx + 1]
  return { nivel: sig, ptsNecesarios: Math.max(0, LEVEL_THRESHOLDS[sig] - pts) }
}

export function profileCompleteness(p: UserProfile): number {
  let pts = 0
  if (p.bio.length > 20) pts += 20
  if (p.linkedin) pts += 10
  if (p.foto) pts += 5
  if (p.topAcciones.length >= 3) pts += 20
  if (p.topAcciones.length >= 5) pts += 10
  if (p.intereses.length >= 3) pts += 10
  if ((p.interesesRentaFija?.length ?? 0) >= 2) pts += 5
  if ((p.interesesRentaVariable?.length ?? 0) >= 2) pts += 5
  if (p.perfilRiesgo) pts += 5
  if (p.stats.posts >= 10) pts += 10
  return Math.min(100, pts)
}

// ── Mock data ──────────────────────────────────────────────────────────────────
// stats.aciertos = count(predicciones donde estado === "acertada")
// stats.totalPrediciones = count(estado === "acertada" | "errada")

export const MOCK_PROFILES: UserProfile[] = [

  // ── u1: Juan / datso (current user) ─────────────────────────────────────────
  // predicciones: 3 acertadas, 2 erradas, 1 abierta → aciertos:3 total:5
  {
    id: "u1",
    nombre: "Juan Ignacio da Torre",
    handle: "datso",
    bio: "Economista. Consultor en Finanzas @ Accenture. Foco en macro y renta fija soberana. Construyendo La Pizarra.",
    avatarBg: "#1B2A4A",
    linkedin: "https://linkedin.com/in/juandatorre",
    interesesRentaFija: ["Bonos soberanos", "Renta fija", "CER"],
    interesesRentaVariable: ["Acciones", "CEDEARs"],
    perfilRiesgo: "moderado",
    topAcciones: [
      { ticker: "AL30", conviccion: 72 },
      { ticker: "GD30", conviccion: 65 },
      { ticker: "GGAL", conviccion: 50 },
    ],
    intereses: ["Macro", "Renta fija", "Bonos soberanos", "IA aplicada"],
    stats: { posts: 18, seguidores: 94, aciertos: 3, totalPrediciones: 5, puntos: 347 },
    nivel: "Analista",
    fechaAlta: "2024-11-15",
    streak: 12,
    isCurrentUser: true,
    predicciones: [
      {
        id: "pred-u1-1", autorId: "u1",
        activo: "GD41", tipoActivo: "bono",
        tesis: "La curva NY Law sigue aplanada. GD41 cotiza con TNA 11.4%, barato vs GD35. Apunto a compresión hacia 10.5% en 30 días.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.5, valorEntrada: 11.4,
        fechaEntrada: "2026-08-18T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-09-17T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u1-2", autorId: "u1",
        activo: "AL30", tipoActivo: "bono",
        tesis: "Largo AL30. El spread vs Globales debería comprimirse con normalización cambiaria. Ley local con descuento excesivo.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 58.20,
        fechaEntrada: "2026-08-14T10:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-19T17:00:00Z",
        estado: "acertada", valorResolucion: 61.50, fechaResuelta: "2026-08-19T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u1-3", autorId: "u1",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL con soporte en $5.400. El sector bancos se beneficia del ciclo de crédito en expansión.",
        metrica: "precio", operador: "mayor_igual", objetivo: 5400, valorEntrada: 5380,
        fechaEntrada: "2026-08-09T11:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-16T17:00:00Z",
        estado: "errada", valorResolucion: 5150, fechaResuelta: "2026-08-16T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u1-4", autorId: "u1",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 con TNA elevada post tensión EMBI+. Espero compresión hacia 10.5% en 2 semanas.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.5, valorEntrada: 11.2,
        fechaEntrada: "2026-07-20T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-03T17:00:00Z",
        estado: "acertada", valorResolucion: 10.1, fechaResuelta: "2026-08-03T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u1-5", autorId: "u1",
        activo: "AL30", tipoActivo: "bono",
        tesis: "Paridad AL30 en 52% está subvalorada. La normalización cambiaria debería llevar paridad a 55%+.",
        metrica: "paridad", operador: "mayor_igual", objetivo: 55.0, valorEntrada: 52.3,
        fechaEntrada: "2026-07-10T10:00:00Z", horizonte: "15 días",
        fechaResolucion: "2026-07-25T17:00:00Z",
        estado: "acertada", valorResolucion: 56.3, fechaResuelta: "2026-07-25T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u1-6", autorId: "u1",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL arriba en el corto. Catalizadores: resultados Q1 + expansión de crédito corporativo.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5200,
        fechaEntrada: "2026-06-20T11:00:00Z", horizonte: "15 días",
        fechaResolucion: "2026-07-05T17:00:00Z",
        estado: "errada", valorResolucion: 4980, fechaResuelta: "2026-07-05T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

  // ── u2: Rodrigo Salgado ──────────────────────────────────────────────────────
  // 4 acertadas, 1 errada, 1 abierta → aciertos:4 total:5
  {
    id: "u2",
    nombre: "Rodrigo Salgado",
    handle: "rsalgado_ar",
    bio: "Especialista en bonos soberanos USD. 10 años en renta fija. Foco en la parte larga de la curva NY Law y flujos de canje MEP/CCL.",
    linkedin: "https://linkedin.com/in/rsalgado",
    avatarBg: "#3A1B1B",
    topAcciones: [
      { ticker: "GD30", conviccion: 90 },
      { ticker: "GD35", conviccion: 85 },
      { ticker: "AL30", conviccion: 78 },
      { ticker: "GD41", conviccion: 60 },
    ],
    intereses: ["Bonos soberanos", "Renta fija", "Macro", "FX"],
    stats: { posts: 234, seguidores: 1240, aciertos: 4, totalPrediciones: 5, puntos: 1780 },
    nivel: "Experto",
    fechaAlta: "2024-09-01",
    streak: 34,
    predicciones: [
      {
        id: "pred-u2-1", autorId: "u2",
        activo: "GD41", tipoActivo: "bono",
        tesis: "EMBI+ en 630bps. La parte larga NY Law está pricinguando riesgo político, no crediticio. Entrada selectiva en GD41.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.8, valorEntrada: 11.6,
        fechaEntrada: "2026-08-19T09:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-09-18T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u2-2", autorId: "u2",
        activo: "GD30", tipoActivo: "bono",
        tesis: "Canje MEP/CCL comprimió a 0.97. Diferencial AL30/GD30 en mínimos del año. Rebalanceo hacia NY Law: GD30 sube.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 63.40,
        fechaEntrada: "2026-08-15T10:00:00Z", horizonte: "3 días",
        fechaResolucion: "2026-08-18T17:00:00Z",
        estado: "acertada", valorResolucion: 65.80, fechaResuelta: "2026-08-18T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u2-3", autorId: "u2",
        activo: "GD35", tipoActivo: "bono",
        tesis: "GD35 a $52.8 dirty con TNA 9.1%: atractivo relativo vs GD30 a $66.2. Apunto a compresión.",
        metrica: "tir", operador: "menor_igual", objetivo: 8.8, valorEntrada: 9.1,
        fechaEntrada: "2026-08-10T09:30:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-17T17:00:00Z",
        estado: "acertada", valorResolucion: 8.5, fechaResuelta: "2026-08-17T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u2-4", autorId: "u2",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 post licitación: spread comprimible. Apunto a TNA sub-10% en 3 semanas.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.0, valorEntrada: 11.0,
        fechaEntrada: "2026-07-25T09:00:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-08-15T17:00:00Z",
        estado: "acertada", valorResolucion: 9.8, fechaResuelta: "2026-08-15T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u2-5", autorId: "u2",
        activo: "AE38", tipoActivo: "bono",
        tesis: "AE38 con paridad 48%: la historia muestra que a este nivel de EMBI+ debería estar en 52%+.",
        metrica: "paridad", operador: "mayor_igual", objetivo: 51.0, valorEntrada: 48.2,
        fechaEntrada: "2026-07-01T10:00:00Z", horizonte: "45 días",
        fechaResolucion: "2026-08-15T17:00:00Z",
        estado: "acertada", valorResolucion: 52.1, fechaResuelta: "2026-08-15T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u2-6", autorId: "u2",
        activo: "GD46", tipoActivo: "bono",
        tesis: "GD46 en la parte muy larga: si el EMBI+ baja a 500bps, GD46 tiene el mayor upside. Objetivo $46.",
        metrica: "precio", operador: "mayor_igual", objetivo: 46.0, valorEntrada: 43.80,
        fechaEntrada: "2026-06-10T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-10T17:00:00Z",
        estado: "errada", valorResolucion: 44.20, fechaResuelta: "2026-07-10T17:15:00Z", fuente: "/api/bonos",
      },
    ],
  },

  // ── u3: Gonzalo Ferreyra ─────────────────────────────────────────────────────
  // 4 acertadas, 1 errada, 1 abierta → aciertos:4 total:5
  {
    id: "u3",
    nombre: "Gonzalo Ferreyra",
    handle: "gonza_macro",
    bio: "Economista macro. Ex-trader de deuda soberana. Analizo el ciclo argentino desde 2015. La macro manda.",
    linkedin: "https://linkedin.com/in/gferreyra",
    avatarBg: "#1B2A1B",
    topAcciones: [
      { ticker: "GD30", conviccion: 80 },
      { ticker: "AL35", conviccion: 75 },
      { ticker: "GGAL", conviccion: 65 },
      { ticker: "TXAR", conviccion: 55 },
    ],
    intereses: ["Macro", "Política económica", "Bonos soberanos", "Acciones"],
    stats: { posts: 187, seguidores: 980, aciertos: 4, totalPrediciones: 5, puntos: 1560 },
    nivel: "Experto",
    fechaAlta: "2024-09-15",
    streak: 21,
    predicciones: [
      {
        id: "pred-u3-1", autorId: "u3",
        activo: "AL35", tipoActivo: "bono",
        tesis: "Dato de inflación de julio consolida la desinflación. Curva de pesos va a reaccionar. AL35 con upside por tasa real positiva.",
        metrica: "tir", operador: "baja", objetivo: null, valorEntrada: 10.8,
        fechaEntrada: "2026-08-19T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-09-18T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u3-2", autorId: "u3",
        activo: "TXAR", tipoActivo: "accion",
        tesis: "TXAR en caída por aluminio internacional. Oportunidad vs el sector industrial. Rebote técnico.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 1420,
        fechaEntrada: "2026-08-12T10:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-19T17:00:00Z",
        estado: "acertada", valorResolucion: 1560, fechaResuelta: "2026-08-19T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u3-3", autorId: "u3",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 con TNA 11.1%: demasiado spread para el contexto macro actual. Apunto a 10.2% en 2 semanas.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.2, valorEntrada: 11.1,
        fechaEntrada: "2026-08-01T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-15T17:00:00Z",
        estado: "acertada", valorResolucion: 9.9, fechaResuelta: "2026-08-15T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u3-4", autorId: "u3",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL a $5.100 con ciclo de crédito expansivo. El sector financiero debería liderar la suba en julio.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5100,
        fechaEntrada: "2026-07-15T10:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-07-29T17:00:00Z",
        estado: "acertada", valorResolucion: 5450, fechaResuelta: "2026-07-29T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u3-5", autorId: "u3",
        activo: "AL35", tipoActivo: "bono",
        tesis: "AL35 a $46.2 con paridad baja. Si el EMBI+ cae a 600bps, debería tocar $48+.",
        metrica: "precio", operador: "mayor_igual", objetivo: 48.0, valorEntrada: 46.2,
        fechaEntrada: "2026-07-01T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-31T17:00:00Z",
        estado: "acertada", valorResolucion: 49.1, fechaResuelta: "2026-07-31T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u3-6", autorId: "u3",
        activo: "TXAR", tipoActivo: "accion",
        tesis: "TXAR: el CRB Metals rebotó. Debería ver $1.500 en 30 días.",
        metrica: "precio", operador: "mayor_igual", objetivo: 1500, valorEntrada: 1380,
        fechaEntrada: "2026-06-05T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-05T17:00:00Z",
        estado: "errada", valorResolucion: 1320, fechaResuelta: "2026-07-05T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

  // ── u4: Lucía Pereyra ────────────────────────────────────────────────────────
  // 4 acertadas, 1 errada, 1 abierta → aciertos:4 total:5
  {
    id: "u4",
    nombre: "Lucía Pereyra",
    handle: "luci_quant",
    bio: "Lic. Actuaría. Modelos cuantitativos aplicados a carteras mixtas ARS/USD. Datos antes que opiniones.",
    linkedin: "https://linkedin.com/in/lpereyra",
    avatarBg: "#2A1B3A",
    topAcciones: [
      { ticker: "GGAL", conviccion: 70 },
      { ticker: "BMA",  conviccion: 65 },
      { ticker: "TXAR", conviccion: 60 },
      { ticker: "VALO", conviccion: 55 },
      { ticker: "ALUA", conviccion: 50 },
    ],
    intereses: ["Quant", "Riesgo", "CEDEARs", "FX", "Portafolios"],
    stats: { posts: 142, seguidores: 820, aciertos: 4, totalPrediciones: 5, puntos: 1380 },
    nivel: "Quant",
    fechaAlta: "2024-10-01",
    streak: 18,
    predicciones: [
      {
        id: "pred-u4-1", autorId: "u4",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "Sharpe rolling 30D: GGAL 1.4, BMA 1.1. La brecha se justifica por liquidez pero no por fundamentals. Upside relativo en BMA.",
        metrica: "precio", operador: "mayor_igual", objetivo: 5600, valorEntrada: 5420,
        fechaEntrada: "2026-08-17T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-31T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u4-2", autorId: "u4",
        activo: "TXAR", tipoActivo: "accion",
        tesis: "Correlación TXAR/CRB Metals en 0.71. El precio en ARS está rezagado vs CCL. Rebote inminente.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 1390,
        fechaEntrada: "2026-08-11T10:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-18T17:00:00Z",
        estado: "acertada", valorResolucion: 1510, fechaResuelta: "2026-08-18T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u4-3", autorId: "u4",
        activo: "BMA", tipoActivo: "accion",
        tesis: "BMA con volatilidad implícita baja. El ciclo de crédito favorece bancos. Apunto a suba en 2 semanas.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 7050,
        fechaEntrada: "2026-08-05T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-19T17:00:00Z",
        estado: "acertada", valorResolucion: 7340, fechaResuelta: "2026-08-19T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u4-4", autorId: "u4",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL con beta 1.2 vs S&P bancos. Ciclo alcista. Objetivo de corto: suba >5%.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5080,
        fechaEntrada: "2026-07-20T10:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-03T17:00:00Z",
        estado: "acertada", valorResolucion: 5320, fechaResuelta: "2026-08-03T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u4-5", autorId: "u4",
        activo: "VALO", tipoActivo: "accion",
        tesis: "VALO a $1.980: valuación por book value en descuento vs pares. Objetivo $2.100.",
        metrica: "precio", operador: "mayor_igual", objetivo: 2100, valorEntrada: 1980,
        fechaEntrada: "2026-07-05T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-08-04T17:00:00Z",
        estado: "acertada", valorResolucion: 2150, fechaResuelta: "2026-08-04T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u4-6", autorId: "u4",
        activo: "ALUA", tipoActivo: "accion",
        tesis: "ALUA con soporte en $820. El aluminio internacional estabilizado debería empujar precio.",
        metrica: "precio", operador: "mayor_igual", objetivo: 900, valorEntrada: 820,
        fechaEntrada: "2026-06-15T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-15T17:00:00Z",
        estado: "errada", valorResolucion: 790, fechaResuelta: "2026-07-15T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

  // ── u5: Valentina Méndez ─────────────────────────────────────────────────────
  // 4 acertadas, 1 errada, 1 abierta → aciertos:4 total:5
  {
    id: "u5",
    nombre: "Valentina Méndez",
    handle: "val_renta",
    bio: "Renta fija en pesos: mi especialidad. LECAPs, BONCAPs y bonos CER. Gestora de portafolios institucionales.",
    linkedin: "https://linkedin.com/in/vmendez",
    avatarBg: "#1B3A3A",
    topAcciones: [
      { ticker: "AL30",  conviccion: 88 },
      { ticker: "GD30",  conviccion: 65 },
      { ticker: "S31E5", conviccion: 70 },
      { ticker: "T17O5", conviccion: 60 },
    ],
    intereses: ["Renta fija", "LECAPs", "BONCAPs", "CER", "Tasas"],
    stats: { posts: 156, seguidores: 740, aciertos: 4, totalPrediciones: 5, puntos: 1240 },
    nivel: "Pro",
    fechaAlta: "2024-10-20",
    streak: 9,
    predicciones: [
      {
        id: "pred-u5-1", autorId: "u5",
        activo: "T17O5", tipoActivo: "bono",
        tesis: "T17O5 rinde TEA 52.8% vs LECAP S31E5 en 49.1%. El spread no se justifica por diferencia de plazo. Armé posición en T17O5.",
        metrica: "tir", operador: "menor_igual", objetivo: 50.0, valorEntrada: 52.8,
        fechaEntrada: "2026-08-18T10:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-25T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u5-2", autorId: "u5",
        activo: "S31E5", tipoActivo: "bono",
        tesis: "Tasa de política monetaria mantenida. Las LECAPs cortas van a comprimir rendimientos. S31E5 TEA 49.1% → apunto a 47%.",
        metrica: "tir", operador: "menor_igual", objetivo: 47.0, valorEntrada: 49.1,
        fechaEntrada: "2026-08-08T10:00:00Z", horizonte: "10 días",
        fechaResolucion: "2026-08-18T17:00:00Z",
        estado: "acertada", valorResolucion: 46.5, fechaResuelta: "2026-08-18T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u5-3", autorId: "u5",
        activo: "AL30", tipoActivo: "bono",
        tesis: "AL30 con descuento excesivo vs Globales. Normalización esperada del spread empuja precio.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 57.80,
        fechaEntrada: "2026-07-25T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-08T17:00:00Z",
        estado: "acertada", valorResolucion: 60.20, fechaResuelta: "2026-08-08T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u5-4", autorId: "u5",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 con TNA 11.1%. El EMBI+ va a bajar post reunión FMI. Apunto a TNA sub-10%.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.0, valorEntrada: 11.1,
        fechaEntrada: "2026-07-10T09:00:00Z", horizonte: "20 días",
        fechaResolucion: "2026-07-30T17:00:00Z",
        estado: "acertada", valorResolucion: 9.8, fechaResuelta: "2026-07-30T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u5-5", autorId: "u5",
        activo: "AL30", tipoActivo: "bono",
        tesis: "Paridad AL30 en 51.5%: subvalorada. Con la normalización del EMBI+ debería superar 54%.",
        metrica: "paridad", operador: "mayor_igual", objetivo: 54.0, valorEntrada: 51.5,
        fechaEntrada: "2026-06-25T09:00:00Z", horizonte: "20 días",
        fechaResolucion: "2026-07-15T17:00:00Z",
        estado: "acertada", valorResolucion: 55.2, fechaResuelta: "2026-07-15T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u5-6", autorId: "u5",
        activo: "S31E5", tipoActivo: "bono",
        tesis: "S31E5 con TEA 46.5% post compresión: apunto a nueva baja hacia 44% en 30 días.",
        metrica: "tir", operador: "menor_igual", objetivo: 44.0, valorEntrada: 46.5,
        fechaEntrada: "2026-06-01T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-01T17:00:00Z",
        estado: "errada", valorResolucion: 45.1, fechaResuelta: "2026-07-01T17:15:00Z", fuente: "/api/bonos",
      },
    ],
  },

  // ── u6: Santiago Montes ──────────────────────────────────────────────────────
  // 4 acertadas, 1 errada, 1 abierta → aciertos:4 total:5
  {
    id: "u6",
    nombre: "Santiago Montes",
    handle: "santi_bonos",
    bio: "Trader de bonos soberanos en mesas propias 8 años. Ahora independiente. Largo en la parte larga, siempre.",
    avatarBg: "#1B1B3A",
    topAcciones: [
      { ticker: "GD30", conviccion: 85 },
      { ticker: "AL30", conviccion: 80 },
      { ticker: "GD35", conviccion: 72 },
      { ticker: "AE38", conviccion: 60 },
      { ticker: "GD41", conviccion: 55 },
    ],
    intereses: ["Bonos soberanos", "Renta fija", "Paridad", "Outstanding"],
    stats: { posts: 203, seguidores: 670, aciertos: 4, totalPrediciones: 5, puntos: 1100 },
    nivel: "Pro",
    fechaAlta: "2024-09-28",
    streak: 27,
    predicciones: [
      {
        id: "pred-u6-1", autorId: "u6",
        activo: "AE38", tipoActivo: "bono",
        tesis: "AE38 por encima de 50% de paridad por primera vez en el año. El mercado empieza a priceear normalización.",
        metrica: "paridad", operador: "mayor_igual", objetivo: 51.0, valorEntrada: 49.5,
        fechaEntrada: "2026-08-16T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-30T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u6-2", autorId: "u6",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 a $66: en el techo del rango. Reduciría exposición acá. Espero retroceso a $63.",
        metrica: "precio", operador: "menor_igual", objetivo: 63.0, valorEntrada: 66.2,
        fechaEntrada: "2026-08-07T10:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-19T17:00:00Z",
        estado: "acertada", valorResolucion: 62.8, fechaResuelta: "2026-08-19T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u6-3", autorId: "u6",
        activo: "GD35", tipoActivo: "bono",
        tesis: "GD35 con TNA 9.5% y curva aplanada en tramo medio. Compresión inminente hacia 9%.",
        metrica: "tir", operador: "menor_igual", objetivo: 9.0, valorEntrada: 9.5,
        fechaEntrada: "2026-07-30T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-13T17:00:00Z",
        estado: "acertada", valorResolucion: 8.8, fechaResuelta: "2026-08-13T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u6-4", autorId: "u6",
        activo: "AL30", tipoActivo: "bono",
        tesis: "AL30 con descuento vs Globales en máximos históricos. El rebote hacia $59 es inevitable.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 56.90,
        fechaEntrada: "2026-07-15T09:00:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-08-05T17:00:00Z",
        estado: "acertada", valorResolucion: 59.40, fechaResuelta: "2026-08-05T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u6-5", autorId: "u6",
        activo: "GD30", tipoActivo: "bono",
        tesis: "GD30 TNA 11.3%: demasiado alto para el contexto macro. Apunto a sub-10.5% en 3 semanas.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.5, valorEntrada: 11.3,
        fechaEntrada: "2026-07-01T09:00:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-07-22T17:00:00Z",
        estado: "acertada", valorResolucion: 10.2, fechaResuelta: "2026-07-22T17:15:00Z", fuente: "/api/bonos",
      },
      {
        id: "pred-u6-6", autorId: "u6",
        activo: "AL30", tipoActivo: "bono",
        tesis: "AL30 a $60.1: el canje MEP/CCL sugiere upside adicional hacia $62+.",
        metrica: "precio", operador: "mayor_igual", objetivo: 62.0, valorEntrada: 60.10,
        fechaEntrada: "2026-06-10T09:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-10T17:00:00Z",
        estado: "errada", valorResolucion: 59.80, fechaResuelta: "2026-07-10T17:15:00Z", fuente: "/api/bonos",
      },
    ],
  },

  // ── u7: Matías Torres ────────────────────────────────────────────────────────
  // 3 acertadas, 2 erradas, 1 abierta → aciertos:3 total:5
  {
    id: "u7",
    nombre: "Matías Torres",
    handle: "matit_t",
    bio: "Trader de acciones, foco en panel líder BYMA. Comprador en pánico vendedor en euforia. GGAL para siempre.",
    linkedin: "https://linkedin.com/in/matiast",
    avatarBg: "#3A2A1B",
    topAcciones: [
      { ticker: "GGAL", conviccion: 85 },
      { ticker: "YPFD", conviccion: 78 },
      { ticker: "BMA",  conviccion: 65 },
      { ticker: "PAMP", conviccion: 60 },
    ],
    intereses: ["Acciones", "Panel líder", "Análisis técnico", "Volumen"],
    stats: { posts: 311, seguidores: 540, aciertos: 3, totalPrediciones: 5, puntos: 980 },
    nivel: "Trader",
    fechaAlta: "2024-11-01",
    streak: 45,
    predicciones: [
      {
        id: "pred-u7-1", autorId: "u7",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL con volumen atípico este miércoles: 3.2x el promedio de 20 ruedas. Algo se está moviendo internamente.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5510,
        fechaEntrada: "2026-08-20T09:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-27T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u7-2", autorId: "u7",
        activo: "PAMP", tipoActivo: "accion",
        tesis: "PAMP rompió la resistencia de $4.200 con volumen. Próxima resistencia en $4.680.",
        metrica: "precio", operador: "mayor_igual", objetivo: 4680, valorEntrada: 4200,
        fechaEntrada: "2026-08-13T10:00:00Z", horizonte: "1 semana",
        fechaResolucion: "2026-08-20T17:00:00Z",
        estado: "acertada", valorResolucion: 4750, fechaResuelta: "2026-08-20T17:00:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u7-3", autorId: "u7",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL con soporte en $5.050. Patrón de acumulación en el chart diario. Objetivo corto: suba.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5050,
        fechaEntrada: "2026-08-01T10:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-15T17:00:00Z",
        estado: "acertada", valorResolucion: 5380, fechaResuelta: "2026-08-15T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u7-4", autorId: "u7",
        activo: "BMA", tipoActivo: "accion",
        tesis: "BMA con baja correlación vs GGAL últimas 20 ruedas. Debería recuperar el diferencial.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 6950,
        fechaEntrada: "2026-07-20T10:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-03T17:00:00Z",
        estado: "acertada", valorResolucion: 7200, fechaResuelta: "2026-08-03T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u7-5", autorId: "u7",
        activo: "YPFD", tipoActivo: "accion",
        tesis: "YPFD con producción récord. El mercado lo está subestimando. Objetivo $9.200 en 30 días.",
        metrica: "precio", operador: "mayor_igual", objetivo: 9200, valorEntrada: 8600,
        fechaEntrada: "2026-07-05T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-08-04T17:00:00Z",
        estado: "errada", valorResolucion: 8750, fechaResuelta: "2026-08-04T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u7-6", autorId: "u7",
        activo: "PAMP", tipoActivo: "accion",
        tesis: "PAMP con soporte técnico en $4.100. Objetivo $4.500 en 30 días.",
        metrica: "precio", operador: "mayor_igual", objetivo: 4500, valorEntrada: 4100,
        fechaEntrada: "2026-06-15T10:00:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-15T17:00:00Z",
        estado: "errada", valorResolucion: 4200, fechaResuelta: "2026-07-15T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

  // ── u8: Florencia Aguirre ────────────────────────────────────────────────────
  // 3 acertadas, 1 errada, 1 abierta → aciertos:3 total:4
  {
    id: "u8",
    nombre: "Florencia Aguirre",
    handle: "flor_energia",
    bio: "Analista de oil & gas y utilities. Vaca Muerta es el macro-activo más importante de Argentina, no los bonos.",
    linkedin: "https://linkedin.com/in/flaguirre",
    avatarBg: "#3A3A1B",
    topAcciones: [
      { ticker: "YPFD", conviccion: 88 },
      { ticker: "PAMP", conviccion: 82 },
      { ticker: "CEPU", conviccion: 70 },
      { ticker: "TRAN", conviccion: 50 },
    ],
    intereses: ["Energía", "Oil & Gas", "Utilities", "Infraestructura", "Vaca Muerta"],
    stats: { posts: 128, seguidores: 490, aciertos: 3, totalPrediciones: 4, puntos: 840 },
    nivel: "Pro",
    fechaAlta: "2025-01-10",
    streak: 8,
    predicciones: [
      {
        id: "pred-u8-1", autorId: "u8",
        activo: "YPFD", tipoActivo: "accion",
        tesis: "Producción de crudo YPF julio: récord de 215k bbl/d. El mercado lo está subestimando a estos precios.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 8920,
        fechaEntrada: "2026-08-17T09:30:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-31T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u8-2", autorId: "u8",
        activo: "CEPU", tipoActivo: "accion",
        tesis: "CEPU con tarifa actualizada y capex en baja. Free cash flow positivo por primera vez en 3 años. Acumulando.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 2720,
        fechaEntrada: "2026-08-05T09:00:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-08-19T17:00:00Z",
        estado: "acertada", valorResolucion: 2940, fechaResuelta: "2026-08-19T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u8-3", autorId: "u8",
        activo: "YPFD", tipoActivo: "accion",
        tesis: "YPFD a $8.450: la producción de Vaca Muerta Q2 estuvo por encima de guidance. Objetivo $9.000.",
        metrica: "precio", operador: "mayor_igual", objetivo: 9000, valorEntrada: 8450,
        fechaEntrada: "2026-07-20T09:30:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-08-10T17:00:00Z",
        estado: "acertada", valorResolucion: 9100, fechaResuelta: "2026-08-10T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u8-4", autorId: "u8",
        activo: "PAMP", tipoActivo: "accion",
        tesis: "PAMP con actualización tarifaria. El upside por expansión de margen debería materializarse en julio.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 3980,
        fechaEntrada: "2026-07-05T09:30:00Z", horizonte: "20 días",
        fechaResolucion: "2026-07-25T17:00:00Z",
        estado: "acertada", valorResolucion: 4200, fechaResuelta: "2026-07-25T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u8-5", autorId: "u8",
        activo: "TRAN", tipoActivo: "accion",
        tesis: "TRAN con contratos de transporte renovados. Debería superar los $2.000 en 30 días.",
        metrica: "precio", operador: "mayor_igual", objetivo: 2000, valorEntrada: 1820,
        fechaEntrada: "2026-06-20T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-20T17:00:00Z",
        estado: "errada", valorResolucion: 1760, fechaResuelta: "2026-07-20T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

  // ── u9: Nicolás Brambilla ────────────────────────────────────────────────────
  // 2 acertadas, 1 errada, 1 abierta → aciertos:2 total:3
  {
    id: "u9",
    nombre: "Nicolás Brambilla",
    handle: "nbrambilla",
    bio: "Economista en formación. Analizo la macro para entender los activos, no al revés. Fan del monetarismo aplicado.",
    avatarBg: "#1B3A2A",
    topAcciones: [
      { ticker: "GGAL", conviccion: 75 },
      { ticker: "GD30", conviccion: 68 },
      { ticker: "YPFD", conviccion: 55 },
    ],
    intereses: ["Macro", "Monetarismo", "Acciones", "FX"],
    stats: { posts: 54, seguidores: 210, aciertos: 2, totalPrediciones: 3, puntos: 620 },
    nivel: "Analista",
    fechaAlta: "2025-03-12",
    streak: 5,
    predicciones: [
      {
        id: "pred-u9-1", autorId: "u9",
        activo: "GD30", tipoActivo: "bono",
        tesis: "Base monetaria creció 2.1% en julio. Si se mantiene el crawling peg la señal es alcista para bonos USD. GD30 TNA sub-10%.",
        metrica: "tir", operador: "menor_igual", objetivo: 10.0, valorEntrada: 11.0,
        fechaEntrada: "2026-08-16T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-09-15T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u9-2", autorId: "u9",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL con ciclo de crédito expansivo y base monetaria controlada. Debería subir.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 5100,
        fechaEntrada: "2026-07-25T10:00:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-08-15T17:00:00Z",
        estado: "acertada", valorResolucion: 5380, fechaResuelta: "2026-08-15T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u9-3", autorId: "u9",
        activo: "YPFD", tipoActivo: "accion",
        tesis: "YPFD con producción récord. El precio en ARS subestima el upside de Vaca Muerta. Objetivo $9.000.",
        metrica: "precio", operador: "mayor_igual", objetivo: 9000, valorEntrada: 8500,
        fechaEntrada: "2026-07-10T10:00:00Z", horizonte: "4 semanas",
        fechaResolucion: "2026-08-07T17:00:00Z",
        estado: "acertada", valorResolucion: 9100, fechaResuelta: "2026-08-07T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u9-4", autorId: "u9",
        activo: "AL35", tipoActivo: "bono",
        tesis: "AL35 a $46.5: el diferencial con Globales debería comprimirse. Apunto a suba.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 46.50,
        fechaEntrada: "2026-06-25T09:30:00Z", horizonte: "30 días",
        fechaResolucion: "2026-07-25T17:00:00Z",
        estado: "errada", valorResolucion: 45.80, fechaResuelta: "2026-07-25T17:15:00Z", fuente: "/api/bonos",
      },
    ],
  },

  // ── u10: Camila Ríos ─────────────────────────────────────────────────────────
  // 1 acertada, 1 errada, 1 abierta → aciertos:1 total:2
  {
    id: "u10",
    nombre: "Camila Ríos",
    handle: "cami_fin",
    bio: "Arrancando en el mundo financiero. Vengo del mundo cripto y estoy aprendiendo a leer balances. Paso a paso.",
    avatarBg: "#3A1B3A",
    topAcciones: [
      { ticker: "MELI", conviccion: 80 },
      { ticker: "GGAL", conviccion: 55 },
    ],
    intereses: ["Cripto", "CEDEARs", "FX", "Fintech"],
    stats: { posts: 12, seguidores: 48, aciertos: 1, totalPrediciones: 2, puntos: 185 },
    nivel: "Novato",
    fechaAlta: "2026-06-01",
    streak: 3,
    predicciones: [
      {
        id: "pred-u10-1", autorId: "u10",
        activo: "MELI", tipoActivo: "accion",
        tesis: "Primera semana siguiendo MELI de cerca. El reporte Q2 estuvo muy por encima de expectativas. Sigo comprando acá.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 280000,
        fechaEntrada: "2026-08-19T09:30:00Z", horizonte: "2 semanas",
        fechaResolucion: "2026-09-02T17:00:00Z",
        estado: "abierta", valorResolucion: null, fechaResuelta: null, fuente: null,
      },
      {
        id: "pred-u10-2", autorId: "u10",
        activo: "MELI", tipoActivo: "accion",
        tesis: "MELI CEDEAR a $265k: el Q1 fue fuerte. Debería seguir subiendo con el mercado de e-commerce.",
        metrica: "precio", operador: "sube", objetivo: null, valorEntrada: 265000,
        fechaEntrada: "2026-07-20T10:00:00Z", horizonte: "3 semanas",
        fechaResolucion: "2026-08-10T17:00:00Z",
        estado: "acertada", valorResolucion: 278000, fechaResuelta: "2026-08-10T17:15:00Z", fuente: "/api/acciones",
      },
      {
        id: "pred-u10-3", autorId: "u10",
        activo: "GGAL", tipoActivo: "accion",
        tesis: "GGAL: todo el mundo habla de bancos. Debería superar los $5.500 fácil.",
        metrica: "precio", operador: "mayor_igual", objetivo: 5500, valorEntrada: 5200,
        fechaEntrada: "2026-07-05T10:00:00Z", horizonte: "4 semanas",
        fechaResolucion: "2026-08-02T17:00:00Z",
        estado: "errada", valorResolucion: 5100, fechaResuelta: "2026-08-02T17:15:00Z", fuente: "/api/acciones",
      },
    ],
  },

]

export const CURRENT_USER = MOCK_PROFILES.find((p) => p.isCurrentUser) ?? MOCK_PROFILES[0]
