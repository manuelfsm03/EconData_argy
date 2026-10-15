/**
 * DJVE — Declaraciones Juradas de Venta al Exterior (parser puro).
 *
 * ESTADO: NO VERIFICADO EN VIVO. Escrito sin acceso a datos.magyp.gob.ar (la
 * máquina de desarrollo no puede consultar hosts externos). Los nombres de
 * columnas reales del CSV se desconocen: el parser mapea encabezados por
 * sinónimos y falla con error explícito (en vez de inventar) si no encuentra
 * cultivo + toneladas + fecha.
 *
 * Qué es: antes de exportar granos/aceites/harinas, el exportador registra
 * una DJVE ante el Ministerio de Agricultura. Las toneladas registradas por
 * cultivo y fecha anticipan embarques y, por lo tanto, la liquidación de
 * divisas de las semanas/meses siguientes (oferta de dólares).
 *
 * Patrón CKAN: igual que origin/fix/agro-siia-ckan, el CSV vigente se
 * resuelve buscándolo en el catálogo (package_show) en vez de fijar una URL
 * de descarga, que queda vieja cuando se publica un recurso nuevo.
 *
 * Este módulo NO hace red. Lo consume scripts/update-djve.ts.
 */

export type DjveFila = { fecha: string; cultivo: string; toneladas: number }

export type DjveMensual = {
  periodo: string // YYYY-MM
  cultivo: string
  toneladas: number
  declaraciones: number
}

type RecursoCkan = { name?: string; format?: string; url?: string; last_modified?: string }

/**
 * Elige el recurso CSV vigente de la respuesta de package_show.
 * Si hay filtro de nombre lo aplica; entre varios candidatos toma el de
 * last_modified más reciente (o el último listado).
 */
export function elegirRecursoCkan(
  respuestaPackageShow: unknown,
  opciones: { nombre?: RegExp } = {},
): string | null {
  const resources = (respuestaPackageShow as { result?: { resources?: RecursoCkan[] } } | null)
    ?.result?.resources
  if (!Array.isArray(resources)) return null
  const csvs = resources.filter(
    (r) => r?.url && (r.format ?? "").toUpperCase() === "CSV"
      && (!opciones.nombre || opciones.nombre.test(r.name ?? "")),
  )
  if (csvs.length === 0) return null
  const ordenados = [...csvs].sort((a, b) =>
    (a.last_modified ?? "").localeCompare(b.last_modified ?? ""))
  return ordenados[ordenados.length - 1].url ?? null
}

/** Decodifica bytes: UTF-8; si aparecen caracteres de reemplazo, Latin-1 (los CSV del MAGyP a veces vienen así). */
export function decodificarCsv(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes)
  return utf8.includes("�") ? new TextDecoder("latin1").decode(bytes) : utf8
}

export function normalizarEncabezado(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^﻿/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

/** Parte una línea CSV respetando comillas. */
export function splitLinea(linea: string, sep: string): string[] {
  const out: string[] = []
  let actual = ""
  let enComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') { actual += '"'; i++ } else enComillas = !enComillas
    } else if (c === sep && !enComillas) { out.push(actual); actual = "" }
    else actual += c
  }
  out.push(actual)
  return out.map((x) => x.trim())
}

const SINONIMOS = {
  fecha: ["fecha_registro", "fecha_de_registro", "fecha_declaracion", "fecha_djve", "fecha", "fecha_inscripcion"],
  cultivo: ["producto", "cultivo", "grano", "mercaderia", "producto_descripcion", "descripcion_producto", "descripcion"],
  toneladas: ["toneladas", "toneladas_declaradas", "tn", "tm", "volumen_tn", "volumen", "cantidad_tn", "cantidad"],
} as const

function buscarColumna(encabezados: string[], sinonimos: readonly string[]): number {
  for (const s of sinonimos) {
    const i = encabezados.indexOf(s)
    if (i >= 0) return i
  }
  return -1
}

/** Fecha ISO (YYYY-MM-DD, con o sin hora) o dd/mm/yyyy -> YYYY-MM-DD; null si no. */
export function normalizarFecha(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return null
}

function numero(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "")
  if (!s) return null
  let n: string
  if (s.includes(".") && s.includes(",")) {
    n = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (s.includes(",")) n = s.replace(",", ".")
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = s.replace(/\./g, "")
  else n = s
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

/**
 * Parsea el CSV de DJVE. Lanza Error("DJVE_COLUMNAS:...") si no reconoce las
 * columnas mínimas: mejor fallar fuerte (y conservar el último dato bueno)
 * que publicar basura. Filas inválidas o con toneladas <= 0 se descartan.
 */
export function parseDjveCsv(texto: string): DjveFila[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "")
  if (lineas.length < 2) throw new Error("DJVE_VACIO")
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ","
  const enc = splitLinea(lineas[0], sep).map(normalizarEncabezado)
  const iFecha = buscarColumna(enc, SINONIMOS.fecha)
  const iCultivo = buscarColumna(enc, SINONIMOS.cultivo)
  const iTn = buscarColumna(enc, SINONIMOS.toneladas)
  if (iFecha < 0 || iCultivo < 0 || iTn < 0) {
    throw new Error(`DJVE_COLUMNAS: no reconozco fecha/cultivo/toneladas en [${enc.join(", ")}]`)
  }
  const filas: DjveFila[] = []
  for (const linea of lineas.slice(1)) {
    const c = splitLinea(linea, sep)
    const fecha = normalizarFecha(c[iFecha] ?? "")
    const tn = numero(c[iTn] ?? "")
    const cultivo = (c[iCultivo] ?? "").trim().toLowerCase()
    if (!fecha || tn == null || tn <= 0 || !cultivo) continue
    filas.push({ fecha, cultivo, toneladas: tn })
  }
  return filas
}

/** Agrega por (mes, cultivo). `desde` = "YYYY-MM" opcional para acotar el tamaño del JSON. */
export function agregarDjvePorMes(filas: DjveFila[], desde?: string): DjveMensual[] {
  const acc = new Map<string, DjveMensual>()
  for (const f of filas) {
    const periodo = f.fecha.slice(0, 7)
    if (desde && periodo < desde) continue
    const k = `${periodo}|${f.cultivo}`
    const prev = acc.get(k) ?? { periodo, cultivo: f.cultivo, toneladas: 0, declaraciones: 0 }
    prev.toneladas += f.toneladas
    prev.declaraciones += 1
    acc.set(k, prev)
  }
  return [...acc.values()]
    .map((r) => ({ ...r, toneladas: Math.round(r.toneladas) }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.cultivo.localeCompare(b.cultivo))
}
