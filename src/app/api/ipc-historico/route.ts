/**
 * /api/ipc-historico — Inflación anual Argentina 1943–presente
 *
 * Combina:
 * 1. Datos hardcodeados 1943–2016 (fuente: INDEC / BCRA histórico)
 * 2. Cálculo dinámico 2017–presente desde serie mensual datos.gob.ar
 *    Serie: 145.3_INGNACUAL_DICI_M_38 (IPC var. mensual, en proporción)
 */

import { NextResponse } from "next/server"

const _cache: { data: unknown; expiry: number } | null = null
let _cacheEntry: { data: unknown; expiry: number } | null = null

// ── Datos históricos 1943–2016 (inmutables) ──────────────────────────────────
const HISTORICO_FIJO = [
  { anio: 1943, inflacion: 10.0 },
  { anio: 1944, inflacion: 5.0 },
  { anio: 1945, inflacion: 14.0 },
  { anio: 1946, inflacion: 17.0 },
  { anio: 1947, inflacion: 14.0 },
  { anio: 1948, inflacion: 13.0 },
  { anio: 1949, inflacion: 31.0 },
  { anio: 1950, inflacion: 25.0 },
  { anio: 1951, inflacion: 37.0 },
  { anio: 1952, inflacion: 38.0 },
  { anio: 1953, inflacion: 4.0 },
  { anio: 1954, inflacion: 3.0 },
  { anio: 1955, inflacion: 13.0 },
  { anio: 1956, inflacion: 14.0 },
  { anio: 1957, inflacion: 25.0 },
  { anio: 1958, inflacion: 32.0 },
  { anio: 1959, inflacion: 113.0 },
  { anio: 1960, inflacion: 27.0 },
  { anio: 1961, inflacion: 13.0 },
  { anio: 1962, inflacion: 28.0 },
  { anio: 1963, inflacion: 24.0 },
  { anio: 1964, inflacion: 22.0 },
  { anio: 1965, inflacion: 29.0 },
  { anio: 1966, inflacion: 32.0 },
  { anio: 1967, inflacion: 30.0 },
  { anio: 1968, inflacion: 16.0 },
  { anio: 1969, inflacion: 7.0 },
  { anio: 1970, inflacion: 13.0 },
  { anio: 1971, inflacion: 35.0 },
  { anio: 1972, inflacion: 58.0 },
  { anio: 1973, inflacion: 61.0 },
  { anio: 1974, inflacion: 24.0 },
  { anio: 1975, inflacion: 183.0 },
  { anio: 1976, inflacion: 444.0 },
  { anio: 1977, inflacion: 176.0 },
  { anio: 1978, inflacion: 175.0 },
  { anio: 1979, inflacion: 160.0 },
  { anio: 1980, inflacion: 101.0 },
  { anio: 1981, inflacion: 105.0 },
  { anio: 1982, inflacion: 165.0 },
  { anio: 1983, inflacion: 344.0 },
  { anio: 1984, inflacion: 627.0, nota: "Hiperinflación naciente" },
  { anio: 1985, inflacion: 672.0, nota: "Plan Austral" },
  { anio: 1986, inflacion: 90.0 },
  { anio: 1987, inflacion: 131.0 },
  { anio: 1988, inflacion: 343.0 },
  { anio: 1989, inflacion: 3079.0, nota: "Hiperinflación" },
  { anio: 1990, inflacion: 2314.0, nota: "Hiperinflación" },
  { anio: 1991, inflacion: 172.0, nota: "Plan Cavallo / Convertibilidad" },
  { anio: 1992, inflacion: 25.0 },
  { anio: 1993, inflacion: 10.0 },
  { anio: 1994, inflacion: 4.0 },
  { anio: 1995, inflacion: 3.0 },
  { anio: 1996, inflacion: 0.2 },
  { anio: 1997, inflacion: 0.5 },
  { anio: 1998, inflacion: 0.9 },
  { anio: 1999, inflacion: -1.2 },
  { anio: 2000, inflacion: -0.9 },
  { anio: 2001, inflacion: -1.1 },
  { anio: 2002, inflacion: 41.0, nota: "Devaluación / fin Convertibilidad" },
  { anio: 2003, inflacion: 3.7 },
  { anio: 2004, inflacion: 6.1 },
  { anio: 2005, inflacion: 12.3 },
  { anio: 2006, inflacion: 9.8 },
  { anio: 2007, inflacion: 8.5 },
  { anio: 2008, inflacion: 7.2 },
  { anio: 2009, inflacion: 7.7 },
  { anio: 2010, inflacion: 10.9 },
  { anio: 2011, inflacion: 9.5 },
  { anio: 2012, inflacion: 10.8 },
  { anio: 2013, inflacion: 10.9 },
  { anio: 2014, inflacion: 23.9 },
  { anio: 2015, inflacion: 26.9 },
  { anio: 2016, inflacion: 41.0, nota: "Unificación cambiaria — inicio base IPC INDEC" },
]

// ── Calcular 2017–presente desde datos.gob.ar ────────────────────────────────
async function fetchRecientes(): Promise<{ anio: number; inflacion: number; nota?: string }[]> {
  try {
    const url = "https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=120&sort=asc&format=json"
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const json = await res.json()
    const data: [string, number | null][] = json.data ?? []

    // Agrupar meses por año y acumular
    const byYear: Record<string, number[]> = {}
    for (const [fecha, v] of data) {
      if (v == null) continue
      const anio = fecha.slice(0, 4)
      if (parseInt(anio) < 2017) continue
      if (!byYear[anio]) byYear[anio] = []
      byYear[anio].push(v * 100)   // proporción → %
    }

    const hoy = new Date()
    return Object.entries(byYear)
      .filter(([anio, meses]) => {
        const a = parseInt(anio)
        // Solo incluir años con datos completos (o el año en curso con ≥1 mes)
        return a < hoy.getFullYear() || (a === hoy.getFullYear() && meses.length >= 1)
      })
      .map(([anio, meses]) => {
        // Acumulado compuesto: ∏(1 + v/100) - 1
        const acum = meses.reduce((acc, v) => (1 + acc / 100) * (1 + v / 100) * 100 - 100, 0)
        const result: { anio: number; inflacion: number; nota?: string } = {
          anio: parseInt(anio),
          inflacion: parseFloat(acum.toFixed(1)),
        }
        // Notas para años relevantes
        if (parseInt(anio) === 2018) result.nota = "Crisis cambiaria / acuerdo FMI"
        if (parseInt(anio) === 2023) result.nota = "Máximo post-hiperinflación"
        if (parseInt(anio) === hoy.getFullYear()) result.nota = "Año en curso (acum.)"
        return result
      })
      .sort((a, b) => a.anio - b.anio)
  } catch {
    return []
  }
}

export async function GET() {
  // Cache 12 horas
  if (_cacheEntry && Date.now() < _cacheEntry.expiry) {
    return NextResponse.json(_cacheEntry.data)
  }

  const recientes = await fetchRecientes()

  // Merge: hardcoded 1943–2016 + dinámico 2017+
  const serie = [
    ...HISTORICO_FIJO,
    ...recientes,
  ].sort((a, b) => a.anio - b.anio)

  const pico = serie.reduce((max, r) => r.inflacion > max.inflacion ? r : max, serie[0])
  const promedio = parseFloat((serie.reduce((s, r) => s + r.inflacion, 0) / serie.length).toFixed(1))

  const result = {
    data: {
      serie,
      stats: {
        pico:    { anio: pico.anio, inflacion: pico.inflacion, nota: pico.nota },
        promedio,
        total_anios: serie.length,
        desde: serie[0]?.anio ?? 1943,
        hasta: serie.at(-1)?.anio ?? new Date().getFullYear(),
      },
    },
    updated_at: new Date().toISOString(),
    source: "INDEC / BCRA (1943–2016 histórico) · datos.gob.ar IPC mensual (2017–presente)",
  }

  _cacheEntry = { data: result, expiry: Date.now() + 12 * 3600 * 1000 }
  return NextResponse.json(result)
}
