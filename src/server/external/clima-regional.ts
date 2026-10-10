/**
 * Clima regional — lluvia reciente sobre el cinturón agrícola del Mercosur.
 *
 * A diferencia de clima-campania.ts (que acumula por campaña agrícola para
 * cruzar con rendimiento), esto es una foto de una ventana corta y reciente
 * —por defecto los últimos 14 días— sobre una grilla de puntos que cubre
 * Argentina, el sur de Brasil (el cinturón sojero: RS/PR/SC/MS), Uruguay y
 * el este de Paraguay. Sirve para responder "dónde llovió esta semana",
 * no "cómo viene la campaña".
 *
 * Lógica pura: arma la grilla y clasifica los valores. La descarga vive en
 * el endpoint.
 */

export type PuntoGrilla = { lat: number; lon: number; pais: string }

/**
 * Grilla de referencia sobre la región agrícola del Mercosur. No es una
 * grilla regular sobre todo el continente —eso desperdicia pedidos sobre
 * selva, mar y cordillera— sino puntos concentrados en la zona productiva.
 */
export function grillaMercosur(pasoGrados = 2): PuntoGrilla[] {
  const puntos: PuntoGrilla[] = []

  // Argentina: NOA a Patagonia norte, cubriendo la pampa húmeda.
  for (let lat = -22; lat >= -42; lat -= pasoGrados) {
    for (let lon = -68; lon <= -57; lon += pasoGrados) {
      puntos.push({ lat, lon, pais: "Argentina" })
    }
  }
  // Sur de Brasil: el cinturón sojero (RS, PR, SC, MS, sur de GO/MT).
  for (let lat = -8; lat >= -33; lat -= pasoGrados) {
    for (let lon = -58; lon <= -47; lon += pasoGrados) {
      puntos.push({ lat, lon, pais: "Brasil" })
    }
  }
  // Uruguay: paso más fino porque el país es chico y con paso 2° casi no
  // entran puntos.
  const pasoUruguay = Math.min(pasoGrados, 1)
  for (let lat = -30; lat >= -35; lat -= pasoUruguay) {
    for (let lon = -58; lon <= -53; lon += pasoUruguay) {
      puntos.push({ lat, lon, pais: "Uruguay" })
    }
  }
  // Paraguay: la mitad oriental, la productiva.
  for (let lat = -19; lat >= -27; lat -= pasoGrados) {
    for (let lon = -58; lon <= -54; lon += pasoGrados) {
      puntos.push({ lat, lon, pais: "Paraguay" })
    }
  }

  return dedupePuntos(puntos)
}

function dedupePuntos(puntos: readonly PuntoGrilla[]): PuntoGrilla[] {
  const vistos = new Set<string>()
  const salida: PuntoGrilla[] = []
  for (const punto of puntos) {
    const clave = `${punto.lat.toFixed(2)},${punto.lon.toFixed(2)}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(punto)
  }
  return salida
}

export type PuntoLluviaAcumulada = PuntoGrilla & { mm: number; diasConDato: number }

/** Suma la precipitación diaria de un punto dentro de una ventana de fechas. */
export function acumularVentana(
  punto: PuntoGrilla,
  fechas: readonly string[],
  mm: readonly (number | null)[],
): PuntoLluviaAcumulada {
  let total = 0
  let dias = 0
  for (let i = 0; i < fechas.length; i++) {
    const valor = mm[i]
    if (valor === null || valor === undefined || !Number.isFinite(valor)) continue
    total += valor
    dias += 1
  }
  return { ...punto, mm: Math.round(total * 10) / 10, diasConDato: dias }
}

/** Categorías de intensidad, mismo criterio que usan los mapas del sector agro. */
export const NIVELES_LLUVIA = [
  { hasta: 1, etiqueta: "sin lluvia", color: "#2a2a2e" },
  { hasta: 10, etiqueta: "muy poca", color: "#123f5a" },
  { hasta: 30, etiqueta: "poca", color: "#159c8a" },
  { hasta: 50, etiqueta: "moderada", color: "#4cb96b" },
  { hasta: 75, etiqueta: "abundante", color: "#d8c53f" },
  { hasta: 100, etiqueta: "muy abundante", color: "#e8a33d" },
  { hasta: Infinity, etiqueta: "extrema", color: "#c62f45" },
] as const

export function nivelDeLluvia(mm: number): (typeof NIVELES_LLUVIA)[number] {
  return NIVELES_LLUVIA.find((nivel) => mm <= nivel.hasta) ?? NIVELES_LLUVIA[NIVELES_LLUVIA.length - 1]
}

export type ResumenPorPais = { pais: string; puntos: number; promedioMm: number; maximoMm: number; minimoMm: number }

/** Agrega la grilla por país: lo que un lector no técnico va a querer ver primero. */
export function resumirPorPais(puntos: readonly PuntoLluviaAcumulada[]): ResumenPorPais[] {
  const porPais = new Map<string, number[]>()
  for (const punto of puntos) {
    const lista = porPais.get(punto.pais) ?? []
    lista.push(punto.mm)
    porPais.set(punto.pais, lista)
  }

  return [...porPais.entries()]
    .map(([pais, valores]) => ({
      pais,
      puntos: valores.length,
      promedioMm: Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10,
      maximoMm: Math.round(Math.max(...valores) * 10) / 10,
      minimoMm: Math.round(Math.min(...valores) * 10) / 10,
    }))
    .sort((a, b) => b.promedioMm - a.promedioMm)
}
