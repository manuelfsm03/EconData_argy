/**
 * Arma el informe semanal en el servidor: lee el texto editorial del equipo
 * (content/informes/*.md), pide a nuestros propios endpoints los datos de cada
 * gráfico y le adjunta fuente + frescura. Solo se ejecuta en el servidor.
 *
 * Los datos se piden por HTTP a la propia app (los mismos /api/* que usa el
 * dashboard), así el informe y el dashboard nunca divergen. Un endpoint que no
 * responde degrada ese gráfico a "no disponible en este momento"; no rompe la
 * página ni se rellena con nada.
 */

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { SOURCE_REGISTRY } from "@/server/sources/registry"
import { EXTRACTORES, type Resultado } from "./extractores"
import { calcularFrescura, type Frescura } from "./frescura"
import { parseInforme, parseNombreArchivo, type InformeTexto } from "./markdown"
import { SECCIONES, type GraficoDef, type SeccionDef } from "./secciones"

const DIR_INFORMES = path.join(process.cwd(), "content", "informes")
const TIMEOUT_MS = 30_000

export interface FuenteInfo {
  id: string
  nombre: string
  publisher: string
}

export interface GraficoRender {
  def: GraficoDef
  fuente: FuenteInfo | null
  resultado: Resultado | null
  frescura: Frescura | null
}

export interface SeccionRender {
  def: SeccionDef
  /** Texto escrito por el equipo; null = se muestra el gráfico solo. */
  texto: string | null
  graficos: GraficoRender[]
}

export interface InformeRender {
  anio: number
  semana: number
  fechaCorte: string
  titulo: string | null
  /** Archivo markdown usado, o null si todavía no hay texto editorial. */
  archivo: string | null
  desconocidas: string[]
  secciones: SeccionRender[]
}

/** Semana ISO 8601 de una fecha AAAA-MM-DD. */
export function semanaISO(fechaIso: string): { anio: number; semana: number } {
  const d = new Date(`${fechaIso}T00:00:00Z`)
  const dia = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dia)
  const inicioAnio = Date.UTC(d.getUTCFullYear(), 0, 1)
  return { anio: d.getUTCFullYear(), semana: Math.ceil(((d.getTime() - inicioAnio) / 86_400_000 + 1) / 7) }
}

function hoyArgentina(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })
}

/** Archivos de informe del equipo (sin PLANTILLA), del más nuevo al más viejo. */
export function listarInformes(): string[] {
  try {
    return readdirSync(DIR_INFORMES)
      .filter((n) => parseNombreArchivo(n) !== null)
      .sort((a, b) => {
        const pa = parseNombreArchivo(a)!
        const pb = parseNombreArchivo(b)!
        return pb.anio - pa.anio || pb.semana - pa.semana
      })
  } catch {
    return []
  }
}

/** `clave` = "2026-S42". Solo acepta ese formato: nunca se arma una ruta con texto libre. */
function resolverArchivo(clave: string | undefined): string | null {
  const disponibles = listarInformes()
  if (clave) {
    const nombre = `${clave}.md`
    return parseNombreArchivo(nombre) && disponibles.includes(nombre) ? nombre : null
  }
  return disponibles[0] ?? null
}

async function pedirEndpoint(origen: string, endpoint: string): Promise<{ json: unknown; error: string | null }> {
  try {
    const res = await fetch(`${origen}${endpoint}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const detalle = (json as { error?: unknown } | null)?.error
      const texto = typeof detalle === "string" ? detalle : (detalle as { message?: string } | undefined)?.message
      return { json: null, error: `El endpoint respondió ${res.status}${texto ? `: ${texto}` : ""}.` }
    }
    return { json, error: null }
  } catch (e) {
    return { json: null, error: e instanceof Error && e.name === "TimeoutError" ? "El endpoint no respondió a tiempo." : "No se pudo consultar el endpoint." }
  }
}

function infoFuente(fuenteId: string | undefined): FuenteInfo | null {
  if (!fuenteId) return null
  const def = (SOURCE_REGISTRY as Record<string, { displayName: string; publisher: string } | undefined>)[fuenteId]
  return def ? { id: fuenteId, nombre: def.displayName, publisher: def.publisher } : null
}

export async function cargarInforme(origen: string, clave?: string): Promise<InformeRender> {
  const archivo = resolverArchivo(clave)
  let texto: InformeTexto | null = null
  if (archivo) {
    try {
      texto = parseInforme(readFileSync(path.join(DIR_INFORMES, archivo), "utf8"))
    } catch {
      texto = null
    }
  }

  const fechaCorte = texto?.meta.fechaCorte ?? hoyArgentina()
  const deArchivo = archivo ? parseNombreArchivo(archivo) : null
  const iso = semanaISO(fechaCorte)
  const anio = texto?.meta.anio ?? deArchivo?.anio ?? iso.anio
  const semana = texto?.meta.semana ?? deArchivo?.semana ?? iso.semana

  // Un solo pedido por endpoint distinto (varios gráficos comparten, ej. /api/riesgo-pais).
  const endpoints = [...new Set(SECCIONES.flatMap((s) => s.graficos.flatMap((g) => (g.estado === "disponible" && g.endpoint ? [g.endpoint] : []))))]
  const respuestas = new Map(await Promise.all(endpoints.map(async (e) => [e, await pedirEndpoint(origen, e)] as const)))

  const secciones: SeccionRender[] = SECCIONES.map((def) => ({
    def,
    texto: texto?.secciones[def.id] ?? null,
    graficos: def.graficos.map((g): GraficoRender => {
      const fuente = infoFuente(g.fuenteId)
      if (g.estado === "pendiente" || !g.endpoint || !g.extractor) {
        return { def: g, fuente, resultado: null, frescura: null }
      }
      const r = respuestas.get(g.endpoint)
      if (!r || r.error) {
        return { def: g, fuente, resultado: { tipo: "vacio", motivo: r?.error ?? "Sin respuesta del endpoint." }, frescura: null }
      }
      const resultado = EXTRACTORES[g.extractor](r.json)
      const frescura =
        resultado.tipo !== "vacio" && resultado.fechaTipo === "dato"
          ? calcularFrescura(resultado.ultimaFecha, g.fuenteId, fechaCorte)
          : null
      return { def: g, fuente, resultado, frescura }
    }),
  }))

  return { anio, semana, fechaCorte, titulo: texto?.meta.titulo ?? null, archivo, desconocidas: texto?.desconocidas ?? [], secciones }
}
