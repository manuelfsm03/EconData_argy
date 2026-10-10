// Cliente HTTP mínimo contra la API de La Pizarra.
// Usa `fetch` nativo de Node 20+ — no requiere axios ni node-fetch.

import { config } from "./config.js";

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

// Hace un GET con timeout, cabeceras estándar y respuesta JSON tipada.
export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new ApiError(
        `La Pizarra API devolvió ${res.status} en ${path}`,
        res.status
      );
    }

    // Algunos endpoints devuelven texto vacío en 204; tratamos ese caso.
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(`Respuesta no-JSON desde ${path}`);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        `Timeout (${config.timeoutMs}ms) consultando ${path}`
      );
    }
    throw new ApiError(
      `No pude alcanzar La Pizarra API (${path}): ${(err as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, config.baseUrl + "/");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}
