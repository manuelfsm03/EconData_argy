export type CardCategory = "resumen" | "finanzas" | "macro" | "bcra" | "noticias"

export interface CardEndpoint {
  path: string
  label: string
  method?: "GET" | "POST"
  body?: Record<string, unknown>
}

export interface DataCardDefinition {
  id: string
  title: string
  description: string
  category: CardCategory
  tab: string
  subtab: string | null
  keywords: string[]
  endpoints: CardEndpoint[]
  defaultW: number
  defaultH: number
  minW: number
  minH: number
}

export const CARD_CATEGORIES: Array<{ id: CardCategory; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "finanzas", label: "Finanzas" },
  { id: "macro", label: "Macro" },
  { id: "bcra", label: "BCRA" },
  { id: "noticias", label: "Noticias" },
]

const card = (
  definition: Omit<DataCardDefinition, "defaultW" | "defaultH" | "minW" | "minH"> &
    Partial<Pick<DataCardDefinition, "defaultW" | "defaultH" | "minW" | "minH">>
): DataCardDefinition => ({
  defaultW: 6,
  defaultH: 10,
  minW: 4,
  minH: 6,
  ...definition,
})

/**
 * Inventario único de módulos visibles en La Pizarra.
 * Alimenta la Biblioteca, el buscador, el Canvas y el monitor de endpoints.
 */
export const DATA_CARD_CATALOG: DataCardDefinition[] = [
  card({ id: "resumen-tipo-cambio", title: "Tipos de cambio", category: "resumen", tab: "resumen", subtab: null, description: "Blue, CCL, MEP, mayorista, oficial y brechas.", keywords: ["dólar", "blue", "mep", "ccl", "brecha"], endpoints: [{ path: "/api/tc-historico?period=1m", label: "Tipo de cambio" }], defaultW: 12, defaultH: 7, minW: 6 }),
  card({ id: "resumen-ipc", title: "IPC actual", category: "resumen", tab: "resumen", subtab: null, description: "Inflación mensual e interanual del último período.", keywords: ["inflación", "ipc", "precios"], endpoints: [{ path: "/api/macro?endpoint=ipc", label: "IPC" }], defaultW: 4, defaultH: 6 }),
  card({ id: "resumen-riesgo", title: "Riesgo país actual", category: "resumen", tab: "resumen", subtab: null, description: "EMBI+ actual y variaciones semanal y mensual.", keywords: ["riesgo", "embi", "spread"], endpoints: [{ path: "/api/riesgo-pais", label: "Riesgo país" }], defaultW: 4, defaultH: 6 }),
  card({ id: "resumen-reservas", title: "Reservas y BADLAR", category: "resumen", tab: "resumen", subtab: null, description: "Reservas internacionales y tasa BADLAR.", keywords: ["reservas", "badlar", "bcra", "tasa"], endpoints: [{ path: "/api/bcra-data", label: "Reservas y BADLAR", method: "POST", body: { series_ids: ["reservas", "badlar"], period: "1m" } }], defaultW: 4, defaultH: 7 }),
  card({ id: "resumen-noticias", title: "Últimas noticias", category: "resumen", tab: "resumen", subtab: null, description: "Titulares económicos locales e internacionales.", keywords: ["noticias", "rss", "titulares"], endpoints: [{ path: "/api/rss-news", label: "Noticias" }], defaultW: 12, defaultH: 8, minW: 6 }),

  card({ id: "acciones", title: "Acciones argentinas", category: "finanzas", tab: "finanzas", subtab: "acciones", description: "Cotizaciones, variaciones y detalle de acciones locales.", keywords: ["merval", "cedear", "equity", "bolsa"], endpoints: [{ path: "/api/acciones?category=all", label: "Acciones" }] }),
  card({ id: "bonos", title: "Renta fija", category: "finanzas", tab: "finanzas", subtab: "bonos", description: "Bonos soberanos, LECAP y métricas de renta fija.", keywords: ["bonos", "lecap", "al30", "gd30", "tir"], endpoints: [{ path: "/api/bonos", label: "Bonos" }, { path: "/api/bonos?tipo=lecap", label: "LECAP" }] }),
  card({ id: "rofex", title: "Futuros ROFEX", category: "finanzas", tab: "finanzas", subtab: "rofex", description: "Curva de futuros de dólar y tasas implícitas.", keywords: ["futuros", "dólar", "matba", "rofex"], endpoints: [{ path: "/api/rofex", label: "ROFEX" }] }),
  card({ id: "plazo-fijo-mercado", title: "Plazo fijo", category: "finanzas", tab: "finanzas", subtab: "plazofijo", description: "Tasas y evolución de depósitos a plazo fijo.", keywords: ["badlar", "tasa", "depósitos"], endpoints: [{ path: "/api/bcra?variable=35", label: "BCRA plazo fijo" }] }),
  card({ id: "commodities", title: "Commodities", category: "finanzas", tab: "finanzas", subtab: "commodities", description: "Precios internacionales y referencias del agro local.", keywords: ["soja", "maíz", "trigo", "petróleo", "oro"], endpoints: [{ path: "/api/mundo", label: "Mercados globales" }, { path: "/api/agro-local", label: "Agro local" }] }),
  card({ id: "mercados-mundo", title: "Mercados del mundo", category: "finanzas", tab: "finanzas", subtab: "mundo", description: "Índices globales y curva de Treasuries de Estados Unidos.", keywords: ["s&p", "nasdaq", "dow", "treasury", "índices"], endpoints: [{ path: "/api/mundo", label: "Mercados globales" }, { path: "/api/ust-curve", label: "Treasuries" }] }),
  card({ id: "cripto", title: "Criptoactivos", category: "finanzas", tab: "finanzas", subtab: "crypto", description: "Cotizaciones y evolución de los principales criptoactivos.", keywords: ["bitcoin", "ethereum", "btc", "eth"], endpoints: [{ path: "/api/cripto", label: "Cripto" }, { path: "/api/mundo", label: "Históricos" }] }),
  card({ id: "screener-activos", title: "Screener de activos", category: "finanzas", tab: "finanzas", subtab: "screener", description: "Lista configurable por ticker con acciones, bonos, letras y mercados globales.", keywords: ["screener", "ticker", "watchlist", "comparar", "activos"], endpoints: [{ path: "/api/acciones?category=all", label: "Acciones" }, { path: "/api/bonos", label: "Bonos" }, { path: "/api/bonos?tipo=lecap", label: "Letras" }, { path: "/api/mundo", label: "Mercados globales" }], defaultW: 8, defaultH: 11, minW: 6 }),
  card({ id: "screener-tasas", title: "Screener de tasas", category: "finanzas", tab: "finanzas", subtab: "screener-tasas", description: "Buscador y comparador de tasas en pesos y dólares.", keywords: ["screener", "tasas", "ars", "usd", "tna", "tir", "treasury", "badlar"], endpoints: [{ path: "/api/bcra?endpoint=tasas", label: "Tasas BCRA" }, { path: "/api/ust-curve", label: "Treasuries" }, { path: "/api/bonos", label: "Bonos USD" }, { path: "/api/bonos?tipo=lecap", label: "Letras ARS" }, { path: "/api/rofex", label: "ROFEX" }], defaultW: 8, defaultH: 12, minW: 6 }),

  card({ id: "emae", title: "Actividad económica · EMAE", category: "macro", tab: "macro", subtab: "emae", description: "Actividad, empleo, sectores y confianza.", keywords: ["emae", "actividad", "empleo", "economía"], endpoints: [{ path: "/api/macro?endpoint=emae", label: "EMAE" }, { path: "/api/macro?endpoint=actividad", label: "Actividad" }] }),
  card({ id: "ipc", title: "Inflación · IPC", category: "macro", tab: "macro", subtab: "ipc", description: "IPC mensual, histórico, expectativas y composición.", keywords: ["inflación", "ipc", "precios", "indec"], endpoints: [{ path: "/api/macro?endpoint=ipc", label: "IPC" }, { path: "/api/ipc-historico", label: "IPC histórico" }, { path: "/api/rem", label: "Expectativas REM" }] }),
  card({ id: "balanza", title: "Balanza comercial", category: "macro", tab: "macro", subtab: "balanza", description: "Exportaciones, importaciones, saldo y principales socios.", keywords: ["comercio", "exportaciones", "importaciones", "saldo"], endpoints: [{ path: "/api/macro?endpoint=balanza", label: "Balanza" }, { path: "/api/balanza-socios", label: "Socios comerciales" }] }),
  card({ id: "fiscal", title: "Resultado fiscal", category: "macro", tab: "macro", subtab: "fiscal", description: "Ingresos, gastos y resultado primario y financiero.", keywords: ["déficit", "superávit", "gasto", "ingresos"], endpoints: [{ path: "/api/macro?endpoint=fiscal", label: "Fiscal" }] }),
  card({ id: "desigualdad", title: "Desigualdad", category: "macro", tab: "macro", subtab: "desigualdad", description: "Coeficiente de Gini y distribución del ingreso.", keywords: ["gini", "ingreso", "distribución", "pobreza"], endpoints: [{ path: "/api/macro?endpoint=argendata_desigualdad", label: "Desigualdad" }] }),
  card({ id: "piramides", title: "Pirámides poblacionales", category: "macro", tab: "macro", subtab: "piramides", description: "Estructura demográfica histórica y proyectada.", keywords: ["población", "demografía", "edad", "proyección"], endpoints: [{ path: "/api/macro?endpoint=piramide&year=2025&country=32", label: "Demografía" }] }),
  card({ id: "fx", title: "Tipo de cambio", category: "macro", tab: "macro", subtab: "fx", description: "Dólares, bandas cambiarias e índice de tipo de cambio real.", keywords: ["dólar", "blue", "mep", "ccl", "itcrm", "fx"], endpoints: [{ path: "/api/tc-historico?period=max", label: "Dólares" }, { path: "/api/tcr", label: "ITCRM" }, { path: "/api/bcra-bands", label: "Bandas" }] }),
  card({ id: "big-mac", title: "Big Mac Index", category: "macro", tab: "macro", subtab: "bigmac", description: "Paridad de poder adquisitivo y valuación relativa del peso.", keywords: ["ppa", "moneda", "valuación", "economist"], endpoints: [{ path: "/api/big-mac", label: "Big Mac" }] }),
  card({ id: "riesgo-pais", title: "Riesgo país", category: "macro", tab: "macro", subtab: "riesgo", description: "EMBI+ argentino y contexto histórico.", keywords: ["embi", "spread", "jpmorgan", "soberano"], endpoints: [{ path: "/api/riesgo-pais", label: "Riesgo país" }] }),
  card({ id: "deuda-publica", title: "Deuda pública", category: "macro", tab: "macro", subtab: "deuda", description: "Stock, composición y vencimientos de deuda pública.", keywords: ["deuda", "stock", "vencimientos", "tesoro"], endpoints: [{ path: "/api/deuda?n=6", label: "Deuda" }, { path: "/api/deuda?endpoint=stock", label: "Stock" }] }),
  card({ id: "senoraje", title: "Señoreaje", category: "macro", tab: "macro", subtab: "senoraje", description: "Modelo de Cagan, base monetaria e impuesto inflacionario.", keywords: ["emisión", "cagan", "base monetaria", "inflación"], endpoints: [{ path: "/api/senoraje", label: "Señoreaje" }] }),

  card({ id: "bcra-plazo-fijo", title: "BCRA · Plazo fijo", category: "bcra", tab: "bcra", subtab: "plazofijo", description: "Depósitos a plazo y tasas de referencia.", keywords: ["badlar", "tamar", "uva", "depósitos"], endpoints: [{ path: "/api/bcra?endpoint=plazofijo", label: "Plazo fijo" }] }),
  card({ id: "bcra-tasas", title: "BCRA · Tasas", category: "bcra", tab: "bcra", subtab: "tasas", description: "TAMAR, BADLAR, préstamos y adelantos.", keywords: ["tasa", "badlar", "tamar", "préstamos"], endpoints: [{ path: "/api/bcra?endpoint=tasas", label: "Tasas" }] }),
  card({ id: "bcra-agregados", title: "BCRA · Agregados monetarios", category: "bcra", tab: "bcra", subtab: "agregados", description: "Base monetaria, circulante, M1, M2 y depósitos.", keywords: ["m1", "m2", "base", "circulante"], endpoints: [{ path: "/api/bcra?endpoint=agregados", label: "Agregados" }] }),
  card({ id: "bcra-reservas", title: "BCRA · Reservas", category: "bcra", tab: "bcra", subtab: "reservas", description: "Reservas internacionales brutas y estimación neta.", keywords: ["reservas", "oro", "encajes", "swap"], endpoints: [{ path: "/api/bcra?endpoint=reservas", label: "Reservas" }] }),
  card({ id: "bcra-compras", title: "BCRA · Compras y ventas", category: "bcra", tab: "bcra", subtab: "compras", description: "Intervención compradora y vendedora en el MULC.", keywords: ["mulc", "intervención", "compras", "ventas"], endpoints: [{ path: "/api/bcra?endpoint=compras", label: "Compras y ventas" }] }),
  card({ id: "rem", title: "Relevamiento de Expectativas", category: "bcra", tab: "bcra", subtab: "rem", description: "Expectativas de mercado relevadas por el BCRA.", keywords: ["rem", "expectativas", "inflación", "dólar"], endpoints: [{ path: "/api/rem", label: "REM" }] }),

  card({ id: "noticias", title: "Noticias económicas", category: "noticias", tab: "noticias", subtab: null, description: "Noticias locales e internacionales y señales en vivo.", keywords: ["rss", "medios", "actualidad", "economía"], endpoints: [{ path: "/api/rss-news", label: "RSS" }], defaultW: 12, minW: 6 }),
]

export const DATA_CARD_BY_ID = new Map(DATA_CARD_CATALOG.map((item) => [item.id, item]))

export function searchDataCards(query: string, category?: CardCategory | "all"): DataCardDefinition[] {
  const normalized = query.trim().toLocaleLowerCase("es")
  return DATA_CARD_CATALOG.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false
    if (!normalized) return true
    return [item.title, item.description, item.category, ...item.keywords]
      .join(" ")
      .toLocaleLowerCase("es")
      .includes(normalized)
  })
}
