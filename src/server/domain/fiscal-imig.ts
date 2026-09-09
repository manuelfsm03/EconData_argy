/**
 * IMIG — Informe Mensual de Ingresos y Gastos del Sector Público Nacional
 * No Financiero (Secretaría de Hacienda, dataset 452, distribución 452.3).
 *
 * Base caja, millones de pesos corrientes, mensual desde 2016-01.
 *
 * El CSV trae 53 columnas: 16 de ingresos, 31 de gasto primario y 5 de
 * resultados. Eso alcanza para armar el flujo fiscal completo sin estimar
 * nada: `sum(ingresos) - sum(gastos) === resultado_primario` publicado, y
 * `resultado_primario - intereses_netos === resultado_financiero`, ambas
 * exactas en toda la serie. `parseImig` verifica ese cierre por período y lo
 * reporta en `desvioCierre`; si algún día la fuente deja de cuadrar, el dato
 * queda marcado en vez de dibujarse como si nada.
 *
 * Clasificación: ECONÓMICA (en qué se gasta por tipo de erogación). El IMIG
 * NO trae clasificación funcional ni por jurisdicción — eso vive en el
 * dataset 451 (anual, con rezago) y en Presupuesto Abierto (requiere token).
 */

export type BloqueGasto =
  | "prestaciones"
  | "subsidios"
  | "funcionamiento"
  | "provincias"
  | "otros_corrientes"
  | "capital"

export const ETIQUETAS_BLOQUE: Record<BloqueGasto, string> = {
  prestaciones: "Prestaciones sociales",
  subsidios: "Subsidios económicos",
  funcionamiento: "Funcionamiento del Estado",
  provincias: "Transferencias a provincias",
  otros_corrientes: "Otros gastos corrientes",
  capital: "Gastos de capital",
}

type Linea = { clave: string; etiqueta: string }
type LineaGasto = Linea & { bloque: BloqueGasto }

/** Las 16 columnas de ingreso del IMIG, en el orden del CSV. */
export const INGRESOS: Linea[] = [
  { clave: "iva_neto_reintegros", etiqueta: "IVA (neto de reintegros)" },
  { clave: "ganancias", etiqueta: "Ganancias" },
  { clave: "aportes_contribuciones_seguridad_social", etiqueta: "Aportes y contribuciones a la seguridad social" },
  { clave: "debitos_creditos", etiqueta: "Débitos y créditos bancarios" },
  { clave: "bienes_personales", etiqueta: "Bienes personales" },
  { clave: "impuestos_internos", etiqueta: "Impuestos internos" },
  { clave: "combustibles", etiqueta: "Combustibles" },
  { clave: "derechos_exportacion", etiqueta: "Derechos de exportación" },
  { clave: "derechos_importacion", etiqueta: "Derechos de importación" },
  { clave: "resto_tributarios", etiqueta: "Resto tributarios" },
  { clave: "fgs_cobradas_sector_privado_sector_publico_financiero", etiqueta: "Rentas del FGS" },
  { clave: "resto_rentas_propiedad", etiqueta: "Resto rentas de la propiedad" },
  { clave: "ingresos_no_tributarios", etiqueta: "Ingresos no tributarios" },
  { clave: "transferencias_corrientes", etiqueta: "Transferencias corrientes" },
  { clave: "resto_ingresos_corrientes", etiqueta: "Resto ingresos corrientes" },
  { clave: "ingresos_capital", etiqueta: "Ingresos de capital" },
]

/**
 * Las 31 columnas de gasto primario, agrupadas en 6 bloques.
 * Ojo: el CSV escribe "tranferencias" (sin la segunda s) en las columnas de
 * capital. Las claves respetan el nombre real de la fuente.
 */
export const GASTOS: LineaGasto[] = [
  { clave: "jubilaciones_pensiones_contributivas", etiqueta: "Jubilaciones y pensiones contributivas", bloque: "prestaciones" },
  { clave: "asignacion_familiares_hijo", etiqueta: "Asignaciones familiares y AUH", bloque: "prestaciones" },
  { clave: "pensiones_no_contributivas", etiqueta: "Pensiones no contributivas", bloque: "prestaciones" },
  { clave: "prestaciones_inssjp", etiqueta: "Prestaciones INSSJP (PAMI)", bloque: "prestaciones" },
  { clave: "otros_programas", etiqueta: "Otros programas sociales", bloque: "prestaciones" },

  { clave: "energia", etiqueta: "Energía", bloque: "subsidios" },
  { clave: "transporte", etiqueta: "Transporte", bloque: "subsidios" },
  { clave: "otras_funciones", etiqueta: "Otras funciones", bloque: "subsidios" },

  { clave: "salarios", etiqueta: "Salarios", bloque: "funcionamiento" },
  { clave: "otros_gastos_funcionamiento", etiqueta: "Otros gastos de funcionamiento", bloque: "funcionamiento" },

  { clave: "transferencias_corrientes_provincias_educacion", etiqueta: "Educación", bloque: "provincias" },
  { clave: "transferencias_corrientes_provincias_seguridad_social", etiqueta: "Seguridad social", bloque: "provincias" },
  { clave: "transferencias_corrientes_provincias_desarrollo_social", etiqueta: "Desarrollo social", bloque: "provincias" },
  { clave: "transferencias_corrientes_provincias_salud", etiqueta: "Salud", bloque: "provincias" },
  { clave: "transferencias_corrientes_provincias_otras", etiqueta: "Otras transferencias", bloque: "provincias" },

  { clave: "otros_corrientes_transferencias_universidades", etiqueta: "Universidades", bloque: "otros_corrientes" },
  { clave: "otros_corrientes_deficit_operativo_empresas_publicas", etiqueta: "Déficit operativo de empresas públicas", bloque: "otros_corrientes" },
  { clave: "otros_corrientes_resto", etiqueta: "Resto", bloque: "otros_corrientes" },

  { clave: "capital_energia_nacion", etiqueta: "Energía (Nación)", bloque: "capital" },
  { clave: "capital_energia_tranferencias_provincias", etiqueta: "Energía (provincias)", bloque: "capital" },
  { clave: "capital_transporte_nacion", etiqueta: "Transporte (Nación)", bloque: "capital" },
  { clave: "capital_transporte_tranferencias_provincias", etiqueta: "Transporte (provincias)", bloque: "capital" },
  { clave: "capital_educacion_nacion", etiqueta: "Educación (Nación)", bloque: "capital" },
  { clave: "capital_educacion_tranferencias_provincias", etiqueta: "Educación (provincias)", bloque: "capital" },
  { clave: "capital_vivienda_nacion", etiqueta: "Vivienda (Nación)", bloque: "capital" },
  { clave: "capital_vivienda_tranferencias_provincias", etiqueta: "Vivienda (provincias)", bloque: "capital" },
  { clave: "capital_agua_potable_alcatarillado_nacion", etiqueta: "Agua y saneamiento (Nación)", bloque: "capital" },
  { clave: "capital_agua_potable_alcatarillado_tranferencias_provincias", etiqueta: "Agua y saneamiento (provincias)", bloque: "capital" },
  { clave: "capital_otros_nacion", etiqueta: "Otros (Nación)", bloque: "capital" },
  { clave: "capital_otros_tranferencias_provincias", etiqueta: "Otros (provincias)", bloque: "capital" },
  { clave: "fondo_federal_solidario", etiqueta: "Fondo Federal Solidario", bloque: "capital" },
]

export type Monto = { clave: string; etiqueta: string; monto: number }
export type MontoGasto = Monto & { bloque: BloqueGasto }

export type ImigPeriodo = {
  /** "2026-07" para un mes, "2026" para un año o acumulado YTD. */
  periodo: string
  meses: number
  ingresos: Monto[]
  gastos: MontoGasto[]
  totalIngresos: number
  totalGastoPrimario: number
  resultadoPrimario: number
  interesesNetos: number
  resultadoFinanciero: number
  /**
   * `sum(ingresos) - sum(gastos) - resultadoPrimario`. Debe ser 0.
   * Se expone en vez de ocultarse: si la fuente deja de cuadrar, la UI lo avisa.
   */
  desvioCierre: number
}

function num(valor: string | undefined): number {
  if (valor == null || valor === "") return 0
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

/** Redondea a 2 decimales para no arrastrar ruido de punto flotante. */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Convierte las filas del CSV del IMIG en períodos mensuales ordenados.
 * Descarta filas sin fecha válida o sin ningún dato numérico.
 */
export function parseImig(rows: Record<string, string>[]): ImigPeriodo[] {
  const periodos: ImigPeriodo[] = []

  for (const row of rows) {
    const fecha = (row.indice_tiempo ?? "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue

    const ingresos = INGRESOS.map(l => ({ ...l, monto: num(row[l.clave]) }))
    const gastos = GASTOS.map(l => ({ ...l, monto: num(row[l.clave]) }))

    const totalIngresos = ingresos.reduce((a, l) => a + l.monto, 0)
    const totalGastoPrimario = gastos.reduce((a, l) => a + l.monto, 0)
    // Un mes sin publicar viene con todas las columnas vacías.
    if (totalIngresos === 0 && totalGastoPrimario === 0) continue

    const resultadoPrimario = num(row.resultado_primario)
    const interesesNetos = num(row.intereses_netos)
    const resultadoFinanciero = num(row.resultado_financiero)

    periodos.push({
      periodo: fecha.slice(0, 7),
      meses: 1,
      ingresos,
      gastos,
      totalIngresos: r2(totalIngresos),
      totalGastoPrimario: r2(totalGastoPrimario),
      resultadoPrimario: r2(resultadoPrimario),
      interesesNetos: r2(interesesNetos),
      resultadoFinanciero: r2(resultadoFinanciero),
      desvioCierre: r2(totalIngresos - totalGastoPrimario - resultadoPrimario),
    })
  }

  return periodos.sort((a, b) => a.periodo.localeCompare(b.periodo))
}

/**
 * Suma varios períodos en uno (para acumulado anual o YTD). Los flujos del
 * IMIG son mensuales, así que sumarlos es legítimo — no son stocks ni índices.
 */
export function agregarPeriodos(periodos: ImigPeriodo[], etiqueta: string): ImigPeriodo | null {
  if (periodos.length === 0) return null

  const sumar = (get: (p: ImigPeriodo) => Monto[]) =>
    get(periodos[0]).map((linea, i) => ({
      ...linea,
      monto: r2(periodos.reduce((a, p) => a + get(p)[i].monto, 0)),
    }))

  const ingresos = sumar(p => p.ingresos)
  const gastos = sumar(p => p.gastos) as MontoGasto[]
  const totalIngresos = ingresos.reduce((a, l) => a + l.monto, 0)
  const totalGastoPrimario = gastos.reduce((a, l) => a + l.monto, 0)
  const resultadoPrimario = periodos.reduce((a, p) => a + p.resultadoPrimario, 0)

  return {
    periodo: etiqueta,
    meses: periodos.length,
    ingresos,
    gastos,
    totalIngresos: r2(totalIngresos),
    totalGastoPrimario: r2(totalGastoPrimario),
    resultadoPrimario: r2(resultadoPrimario),
    interesesNetos: r2(periodos.reduce((a, p) => a + p.interesesNetos, 0)),
    resultadoFinanciero: r2(periodos.reduce((a, p) => a + p.resultadoFinanciero, 0)),
    desvioCierre: r2(totalIngresos - totalGastoPrimario - resultadoPrimario),
  }
}

export type SankeyLink = { source: string; target: string; value: number }

/**
 * Arma los enlaces del Sankey a partir de un período.
 *
 * Estructura: cada impuesto → "Ingresos totales" → cada bloque de gasto →
 * y en paralelo "Ingresos totales" → Intereses / Resultado financiero.
 *
 * Sólo se emiten enlaces con monto > 0: un gasto negativo (hay
 * recuperos puntuales en la fuente) no se puede dibujar como flujo y se
 * omite en vez de invertirse o forzarse a cero.
 */
export function construirSankey(periodo: ImigPeriodo): SankeyLink[] {
  const CENTRO = "Ingresos totales"
  const links: SankeyLink[] = []

  for (const ing of periodo.ingresos) {
    if (ing.monto > 0) links.push({ source: ing.etiqueta, target: CENTRO, value: ing.monto })
  }

  const porBloque = new Map<BloqueGasto, number>()
  for (const g of periodo.gastos) {
    if (g.monto <= 0) continue
    porBloque.set(g.bloque, (porBloque.get(g.bloque) ?? 0) + g.monto)
    links.push({ source: ETIQUETAS_BLOQUE[g.bloque], target: g.etiqueta, value: g.monto })
  }
  for (const [bloque, monto] of porBloque) {
    links.push({ source: CENTRO, target: ETIQUETAS_BLOQUE[bloque], value: r2(monto) })
  }

  if (periodo.interesesNetos > 0) {
    links.push({ source: CENTRO, target: "Intereses de deuda", value: periodo.interesesNetos })
  }
  if (periodo.resultadoFinanciero > 0) {
    links.push({ source: CENTRO, target: "Superávit financiero", value: periodo.resultadoFinanciero })
  }

  return links
}
