// ─── Cliente Resend ──────────────────────────────────────────────────────────
// Sirve emails transaccionales de La Pizarra (por ahora, sólo alertas).
// Docs: https://resend.com/docs/api-reference/emails/send-email
//
// El API key vive en RESEND_API_KEY. Si falta, degradamos silenciosamente:
// el poller loguea pero no crashea. Esto habilita testear el pipeline sin
// pagar mientras no haya usuarios reales.

const FROM_DEFAULT = "La Pizarra <alertas@lapizarra.ar>"
const RESEND_URL = "https://api.resend.com/emails"

export interface EnviarEmailResult {
  ok: boolean
  status?: number
  error?: string
}

export async function enviarEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { from?: string; replyTo?: string },
): Promise<EnviarEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error("[resend] falta RESEND_API_KEY — no se envió email a", to)
    return { ok: false, error: "RESEND_API_KEY no configurada" }
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts?.from ?? FROM_DEFAULT,
        to,
        subject,
        html,
        ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[resend] status ${res.status} enviando a ${to}: ${body}`)
      return { ok: false, status: res.status, error: body }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    console.error("[resend] error enviando email:", e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
