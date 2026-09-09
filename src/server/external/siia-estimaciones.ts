/**
 * SIIA — Estimaciones Agrícolas (MAGyP)
 *
 * Serie oficial de superficie, producción y rendimiento por cultivo, campaña y
 * departamento, publicada como CSV único en el portal de datos abiertos del
 * Ministerio de Agricultura. Cubre desde la campaña 1969/1970.
 *
 * Este módulo es lógica pura: parsea, agrega y documenta discontinuidades.
 * No hace red — de eso se ocupa el endpoint.
 *
 * Columnas del CSV de origen:
 *   cultivo, anio, campania, provincia, provincia_id, departamento,
 *   departamento_id, superficie_sembrada_ha, superficie_cosechada_ha,
 *   produccion_tm, rendimiento_kgxha
 */

export type SiiaRow = {
  cultivo: string
  anio: number
  campania: string
  provincia: string
  provinciaId: string
  departamento: string
  departamentoId: string
  superficieSembradaHa: number | null
  superficieCosechadaHa: number | null
  produccionTm: number | null
  rendimientoKgHa: number | null
}

export type SiiaPuntoSerie = {
  campania: string
  anio: number
  superficieSembradaHa: number | null
  superficieCosechadaHa: number | null
  produccionTm: number | null
  /** Ponderado: producción total / superficie cosechada total. Nunca un promedio simple. */
  rendimientoKgHa: number | null
  /** Cuántas unidades territoriales aportaron datos a este punto. */
  unidadesReportadas: number
}

export type SiiaFiltro = {
  cultivo: string
  provincia?: string
  desdeAnio?: number
  hastaAnio?: number
}

/** Nivel de agregación pedido por el consumidor. */
export type SiiaNivel = "pais" | "provincia" | "departamento"

// ── Parseo ────────────────────────────────────────────────────────────────────

/**
 * Divide una línea CSV respetando campos entrecomillados. El dataset usa
 * comillas dobles en los campos de texto y deja los numéricos sin comillas.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') { inQuotes = true; continue }
    if (char === ",") { out.push(field); field = ""; continue }
    field += char
  }
  out.push(field)
  return out
}

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === "" || trimmed === "SD" || trimmed === "sd") return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/** Normaliza para comparar sin depender de mayúsculas ni acentos. */
export function normalizarClave(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function parseSiiaCsv(text: string): SiiaRow[] {
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []

  const header = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""))
  const index = (name: string) => header.indexOf(name)

  const iCultivo = index("cultivo")
  const iAnio = index("anio")
  const iCampania = index("campania")
  const iProvincia = index("provincia")
  const iProvinciaId = index("provincia_id")
  const iDepartamento = index("departamento")
  const iDepartamentoId = index("departamento_id")
  const iSembrada = index("superficie_sembrada_ha")
  const iCosechada = index("superficie_cosechada_ha")
  const iProduccion = index("produccion_tm")
  const iRendimiento = index("rendimiento_kgxha")

  if (iCultivo < 0 || iAnio < 0 || iCampania < 0) return []

  const rows: SiiaRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cells = splitCsvLine(line)
    const anio = toNumber(cells[iAnio])
    if (anio === null) continue

    rows.push({
      cultivo: (cells[iCultivo] ?? "").trim(),
      anio,
      campania: (cells[iCampania] ?? "").trim(),
      provincia: (cells[iProvincia] ?? "").trim(),
      provinciaId: (cells[iProvinciaId] ?? "").trim(),
      departamento: (cells[iDepartamento] ?? "").trim(),
      departamentoId: (cells[iDepartamentoId] ?? "").trim(),
      superficieSembradaHa: toNumber(cells[iSembrada]),
      superficieCosechadaHa: toNumber(cells[iCosechada]),
      produccionTm: toNumber(cells[iProduccion]),
      rendimientoKgHa: toNumber(cells[iRendimiento]),
    })
  }
  return rows
}

// ── Agregación ────────────────────────────────────────────────────────────────

function coincide(row: SiiaRow, filtro: SiiaFiltro): boolean {
  if (normalizarClave(row.cultivo) !== normalizarClave(filtro.cultivo)) return false
  if (filtro.provincia && normalizarClave(row.provincia) !== normalizarClave(filtro.provincia)) return false
  if (filtro.desdeAnio !== undefined && row.anio < filtro.desdeAnio) return false
  if (filtro.hastaAnio !== undefined && row.anio > filtro.hastaAnio) return false
  return true
}

function sumar(actual: number | null, aporte: number | null): number | null {
  if (aporte === null) return actual
  return (actual ?? 0) + aporte
}

/**
 * Agrega a serie por campaña.
 *
 * El rendimiento se recalcula como producción/superficie cosechada del total
 * agregado: promediar los rendimientos departamentales daría el mismo peso a un
 * departamento de 50 ha que a uno de 500.000 ha.
 */
export function agregarPorCampania(rows: readonly SiiaRow[], filtro: SiiaFiltro): SiiaPuntoSerie[] {
  const porCampania = new Map<string, SiiaPuntoSerie>()

  for (const row of rows) {
    if (!coincide(row, filtro)) continue

    const previo = porCampania.get(row.campania)
    if (previo) {
      previo.superficieSembradaHa = sumar(previo.superficieSembradaHa, row.superficieSembradaHa)
      previo.superficieCosechadaHa = sumar(previo.superficieCosechadaHa, row.superficieCosechadaHa)
      previo.produccionTm = sumar(previo.produccionTm, row.produccionTm)
      previo.unidadesReportadas += 1
    } else {
      porCampania.set(row.campania, {
        campania: row.campania,
        anio: row.anio,
        superficieSembradaHa: row.superficieSembradaHa,
        superficieCosechadaHa: row.superficieCosechadaHa,
        produccionTm: row.produccionTm,
        rendimientoKgHa: null,
        unidadesReportadas: 1,
      })
    }
  }

  return [...porCampania.values()]
    .map(cerrarRendimiento)
    .sort((a, b) => a.anio - b.anio || a.campania.localeCompare(b.campania))
}

/**
 * Cierra un punto agregado calculando su rendimiento ponderado.
 * Se aplica una sola vez, al final de la suma: el rendimiento de un agregado no
 * es el promedio de los rendimientos que lo componen.
 */
function cerrarRendimiento(punto: SiiaPuntoSerie): SiiaPuntoSerie {
  const { produccionTm, superficieCosechadaHa } = punto
  return {
    ...punto,
    rendimientoKgHa:
      produccionTm !== null && superficieCosechadaHa !== null && superficieCosechadaHa > 0
        ? Math.round((produccionTm * 1000) / superficieCosechadaHa)
        : null,
  }
}

export type SiiaIndice = {
  /** Clave `cultivo|provincia`; la provincia vacía es el agregado nacional. */
  series: Map<string, SiiaPuntoSerie[]>
  cultivos: { cultivo: string; desde: number; hasta: number; registros: number }[]
  provinciasPorCultivo: Map<string, string[]>
}

export function claveSerie(cultivo: string, provincia?: string): string {
  return `${normalizarClave(cultivo)}|${provincia ? normalizarClave(provincia) : ""}`
}

/**
 * Recorre el dataset una sola vez y deja un índice compacto de series ya
 * agregadas (nación y provincia). El consumidor puede descartar las filas
 * crudas: son ~160.000 y no hace falta retenerlas entre requests.
 */
export function construirIndice(rows: readonly SiiaRow[]): SiiaIndice {
  const acumulador = new Map<string, Map<string, SiiaPuntoSerie>>()
  const provincias = new Map<string, Set<string>>()

  const acumular = (clave: string, row: SiiaRow) => {
    let porCampania = acumulador.get(clave)
    if (!porCampania) { porCampania = new Map(); acumulador.set(clave, porCampania) }

    const previo = porCampania.get(row.campania)
    if (previo) {
      previo.superficieSembradaHa = sumar(previo.superficieSembradaHa, row.superficieSembradaHa)
      previo.superficieCosechadaHa = sumar(previo.superficieCosechadaHa, row.superficieCosechadaHa)
      previo.produccionTm = sumar(previo.produccionTm, row.produccionTm)
      previo.unidadesReportadas += 1
      return
    }
    porCampania.set(row.campania, {
      campania: row.campania,
      anio: row.anio,
      superficieSembradaHa: row.superficieSembradaHa,
      superficieCosechadaHa: row.superficieCosechadaHa,
      produccionTm: row.produccionTm,
      rendimientoKgHa: null,
      unidadesReportadas: 1,
    })
  }

  for (const row of rows) {
    acumular(claveSerie(row.cultivo), row)
    if (row.provincia) {
      acumular(claveSerie(row.cultivo, row.provincia), row)
      const clave = normalizarClave(row.cultivo)
      const set = provincias.get(clave) ?? new Set<string>()
      set.add(row.provincia)
      provincias.set(clave, set)
    }
  }

  const series = new Map<string, SiiaPuntoSerie[]>()
  for (const [clave, porCampania] of acumulador) {
    series.set(clave, [...porCampania.values()]
      .map(cerrarRendimiento)
      .sort((a, b) => a.anio - b.anio || a.campania.localeCompare(b.campania)))
  }

  return {
    series,
    cultivos: catalogoCultivos(rows),
    provinciasPorCultivo: new Map([...provincias].map(([k, v]) => [k, [...v].sort()])),
  }
}

/** Catálogo de cultivos presentes en el dataset, con su cobertura temporal real. */
export function catalogoCultivos(rows: readonly SiiaRow[]): { cultivo: string; desde: number; hasta: number; registros: number }[] {
  const acumulado = new Map<string, { desde: number; hasta: number; registros: number }>()
  for (const row of rows) {
    const previo = acumulado.get(row.cultivo)
    if (previo) {
      if (row.anio < previo.desde) previo.desde = row.anio
      if (row.anio > previo.hasta) previo.hasta = row.anio
      previo.registros += 1
    } else {
      acumulado.set(row.cultivo, { desde: row.anio, hasta: row.anio, registros: 1 })
    }
  }
  return [...acumulado.entries()]
    .map(([cultivo, datos]) => ({ cultivo, ...datos }))
    .sort((a, b) => b.registros - a.registros)
}

// ── Discontinuidades declaradas ───────────────────────────────────────────────

export type SiiaDiscontinuidad = {
  cultivos: readonly string[]
  tipo: "cambio-metodologico" | "serie-discontinuada" | "serie-nueva"
  anio: number
  nota: string
}

/**
 * Quiebres conocidos de la serie, verificados contra el dataset de marzo 2026.
 *
 * No son adorno: sin esta advertencia, empalmar una serie a través del quiebre
 * produce un salto que parece un cambio productivo y es un cambio de criterio
 * de reporte. Se rinden junto a la serie, no en una nota al pie.
 */
export const SIIA_DISCONTINUIDADES: readonly SiiaDiscontinuidad[] = [
  {
    cultivos: ["cebada forrajera", "cebada cervecera", "cebada total"],
    tipo: "cambio-metodologico",
    anio: 2016,
    nota: "Hasta la campaña 2015/2016 la cebada se reportó desglosada en forrajera y cervecera. Desde 2016/2017 solo se publica 'cebada total': el desglose dejó de estar disponible y las series no son empalmables sin advertirlo.",
  },
  {
    cultivos: ["soja total", "soja 1ra", "soja 2da"],
    tipo: "serie-nueva",
    anio: 2000,
    nota: "El desglose entre soja de primera y de segunda arranca en la campaña 2000/2001. Antes de esa fecha solo existe 'soja total'.",
  },
  {
    cultivos: ["naranja", "mandarina", "limón", "pomelo"],
    tipo: "serie-discontinuada",
    anio: 1996,
    nota: "Los cítricos dejaron de reportarse en esta serie después de 1996. Es uno de los huecos de cultivos regionales: el dato posterior hay que buscarlo en otras instituciones.",
  },
  {
    cultivos: ["papa total", "cebolla total", "ajo", "banana"],
    tipo: "serie-discontinuada",
    anio: 1997,
    nota: "Las hortalizas y la banana se discontinuaron después de 1997 en esta serie.",
  },
  {
    cultivos: ["caña de azúcar"],
    tipo: "serie-discontinuada",
    anio: 2004,
    nota: "La caña de azúcar deja de reportarse después de 2004.",
  },
  {
    cultivos: ["arveja", "garbanzo", "lenteja"],
    tipo: "serie-nueva",
    anio: 2018,
    nota: "Las legumbres se incorporan recién en la campaña 2018/2019: no hay historia previa para análisis de riesgo.",
  },
  {
    cultivos: ["poroto negro", "poroto alubia", "poroto otros"],
    tipo: "serie-nueva",
    anio: 2021,
    nota: "El desglose de poroto arranca en 2021. Antes existe únicamente 'poroto total'.",
  },
]

/** Discontinuidades que afectan a un cultivo puntual. */
export function discontinuidadesDe(cultivo: string): SiiaDiscontinuidad[] {
  const clave = normalizarClave(cultivo)
  return SIIA_DISCONTINUIDADES.filter((d) => d.cultivos.some((c) => normalizarClave(c) === clave))
}

/**
 * Cultivos que el SIIA no cubre y que hay que ir a buscar a otro lado.
 * Es la brecha de cultivos regionales, declarada explícitamente en vez de
 * dejar que el usuario deduzca la ausencia por no encontrarlos en la lista.
 */
export const SIIA_CULTIVOS_NO_CUBIERTOS: readonly { cultivo: string; donde: string }[] = [
  { cultivo: "vid", donde: "Instituto Nacional de Vitivinicultura (INV)" },
  { cultivo: "olivo", donde: "organismos provinciales y cámaras del sector" },
  { cultivo: "cítricos (desde 1997)", donde: "federaciones citrícolas provinciales" },
]
