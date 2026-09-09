/**
 * Clima por campaña agrícola — lluvia acumulada y su relación con el rinde.
 *
 * La unidad de análisis no es el año calendario sino la CAMPAÑA: para los
 * cultivos de verano el ciclo va de octubre a marzo, así que la lluvia de la
 * campaña 2022/2023 es la caída entre octubre de 2022 y marzo de 2023. Sumar
 * por año calendario mezcla el final de una campaña con el arranque de otra.
 *
 * Lógica pura: no hace red. La descarga vive en el endpoint.
 *
 * Advertencia que viaja con el dato: la fuente es reanálisis (ERA5), no
 * observación de estación meteorológica. Sirve para el orden de magnitud y
 * para comparar campañas entre sí; no reemplaza la medición en tierra.
 */

export type PuntoZona = { nombre: string; lat: number; lon: number; provincia: string }

export type ZonaAgricola = {
  id: string
  nombre: string
  descripcion: string
  puntos: readonly PuntoZona[]
}

/** Meses del ciclo de verano: octubre a marzo. */
export const CAMPANIA_MES_INICIO = 10
export const CAMPANIA_MES_FIN = 3

export const ZONAS_AGRICOLAS: readonly ZonaAgricola[] = [
  {
    id: "nucleo",
    nombre: "Zona núcleo",
    descripcion: "Sur de Santa Fe, norte de Buenos Aires y sudeste de Córdoba: el corazón sojero.",
    puntos: [
      { nombre: "Pergamino", lat: -33.89, lon: -60.57, provincia: "Buenos Aires" },
      { nombre: "Rosario", lat: -32.95, lon: -60.65, provincia: "Santa Fe" },
      { nombre: "Marcos Juárez", lat: -32.70, lon: -62.10, provincia: "Córdoba" },
      { nombre: "Junín", lat: -34.58, lon: -60.94, provincia: "Buenos Aires" },
      { nombre: "Venado Tuerto", lat: -33.75, lon: -61.97, provincia: "Santa Fe" },
      { nombre: "Río Cuarto", lat: -33.12, lon: -64.35, provincia: "Córdoba" },
    ],
  },
  {
    id: "noa",
    nombre: "NOA",
    descripcion: "Frontera agrícola del noroeste: Salta, Tucumán y Santiago del Estero.",
    puntos: [
      { nombre: "Las Lajitas", lat: -24.72, lon: -64.20, provincia: "Salta" },
      { nombre: "Tucumán", lat: -26.82, lon: -65.22, provincia: "Tucumán" },
      { nombre: "Añatuya", lat: -28.46, lon: -62.83, provincia: "Santiago del Estero" },
    ],
  },
  {
    id: "sudoeste",
    nombre: "Sudoeste bonaerense",
    descripcion: "Margen semiárido de la región pampeana, el más expuesto a la sequía.",
    puntos: [
      { nombre: "Bahía Blanca", lat: -38.72, lon: -62.27, provincia: "Buenos Aires" },
      { nombre: "Pigüé", lat: -37.60, lon: -62.40, provincia: "Buenos Aires" },
      { nombre: "Santa Rosa", lat: -36.62, lon: -64.29, provincia: "La Pampa" },
    ],
  },
]

export function zonaPorId(id: string): ZonaAgricola | undefined {
  return ZONAS_AGRICOLAS.find((zona) => zona.id === id)
}

/**
 * Campaña a la que pertenece una fecha ISO, o null si cae fuera del ciclo.
 * Octubre a diciembre abren la campaña del año en curso; enero a marzo cierran
 * la que abrió el año anterior. Abril a septiembre es entre campañas.
 */
export function campaniaDe(fechaIso: string): number | null {
  const anio = Number(fechaIso.slice(0, 4))
  const mes = Number(fechaIso.slice(5, 7))
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) return null
  if (mes >= CAMPANIA_MES_INICIO) return anio
  if (mes <= CAMPANIA_MES_FIN) return anio - 1
  return null
}

export function etiquetaCampania(anio: number): string {
  return `${anio}/${anio + 1}`
}

export type PuntoLluvia = { campania: number; etiqueta: string; mm: number; diasConDato: number }

/** Acumula una serie diaria de un punto en campañas. */
export function acumularPorCampania(fechas: readonly string[], mm: readonly (number | null)[]): PuntoLluvia[] {
  const acumulado = new Map<number, { mm: number; dias: number }>()

  for (let i = 0; i < fechas.length; i++) {
    const valor = mm[i]
    if (valor === null || valor === undefined || !Number.isFinite(valor)) continue
    const campania = campaniaDe(fechas[i])
    if (campania === null) continue
    const previo = acumulado.get(campania) ?? { mm: 0, dias: 0 }
    previo.mm += valor
    previo.dias += 1
    acumulado.set(campania, previo)
  }

  return [...acumulado.entries()]
    .map(([campania, { mm: total, dias }]) => ({
      campania,
      etiqueta: etiquetaCampania(campania),
      mm: Math.round(total * 10) / 10,
      diasConDato: dias,
    }))
    .sort((a, b) => a.campania - b.campania)
}

/**
 * Promedia varias series de puntos en una sola serie de zona.
 *
 * Una campaña solo se reporta si TODOS los puntos de la zona la cubren: si un
 * punto arranca más tarde que los otros, promediar igual haría que la serie
 * salte de nivel por un cambio en la muestra y no por el clima.
 */
export function promediarZona(seriesPorPunto: readonly PuntoLluvia[][]): PuntoLluvia[] {
  if (seriesPorPunto.length === 0) return []

  const conteo = new Map<number, { mm: number; dias: number; puntos: number }>()
  for (const serie of seriesPorPunto) {
    for (const punto of serie) {
      const previo = conteo.get(punto.campania) ?? { mm: 0, dias: 0, puntos: 0 }
      previo.mm += punto.mm
      previo.dias += punto.diasConDato
      previo.puntos += 1
      conteo.set(punto.campania, previo)
    }
  }

  return [...conteo.entries()]
    .filter(([, valor]) => valor.puntos === seriesPorPunto.length)
    .map(([campania, valor]) => ({
      campania,
      etiqueta: etiquetaCampania(campania),
      mm: Math.round((valor.mm / valor.puntos) * 10) / 10,
      diasConDato: Math.round(valor.dias / valor.puntos),
    }))
    .sort((a, b) => a.campania - b.campania)
}

// ── Estadística de la serie ───────────────────────────────────────────────────

export type ResumenLluvia = {
  campanias: number
  promedioMm: number
  ultima: PuntoLluvia | null
  /** Percentil de la última campaña dentro de la serie histórica, 0 a 100. */
  percentilUltima: number | null
  desvioVsPromedioPct: number | null
  masSecas: PuntoLluvia[]
}

export function resumirLluvia(serie: readonly PuntoLluvia[]): ResumenLluvia {
  if (serie.length === 0) {
    return { campanias: 0, promedioMm: 0, ultima: null, percentilUltima: null, desvioVsPromedioPct: null, masSecas: [] }
  }

  const promedio = serie.reduce((suma, punto) => suma + punto.mm, 0) / serie.length
  const ultima = serie[serie.length - 1]
  const menores = serie.filter((punto) => punto.mm < ultima.mm).length

  return {
    campanias: serie.length,
    promedioMm: Math.round(promedio * 10) / 10,
    ultima,
    percentilUltima: Math.round((menores / serie.length) * 100),
    desvioVsPromedioPct: promedio > 0 ? Math.round(((ultima.mm / promedio) - 1) * 1000) / 10 : null,
    masSecas: [...serie].sort((a, b) => a.mm - b.mm).slice(0, 5),
  }
}

// ── Cruce con rendimiento ─────────────────────────────────────────────────────

export type PuntoRinde = { campania: number; rendimientoKgHa: number }

export type SensibilidadClima = {
  campaniasCruzadas: number
  /** Correlación cruda: subestima el efecto porque compite con la tecnología. */
  correlacionCruda: number
  /** Ganancia anual de rinde atribuible a tecnología, en kg/ha por año. */
  tendenciaKgHaPorAnio: number
  /** Correlación entre lluvia y el desvío del rinde respecto de su tendencia. */
  correlacionDetrend: number
  r2Detrend: number
  /** Kg/ha de rinde asociados a cada 100 mm adicionales de lluvia de campaña. */
  kgHaPor100mm: number
  peoresDesvios: { campania: string; mm: number; rendimientoKgHa: number; desvioKgHa: number }[]
}

function correlacion(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my
    num += a * b; dx += a * a; dy += b * b
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0
}

/** Mínimos cuadrados simple: devuelve pendiente y ordenada. */
function regresion(xs: readonly number[], ys: readonly number[]): { pendiente: number; ordenada: number } {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const pendiente = den > 0 ? num / den : 0
  return { pendiente, ordenada: my - pendiente * mx }
}

/**
 * Relaciona lluvia de campaña con rendimiento.
 *
 * El rinde crece de forma sostenida por mejoras técnicas (genética, siembra
 * directa, fertilización). Si se corre la correlación contra el rinde en
 * niveles, esa tendencia se come la señal climática y el clima parece no
 * importar. Por eso se quita la tendencia primero y se correlaciona la lluvia
 * contra el DESVÍO del rinde respecto de ella.
 */
export function sensibilidadClimaRinde(
  lluvia: readonly PuntoLluvia[],
  rinde: readonly PuntoRinde[],
): SensibilidadClima | null {
  const porCampania = new Map(rinde.map((punto) => [punto.campania, punto.rendimientoKgHa]))
  const pares = lluvia
    .filter((punto) => porCampania.has(punto.campania))
    .map((punto) => ({
      campania: punto.campania,
      mm: punto.mm,
      rinde: porCampania.get(punto.campania) as number,
    }))
    .filter((par) => Number.isFinite(par.rinde) && par.rinde > 0)

  if (pares.length < 10) return null

  const anios = pares.map((par) => par.campania)
  const rindes = pares.map((par) => par.rinde)
  const mms = pares.map((par) => par.mm)

  const tendencia = regresion(anios, rindes)
  const residuos = pares.map((par, i) => rindes[i] - (tendencia.ordenada + tendencia.pendiente * anios[i]))
  const detrend = correlacion(mms, residuos)
  const sensibilidad = regresion(mms, residuos)

  const peores = pares
    .map((par, i) => ({
      campania: etiquetaCampania(par.campania),
      mm: par.mm,
      rendimientoKgHa: Math.round(par.rinde),
      desvioKgHa: Math.round(residuos[i]),
    }))
    .sort((a, b) => a.desvioKgHa - b.desvioKgHa)
    .slice(0, 5)

  return {
    campaniasCruzadas: pares.length,
    correlacionCruda: Math.round(correlacion(mms, rindes) * 1000) / 1000,
    tendenciaKgHaPorAnio: Math.round(tendencia.pendiente * 10) / 10,
    correlacionDetrend: Math.round(detrend * 1000) / 1000,
    r2Detrend: Math.round(detrend * detrend * 1000) / 1000,
    kgHaPor100mm: Math.round(sensibilidad.pendiente * 100),
    peoresDesvios: peores,
  }
}
