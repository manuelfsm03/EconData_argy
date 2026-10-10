/**
 * Lluvia histórica — el mismo diario de ERA5 agregado por día, semana, mes o año.
 *
 * clima-campania.ts agrega por campaña agrícola (para cruzar con rendimiento)
 * y clima-regional.ts por una ventana móvil de días (para el mapa "qué llovió
 * esta semana"). Esto es distinto: un explorador general de la serie completa
 * desde 1940, para cualquier período de calendario, sin acoplar a ningún
 * cultivo ni campaña. Lógica pura, sin red.
 */

export type Granularidad = "dia" | "semana" | "mes" | "anio"

export type PuntoHistorico = { periodo: string; etiqueta: string; mm: number; diasConDato: number }

/**
 * Clave de agrupación de una fecha ISO (YYYY-MM-DD) según la granularidad.
 *
 * "semana" usa semana ISO-8601 (lunes a domingo, semana 1 = la que contiene
 * el primer jueves del año): es el estándar sin ambigüedad de "a qué semana
 * pertenece el 1 de enero", que varía si se cuenta domingo-sábado.
 */
export function periodoDe(fechaIso: string, granularidad: Granularidad): string {
  const [anioStr, mesStr, diaStr] = fechaIso.split("-")
  const anio = Number(anioStr), mes = Number(mesStr), dia = Number(diaStr)

  switch (granularidad) {
    case "dia": return fechaIso
    case "mes": return `${anioStr}-${mesStr}`
    case "anio": return anioStr
    case "semana": {
      const { anioIso, semanaIso } = semanaIsoDe(anio, mes, dia)
      return `${anioIso}-W${String(semanaIso).padStart(2, "0")}`
    }
  }
}

/** Año y número de semana ISO-8601 de una fecha calendario. */
function semanaIsoDe(anio: number, mes: number, dia: number): { anioIso: number; semanaIso: number } {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  // Correr al jueves de esa semana ISO: el año y la semana de ese jueves
  // definen el año/semana ISO de toda la semana (lun-dom), sea cual sea el
  // día real de la fecha original.
  const diaSemanaIso = (fecha.getUTCDay() + 6) % 7 // lunes=0 ... domingo=6
  fecha.setUTCDate(fecha.getUTCDate() - diaSemanaIso + 3)

  const anioIso = fecha.getUTCFullYear()
  const inicioAnio = new Date(Date.UTC(anioIso, 0, 4))
  const diaSemanaInicio = (inicioAnio.getUTCDay() + 6) % 7
  inicioAnio.setUTCDate(inicioAnio.getUTCDate() - diaSemanaInicio)

  const semanaIso = Math.round((fecha.getTime() - inicioAnio.getTime()) / (7 * 86_400_000)) + 1
  return { anioIso, semanaIso }
}

function etiquetaDe(periodo: string, granularidad: Granularidad): string {
  switch (granularidad) {
    case "dia": return periodo
    case "semana": return periodo
    case "mes": {
      const [anio, mes] = periodo.split("-")
      const NOMBRES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
      return `${NOMBRES[Number(mes) - 1]} ${anio}`
    }
    case "anio": return periodo
  }
}

/**
 * Agrega una serie diaria (fechas ISO + mm) según la granularidad pedida.
 *
 * Los días sin dato se saltean sin contar como cero: un mes con 25 días
 * medidos de 30 no es "menos lluvia", es un mes con datos incompletos, y
 * eso se refleja en `diasConDato`, no se disimula.
 */
export function agregarSerieHistorica(
  fechas: readonly string[],
  mm: readonly (number | null)[],
  granularidad: Granularidad,
): PuntoHistorico[] {
  const acumulado = new Map<string, { mm: number; dias: number }>()

  for (let i = 0; i < fechas.length; i++) {
    const valor = mm[i]
    if (valor === null || valor === undefined || !Number.isFinite(valor)) continue
    const periodo = periodoDe(fechas[i], granularidad)
    const previo = acumulado.get(periodo) ?? { mm: 0, dias: 0 }
    previo.mm += valor
    previo.dias += 1
    acumulado.set(periodo, previo)
  }

  return [...acumulado.entries()]
    .map(([periodo, { mm: total, dias }]) => ({
      periodo,
      etiqueta: etiquetaDe(periodo, granularidad),
      mm: Math.round(total * 10) / 10,
      diasConDato: dias,
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

/** Promedia varios puntos (zona) para una misma granularidad, igual criterio que clima-campania: sólo cuenta un período si todos los puntos lo cubren. */
export function promediarSerieHistorica(seriesPorPunto: readonly PuntoHistorico[][]): PuntoHistorico[] {
  if (seriesPorPunto.length === 0) return []

  const conteo = new Map<string, { etiqueta: string; mm: number; dias: number; puntos: number }>()
  for (const serie of seriesPorPunto) {
    for (const punto of serie) {
      const previo = conteo.get(punto.periodo) ?? { etiqueta: punto.etiqueta, mm: 0, dias: 0, puntos: 0 }
      previo.mm += punto.mm
      previo.dias += punto.diasConDato
      previo.puntos += 1
      conteo.set(punto.periodo, previo)
    }
  }

  return [...conteo.entries()]
    .filter(([, valor]) => valor.puntos === seriesPorPunto.length)
    .map(([periodo, valor]) => ({
      periodo,
      etiqueta: valor.etiqueta,
      mm: Math.round((valor.mm / valor.puntos) * 10) / 10,
      diasConDato: Math.round(valor.dias / valor.puntos),
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}

export type ResumenHistorico = {
  periodos: number
  promedioMm: number
  ultimo: PuntoHistorico | null
  masLluvioso: PuntoHistorico | null
  masSeco: PuntoHistorico | null
}

export function resumirSerieHistorica(serie: readonly PuntoHistorico[]): ResumenHistorico {
  if (serie.length === 0) return { periodos: 0, promedioMm: 0, ultimo: null, masLluvioso: null, masSeco: null }

  const promedio = serie.reduce((suma, p) => suma + p.mm, 0) / serie.length
  const masLluvioso = serie.reduce((a, b) => (b.mm > a.mm ? b : a))
  const masSeco = serie.reduce((a, b) => (b.mm < a.mm ? b : a))

  return {
    periodos: serie.length,
    promedioMm: Math.round(promedio * 10) / 10,
    ultimo: serie[serie.length - 1],
    masLluvioso,
    masSeco,
  }
}
