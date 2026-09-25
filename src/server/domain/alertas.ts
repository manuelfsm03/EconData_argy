// ─── ALERTAS — dominio compartido ────────────────────────────────────────────
// Tipos y validadores usados por la API (/api/alertas) y por el poller
// (scripts/poll-alertas.mjs, vía inspección de config JSON).
//
// MVP: 3 tipos, canal único email, freemium = 3 alertas activas por usuario.

export const ALERTA_TIPOS = ["dolar", "tasa_bcra", "publicacion_ipc"] as const
export type AlertaTipo = (typeof ALERTA_TIPOS)[number]

export const ALERTA_OPERADORES = [">", ">=", "<", "<=", "=="] as const
export type AlertaOperador = (typeof ALERTA_OPERADORES)[number]

// Variedades de dólar que expone /api/dolares (key "casa" de dolarapi.com)
export const DOLAR_VARIEDADES = [
  "blue",
  "oficial",
  "bolsa",            // MEP
  "contadoconliqui",  // CCL
  "mayorista",
  "cripto",
  "tarjeta",
] as const
export type DolarVariedad = (typeof DOLAR_VARIEDADES)[number]

export interface ConfigDolar {
  variedad: DolarVariedad
  operador: AlertaOperador
  umbral: number
}

export interface ConfigTasaBcra {
  operador: AlertaOperador
  umbral: number  // TNA %
}

// Publicación IPC: no tiene threshold — dispara cuando aparece un mes nuevo.
export type ConfigPublicacionIpc = Record<string, never>

export type AlertaConfig = ConfigDolar | ConfigTasaBcra | ConfigPublicacionIpc

// Freemium
export const LIMITE_ALERTAS_FREE = 3

// ─── Validaciones ────────────────────────────────────────────────────────────

export function validarTipo(tipo: unknown): tipo is AlertaTipo {
  return typeof tipo === "string" && (ALERTA_TIPOS as readonly string[]).includes(tipo)
}

export function validarOperador(op: unknown): op is AlertaOperador {
  return typeof op === "string" && (ALERTA_OPERADORES as readonly string[]).includes(op)
}

export function validarVariedadDolar(v: unknown): v is DolarVariedad {
  return typeof v === "string" && (DOLAR_VARIEDADES as readonly string[]).includes(v)
}

/**
 * Valida y normaliza el `config` según el tipo.
 * Devuelve `{ ok: true, config }` si es válido, o `{ ok: false, error }` si no.
 */
export function validarConfig(
  tipo: AlertaTipo,
  raw: unknown,
): { ok: true; config: AlertaConfig } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "config debe ser un objeto" }
  }
  const c = raw as Record<string, unknown>

  if (tipo === "dolar") {
    if (!validarVariedadDolar(c.variedad)) {
      return { ok: false, error: `variedad inválida (usar una de: ${DOLAR_VARIEDADES.join(", ")})` }
    }
    if (!validarOperador(c.operador)) {
      return { ok: false, error: `operador inválido (usar uno de: ${ALERTA_OPERADORES.join(", ")})` }
    }
    if (typeof c.umbral !== "number" || !Number.isFinite(c.umbral)) {
      return { ok: false, error: "umbral debe ser un número finito" }
    }
    return { ok: true, config: { variedad: c.variedad, operador: c.operador, umbral: c.umbral } }
  }

  if (tipo === "tasa_bcra") {
    if (!validarOperador(c.operador)) {
      return { ok: false, error: `operador inválido (usar uno de: ${ALERTA_OPERADORES.join(", ")})` }
    }
    if (typeof c.umbral !== "number" || !Number.isFinite(c.umbral)) {
      return { ok: false, error: "umbral debe ser un número finito" }
    }
    return { ok: true, config: { operador: c.operador, umbral: c.umbral } }
  }

  if (tipo === "publicacion_ipc") {
    // No hay campos requeridos — el trigger es la nueva publicación mensual
    return { ok: true, config: {} }
  }

  return { ok: false, error: `tipo desconocido: ${tipo}` }
}

// ─── Evaluadores ─────────────────────────────────────────────────────────────

export function comparar(op: AlertaOperador, valor: number, umbral: number): boolean {
  switch (op) {
    case ">":  return valor >  umbral
    case ">=": return valor >= umbral
    case "<":  return valor <  umbral
    case "<=": return valor <= umbral
    case "==": return valor === umbral
  }
}

// ─── Descripciones humanas (UI + emails) ─────────────────────────────────────

const NOMBRE_VARIEDAD: Record<DolarVariedad, string> = {
  blue:            "Dólar Blue",
  oficial:         "Dólar Oficial",
  bolsa:           "Dólar MEP",
  contadoconliqui: "Dólar CCL",
  mayorista:       "Dólar Mayorista",
  cripto:          "Dólar Cripto",
  tarjeta:         "Dólar Tarjeta",
}

export function describirAlerta(tipo: AlertaTipo, config: AlertaConfig): string {
  if (tipo === "dolar") {
    const c = config as ConfigDolar
    return `${NOMBRE_VARIEDAD[c.variedad]} ${c.operador} $${c.umbral.toLocaleString("es-AR")}`
  }
  if (tipo === "tasa_bcra") {
    const c = config as ConfigTasaBcra
    return `Tasa de política monetaria BCRA ${c.operador} ${c.umbral}% TNA`
  }
  if (tipo === "publicacion_ipc") {
    return "Nueva publicación mensual del IPC (INDEC)"
  }
  return "Alerta"
}
