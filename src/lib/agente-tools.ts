/**
 * src/lib/agente-tools.ts
 * ─────────────────────────────────────────────────────────
 * Definición de tools del agente + ejecutor.
 *
 * Las tools llaman a los endpoints Next.js existentes via fetch interno.
 * Patrón: BASE_URL resuelve a localhost en dev y a la URL del deploy en prod.
 * ─────────────────────────────────────────────────────────
 */

import { headers } from "next/headers"

// ── Base URL helper ───────────────────────────────────────────────────────────

function getBaseUrl(): string {
  // En Vercel Production
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // En Vercel Preview
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  // Local
  return "http://localhost:3000"
}

async function internalFetch(path: string): Promise<unknown> {
  const base = getBaseUrl()
  const res = await fetch(`${base}${path}`, {
    headers: { "x-internal-agent": "1" },
    signal: AbortSignal.timeout(7000),
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10)
  return `Sos el asistente de análisis de La Pizarra, un dashboard argentino de economía y mercados. Hoy es ${today}.

Respondés preguntas sobre economía, mercados y datos argentinos usando exclusivamente las herramientas disponibles.

HERRAMIENTAS:
- get_dolar_bcra: tipos de cambio (oficial, blue, MEP, CCL, mayorista, cripto, tarjeta), brecha, reservas BCRA, riesgo país, BADLAR
- get_macro: EMAE, IPI manufacturero, balanza comercial, actividad económica
- get_ipc: IPC nacional histórico, núcleo, alimentos, regulados, inflación mensual e interanual
- get_deuda_fiscal: última licitación del Tesoro, resultado primario/financiero, recaudación
- get_mundo: mercados globales (S&P 500, Nasdaq, Merval, commodities, FX, crypto, UST 10Y)
- get_noticias: noticias económicas filtradas del apartado de noticias

REGLAS DURAS:
1. Si necesitás datos, LLAMÁ a la tool correspondiente. Nunca inventes cifras ni fechas.
2. Si la tool no devuelve info relevante, decilo: "No encuentro ese dato en el dashboard ahora".
3. Siempre citá fuente y fecha al final: [Fuente, fecha].
4. Separá HECHOS de INTERPRETACIÓN: "El dato muestra X" vs "Esto podría implicar Y".
5. NO das recomendaciones de inversión personalizadas. Si preguntan "¿compro X?", aclarás: "No doy recomendaciones personalizadas".
6. Respuestas CORTAS: máximo 4 oraciones salvo que pidan profundizar.
7. Si la pregunta no es sobre economía/finanzas/mercado argentino o contexto global relevante, decí: "Me ocupo solo de economía y mercados. ¿Te puedo ayudar con algo del dashboard?" y no llames tools.
8. Neutral políticamente. No uses adjetivos cargados. Describí hechos.

TONO: directo, técnico pero claro, rioplatense. Sin emojis. Sin "¡Excelente pregunta!".

Si una tool falla o devuelve vacío, no insistas; avisá al usuario.`
}

// ── Definición de tools (formato Anthropic / adaptable a Gemini) ───────────────

export interface ToolDef {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_dolar_bcra",
    description:
      "Obtiene tipos de cambio actuales (dólar oficial, blue, MEP, CCL, mayorista, cripto, tarjeta), " +
      "brecha cambiaria, reservas internacionales del BCRA, riesgo país (EMBI) y tasa BADLAR. " +
      "Usar cuando el usuario pregunte por cotizaciones, brecha, reservas, riesgo país o tasas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_macro",
    description:
      "Obtiene indicadores de actividad económica argentina: EMAE (nivel, variación mensual e interanual), " +
      "IPI Manufacturero, balanza comercial (exportaciones, importaciones, saldo). " +
      "Usar cuando pregunten por nivel de actividad, crecimiento, exportaciones/importaciones.",
    input_schema: {
      type: "object",
      properties: {
        indicador: {
          type: "string",
          enum: ["emae", "ipi", "balanza", "todos"],
          description: "Indicador específico. 'todos' para traer el panel completo.",
        },
      },
    },
  },
  {
    name: "get_ipc",
    description:
      "Obtiene datos de IPC argentino: variación mensual e interanual, núcleo, alimentos, regulados. " +
      "Usar para cualquier pregunta sobre inflación.",
    input_schema: {
      type: "object",
      properties: {
        vista: {
          type: "string",
          enum: ["actual", "historico"],
          description: "'actual' = último dato, 'historico' = serie últimos 24 meses.",
        },
      },
    },
  },
  {
    name: "get_deuda_fiscal",
    description:
      "Obtiene info de deuda y fiscal: última licitación del Tesoro (adjudicado, vencimientos, " +
      "rollover %, instrumentos), resultado primario, recaudación. " +
      "Usar cuando pregunten por licitaciones, superávit/déficit, recaudación, deuda.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_mundo",
    description:
      "Obtiene cotizaciones de mercados globales: S&P 500, Nasdaq, Merval, VIX, " +
      "soja, maíz, trigo, petróleo, oro, EUR/USD, BRL/USD, UST 10Y, Bitcoin, Ethereum. " +
      "Usar cuando pregunten por mercados internacionales, commodities, monedas globales, crypto.",
    input_schema: {
      type: "object",
      properties: {
        tickers: {
          type: "string",
          description: "Tickers específicos separados por coma (ej: sp500,soja,bitcoin). Omitir para traer todos.",
        },
      },
    },
  },
  {
    name: "get_noticias",
    description:
      "Obtiene noticias económicas argentinas del dashboard. " +
      "Usar cuando el usuario pregunte qué pasó, qué medida se tomó, novedades recientes.",
    input_schema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Texto para filtrar (ej: 'dólar', 'BCRA', 'inflación'). Omitir para traer todas.",
        },
        limit: {
          type: "integer",
          description: "Cantidad de noticias (default 8, máx 20).",
        },
      },
    },
  },
]

// ── Ejecutor ──────────────────────────────────────────────────────────────────

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const handlers: Record<string, (a: Record<string, unknown>) => Promise<unknown>> = {
      get_dolar_bcra: callDolarBcra,
      get_macro:      callMacro,
      get_ipc:        callIpc,
      get_deuda_fiscal: callDeudaFiscal,
      get_mundo:      callMundo,
      get_noticias:   callNoticias,
    }
    const handler = handlers[name]
    if (!handler) return { ok: false, error: `Tool desconocida: ${name}` }
    const data = await handler(args)
    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg.slice(0, 200) }
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function callDolarBcra(_args: Record<string, unknown>) {
  // Llama al endpoint de dólares y extrae un snapshot compacto para el agente
  const data = await internalFetch("/api/dolares") as Record<string, unknown>

  // Simplificar para el agente: solo los campos relevantes
  const rates = (data.rates as Record<string, unknown>[] | undefined) ?? []
  const snapshot = rates.map((r: Record<string, unknown>) => ({
    nombre: r.nombre,
    compra: r.compra,
    venta: r.venta,
    fechaActualizacion: r.fechaActualizacion,
  }))

  return {
    cotizaciones: snapshot,
    brecha_ccl: data.brecha_ccl,
    brecha_mep: data.brecha_mep,
    fuente: "dolarapi.com",
    fecha: new Date().toISOString().slice(0, 10),
  }
}

async function callMacro(args: Record<string, unknown>) {
  const indicador = (args.indicador as string) || "todos"

  if (indicador === "todos" || indicador === "emae") {
    const emae = await internalFetch("/api/macro?endpoint=emae") as Record<string, unknown>
    const balanza = await internalFetch("/api/macro?endpoint=balanza") as Record<string, unknown>
    const ipi = await internalFetch("/api/macro?endpoint=ipi") as Record<string, unknown>
    return {
      emae: extractEmae(emae),
      balanza: extractBalanza(balanza),
      ipi: extractIpi(ipi),
      fuente: "INDEC · datos.gob.ar",
    }
  }
  if (indicador === "balanza") {
    const d = await internalFetch("/api/macro?endpoint=balanza") as Record<string, unknown>
    return { ...extractBalanza(d), fuente: "INDEC · datos.gob.ar" }
  }
  if (indicador === "ipi") {
    const d = await internalFetch("/api/macro?endpoint=ipi") as Record<string, unknown>
    return { ...extractIpi(d), fuente: "INDEC · datos.gob.ar" }
  }
  // emae
  const d = await internalFetch("/api/macro?endpoint=emae") as Record<string, unknown>
  return { ...extractEmae(d), fuente: "INDEC · datos.gob.ar" }
}

async function callIpc(args: Record<string, unknown>) {
  const d = await internalFetch("/api/macro?endpoint=ipc") as Record<string, unknown>
  const data = d.data as Record<string, [string, number][]> | undefined
  if (!data) return { error: "Sin datos IPC" }

  const ultimo_mensual = data.ipc_var_mensual?.[0]
  const ultimo_interanual = (() => {
    const general = data.ipc_general
    if (!general || general.length < 13) return null
    const last = general[0][1]
    const base = general[12][1]
    return base ? +((last / base - 1) * 100).toFixed(2) : null
  })()

  if ((args.vista as string) === "historico") {
    return {
      serie_mensual: data.ipc_var_mensual?.slice(0, 24),
      nucleo: data.ipc_nucleo?.slice(0, 12),
      alimentos: data.ipc_alimentos?.slice(0, 12),
      regulados: data.ipc_regulados?.slice(0, 12),
      fuente: "INDEC · datos.gob.ar",
    }
  }

  return {
    var_mensual_pct: ultimo_mensual ? +(ultimo_mensual[1] * 100).toFixed(2) : null,
    fecha: ultimo_mensual?.[0],
    var_interanual_pct: ultimo_interanual,
    nucleo_ultimo: data.ipc_nucleo?.[0],
    alimentos_ultimo: data.ipc_alimentos?.[0],
    regulados_ultimo: data.ipc_regulados?.[0],
    fuente: "INDEC · datos.gob.ar",
  }
}

async function callDeudaFiscal(_args: Record<string, unknown>) {
  const [deuda, fiscal] = await Promise.allSettled([
    internalFetch("/api/deuda"),
    internalFetch("/api/macro?endpoint=fiscal"),
  ])

  return {
    deuda: deuda.status === "fulfilled" ? deuda.value : null,
    fiscal: fiscal.status === "fulfilled"
      ? extractFiscal(fiscal.value as Record<string, unknown>)
      : null,
    fuente: "INDEC · datos.gob.ar · argentina.gob.ar",
  }
}

async function callMundo(args: Record<string, unknown>) {
  const tickers = args.tickers as string | undefined
  const path = tickers ? `/api/mundo?ticker=${tickers}` : "/api/mundo"
  const d = await internalFetch(path) as Record<string, unknown>
  return { ...d, fuente: "Yahoo Finance" }
}

async function callNoticias(args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 8, 20)
  const filter = (args.filter as string | undefined) ?? ""

  // Llama al RSS news endpoint general
  const d = await internalFetch(`/api/rss-news?limit=${limit * 3}`) as Record<string, unknown>
  let items = (d.items as Record<string, unknown>[] | undefined) ?? []

  if (filter) {
    const kw = filter.toLowerCase()
    items = items.filter((item) => {
      const title = String(item.title ?? "").toLowerCase()
      const desc  = String(item.description ?? "").toLowerCase()
      return title.includes(kw) || desc.includes(kw)
    })
  }

  return {
    noticias: items.slice(0, limit).map((item) => ({
      titulo: item.title,
      fuente: item.source,
      fecha:  item.pubDate,
      link:   item.link,
    })),
    total: items.length,
    filtro: filter || null,
    fuente: "RSS (Infobae, Ámbito, iProfesional)",
  }
}

// ── Helpers de extracción compacta ────────────────────────────────────────────

function extractEmae(d: Record<string, unknown>) {
  const data = d.data as Record<string, [string, number][]> | undefined
  if (!data) return null
  return {
    indice: data.emae?.[0],
    var_mensual: data.emae_var_mensual?.[0],
    var_interanual: data.emae_var_interanual?.[0],
  }
}

function extractBalanza(d: Record<string, unknown>) {
  const data = d.data as Record<string, [string, number][]> | undefined
  if (!data) return null
  return {
    exportaciones_ultimo: data.exportaciones?.[0],
    importaciones_ultimo: data.importaciones?.[0],
    saldo_ultimo: data.saldo_comercial?.[0],
  }
}

function extractIpi(d: Record<string, unknown>) {
  const data = d.data as Record<string, [string, number][]> | undefined
  if (!data) return null
  return {
    ipi_ultimo: data.ipi?.[0],
    ipi_var_interanual: data.ipi_var_interanual?.[0],
  }
}

function extractFiscal(d: Record<string, unknown>) {
  const data = d.data as Record<string, [string, number][]> | undefined
  if (!data) return null
  return {
    resultado_primario_ultimo: data.resultado_primario?.[0],
    resultado_financiero_ultimo: data.resultado_financiero?.[0],
    recaudacion_ultimo: data.recaudacion?.[0],
  }
}
