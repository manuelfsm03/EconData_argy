import type { SourceId } from "@/server/sources/registry"
import type { DataClass } from "@/server/sources/types"
import { CARD_FICHA_META } from "./card-ficha-meta"

export type CardCategory ="resumen" | "finanzas" | "macro" | "bcra" | "noticias"

export interface CardEndpoint {
  path: string
  label: string
  method?: "GET" | "POST"
  body?: Record<string, unknown>
}

/**
 * Una línea del gráfico de la ficha. `path` apunta (con puntos) al arreglo
 * dentro del JSON del endpoint. `shape` dice cómo viene cada punto:
 *  - "tuples":  [fecha, valor]            (p. ej. /api/macro)
 *  - "objects": { <dateKey>, <valueKey> } (p. ej. /api/bcra, /api/tc-historico)
 * `scale` multiplica el valor (p. ej. 100 si la fuente lo da en proporción).
 */
export interface CardSeriesLine {
  path: string
  name: string
  shape: "tuples" | "objects"
  dateKey?: string
  valueKey?: string
  scale?: number
  color?: string
}

/** Endpoint (existente) del que la ficha saca la serie larga de la tarjeta. */
export interface CardSerieEndpoint {
  path: string
  method?: "GET" | "POST"
  body?: Record<string, unknown>
  lines: CardSeriesLine[]
  /** Unidad para mostrar al lado del título (solo si la fuente la declara). */
  unit?: string
  /** Aclaración honesta de la ventana (p. ej. "últimos 36 meses"). */
  ventana?: string
  /**
   * Frecuencia real de la serie. Se usa para juzgar la frescura: una serie
   * mensual no puede medirse con la ventana de una fuente diaria.
   */
  claseDato?: DataClass
}

/**
 * Metadata opcional de "profundidad" (ficha de tarjeta). Todo es opcional y
 * solo se completa cuando el dato es derivable del código; si no se sabe, se
 * deja vacío y la ficha lo dice en lugar de inventarlo.
 */
export interface CardFichaMeta {
  /** Fuente de la serie que muestra la ficha (clave de SOURCE_REGISTRY). */
  fuenteId?: SourceId
  /** Cómo se calcula, en criollo; solo lo verificado en el código del endpoint. */
  calculo?: string
  /** Ids de otras tarjetas con relación conceptual (además de las que comparten endpoint). */
  relacionadas?: string[]
  /** Ids de término del glosario (src/lib/glossary.ts) para explicar en la ficha. */
  glosario?: string[]
  /** Endpoint existente con la serie larga. */
  serieEndpoint?: CardSerieEndpoint
}

export interface DataCardDefinition extends CardFichaMeta {
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

// Agro remains implemented for a later scope, but is not part of the approved
// MVP inventory yet. Keep the definition behind an explicit flag so it
// cannot silently enter the Library, Canvas, or their coverage contracts.
const AGRO_CARD_ENABLED = false
const AGRO_CARD = card({ id: "agro", title: "Agro", category: "macro", tab: "macro", subtab: "agro", description: "Pizarra Rosario en vivo, futuros CBOT y producción mundial de soja.", keywords: ["soja", "maíz", "trigo", "agro", "cbot", "rosario", "fob", "girasol", "cereales", "granos"], endpoints: [{ path: "/api/agro-local", label: "Pizarra Rosario" }, { path: "/api/commodities?categoria=agro", label: "CBOT futuros" }, { path: "/api/agro-soja", label: "Producción soja" }] })

/**
 * Inventario único de módulos visibles en La Pizarra.
 * Alimenta la Biblioteca, el buscador, el Canvas y el monitor de endpoints.
 */
const BASE_CATALOG: DataCardDefinition[] = [
  card({ id: "resumen-tipo-cambio", title: "Tipos de cambio", category: "resumen", tab: "resumen", subtab: null, description: "Blue, CCL, MEP, mayorista, oficial y brechas.", keywords: ["dólar", "blue", "mep", "ccl", "brecha"], endpoints: [{ path: "/api/dolares", label: "Cotización intradiaria" }, { path: "/api/tc-historico?period=1m", label: "Histórico" }], defaultW: 12, defaultH: 5, minW: 6, minH: 4 }),
  card({ id: "resumen-ipc", title: "IPC actual", category: "resumen", tab: "resumen", subtab: null, description: "Inflación mensual e interanual del último período.", keywords: ["inflación", "ipc", "precios"], endpoints: [{ path: "/api/macro?endpoint=ipc", label: "IPC" }], defaultW: 4, defaultH: 4, minH: 3 }),
  card({ id: "resumen-riesgo", title: "Riesgo país actual", category: "resumen", tab: "resumen", subtab: null, description: "EMBI+ actual y variaciones semanal y mensual.", keywords: ["riesgo", "embi", "spread"], endpoints: [{ path: "/api/riesgo-pais", label: "Riesgo país" }], defaultW: 4, defaultH: 4, minH: 3 }),
  card({ id: "resumen-reservas", title: "Reservas y TAMAR", category: "resumen", tab: "resumen", subtab: null, description: "Reservas internacionales, TAMAR vigente y BADLAR histórica.", keywords: ["reservas", "tamar", "badlar", "bcra", "tasa"], endpoints: [{ path: "/api/bcra-data", label: "Reservas, TAMAR y BADLAR", method: "POST", body: { series_ids: ["reservas", "tamar", "badlar"], period: "1m" } }], defaultW: 4, defaultH: 5, minH: 4 }),
  card({ id: "resumen-noticias", title: "Últimas noticias", category: "resumen", tab: "resumen", subtab: null, description: "Titulares económicos locales e internacionales.", keywords: ["noticias", "rss", "titulares"], endpoints: [{ path: "/api/rss-news", label: "Noticias" }], defaultW: 12, defaultH: 8, minW: 6 }),

  card({ id: "acciones", title: "Acciones argentinas", category: "finanzas", tab: "finanzas", subtab: "acciones", description: "Cotizaciones, variaciones y detalle de acciones locales.", keywords: ["merval", "cedear", "equity", "bolsa"], endpoints: [{ path: "/api/acciones?category=all", label: "Acciones" }] }),
  card({ id: "bonos", title: "Renta fija", category: "finanzas", tab: "finanzas", subtab: "bonos", description: "Bonos soberanos, LECAP y métricas de renta fija.", keywords: ["bonos", "lecap", "al30", "gd30", "tir"], endpoints: [{ path: "/api/bonos", label: "Bonos" }, { path: "/api/bonos?tipo=lecap", label: "LECAP" }] }),
  card({ id: "renta-fija-avanzada", title: "Renta fija avanzada", category: "finanzas", tab: "finanzas", subtab: "bonos-avanzado", description: "Snapshot soberano, curva TIR-duration, heatmap, LECAP/BONCAP y riesgo país.", keywords: ["bonos", "curva", "duration", "heatmap", "lecap", "riesgo país"], endpoints: [{ path: "/api/bonos", label: "Bonos" }, { path: "/api/bonos?tipo=lecap", label: "LECAP" }, { path: "/api/riesgo-pais", label: "Riesgo país" }], defaultW: 12, defaultH: 18, minW: 8 }),
  card({ id: "rofex", title: "Futuros ROFEX", category: "finanzas", tab: "finanzas", subtab: "rofex", description: "Curva de futuros de dólar y tasas implícitas.", keywords: ["futuros", "dólar", "matba", "rofex"], endpoints: [{ path: "/api/rofex", label: "ROFEX" }] }),
  card({ id: "plazo-fijo-mercado", title: "Plazo fijo", category: "finanzas", tab: "finanzas", subtab: "plazofijo", description: "Tasas y evolución de depósitos a plazo fijo.", keywords: ["tamar", "badlar", "tasa", "depósitos"], endpoints: [{ path: "/api/bcra?endpoint=plazofijo", label: "BCRA plazo fijo" }] }),
  card({ id: "commodities", title: "Commodities", category: "finanzas", tab: "finanzas", subtab: "commodities", description: "Precios internacionales y referencias del agro local.", keywords: ["soja", "maíz", "trigo", "petróleo", "oro"], endpoints: [{ path: "/api/mundo", label: "Mercados globales" }, { path: "/api/agro-local", label: "Agro local" }] }),
  card({ id: "mercados-mundo", title: "Mercados del mundo", category: "finanzas", tab: "finanzas", subtab: "mundo", description: "Índices globales y curva de Treasuries de Estados Unidos.", keywords: ["s&p", "nasdaq", "dow", "treasury", "índices"], endpoints: [{ path: "/api/mundo", label: "Mercados globales" }, { path: "/api/ust-curve", label: "Treasuries" }] }),
  card({ id: "cripto", title: "Criptoactivos", category: "finanzas", tab: "finanzas", subtab: "crypto", description: "Cotizaciones y evolución de los principales criptoactivos.", keywords: ["bitcoin", "ethereum", "btc", "eth"], endpoints: [{ path: "/api/cripto", label: "Cripto" }, { path: "/api/mundo", label: "Históricos" }] }),
  card({ id: "screener-activos", title: "Screener de activos", category: "finanzas", tab: "finanzas", subtab: "screener", description: "Lista configurable por ticker con acciones, bonos, letras y mercados globales.", keywords: ["screener", "ticker", "watchlist", "comparar", "activos"], endpoints: [{ path: "/api/acciones?category=all", label: "Acciones" }, { path: "/api/bonos", label: "Bonos" }, { path: "/api/bonos?tipo=lecap", label: "Letras" }, { path: "/api/mundo", label: "Mercados globales" }], defaultW: 8, defaultH: 11, minW: 6 }),

  card({ id: "emae", title: "Actividad económica · EMAE", category: "macro", tab: "macro", subtab: "emae", description: "Actividad, empleo, sectores y confianza.", keywords: ["emae", "actividad", "empleo", "economía"], endpoints: [{ path: "/api/macro?endpoint=emae", label: "EMAE" }, { path: "/api/macro?endpoint=actividad", label: "Actividad" }] }),
  card({ id: "ipc", title: "Inflación · IPC", category: "macro", tab: "macro", subtab: "ipc", description: "IPC mensual, histórico y calculadora personal.", keywords: ["inflación", "ipc", "precios", "indec"], endpoints: [{ path: "/api/macro?endpoint=ipc", label: "IPC" }, { path: "/api/macro?endpoint=ipc_divisiones", label: "IPC por divisiones" }, { path: "/api/ipc-historico", label: "IPC histórico" }] }),
  card({ id: "balanza", title: "Balanza comercial", category: "macro", tab: "macro", subtab: "balanza", description: "Exportaciones, importaciones, saldo y principales socios.", keywords: ["comercio", "exportaciones", "importaciones", "saldo"], endpoints: [{ path: "/api/macro?endpoint=balanza", label: "Balanza" }, { path: "/api/macro?endpoint=argendata_comext", label: "Composición ICA (USD M)" }, { path: "/api/macro?endpoint=comext_sitc", label: "SITC histórico (%)" }, { path: "/api/balanza-socios", label: "Socios comerciales" }] }),
  card({ id: "fiscal", title: "Flujo fiscal", category: "macro", tab: "macro", subtab: "fiscal", description: "Fuentes de ingreso y gasto primario en 31 líneas publicadas, con resultado primario y financiero.", keywords: ["déficit", "superávit", "gasto", "ingresos", "fiscal", "imig", "recaudación", "subsidios", "jubilaciones"], endpoints: [{ path: "/api/macro?endpoint=fiscal_imig", label: "IMIG — ingresos y gastos" }, { path: "/api/macro?endpoint=fiscal", label: "Resultado fiscal" }], defaultW: 12, defaultH: 18, minW: 8 }),

  card({ id: "desigualdad", title: "Desigualdad", category: "macro", tab: "macro", subtab: "desigualdad", description: "Coeficiente de Gini y distribución del ingreso.", keywords: ["gini", "ingreso", "distribución", "pobreza"], endpoints: [{ path: "/api/macro?endpoint=argendata_desigualdad", label: "Desigualdad" }] }),
  card({ id: "piramides", title: "Pirámides poblacionales", category: "macro", tab: "macro", subtab: "piramides", description: "Estructura demográfica histórica y proyectada.", keywords: ["población", "demografía", "edad", "proyección"], endpoints: [{ path: "/api/macro?endpoint=piramide&year=2025&country=32", label: "Demografía" }] }),
  card({ id: "fx", title: "Tipo de cambio", category: "macro", tab: "macro", subtab: "fx", description: "Dólares, bandas cambiarias e índice de tipo de cambio real.", keywords: ["dólar", "blue", "mep", "ccl", "itcrm", "fx"], endpoints: [{ path: "/api/dolares", label: "Cotización intradiaria" }, { path: "/api/tc-historico?period=max", label: "Histórico" }, { path: "/api/tcr", label: "ITCRM" }, { path: "/api/bcra-bands", label: "Bandas" }] }),
  card({ id: "big-mac", title: "Big Mac Index", category: "macro", tab: "macro", subtab: null, description: "Paridad de poder adquisitivo y valuación relativa del peso.", keywords: ["ppa", "moneda", "valuación", "economist"], endpoints: [{ path: "/api/big-mac", label: "Big Mac" }] }),
  card({ id: "riesgo-pais", title: "Riesgo país", category: "macro", tab: "macro", subtab: "riesgo", description: "EMBI+ argentino y contexto histórico.", keywords: ["embi", "spread", "jpmorgan", "soberano"], endpoints: [{ path: "/api/riesgo-pais", label: "Riesgo país" }] }),
  card({ id: "deuda-publica", title: "Deuda pública", category: "macro", tab: "macro", subtab: "deuda", description: "Stock, composición y resultados de licitaciones del Tesoro.", keywords: ["deuda", "stock", "vencimientos", "tesoro", "licitaciones"], endpoints: [{ path: "/api/deuda?endpoint=stock", label: "Stock" }, { path: "/api/deuda?n=6", label: "Licitaciones" }] }),
  card({ id: "senoraje", title: "Señoreaje", category: "macro", tab: "macro", subtab: null, description: "Modelo de Cagan, base monetaria e impuesto inflacionario.", keywords: ["emisión", "cagan", "base monetaria", "inflación"], endpoints: [{ path: "/api/senoraje", label: "Señoreaje" }] }),

  card({ id: "bcra-plazo-fijo", title: "BCRA · Plazo fijo", category: "bcra", tab: "bcra", subtab: "plazofijo", description: "Depósitos a plazo y tasas de referencia.", keywords: ["badlar", "tamar", "uva", "depósitos"], endpoints: [{ path: "/api/bcra?endpoint=plazofijo", label: "Plazo fijo" }] }),
  card({ id: "bcra-tasas", title: "BCRA · Tasas", category: "bcra", tab: "bcra", subtab: "tasas", description: "TAMAR, BADLAR, préstamos y adelantos.", keywords: ["tasa", "badlar", "tamar", "préstamos"], endpoints: [{ path: "/api/bcra?endpoint=tasas", label: "Tasas" }] }),
  card({ id: "bcra-agregados", title: "BCRA · Agregados monetarios", category: "bcra", tab: "bcra", subtab: "agregados", description: "Base monetaria, circulante, M1, M2 y depósitos.", keywords: ["m1", "m2", "base", "circulante"], endpoints: [{ path: "/api/bcra?endpoint=agregados", label: "Agregados" }] }),
  card({ id: "bcra-reservas", title: "BCRA · Reservas", category: "bcra", tab: "bcra", subtab: "reservas", description: "Reservas brutas y netas medidas, con histórico desde 2000.", keywords: ["reservas", "oro", "encajes", "histórico"], endpoints: [{ path: "/api/bcra?endpoint=reservas&historico=true", label: "Reservas" }] }),
  card({ id: "bcra-bancos", title: "BCRA · Balance de bancos", category: "bcra", tab: "bcra", subtab: "bancos", description: "Composición histórica del activo y fondeo del sistema financiero.", keywords: ["bancos", "balance", "crédito", "depósitos", "fondeo"], endpoints: [{ path: "/api/bcra-data?endpoint=bancos&desde=2021-01-01&hasta=2030-12-31", label: "Balance de bancos" }], defaultW: 12, defaultH: 15, minW: 8 }),
  card({ id: "bcra-compras", title: "BCRA · Compras y ventas", category: "bcra", tab: "bcra", subtab: "compras", description: "Intervención compradora y vendedora en el MULC.", keywords: ["mulc", "intervención", "compras", "ventas"], endpoints: [{ path: "/api/bcra?endpoint=compras", label: "Compras y ventas" }] }),
  card({ id: "rem", title: "Relevamiento de Expectativas", category: "bcra", tab: "bcra", subtab: "rem", description: "Expectativas de mercado relevadas por el BCRA.", keywords: ["rem", "expectativas", "inflación", "dólar"], endpoints: [{ path: "/api/rem", label: "REM" }] }),

  card({ id: "noticias", title: "Noticias económicas", category: "noticias", tab: "noticias", subtab: null, description: "Noticias locales e internacionales y señales en vivo.", keywords: ["rss", "medios", "actualidad", "economía"], endpoints: [{ path: "/api/rss-news", label: "RSS" }], defaultW: 12, minW: 6 }),
  ...(AGRO_CARD_ENABLED ? [AGRO_CARD] : []),
]

/**
 * Catálogo final = definiciones base + metadata de la ficha. La metadata vive en
 * `card-ficha-meta.ts` (un solo archivo, claves por id) para no pisar las líneas
 * del catálogo que otros PRs tocan todo el tiempo.
 */
export const DATA_CARD_CATALOG: DataCardDefinition[] = BASE_CATALOG.map((item) => ({ ...item, ...CARD_FICHA_META[item.id] }))

/**
 * Tarjetas que comparten exactamente el mismo endpoint (método + path + query +
 * body) con la dada: "usan el mismo dato". Se deriva, no se declara, así no se
 * desactualiza.
 */
export function cardsSharingEndpoint(cardId: string): DataCardDefinition[] {
  const base = DATA_CARD_CATALOG.find((item) => item.id === cardId)
  if (!base) return []
  const key = (endpoint: CardEndpoint) => `${endpoint.method ?? "GET"}:${endpoint.path}:${JSON.stringify(endpoint.body ?? null)}`
  const keys = new Set(base.endpoints.map(key))
  return DATA_CARD_CATALOG.filter((item) => item.id !== cardId && item.endpoints.some((endpoint) => keys.has(key(endpoint))))
}

export const DATA_CARD_BY_ID =new Map(DATA_CARD_CATALOG.map((item) => [item.id, item]))

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

export function searchDataCards(query: string, category?: CardCategory | "all"): DataCardDefinition[] {
  const normalized = normalizeSearchText(query)
  return DATA_CARD_CATALOG.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false
    if (!normalized) return true
    return normalizeSearchText([item.title, item.description, item.category, ...item.keywords].join(" ")).includes(normalized)
  })
}
