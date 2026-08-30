import { DATA_CARD_BY_ID, DATA_CARD_CATALOG, searchDataCards } from "@/lib/card-catalog"

export const MCP_PROTOCOL_VERSION = "2026-07-28"
export const MCP_SUPPORTED_VERSIONS = [
  MCP_PROTOCOL_VERSION,
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const
export const MCP_SERVER_VERSION = "1.0.0"
export const MCP_DATA_ORIGIN = "https://www.lapizarra.ar"

type JsonObject = Record<string, unknown>
type FetchLike = typeof fetch

interface McpTool {
  name: string
  title: string
  description: string
  inputSchema: JsonObject
  annotations: {
    readOnlyHint: true
    destructiveHint: false
    idempotentHint: true
    openWorldHint: boolean
  }
}

export const LAPIZARRA_MCP_TOOLS: McpTool[] = [
  {
    name: "buscar_indicadores",
    title: "Buscar indicadores económicos",
    description: "Busca en el catálogo público de La Pizarra por tema, indicador o fuente. Usalo antes de consultar para obtener el indicador_id y sus fuentes disponibles.",
    inputSchema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Texto libre, por ejemplo: inflación, dólar, reservas, bonos o actividad." },
        categoria: { type: "string", enum: ["todas", "resumen", "finanzas", "macro", "bcra", "noticias"], default: "todas" },
        limite: { type: "integer", minimum: 1, maximum: 35, default: 12 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "consultar_indicador",
    title: "Consultar datos económicos",
    description: "Obtiene datos actuales de una tarjeta pública de La Pizarra. Solo permite fuentes de solo lectura registradas en el catálogo y devuelve su procedencia cuando está disponible.",
    inputSchema: {
      type: "object",
      required: ["indicador_id"],
      properties: {
        indicador_id: { type: "string", description: "ID devuelto por buscar_indicadores, por ejemplo ipc, fx, riesgo-pais o bcra-reservas." },
        fuente: { type: "integer", minimum: 1, description: "Número de fuente dentro de la tarjeta. Por defecto usa la primera." },
        max_caracteres: { type: "integer", minimum: 2000, maximum: 50000, default: 20000 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "estado_fuentes",
    title: "Estado de las fuentes",
    description: "Consulta el monitor público de disponibilidad de las fuentes económicas de La Pizarra.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
]

function stringArg(args: JsonObject, key: string): string {
  return typeof args[key] === "string" ? args[key].trim() : ""
}

function integerArg(args: JsonObject, key: string, fallback: number, min: number, max: number): number {
  const value = args[key]
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function textResult(payload: unknown, maxCharacters = 50000) {
  const serialized = JSON.stringify(payload, null, 2)
  const truncated = serialized.length > maxCharacters
  const text = truncated
    ? `${serialized.slice(0, maxCharacters)}\n\n[Respuesta truncada: ${serialized.length} caracteres totales]`
    : serialized
  return { resultType: "complete" as const, content: [{ type: "text" as const, text }], isError: false }
}

function errorResult(message: string) {
  return { resultType: "complete" as const, isError: true, content: [{ type: "text" as const, text: message }] }
}

function publicCard(card: (typeof DATA_CARD_CATALOG)[number]) {
  return {
    indicador_id: card.id,
    titulo: card.title,
    descripcion: card.description,
    categoria: card.category,
    fuentes: card.endpoints.map((endpoint, index) => ({
      numero: index + 1,
      nombre: endpoint.label,
      metodo: endpoint.method ?? "GET",
    })),
  }
}

async function fetchRegisteredEndpoint(
  endpoint: (typeof DATA_CARD_CATALOG)[number]["endpoints"][number],
  fetcher: FetchLike,
) {
  const url = new URL(endpoint.path, MCP_DATA_ORIGIN)
  if (url.origin !== MCP_DATA_ORIGIN || !url.pathname.startsWith("/api/")) {
    throw new Error("La fuente solicitada no pertenece al catálogo público")
  }

  const method = endpoint.method ?? "GET"
  const response = await fetcher(url, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(endpoint.body ?? {}) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  const raw = await response.text()
  let data: unknown = raw
  try { data = JSON.parse(raw) } catch { /* Una fuente puede responder texto; se conserva sin ejecutar. */ }

  if (!response.ok) {
    throw new Error(`La fuente ${endpoint.label} respondió HTTP ${response.status}`)
  }

  return {
    fuente: endpoint.label,
    ruta: endpoint.path,
    consultado_en: new Date().toISOString(),
    procedencia: {
      source: response.headers.get("x-data-source"),
      freshness: response.headers.get("x-data-freshness"),
      as_of: response.headers.get("x-data-as-of"),
      warning: response.headers.get("x-data-warning"),
    },
    datos: data,
  }
}

export async function callLapizarraTool(
  name: string,
  args: JsonObject = {},
  fetcher: FetchLike = fetch,
) {
  if (name === "buscar_indicadores") {
    const query = stringArg(args, "consulta")
    const requestedCategory = stringArg(args, "categoria")
    const category = requestedCategory && requestedCategory !== "todas"
      ? requestedCategory as "resumen" | "finanzas" | "macro" | "bcra" | "noticias"
      : "all"
    const limit = integerArg(args, "limite", 12, 1, DATA_CARD_CATALOG.length)
    const results = searchDataCards(query, category).slice(0, limit)
    return textResult({
      consulta: query || null,
      resultados: results.map(publicCard),
      total: results.length,
      catalogo_total: DATA_CARD_CATALOG.length,
    })
  }

  if (name === "consultar_indicador") {
    const cardId = stringArg(args, "indicador_id").toLocaleLowerCase("es")
    const card = DATA_CARD_BY_ID.get(cardId)
    if (!card) return errorResult("indicador_id desconocido. Usá buscar_indicadores para consultar el catálogo.")

    const sourceNumber = integerArg(args, "fuente", 1, 1, card.endpoints.length)
    const endpoint = card.endpoints[sourceNumber - 1]
    const maxCharacters = integerArg(args, "max_caracteres", 20000, 2000, 50000)
    try {
      const result = await fetchRegisteredEndpoint(endpoint, fetcher)
      return textResult({ indicador: publicCard(card), ...result }, maxCharacters)
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : "No se pudo consultar la fuente")
    }
  }

  if (name === "estado_fuentes") {
    try {
      const result = await fetchRegisteredEndpoint({ path: "/api/status", label: "Monitor de fuentes" }, fetcher)
      return textResult(result)
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : "No se pudo consultar el monitor")
    }
  }

  return errorResult(`Herramienta desconocida: ${name}`)
}
