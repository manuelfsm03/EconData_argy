/**
 * src/lib/agente-llm.ts
 * ─────────────────────────────────────────────────────────
 * Router unificado de LLMs con tool use.
 *
 * Soporta:
 *   - Claude Haiku 4.5 (Anthropic API, via fetch directo)
 *   - Gemini 2.0 Flash (Google Generative Language API, via fetch directo)
 *
 * Sin SDKs para mantener el bundle liviano en Vercel Hobby (10s limit).
 * ─────────────────────────────────────────────────────────
 */

import { executeTool, ToolDef } from "./agente-tools"

const MAX_OUTPUT_TOKENS = 350  // respuestas cortas = menos tokens de salida
const LLM_TIMEOUT_MS   = 8000

export const MODELS: Record<string, { label: string; provider: "anthropic" | "google"; model: string }> = {
  "haiku-4.5": {
    label:    "Claude Haiku 4.5",
    provider: "anthropic",
    model:    "claude-haiku-4-5-20251001",
  },
  "gemini-flash": {
    label:    "Gemini 2.0 Flash",
    provider: "google",
    model:    "gemini-2.0-flash",
  },
}

export interface ToolCallLog {
  tool:       string
  args:       Record<string, unknown>
  ok:         boolean
  latency_ms: number
}

export interface AgentResult {
  answer:        string
  tool_calls:    ToolCallLog[]
  iterations:    number
  tokens_input:  number
  tokens_output: number
}

export async function runAgent(
  modelId: string,
  systemPrompt: string,
  userMessage: string,
  tools: ToolDef[],
  maxIterations = 4,
): Promise<AgentResult> {
  const cfg = MODELS[modelId]
  if (!cfg) throw new Error(`Modelo desconocido: ${modelId}`)

  if (cfg.provider === "anthropic") {
    return runAnthropic(cfg, systemPrompt, userMessage, tools, maxIterations)
  }
  return runGoogle(cfg, systemPrompt, userMessage, tools, maxIterations)
}

// ═══════════════════════════════════════════════════════════
//   ANTHROPIC (Claude Haiku 4.5)
// ═══════════════════════════════════════════════════════════

async function runAnthropic(
  cfg: { model: string },
  systemPrompt: string,
  userMessage: string,
  tools: ToolDef[],
  maxIterations: number,
): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada")

  const anthropicTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))

  type AnthropicMessage = { role: "user" | "assistant"; content: unknown }
  const messages: AnthropicMessage[] = [{ role: "user", content: userMessage }]

  const toolCallsLog: ToolCallLog[] = []
  let totalInput = 0
  let totalOutput = 0
  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt,
        tools: anthropicTools,
        messages,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      stop_reason: string
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
      usage: { input_tokens: number; output_tokens: number }
    }

    totalInput  += data.usage?.input_tokens  ?? 0
    totalOutput += data.usage?.output_tokens ?? 0

    const hasToolUse = data.content.some((b) => b.type === "tool_use")

    if (!hasToolUse || data.stop_reason === "end_turn") {
      const answer = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim()
      return { answer, tool_calls: toolCallsLog, iterations, tokens_input: totalInput, tokens_output: totalOutput }
    }

    messages.push({ role: "assistant", content: data.content })

    const toolResults: Array<{ type: string; tool_use_id: string; content: string; is_error: boolean }> = []

    for (const block of data.content) {
      if (block.type !== "tool_use") continue

      const t0 = Date.now()
      const result = await executeTool(block.name!, block.input ?? {})
      const latency = Date.now() - t0

      toolCallsLog.push({ tool: block.name!, args: block.input ?? {}, ok: result.ok, latency_ms: latency })

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id!,
        content: JSON.stringify(result.ok ? result.data : { error: result.error }),
        is_error: !result.ok,
      })
    }

    messages.push({ role: "user", content: toolResults })
  }

  return {
    answer: "Tuve problemas para completar la respuesta. Probá reformulando la pregunta.",
    tool_calls: toolCallsLog,
    iterations,
    tokens_input: totalInput,
    tokens_output: totalOutput,
  }
}

// ═══════════════════════════════════════════════════════════
//   GOOGLE (Gemini 2.0 Flash)
// ═══════════════════════════════════════════════════════════

async function runGoogle(
  cfg: { model: string },
  systemPrompt: string,
  userMessage: string,
  tools: ToolDef[],
  maxIterations: number,
): Promise<AgentResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada")

  const googleTools = [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: stripGeminiUnsupported(t.input_schema),
    })),
  }]

  type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: unknown }
  type GeminiContent = { role: string; parts: GeminiPart[] }
  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: userMessage }] }]

  const toolCallsLog: ToolCallLog[] = []
  let totalInput = 0
  let totalOutput = 0
  let iterations = 0

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`

  while (iterations < maxIterations) {
    iterations++

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: googleTools,
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: 0.3,
        },
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates: Array<{ content: { parts: GeminiPart[] } }>
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number }
    }

    totalInput  += data.usageMetadata?.promptTokenCount     ?? 0
    totalOutput += data.usageMetadata?.candidatesTokenCount ?? 0

    const parts = data.candidates?.[0]?.content?.parts ?? []
    const functionCalls = parts.filter((p) => p.functionCall)

    if (functionCalls.length === 0) {
      const answer = parts
        .filter((p) => p.text)
        .map((p) => p.text ?? "")
        .join("\n")
        .trim()
      return { answer, tool_calls: toolCallsLog, iterations, tokens_input: totalInput, tokens_output: totalOutput }
    }

    contents.push({ role: "model", parts })

    const responseParts: GeminiPart[] = []

    for (const part of functionCalls) {
      const fc = part.functionCall!
      const t0 = Date.now()
      const result = await executeTool(fc.name, fc.args ?? {})
      const latency = Date.now() - t0

      toolCallsLog.push({ tool: fc.name, args: fc.args ?? {}, ok: result.ok, latency_ms: latency })

      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: result.ok ? result.data : { error: result.error },
        },
      })
    }

    contents.push({ role: "user", parts: responseParts })
  }

  return {
    answer: "Tuve problemas para completar la respuesta. Probá reformulando la pregunta.",
    tool_calls: toolCallsLog,
    iterations,
    tokens_input: totalInput,
    tokens_output: totalOutput,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripGeminiUnsupported(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema
  const s = schema as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s)) {
    if (k === "default" || k === "enum") continue
    out[k] = k === "properties"
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, stripGeminiUnsupported(pv)]))
      : stripGeminiUnsupported(v)
  }
  return out
}
