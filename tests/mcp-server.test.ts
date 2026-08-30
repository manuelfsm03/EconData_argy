import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { POST } from "../src/app/api/mcp/route"
import { callLapizarraTool, LAPIZARRA_MCP_TOOLS, MCP_DATA_ORIGIN, MCP_PROTOCOL_VERSION, MCP_SUPPORTED_VERSIONS } from "../src/server/mcp/lapizarra-mcp"

test("MCP initializes legacy clients as a stateless read-only tool server", async () => {
  const request = new NextRequest("https://www.lapizarra.ar/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
  })
  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("mcp-protocol-version"), "2025-06-18")
  assert.equal(payload.result.protocolVersion, "2025-06-18")
  assert.deepEqual(payload.result.capabilities, { tools: { listChanged: false } })
  assert.equal(LAPIZARRA_MCP_TOOLS.length, 3)
  assert.ok(LAPIZARRA_MCP_TOOLS.every((tool) => tool.annotations.readOnlyHint))
})

test("MCP implements modern server discovery with the current protocol", async () => {
  const request = new NextRequest("https://www.lapizarra.ar/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "MCP-Protocol-Version": MCP_PROTOCOL_VERSION },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "discover-1",
      method: "server/discover",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": { name: "test", version: "1.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  })
  const response = await POST(request)
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.result.resultType, "complete")
  assert.deepEqual(payload.result.supportedVersions, [...MCP_SUPPORTED_VERSIONS])
  assert.equal(payload.result._meta["io.modelcontextprotocol/serverInfo"].name, "lapizarra")
})

test("buscar_indicadores returns registered cards without calling the network", async () => {
  const result = await callLapizarraTool("buscar_indicadores", { consulta: "inflacion", limite: 5 })
  const text = result.content[0].text
  assert.equal(result.resultType, "complete")
  assert.match(text, /"indicador_id": "ipc"/)
  assert.match(text, /IPC/)
  assert.doesNotMatch(text, /\/api\//)
})

test("consultar_indicador calls only the registered canonical endpoint", async () => {
  let requestedUrl = ""
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({ data: [{ fecha: "2026-08-01", valor: 2.1 }] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Data-Source": "indec", "X-Data-Freshness": "fresh" },
    })
  }

  const result = await callLapizarraTool("consultar_indicador", { indicador_id: "ipc" }, fetcher)
  assert.equal(requestedUrl, `${MCP_DATA_ORIGIN}/api/macro?endpoint=ipc`)
  assert.equal(result.isError, false)
  assert.match(result.content[0].text, /"source": "indec"/)
  assert.match(result.content[0].text, /"valor": 2.1/)
})

test("unknown indicators and tools fail closed", async () => {
  const missing = await callLapizarraTool("consultar_indicador", { indicador_id: "../../admin" })
  const unknown = await callLapizarraTool("borrar_datos", {})
  assert.equal("isError" in missing && missing.isError, true)
  assert.equal("isError" in unknown && unknown.isError, true)
})
