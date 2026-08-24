/**
 * Contrato de Predicción — el corazón de "integridad" de la Comunidad.
 *
 * El ranking (puntos, aciertos) solo tiene valor si cada predicción es
 * VERIFICABLE OBJETIVAMENTE. Para eso, una predicción no es un texto libre:
 * es un contrato con una regla de resolución que una máquina puede evaluar
 * sin criterio humano, contra las mismas fuentes de precios que ya usa La
 * Pizarra.
 *
 * Principios de integridad (por qué el contrato se ve así):
 *  1. Foto de entrada inmutable: `activo`, `valorEntrada` y `fechaEntrada` se
 *     capturan al publicar y NO se pueden editar después. Sin esto, cualquiera
 *     "acierta" moviendo el precio de entrada.
 *  2. Regla de resolución objetiva: `metrica` + `operador` + `objetivo` +
 *     `fechaResolucion`. Se evalúa sola; nadie se autocalifica.
 *  3. Resolución auditable: el valor que resuelve viene de una `fuente`
 *     nombrada (endpoint real) y se guarda `valorResolucion` + `fechaResuelta`.
 *  4. La dirección/tesis está estructurada en `operador` (la máquina la lee) y
 *     además hay `tesis` en texto para el razonamiento humano.
 *  5. El estado lo deriva `resolverPrediccion`, no el usuario.
 */

export type TipoActivo = "bono" | "accion" | "fx" | "tasa" | "indice" | "cripto"

/** Qué variable del activo se mide para resolver. */
export type MetricaPrediccion =
  | "precio"          // precio de mercado (USD o $ según el activo)
  | "tir"             // TIR / TNA / TEA de un bono
  | "paridad"         // paridad de un bono
  | "spread"          // spread vs otro activo / riesgo país
  | "variacion_pct"   // variación % desde la entrada

/** La comparación objetiva que define un acierto. */
export type OperadorPrediccion =
  | "mayor_igual"     // valor final >= objetivo
  | "menor_igual"     // valor final <= objetivo
  | "sube"            // valor final > valorEntrada
  | "baja"            // valor final < valorEntrada
  | "rango"           // objetivoMin <= valor final <= objetivoMax

export type EstadoPrediccion = "abierta" | "acertada" | "errada" | "anulada"

export interface Prediccion {
  id: string
  autorId: string

  // ── QUÉ ──────────────────────────────────────────────
  activo: string           // ticker: "GD30", "AL30", "GGAL", "USD_CCL"...
  tipoActivo: TipoActivo

  // ── TESIS (humano) ───────────────────────────────────
  tesis: string            // el razonamiento, en palabras del autor

  // ── REGLA DE RESOLUCIÓN (máquina) ────────────────────
  metrica: MetricaPrediccion
  operador: OperadorPrediccion
  objetivo: number | null      // umbral; null para operadores sube/baja
  objetivoMax?: number | null  // solo para operador "rango"

  // ── FOTO DE ENTRADA (inmutable) ──────────────────────
  valorEntrada: number         // valor de la métrica al publicar
  fechaEntrada: string         // ISO timestamp de publicación

  // ── HORIZONTE ────────────────────────────────────────
  horizonte: string           // label legible: "30 días", "al vencimiento"
  fechaResolucion: string     // ISO: cuándo se evalúa la condición

  // ── RESOLUCIÓN (se completa al vencer) ───────────────
  estado: EstadoPrediccion
  valorResolucion: number | null   // valor observado al resolver
  fechaResuelta: string | null     // ISO en que se resolvió
  fuente: string | null            // fuente/endpoint que dio el valor (auditable)
}

/** Solo los campos que el usuario ELIGE al crear una predicción. El resto
 *  (valorEntrada, fechaEntrada, estado, resolución) los fija el sistema. */
export type PrediccionInput = Pick<
  Prediccion,
  "activo" | "tipoActivo" | "tesis" | "metrica" | "operador" | "objetivo" | "objetivoMax" | "horizonte" | "fechaResolucion"
>

const UNIDAD: Record<MetricaPrediccion, string> = {
  precio: "", tir: "%", paridad: "%", spread: " bps", variacion_pct: "%",
}

/** Texto legible y auditable de la condición de resolución. */
export function describirCondicion(p: Pick<Prediccion, "activo" | "metrica" | "operador" | "objetivo" | "objetivoMax" | "valorEntrada" | "fechaResolucion">): string {
  const u = UNIDAD[p.metrica]
  const m = p.metrica === "variacion_pct" ? "variación" : p.metrica.toUpperCase()
  const al = ` al ${p.fechaResolucion.slice(0, 10)}`
  switch (p.operador) {
    case "mayor_igual": return `${p.activo}: ${m} ≥ ${p.objetivo}${u}${al}`
    case "menor_igual": return `${p.activo}: ${m} ≤ ${p.objetivo}${u}${al}`
    case "sube":        return `${p.activo}: ${m} sube vs ${p.valorEntrada}${u}${al}`
    case "baja":        return `${p.activo}: ${m} baja vs ${p.valorEntrada}${u}${al}`
    case "rango":       return `${p.activo}: ${m} entre ${p.objetivo}${u} y ${p.objetivoMax}${u}${al}`
  }
}

/** Valida que una predicción sea resoluble (no ambigua). Devuelve el motivo si NO lo es. */
export function validarPrediccion(input: PrediccionInput): string | null {
  if (!input.activo.trim()) return "Falta el activo"
  if (!input.tesis.trim()) return "Falta la tesis"
  if (!input.fechaResolucion) return "Falta la fecha de resolución (horizonte)"
  if (new Date(input.fechaResolucion).getTime() <= Date.now()) return "La fecha de resolución debe ser futura"
  const requiereObjetivo = input.operador === "mayor_igual" || input.operador === "menor_igual" || input.operador === "rango"
  if (requiereObjetivo && input.objetivo == null) return "Este operador requiere un valor objetivo"
  if (input.operador === "rango" && input.objetivoMax == null) return "El rango requiere un máximo"
  return null
}

/**
 * Resuelve una predicción contra el valor observado de la métrica al vencimiento.
 * Función PURA: mismos inputs → mismo resultado. No se autocalifica: recibe el
 * valor observado desde una fuente confiable y aplica la regla.
 */
export function resolverPrediccion(
  p: Prediccion,
  valorObservado: number,
  fuente: string,
  ahora: string = new Date().toISOString(),
): Prediccion {
  if (p.estado !== "abierta") return p
  if (new Date(ahora).getTime() < new Date(p.fechaResolucion).getTime()) return p // todavía no vence

  let acierta: boolean
  switch (p.operador) {
    case "mayor_igual": acierta = p.objetivo != null && valorObservado >= p.objetivo; break
    case "menor_igual": acierta = p.objetivo != null && valorObservado <= p.objetivo; break
    case "sube":        acierta = valorObservado > p.valorEntrada; break
    case "baja":        acierta = valorObservado < p.valorEntrada; break
    case "rango":       acierta = p.objetivo != null && p.objetivoMax != null && valorObservado >= p.objetivo && valorObservado <= p.objetivoMax; break
    default:            acierta = false
  }

  return {
    ...p,
    estado: acierta ? "acertada" : "errada",
    valorResolucion: valorObservado,
    fechaResuelta: ahora,
    fuente,
  }
}

/** Puntos que otorga una predicción resuelta (base para el ranking). El acierto
 *  suma más cuanto más largo el horizonte y más lejos del precio de entrada
 *  estaba el objetivo (más convicción, más riesgo). Errar resta poco: se premia
 *  participar y exponerse, pero acertar en serio pesa. */
export function puntosPorPrediccion(p: Prediccion): number {
  if (p.estado === "acertada") {
    const dias = Math.max(1, (new Date(p.fechaResolucion).getTime() - new Date(p.fechaEntrada).getTime()) / 86_400_000)
    const distancia = p.valorEntrada > 0 && p.objetivo != null ? Math.abs(p.objetivo - p.valorEntrada) / p.valorEntrada : 0
    return Math.round(10 + Math.min(20, dias / 3) + Math.min(20, distancia * 100))
  }
  if (p.estado === "errada") return -5
  return 0 // abierta / anulada
}
