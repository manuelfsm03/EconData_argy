import { findSourceForUrl } from "@/server/sources/registry"
import type { SourceDefinition } from "@/server/sources/types"

const MAX_REDIRECTS = 3

export type SessionResult = { response: Response; cookieHeader: string }

type CookieJar = Map<string, string>

function retryable(error: unknown): boolean {
  return error instanceof TypeError || (
    error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

async function boundedResponse(response: Response, maxBytes: number): Promise<Response> {
  const declaredBytes = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    await response.body?.cancel()
    throw new Error("SOURCE_RESPONSE_TOO_LARGE")
  }
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

function responseCookieHeader(response: Response, jar: CookieJar): void {
  const raw = response.headers.get("set-cookie")
  if (!raw) return
  if (/[\r\n]/.test(raw)) throw new Error("SOURCE_INVALID_COOKIE")

  // Node's Headers may combine Set-Cookie values. Cookie attributes are
  // deliberately discarded; only the name/value pair enters this local jar.
  const parts = raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
  for (const part of parts) {
    const pair = part.trim().split(";", 1)[0]?.trim() ?? ""
    const equals = pair.indexOf("=")
    const name = equals >= 0 ? pair.slice(0, equals).trim() : ""
    const value = equals >= 0 ? pair.slice(equals + 1).trim() : ""
    if (!name || /[\u0000-\u001f\u007f;=]/.test(name) || /[\r\n\u0000-\u001f\u007f]/.test(value)) {
      throw new Error("SOURCE_INVALID_COOKIE")
    }
    jar.set(name, value)
  }
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar).map(([name, value]) => `${name}=${value}`).join("; ")
}

const SAFE_CROSS_SOURCE_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "cache-control",
  "content-type",
  "user-agent",
])

function crossSourceHeaders(headers: Headers): Headers {
  const result = new Headers()
  for (const [name, value] of Array.from(headers)) {
    if (SAFE_CROSS_SOURCE_HEADERS.has(name)) result.set(name, value)
  }
  return result
}

function withCookie(headers: Headers, cookie: string): Headers {
  const result = new Headers(headers)
  if (cookie) result.set("Cookie", cookie)
  else result.delete("Cookie")
  return result
}

function retryStatus(response: Response, definition: SourceDefinition): boolean {
  return (response.status === 429 && definition.retry.retryOn.includes("429")) ||
    (response.status >= 500 && response.status < 600 && definition.retry.retryOn.includes("5xx"))
}

async function fetchBounded(
  input: string | URL,
  init: RequestInit,
  transport: typeof fetch,
  session: boolean,
): Promise<SessionResult> {
  let url = input.toString()
  let definition: SourceDefinition = findSourceForUrl(url)
  let redirects = 0
  let forwardCookies = false
  const jar: CookieJar = new Map()
  let hopHeaders = new Headers(init.headers)
  const method = (init.method ?? "GET").toUpperCase()

  while (true) {
    let redirected = false
    const maxAttempts = method === "GET" ? definition.retry.attempts + 1 : 1
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const registrySignal = AbortSignal.timeout(definition.timeoutMs)
        const signal = init.signal ? AbortSignal.any([init.signal, registrySignal]) : registrySignal
        const headers = session && forwardCookies ? withCookie(hopHeaders, cookieHeader(jar)) : new Headers(hopHeaders)
        const response = await transport(url, { ...init, headers, redirect: "manual", signal })

        if (session && (definition.id === "yahoo_finance" || definition.id === "yahoo_consent")) {
          responseCookieHeader(response, jar)
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location")
          if (!location) throw new Error("SOURCE_REDIRECT_WITHOUT_LOCATION")
          const redirectedUrl = new URL(location, url).toString()
          const redirectedSource = findSourceForUrl(redirectedUrl)
          const crossSource = redirectedSource.id !== definition.id
          if (crossSource && !definition.allowedRedirectSourceIds.includes(redirectedSource.id)) {
            throw new Error("SOURCE_REDIRECT_NOT_ALLOWED")
          }
          redirects += 1
          if (redirects > MAX_REDIRECTS) throw new Error("SOURCE_REDIRECT_LIMIT")
          await response.body?.cancel()
          // Never carry credentials from one publisher to another. The next
          // hop starts from these sanitized headers, not from init.headers, so
          // a later return to the original source cannot resurrect them.
          hopHeaders = crossSource ? crossSourceHeaders(hopHeaders) : new Headers(hopHeaders)
          // A local session jar is allowed on an explicit cross-source edge;
          // same-source redirects retain it for the active session only.
          forwardCookies = session && (
            redirectedSource.id === definition.id ||
            definition.cookieForwardSourceIds.includes(redirectedSource.id)
          )
          url = redirectedUrl
          definition = redirectedSource
          redirected = true
          break
        }

        if (retryStatus(response, definition) && attempt < maxAttempts) {
          await response.body?.cancel()
          await delay(25 * attempt)
          continue
        }
        return { response: await boundedResponse(response, definition.maxResponseBytes), cookieHeader: cookieHeader(jar) }
      } catch (error) {
        if (attempt < maxAttempts && retryable(error)) continue
        throw error
      }
    }
    // A redirect changed the active definition. Start a fresh retry budget for
    // that destination and derive its timeout/byte policy on the next hop.
    if (!redirected) throw new Error("SOURCE_UNAVAILABLE")
  }
}

export async function fetchRegistered(
  input: string | URL,
  init: RequestInit = {},
  transport: typeof fetch = globalThis.fetch,
): Promise<Response> {
  return (await fetchBounded(input, init, transport, false)).response
}

export async function fetchRegisteredSession(
  input: string | URL,
  init: RequestInit = {},
  transport: typeof fetch = globalThis.fetch,
): Promise<SessionResult> {
  return fetchBounded(input, init, transport, true)
}
