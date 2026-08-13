import { findSourceForUrl } from "@/server/sources/registry"

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

function retryable(error: unknown): boolean {
  return error instanceof TypeError || (
    error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

async function boundedResponse(response: Response, maxBytes: number): Promise<Response> {
  if (!response.body) return response
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error("SOURCE_RESPONSE_TOO_LARGE")
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function fetchRegistered(
  input: string | URL,
  init: RequestInit = {},
  transport: typeof fetch = globalThis.fetch,
): Promise<Response> {
  let url = input.toString()
  const definition = findSourceForUrl(url)
  const method = (init.method ?? "GET").toUpperCase()
  const maxAttempts = method === "GET" ? definition.retry.attempts + 1 : 1
  let redirects = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const registrySignal = AbortSignal.timeout(definition.timeoutMs)
      const signal = init.signal ? AbortSignal.any([init.signal, registrySignal]) : registrySignal
      const response = await transport(url, { ...init, redirect: "manual", signal })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) throw new Error("SOURCE_REDIRECT_WITHOUT_LOCATION")
        const redirectedUrl = new URL(location, url).toString()
        const redirectedSource = findSourceForUrl(redirectedUrl)
        if (redirectedSource.id !== definition.id) throw new Error("SOURCE_REDIRECT_NOT_ALLOWED")
        redirects += 1
        if (redirects > 3) throw new Error("SOURCE_REDIRECT_LIMIT")
        url = redirectedUrl
        attempt -= 1
        continue
      }

      const declaredBytes = Number(response.headers.get("content-length"))
      if (Number.isFinite(declaredBytes) && declaredBytes > definition.maxResponseBytes) {
        await response.body?.cancel()
        throw new Error("SOURCE_RESPONSE_TOO_LARGE")
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt < maxAttempts) {
        await response.body?.cancel()
        await delay(25 * attempt)
        continue
      }
      return boundedResponse(response, definition.maxResponseBytes)
    } catch (error) {
      if (attempt < maxAttempts && retryable(error)) continue
      throw error
    }
  }
  throw new Error("SOURCE_UNAVAILABLE")
}
