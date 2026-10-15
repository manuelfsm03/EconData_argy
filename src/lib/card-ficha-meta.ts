/**
 * Metadata de la "ficha" de cada tarjeta (profundidad del tablero).
 *
 * REGLA: solo se completa lo que se puede derivar del código de los endpoints
 * o de los comentarios de metodología que ya viven en el repo. Lo que no se
 * sabe se deja SIN completar: la ficha muestra "sin dato declarado" en vez de
 * inventar una fórmula o una relación.
 *
 * Tarjetas con metadata completa (fuente + cálculo + serie): ver
 * `tests/card-ficha.test.ts`, que lista la cobertura.
 *
 * `relacionadas` = relación conceptual declarada. Las tarjetas que comparten
 * el mismo endpoint se derivan solas (`cardsSharingEndpoint`), no hace falta
 * repetirlas acá.
 */
import type { CardFichaMeta, CardSerieEndpoint } from "./card-catalog"

// ── Series reutilizadas por varias tarjetas ─────────────────────────────────

/** /api/tc-historico: { data: [{ date, blue, mep, ccl, oficial, mayorista, cripto }] } */
const SERIE_TIPOS_DE_CAMBIO: CardSerieEndpoint = {
  path: "/api/tc-historico?period=max",
  claseDato: "daily_market",
  ventana: "Histórico completo disponible desde 2010 (ArgentinaDatos)",
  lines: [
    { path: "data", name: "Oficial", shape: "objects", dateKey: "date", valueKey: "oficial", color: "var(--sky)" },
    { path: "data", name: "Blue", shape: "objects", dateKey: "date", valueKey: "blue", color: "var(--amber)" },
    { path: "data", name: "MEP", shape: "objects", dateKey: "date", valueKey: "mep", color: "var(--positive)" },
    { path: "data", name: "CCL", shape: "objects", dateKey: "date", valueKey: "ccl", color: "#CE93D8" },
  ],
}

/** /api/riesgo-pais: { data: { historico: [{ date, valor }] } } (últimos 2 años, en pb) */
const SERIE_RIESGO_PAIS: CardSerieEndpoint = {
  path: "/api/riesgo-pais",
  claseDato: "daily_market",
  unit: "puntos básicos",
  ventana: "Últimos 2 años (el endpoint recorta la serie a esa ventana)",
  lines: [{ path: "data.historico", name: "Riesgo país (EMBI+)", shape: "objects", dateKey: "date", valueKey: "valor", color: "var(--negative)" }],
}

/** /api/macro?endpoint=ipc: { data: { ipc_var_interanual: [[fecha, %]], ipc_var_mensual: [[fecha, proporción]] } } */
const SERIE_IPC: CardSerieEndpoint = {
  path: "/api/macro?endpoint=ipc",
  claseDato: "official_monthly",
  unit: "%",
  ventana: "Últimos 180 meses publicados por datos.gob.ar",
  lines: [
    { path: "data.ipc_var_interanual", name: "Interanual", shape: "tuples", color: "var(--negative)" },
    // La fuente da la variación mensual como proporción (0,0288): se pasa a %.
    { path: "data.ipc_var_mensual", name: "Mensual", shape: "tuples", scale: 100, color: "var(--amber)" },
  ],
}

/** /api/bcra?endpoint=reservas&historico=true: { data: { brutas: [{fecha,valor}], netas: [{fecha,brutas,netas}] } } */
const SERIE_RESERVAS: CardSerieEndpoint = {
  path: "/api/bcra?endpoint=reservas&historico=true",
  claseDato: "official_daily",
  ventana: "Histórico desde 2000 (BCRA API v4.0)",
  lines: [
    { path: "data.brutas", name: "Reservas brutas", shape: "objects", dateKey: "fecha", valueKey: "valor", color: "var(--amber)" },
    { path: "data.netas", name: "Reservas netas medidas", shape: "objects", dateKey: "fecha", valueKey: "netas", color: "var(--sky)" },
  ],
}

/** /api/bcra?endpoint=plazofijo|tasas: { data: { tamar: [{fecha,valor}], badlar: [...] } } (últimos 2 años, TNA) */
const serieTasas = (endpoint: "plazofijo" | "tasas"): CardSerieEndpoint => ({
  path: `/api/bcra?endpoint=${endpoint}`,
  claseDato: "official_daily",
  unit: "% TNA",
  ventana: "Últimos 2 años (el endpoint recorta la serie a esa ventana)",
  lines: [
    { path: "data.tamar", name: "TAMAR bancos privados", shape: "objects", dateKey: "fecha", valueKey: "valor", color: "var(--amber)" },
    { path: "data.badlar", name: "BADLAR bancos privados", shape: "objects", dateKey: "fecha", valueKey: "valor", color: "var(--sky)" },
  ],
})

const CALCULO_TASAS_BCRA =
  "Son series oficiales del BCRA (API v4.0), sin transformar: TAMAR (variable 44) y BADLAR (variable 7), ambas de bancos privados y en TNA."

export const CARD_FICHA_META: Record<string, CardFichaMeta> = {
  // ── Resumen ────────────────────────────────────────────────────────────────
  "resumen-tipo-cambio": {
    fuenteId: "argentina_datos",
    glosario: ["BLUE", "MEP", "CCL", "OFICIAL", "MAYORISTA"],
    calculo:
      "Cada cotización viene publicada tal cual por casa de cambio (blue, MEP, CCL, oficial, mayorista). La brecha de una cotización contra el oficial se calcula como (cotización − oficial) / oficial × 100. La cotización del momento sale de DolarAPI; la serie larga, de ArgentinaDatos.",
    serieEndpoint: SERIE_TIPOS_DE_CAMBIO,
    relacionadas: ["rofex", "bcra-compras"],
  },
  "resumen-ipc": {
    fuenteId: "datos_gob_series",
    glosario: ["IPC"],
    calculo:
      "La variación mensual es la serie oficial del INDEC (IPC Nacional) vía datos.gob.ar. La interanual se calcula acá: nivel del mes / nivel de 12 meses antes − 1, expresado en %.",
    serieEndpoint: SERIE_IPC,
    relacionadas: ["senoraje"],
  },
  "resumen-riesgo": {
    fuenteId: "argentina_datos",
    glosario: ["EMBI"],
    calculo:
      "El valor actual es el último dato de la serie diaria de riesgo país (puntos básicos) publicada por ArgentinaDatos. Las variaciones semanal y mensual se calculan contra el primer dato disponible dentro de la ventana de 7 días y de 1 mes.",
    serieEndpoint: SERIE_RIESGO_PAIS,
    relacionadas: ["bonos"],
  },
  "resumen-reservas": {
    fuenteId: "bcra_official",
    glosario: ["RESERVAS", "TAMAR", "BADLAR"],
    calculo:
      "Las reservas brutas son la serie oficial del BCRA. Las netas medidas se calculan como Var75 − Var1200 − Var1243 de la API del BCRA (metodología F. Machado); si falta un componente diario la neta queda vacía, no se estima. TAMAR y BADLAR son series oficiales sin transformar.",
    serieEndpoint: SERIE_RESERVAS,
    relacionadas: ["bcra-tasas", "bcra-compras"],
  },
  "resumen-noticias": { fuenteId: "news_rss" },

  // ── Finanzas ───────────────────────────────────────────────────────────────
  bonos: { glosario: ["LECAP", "TIR", "DURATION"], relacionadas: ["riesgo-pais"] },
  "renta-fija-avanzada": { glosario: ["TIR", "DURATION", "LECAP", "BONCAP"], relacionadas: ["riesgo-pais"] },
  rofex: { fuenteId: "rava_market", glosario: ["ROFEX"], relacionadas: ["fx"] },
  "plazo-fijo-mercado": {
    fuenteId: "bcra_official",
    glosario: ["TAMAR", "BADLAR"],
    calculo: CALCULO_TASAS_BCRA,
    serieEndpoint: serieTasas("plazofijo"),
    relacionadas: ["bcra-tasas"],
  },
  cripto: { fuenteId: "coingecko" },

  // ── Macro ──────────────────────────────────────────────────────────────────
  emae: {
    fuenteId: "datos_gob_series",
    glosario: ["EMAE"],
    calculo:
      "Serie del EMAE del INDEC (índice base 2004) vía datos.gob.ar. Las variaciones mensual e interanual son series oficiales distintas y se muestran en %.",
    serieEndpoint: {
      path: "/api/macro?endpoint=emae",
      claseDato: "official_monthly",
      ventana: "Últimos 36 meses (el endpoint recorta la serie a esa ventana)",
      lines: [{ path: "data.emae", name: "EMAE (índice base 2004)", shape: "tuples", color: "var(--amber)" }],
    },
  },
  ipc: {
    fuenteId: "datos_gob_series",
    glosario: ["IPC"],
    calculo:
      "La variación mensual es la serie oficial del INDEC (IPC Nacional) vía datos.gob.ar. La interanual se calcula acá: nivel del mes / nivel de 12 meses antes − 1, expresado en %.",
    serieEndpoint: SERIE_IPC,
    relacionadas: ["senoraje"],
  },
  fx: {
    fuenteId: "argentina_datos",
    glosario: ["BLUE", "MEP", "CCL", "OFICIAL", "MAYORISTA"],
    calculo:
      "Cada cotización viene publicada tal cual por casa de cambio. La brecha contra el oficial se calcula como (cotización − oficial) / oficial × 100. La serie larga sale de ArgentinaDatos; la cotización del momento, de DolarAPI.",
    serieEndpoint: SERIE_TIPOS_DE_CAMBIO,
    relacionadas: ["rofex", "bcra-compras"],
  },
  "riesgo-pais": {
    fuenteId: "argentina_datos",
    glosario: ["EMBI"],
    calculo:
      "El valor actual es el último dato de la serie diaria de riesgo país (puntos básicos) publicada por ArgentinaDatos. Las variaciones semanal y mensual se calculan contra el primer dato de la ventana; las medias móviles de 30 y 90 días se calculan sobre la misma serie.",
    serieEndpoint: SERIE_RIESGO_PAIS,
    relacionadas: ["bonos"],
  },
  senoraje: {
    fuenteId: "bcra_official",
    calculo:
      "Se toma la Base Monetaria diaria del BCRA (variable 15, último valor de cada mes) y el IPC mensual (datos.gob.ar). Con eso: precios acumulados P_t = producto de (1 + inflación); saldos reales = Base / P_t; señoreaje mensual = inflación × saldos reales. Después se agrega por año y se ajusta por OLS el modelo de Cagan, ln(M/P) = ln(k) − α·π; la curva de Laffer teórica es S(π) = π·k·exp(−α·π), con máximo en π* = 1/α.",
    relacionadas: ["bcra-agregados", "ipc"],
  },

  // ── BCRA ───────────────────────────────────────────────────────────────────
  "bcra-plazo-fijo": {
    fuenteId: "bcra_official",
    glosario: ["TAMAR", "BADLAR"],
    calculo: CALCULO_TASAS_BCRA,
    serieEndpoint: serieTasas("plazofijo"),
    relacionadas: ["bcra-tasas", "plazo-fijo-mercado"],
  },
  "bcra-tasas": {
    fuenteId: "bcra_official",
    glosario: ["TAMAR", "BADLAR"],
    calculo: CALCULO_TASAS_BCRA,
    serieEndpoint: serieTasas("tasas"),
    relacionadas: ["bcra-plazo-fijo", "plazo-fijo-mercado"],
  },
  "bcra-agregados": {
    fuenteId: "bcra_official",
    glosario: ["M2"],
    calculo: "Series oficiales del BCRA (API v4.0) sin transformar: Base Monetaria (variable 15), circulación (16), billetes en poder del público (17) y depósitos (variables 21, 22 y 23).",
    serieEndpoint: {
      path: "/api/bcra?endpoint=agregados",
      claseDato: "official_daily",
      unit: "millones de ARS",
      ventana: "Últimos 3 años (el endpoint recorta la serie a esa ventana)",
      lines: [
        { path: "data.base", name: "Base monetaria", shape: "objects", dateKey: "fecha", valueKey: "valor", color: "var(--amber)" },
        { path: "data.circulacion", name: "Circulación monetaria", shape: "objects", dateKey: "fecha", valueKey: "valor", color: "var(--sky)" },
      ],
    },
    relacionadas: ["senoraje"],
  },
  "bcra-reservas": {
    fuenteId: "bcra_official",
    glosario: ["RESERVAS"],
    calculo:
      "Las reservas brutas son la serie oficial del BCRA. Las netas medidas se calculan como Var75 − Var1200 − Var1243 de la API del BCRA (metodología F. Machado); si falta un componente diario la neta queda vacía, no se estima ni se ajusta por el FMI.",
    serieEndpoint: SERIE_RESERVAS,
    relacionadas: ["bcra-compras"],
  },
  "bcra-compras": {
    fuenteId: "bcra_official",
    glosario: ["MULC"],
    relacionadas: ["bcra-reservas", "fx"],
  },
  rem: { glosario: ["REM"] },
}
