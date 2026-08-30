import { NextRequest, NextResponse } from "next/server"
import {
  callLapizarraTool,
  LAPIZARRA_MCP_TOOLS,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_VERSION,
  MCP_SUPPORTED_VERSIONS,
} from "@/server/mcp/lapizarra-mcp"

export const dynamic = "force-dynamic"

interface JsonRpcRequest {
  jsonrpc?: unknown
  id?: unknown
  method?: unknown
  params?: unknown
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version",
}

function rpcResult(id: unknown, result: unknown, status = 200, protocolVersion = MCP_PROTOCOL_VERSION) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status, headers: { ...CORS_HEADERS, "MCP-Protocol-Version": protocolVersion } },
  )
}

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status, headers: { ...CORS_HEADERS, "MCP-Protocol-Version": MCP_PROTOCOL_VERSION } },
  )
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export function GET() {
  return NextResponse.json(
    {
      name: "La Pizarra MCP",
      transport: "Streamable HTTP",
      protocolVersion: MCP_PROTOCOL_VERSION,
      instructions: "Conectá este endpoint desde un cliente MCP mediante POST.",
    },
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } },
  )
}

export async function POST(request: NextRequest) {
  let payload: JsonRpcRequest
  try {
    payload = await request.json()
  } catch {
    return rpcError(null, -32700, "Parse error", 400)
  }

  if (payload.jsonrpc !== "2.0" || typeof payload.method !== "string") {
    return rpcError(payload.id, -32600, "Invalid Request", 400)
  }

  if (payload.method === "notifications/initialized") {
    return new NextResponse(null, { status: 202, headers: CORS_HEADERS })
  }

  if (payload.method === "initialize") {
    const params = payload.params && typeof payload.params === "object" ? payload.params as Record<string, unknown> : {}
    const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : ""
    const negotiatedVersion = (MCP_SUPPORTED_VERSIONS as readonly string[]).includes(requestedVersion)
      ? requestedVersion
      : MCP_PROTOCOL_VERSION
    return rpcResult(payload.id, {
      protocolVersion: negotiatedVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "lapizarra", title: "La Pizarra · Datos económicos", version: MCP_SERVER_VERSION },
      instructions: "Servidor público y de solo lectura. Buscá indicadores y consultá sus fuentes registradas; verificá siempre procedencia y fecha de actualización antes de tomar decisiones.",
    }, 200, negotiatedVersion)
  }

  if (payload.method === "server/discover") {
    return rpcResult(payload.id, {
      resultType: "complete",
      supportedVersions: MCP_SUPPORTED_VERSIONS,
      capabilities: { tools: { listChanged: false } },
      _meta: {
        "io.modelcontextprotocol/serverInfo": {
          name: "lapizarra",
          title: "La Pizarra · Datos económicos",
          version: MCP_SERVER_VERSION,
        },
      },
      instructions: "Servidor público y de solo lectura para consultar el catálogo económico y la salud de sus fuentes.",
      ttlMs: 3600000,
      cacheScope: "public",
    })
  }

  if (payload.method === "ping") return rpcResult(payload.id, {})
  if (payload.method === "tools/list") return rpcResult(payload.id, {
    resultType: "complete",
    tools: LAPIZARRA_MCP_TOOLS,
    ttlMs: 3600000,
    cacheScope: "public",
  })

  if (payload.method === "tools/call") {
    const params = payload.params && typeof payload.params === "object" ? payload.params as Record<string, unknown> : {}
    if (typeof params.name !== "string") return rpcError(payload.id, -32602, "Nombre de herramienta requerido")
    const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
      ? params.arguments as Record<string, unknown>
      : {}
    const result = await callLapizarraTool(params.name, args)
    return rpcResult(payload.id, result)
  }

  return rpcError(payload.id, -32601, `Method not found: ${payload.method}`)
}
