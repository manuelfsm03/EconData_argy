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
const SESSION_ID_MAX_LEN  = 64

// Patrones de prompt injection conocidos
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /forget\s+(everything|all|your|the)/i,
  /you\s+are\s+now\s+(a\s+)?(?!pizi)/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(?!pizi)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
]

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
}

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
  const rawSession = typeof body.session_id === "string" ? body.session_id : ""
  const sessionId  = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, SESSION_ID_MAX_LEN) || null

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (!message || message.length === 0) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `Mensaje demasiado largo (máx ${MAX_MESSAGE_LEN} caracteres)` }, { status: 400 })
  }
  if (!MODELS[modelId]) {
    return NextResponse.json({ error: "Modelo inválido" }, { status: 400 })
  }
  if (detectInjection(message)) {
    return NextResponse.json(
      { error: "Solo puedo ayudarte con los datos del dashboard. ¿Querés que consulte el dólar, la inflación, los mercados o las noticias de hoy?" },
      { status: 400 },
    )
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
    console.error("[agente/chat] ERROR:", errMsg)

    logChatEvent({
      ip,
      sessionId,
      messageText:    message,
      modelId,
      latencyMsTotal: Date.now() - tStart,
      status:         "error",
      errorMessage:   errMsg.slice(0, 500),
    })

    if (process.env.NODE_ENV === "development") console.error("[agente/chat] ERROR:", errMsg)
    return NextResponse.json(
      { error: "Error procesando la consulta. Intentá de nuevo." },
      { status: 500 },
    )
  }
}
