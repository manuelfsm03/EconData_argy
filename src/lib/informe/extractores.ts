/**
 * Extractores del informe: convierten la respuesta JSON de cada endpoint propio
 * en algo que la página sabe dibujar (serie para un gráfico o tabla).
 *
 * Son funciones puras sobre el JSON de la respuesta. No inventan nada: si el
 * payload no trae lo que se necesita, devuelven { tipo: "vacio", motivo } y la
 * página lo muestra como "dato no disponible en este momento" (distinto de
 * "pendiente", que es un gráfico cuya rama todavía no entró a main).
 *
 * Lo que cruza del servidor al cliente son solo datos serializables: los
 * formatos se eligen por nombre (Formato), no con funciones.
 */

import type { ExtractorId } from "./secciones"

/** "billones" = el valor llega en millones y se muestra en billones (1 billon = 1.000.000 de millones, escala larga es-AR). */
export type Formato = "bps" | "pct1" | "pct2" | "num0" | "num2" | "billones" | "texto"

export interface SerieDef {
  key: string
  name: string
  color: string
  eje?: "left" | "right"
  dashed?: boolean
}

export interface ResultadoSerie {
  tipo: "linea" | "area"
  filas: Record<string, unknown>[]
  series: SerieDef[]
  formato: Formato
  /** Etiqueta del eje Y izquierdo. */
  etiquetaY?: string
  apilado?: boolean
  ultimaFecha: string | null
  /** "dato" = fecha del último punto; "consulta" = la fuente no informa fecha, es el momento del pedido. */
  fechaTipo: "dato" | "consulta"
  /** Texto de fuente que declara el propio endpoint (campo `source`), si lo hay. */
  fuenteEndpoint: string | null
}

export interface ColumnaTabla {
  key: string
  label: string
  formato: Formato
}

export interface ResultadoTabla {
  tipo: "tabla"
  columnas: ColumnaTabla[]
  filas: Record<string, string | number | null>[]
  compacta?: boolean
  ultimaFecha: string | null
  fechaTipo: "dato" | "consulta"
  fuenteEndpoint: string | null
}

export interface ResultadoVacio {
  tipo: "vacio"
  motivo: string
}

export type Resultado = ResultadoSerie | ResultadoTabla | ResultadoVacio

// ── helpers ────────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

function obj(x: unknown): Obj | null {
  return x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : null
}
function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : []
}
function num(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null
}
function str(x: unknown): string | null {
  return typeof x === "string" && x.length > 0 ? x : null
}
function fuenteDe(payload: Obj | null): string | null {
  return str(payload?.source) ?? null
}
const vacio = (motivo: string): ResultadoVacio => ({ tipo: "vacio", motivo })

/** Solo los últimos `dias` días respecto del último punto de la serie (ordenada por `date`). */
function ultimosDias<T extends { date: string }>(filas: T[], dias: number): T[] {
  const ultimo = filas.at(-1)
  if (!ultimo) return filas
  const corte = new Date(`${ultimo.date.slice(0, 10)}T00:00:00Z`)
  corte.setUTCDate(corte.getUTCDate() - dias)
  const corteIso = corte.toISOString().slice(0, 10)
  return filas.filter((f) => f.date.slice(0, 10) >= corteIso)
}

/** Une varias series [{fecha, valor}] en filas {date, <key>: valor} ordenadas por fecha. */
export function unirPorFecha(series: Record<string, unknown>): Array<Record<string, unknown> & { date: string }> {
  const porFecha = new Map<string, Record<string, unknown> & { date: string }>()
  for (const [key, puntos] of Object.entries(series)) {
    for (const p of arr(puntos)) {
      const punto = obj(p)
      const fecha = str(punto?.fecha)
      const valor = num(punto?.valor)
      if (!fecha || valor === null) continue
      const fila = porFecha.get(fecha) ?? { date: fecha }
      fila[key] = valor
      porFecha.set(fecha, fila)
    }
  }
  return [...porFecha.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function maxFecha(valores: unknown[]): string | null {
  const fechas = valores.map((v) => str(v)?.slice(0, 10)).filter((f): f is string => Boolean(f))
  return fechas.length ? fechas.sort().at(-1)! : null
}

// ── extractores por gráfico ────────────────────────────────────────────────────

function riesgoPais(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(obj(raiz?.data)?.historicoConSMA)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.date) !== null && num(f.valor) !== null)
    .map((f) => ({ date: f.date as string, valor: f.valor, sma90: num(f.sma90) }))
  if (filas.length === 0) return vacio("El endpoint no devolvió la serie histórica de riesgo país.")
  return {
    tipo: "linea",
    filas,
    series: [
      { key: "valor", name: "Riesgo país", color: "var(--amber)" },
      { key: "sma90", name: "Media móvil 90d", color: "var(--sky)", dashed: true },
    ],
    formato: "bps",
    etiquetaY: "pb",
    ultimaFecha: filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function globalesTir(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(obj(raiz?.data)?.globalesTir)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.ticker) !== null)
    .map((f) => ({ ticker: f.ticker as string, tir: num(f.tir), precio: num(f.precio), durationMod: num(f.durationMod) }))
  if (filas.length === 0 || filas.every((f) => f.tir === null)) {
    return vacio("Sin precios BYMA para calcular la TIR de los Globales en este momento.")
  }
  return {
    tipo: "tabla",
    columnas: [
      { key: "ticker", label: "Bono", formato: "texto" },
      { key: "tir", label: "TIR (%)", formato: "pct2" },
      { key: "precio", label: "Precio (USD)", formato: "num2" },
      { key: "durationMod", label: "Duration mod.", formato: "num2" },
    ],
    filas,
    ultimaFecha: str(raiz?.updated_at)?.slice(0, 10) ?? null,
    fechaTipo: "consulta",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function deudaPib(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(obj(raiz?.data)?.series_mensual)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.date) !== null && num(f.deuda_pib) !== null)
    .map((f) => ({ date: `${f.date as string}-01`.slice(0, 10), deuda_pib: f.deuda_pib }))
  if (filas.length === 0) return vacio("El stock de deuda no trae la serie mensual como % del PIB.")
  const ultimoMes = str(arr(obj(raiz?.data)?.series_mensual).map((f) => obj(f)?.date).at(-1))
  return {
    tipo: "linea",
    filas,
    series: [{ key: "deuda_pib", name: "Deuda bruta / PIB (%)", color: "var(--amber)" }],
    formato: "pct1",
    etiquetaY: "% del PIB",
    ultimaFecha: ultimoMes,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function depositos(p: unknown): Resultado {
  const raiz = obj(p)
  const d = obj(raiz?.data)
  const filas = ultimosDias(
    unirPorFecha({ dep_plazo: d?.dep_plazo, dep_cc: d?.dep_cc, cajas_ahorro: d?.cajas_ahorro }),
    365,
  )
  if (filas.length === 0) return vacio("El BCRA no devolvió las series de depósitos.")
  return {
    tipo: "area",
    filas,
    series: [
      { key: "dep_plazo", name: "A plazo", color: "var(--amber)" },
      { key: "dep_cc", name: "Cuenta corriente", color: "var(--sky)" },
      { key: "cajas_ahorro", name: "Cajas de ahorro", color: "var(--positive)" },
    ],
    formato: "billones",
    etiquetaY: "billones de ARS",
    apilado: true,
    ultimaFecha: filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function tasasDepositos(p: unknown): Resultado {
  const raiz = obj(p)
  const d = obj(raiz?.data)
  const filas = ultimosDias(unirPorFecha({ tamar: d?.tamar, badlar: d?.badlar, dep30: d?.dep30 }), 365)
  if (filas.length === 0) return vacio("El BCRA no devolvió las series de tasas.")
  return {
    tipo: "linea",
    filas,
    series: [
      { key: "tamar", name: "TAMAR", color: "var(--amber)" },
      { key: "badlar", name: "BADLAR", color: "var(--sky)" },
      { key: "dep30", name: "Plazo fijo 30d", color: "var(--positive)", dashed: true },
    ],
    formato: "pct1",
    etiquetaY: "TNA %",
    ultimaFecha: filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function lecapCurva(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(raiz?.data)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.ticker) !== null)
    .map((f) => ({
      ticker: f.ticker as string,
      tipo: str(f.tipo),
      vencimiento: str(f.vencimiento)?.slice(0, 10) ?? null,
      dias: num(f.diasVencimiento),
      precio: num(f.precio),
      tem: num(f.tem),
      tea: num(f.tea),
      asOf: str(f.asOf),
    }))
    .sort((a, b) => (a.vencimiento ?? "").localeCompare(b.vencimiento ?? ""))
  if (filas.length === 0) return vacio("El screener de LECAP/BONCAP no devolvió instrumentos.")
  return {
    tipo: "tabla",
    columnas: [
      { key: "ticker", label: "Ticker", formato: "texto" },
      { key: "tipo", label: "Tipo", formato: "texto" },
      { key: "vencimiento", label: "Vencimiento", formato: "texto" },
      { key: "dias", label: "Días", formato: "num0" },
      { key: "precio", label: "Precio", formato: "num2" },
      { key: "tem", label: "TEM (%)", formato: "pct2" },
      { key: "tea", label: "TEA (%)", formato: "pct1" },
    ],
    filas,
    ultimaFecha: maxFecha(filas.map((f) => f.asOf)),
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function cerDuales(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(raiz?.data)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.ticker) !== null)
    .map((f) => ({
      ticker: f.ticker as string,
      vencimiento: str(f.vencimiento)?.slice(0, 10) ?? null,
      precio: num(f.precio),
      tir: num(f.tir),
      dm: num(f.dm),
      paridad: num(f.paridad),
      asOf: str(f.asOf),
    }))
    .sort((a, b) => (a.vencimiento ?? "").localeCompare(b.vencimiento ?? ""))
  if (filas.length === 0) return vacio("El screener de bonos en pesos no devolvió instrumentos.")
  return {
    tipo: "tabla",
    columnas: [
      { key: "ticker", label: "Ticker", formato: "texto" },
      { key: "vencimiento", label: "Vencimiento", formato: "texto" },
      { key: "precio", label: "Precio", formato: "num2" },
      { key: "tir", label: "TIR (%)", formato: "pct2" },
      { key: "dm", label: "Dur. mod.", formato: "num2" },
      { key: "paridad", label: "Paridad", formato: "num2" },
    ],
    filas,
    compacta: true,
    ultimaFecha: maxFecha(filas.map((f) => f.asOf)),
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function licitaciones(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(raiz?.data)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null)
    .map((f) => ({
      fecha: str(f.fecha) ?? str(f.fechaLabel),
      moneda: str(f.moneda),
      ofertado: num(f.ofertado),
      adjudicado: num(f.adjudicado),
      unidad: str(f.unidad),
      cobertura: num(f.coberturaPct),
    }))
  if (filas.length === 0) return vacio("No hay resultados de licitación disponibles.")
  return {
    tipo: "tabla",
    columnas: [
      { key: "fecha", label: "Fecha", formato: "texto" },
      { key: "unidad", label: "Unidad", formato: "texto" },
      { key: "ofertado", label: "Ofertado", formato: "num2" },
      { key: "adjudicado", label: "Adjudicado", formato: "num2" },
      { key: "cobertura", label: "Cobertura (%)", formato: "num0" },
    ],
    filas,
    ultimaFecha: maxFecha(filas.map((f) => f.fecha)),
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function tcHistorico(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(raiz?.data)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.date) !== null)
    .map((f) => ({
      date: f.date as string,
      oficial: num(f.oficial),
      mep: num(f.mep),
      ccl: num(f.ccl),
      blue: num(f.blue),
    }))
  if (filas.length === 0) return vacio("El histórico de tipos de cambio no está disponible.")
  return {
    tipo: "linea",
    filas,
    series: [
      { key: "oficial", name: "Oficial", color: "var(--text-dim)" },
      { key: "mep", name: "MEP", color: "var(--amber)" },
      { key: "ccl", name: "CCL", color: "var(--sky)" },
      { key: "blue", name: "Blue", color: "var(--negative)", dashed: true },
    ],
    formato: "num0",
    etiquetaY: "ARS/USD",
    ultimaFecha: str(raiz?.asOf)?.slice(0, 10) ?? filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function bandas(p: unknown): Resultado {
  const raiz = obj(p)
  const filas = arr(raiz?.data)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.date) !== null && f.proyectado !== true)
    .map((f) => ({ date: f.date as string, piso: num(f.piso), techo: num(f.techo) }))
  if (filas.length === 0) return vacio("El endpoint de bandas no devolvió puntos observados.")
  return {
    tipo: "linea",
    filas,
    series: [
      { key: "techo", name: "Techo", color: "var(--negative)" },
      { key: "piso", name: "Piso", color: "var(--positive)" },
    ],
    formato: "num0",
    etiquetaY: "ARS/USD",
    ultimaFecha: filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function reservas(p: unknown): Resultado {
  const raiz = obj(p)
  const d = obj(raiz?.data)
  const brutas = arr(d?.brutas)
  const netas = arr(d?.netas)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null)
    .map((f) => ({ fecha: f.fecha, valor: f.netas }))
  const filas = ultimosDias(unirPorFecha({ brutas, netas }), 365)
  if (filas.length === 0) return vacio("El BCRA no devolvió la serie de reservas.")
  return {
    tipo: "linea",
    filas,
    series: [
      { key: "brutas", name: "Brutas", color: "var(--amber)" },
      { key: "netas", name: "Netas (metodología F. Machado)", color: "var(--sky)", dashed: true },
    ],
    formato: "num0",
    etiquetaY: "USD millones",
    ultimaFecha: str(obj(d?.ultima)?.fecha) ?? filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

function comprasBcra(p: unknown): Resultado {
  const raiz = obj(p)
  const d = obj(raiz?.data)
  const filas = arr(d?.datos)
    .map((f) => obj(f))
    .filter((f): f is Obj => f !== null && str(f.fecha) !== null && num(f.monto) !== null)
    .map((f) => ({ date: f.fecha as string, monto: f.monto }))
  if (filas.length === 0) return vacio("La serie oficial de compras de divisas (BCRA var. 78) no está disponible.")
  return {
    tipo: "area",
    filas,
    series: [{ key: "monto", name: "Compras de divisas", color: "var(--amber)" }],
    formato: "num0",
    etiquetaY: "USD millones",
    ultimaFecha: str(obj(d?.resumen)?.fecha_corte) ?? filas.at(-1)!.date,
    fechaTipo: "dato",
    fuenteEndpoint: fuenteDe(raiz),
  }
}

export const EXTRACTORES: Record<ExtractorId, (payload: unknown) => Resultado> = {
  riesgo_pais: riesgoPais,
  globales_tir: globalesTir,
  deuda_pib: deudaPib,
  depositos,
  tasas_depositos: tasasDepositos,
  lecap_curva: lecapCurva,
  cer_duales: cerDuales,
  licitaciones,
  tc_historico: tcHistorico,
  bandas,
  reservas,
  compras_bcra: comprasBcra,
}

// ── formato de valores (compartido por tablas y gráficos) ──────────────────────

export function formatearValor(valor: unknown, formato: Formato): string {
  if (valor === null || valor === undefined || valor === "") return "—"
  if (formato === "texto") return String(valor)
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—"
  const opts = (min: number, max: number) => ({ minimumFractionDigits: min, maximumFractionDigits: max })
  switch (formato) {
    case "bps": return `${valor.toLocaleString("es-AR", opts(0, 0))} pb`
    case "pct1": return `${valor.toLocaleString("es-AR", opts(1, 1))}%`
    case "pct2": return `${valor.toLocaleString("es-AR", opts(2, 2))}%`
    case "num0": return valor.toLocaleString("es-AR", opts(0, 0))
    case "num2": return valor.toLocaleString("es-AR", opts(2, 2))
    case "billones": return `${(valor / 1_000_000).toLocaleString("es-AR", opts(0, 1))} bill.`
  }
}
