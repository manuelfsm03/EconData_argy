/**
 * POST /api/agente/chat
 * ─────────────────────────────────────────────────────────
 * Endpoint conversacional del agente de análisis.
 *
 * Body: { message: string, model?: string, session_id?: string }
 * Response: { answer, remaining, model_used, tool_calls, iterations }
 * ─────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server"
import { runAgent, MODELS }          from "@/lib/agente-llm"
import { TOOLS, buildSystemPrompt }  from "@/lib/agente-tools"
import { checkRateLimit, logChatEvent, getClientIp } from "@/lib/agente-observability"

export const runtime = "nodejs"
export const maxDuration = 10 // Vercel Hobby limit

const MAX_QUERIES_PER_DAY = 3
const MAX_MESSAGE_LEN     = 500

export async function POST(request: NextRequest) {
  const tStart = Date.now()
  const ip     = getClientIp(request)

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { message?: unknown; model?: unknown; session_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const message   = typeof body.message === "string" ? body.message.trim() : ""
  const modelId   = typeof body.model   === "string" ? body.model   : "haiku-4.5"
  const sessionId = typeof body.session_id === "string" ? body.session_id : null

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (!message || message.length === 0) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `Mensaje demasiado largo (máx ${MAX_MESSAGE_LEN} caracteres)` }, { status: 400 })
  }
  if (!MODELS[modelId]) {
    const valid = Object.keys(MODELS).join(", ")
    return NextResponse.json({ error: `Modelo inválido. Opciones: ${valid}` }, { status: 400 })
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rl = await checkRateLimit(ip, MAX_QUERIES_PER_DAY)

  if (!rl.allowed) {
    // Log rate limit (fire-and-forget)
    logChatEvent({
      ip,
      sessionId,
      messageText:    message,
      modelId,
      latencyMsTotal: Date.now() - tStart,
      status:         "rate_limited",
    })
    return NextResponse.json(
      {
        error:             "Alcanzaste el límite diario de consultas",
        remaining:         0,
        resets_in_seconds: rl.resetsInSeconds,
      },
      { status: 429 },
    )
  }

  // ── Correr el agente ──────────────────────────────────────────────────────
  try {
    const systemPrompt = buildSystemPrompt()
    const result = await runAgent(modelId, systemPrompt, message, TOOLS, 4)

    const latencyTotal = Date.now() - tStart
    const latencyTools = result.tool_calls.reduce((acc, tc) => acc + tc.latency_ms, 0)

    // Log (fire-and-forget)
    logChatEvent({
      ip,
      sessionId,
      messageText:    message,
      modelId,
      modelVersion:   MODELS[modelId].model,
      toolCalls:      result.tool_calls,
      iterations:     result.iterations,
      latencyMsTotal: latencyTotal,
      latencyMsLlm:   latencyTotal - latencyTools,
      latencyMsTools: latencyTools,
      tokensInput:    result.tokens_input,
      tokensOutput:   result.tokens_output,
      status:         "ok",
      answerLen:      result.answer.length,
    })

    return NextResponse.json({
      answer:     result.answer,
      remaining:  rl.remaining,
      model_used: modelId,
      tool_calls: result.tool_calls,
      iterations: result.iterations,
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)

    logChatEvent({
      ip,
      sessionId,
      messageText:    message,
      modelId,
      latencyMsTotal: Date.now() - tStart,
      status:         "error",
      errorMessage:   errMsg.slice(0, 500),
    })

    // No exponer el mensaje interno al usuario
    return NextResponse.json(
      { error: "Error procesando la consulta. Intentá de nuevo." },
      { status: 500 },
    )
  }
}
