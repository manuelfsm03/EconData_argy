/**
 * src/lib/agente-observability.ts
 * ─────────────────────────────────────────────────────────
 * Rate limit + logging de eventos en Supabase (via REST, sin SDK).
 *
 * Principios:
 *   - Nunca bloquea la respuesta al usuario si Supabase falla (fail-open)
 *   - IPs hasheadas con SHA-256 + salt antes de guardar
 *   - Compatible con Vercel Lambda (stateless, sin shared memory)
 * ─────────────────────────────────────────────────────────
 */

import crypto from "crypto"

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supabaseUrl(path: string): string {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "")
  return `${base}/rest/v1/${path}`
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
}

// ── Hashing ───────────────────────────────────────────────────────────────────

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "lapizarra-default-salt-CAMBIAR"
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex")
}

export function hashMessage(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.?!,;:]+$/, "")
  return crypto.createHash("sha256").update(normalized).digest("hex")
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for") ?? ""
  if (xff) return xff.split(",")[0].trim()
  return "unknown"
}

// ── Estimación de costos (USD) ────────────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  "haiku-4.5":    { input: 1.00 / 1_000_000, output: 5.00 / 1_000_000 },
  "gemini-flash": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
}

export function estimateCost(modelId: string, tokensIn: number, tokensOut: number): number | null {
  const p = PRICING[modelId]
  if (!p) return null
  return Math.round((tokensIn * p.input + tokensOut * p.output) * 1_000_000) / 1_000_000
}

// ── Rate limit ────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetsInSeconds: number
}

export async function checkRateLimit(ip: string, maxPerDay: number): Promise<RateLimitResult> {
  const ipHash = hashIp(ip)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Si no hay Supabase configurado, siempre permitir (MVP sin observabilidad)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true, remaining: maxPerDay - 1, resetsInSeconds: 86400 }
  }

  try {
    const res = await fetch(
      supabaseUrl("chat_events") +
        `?select=id&ip_hash=eq.${ipHash}&status=eq.ok&created_at=gte.${encodeURIComponent(since)}&limit=1`,
      {
        headers: { ...supabaseHeaders(), Prefer: "count=exact" },
        signal: AbortSignal.timeout(3000),
      },
    )
    const contentRange = res.headers.get("content-range") ?? "*/0"
    const current = parseInt(contentRange.split("/").at(-1) ?? "0", 10)

    if (current >= maxPerDay) {
      return { allowed: false, remaining: 0, resetsInSeconds: 86400 }
    }
    return { allowed: true, remaining: maxPerDay - current - 1, resetsInSeconds: 86400 }
  } catch {
    // Fail-open: si Supabase no responde, no bloqueamos al usuario
    return { allowed: true, remaining: maxPerDay - 1, resetsInSeconds: 86400 }
  }
}

// ── Logging de eventos ────────────────────────────────────────────────────────

export interface ChatEventPayload {
  ip: string
  sessionId?: string | null
  messageText: string
  modelId: string
  modelVersion?: string
  toolCalls?: unknown[]
  iterations?: number
  latencyMsTotal: number
  latencyMsLlm?: number
  latencyMsTools?: number
  tokensInput?: number
  tokensOutput?: number
  status: "ok" | "error" | "rate_limited" | "timeout"
  errorMessage?: string
  answerLen?: number
}

export async function logChatEvent(event: ChatEventPayload): Promise<void> {
  // Si no hay Supabase, no hacer nada (sin ruido en logs)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

  try {
    const payload = {
      ip_hash:          hashIp(event.ip),
      session_id:       event.sessionId ?? null,
      message_text:     event.messageText.slice(0, 1000),
      message_hash:     hashMessage(event.messageText),
      message_len:      event.messageText.length,
      model_id:         event.modelId,
      model_version:    event.modelVersion ?? null,
      tool_calls:       event.toolCalls ?? [],
      iterations:       event.iterations ?? 1,
      latency_ms_total: event.latencyMsTotal,
      latency_ms_llm:   event.latencyMsLlm ?? null,
      latency_ms_tools: event.latencyMsTools ?? null,
      tokens_input:     event.tokensInput ?? null,
      tokens_output:    event.tokensOutput ?? null,
      cost_usd:         event.tokensInput != null && event.tokensOutput != null
        ? estimateCost(event.modelId, event.tokensInput, event.tokensOutput)
        : null,
      status:           event.status,
      error_message:    event.errorMessage ?? null,
      answer_len:       event.answerLen ?? null,
    }

    await fetch(supabaseUrl("chat_events"), {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
  } catch (e) {
    // Fire-and-forget: nunca romper la respuesta al usuario
    console.error("[observability] log error:", e)
  }
}
