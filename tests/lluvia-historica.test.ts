import assert from "node:assert/strict"
import test from "node:test"

import {
  agregarSerieHistorica,
  periodoDe,
  promediarSerieHistorica,
  resumirSerieHistorica,
  type PuntoHistorico,
} from "../src/server/external/lluvia-historica"

test("día devuelve la fecha tal cual", () => {
  assert.equal(periodoDe("2026-03-15", "dia"), "2026-03-15")
})

test("mes agrupa por año-mes", () => {
  assert.equal(periodoDe("2026-03-15", "mes"), "2026-03")
  assert.equal(periodoDe("2026-03-01", "mes"), "2026-03")
  assert.equal(periodoDe("2026-03-31", "mes"), "2026-03")
})

test("año agrupa por año calendario", () => {
  assert.equal(periodoDe("2026-01-01", "anio"), "2026")
  assert.equal(periodoDe("2026-12-31", "anio"), "2026")
})

test("semana ISO: 2026-01-01 es jueves, cae en la semana 1 de su propio año", () => {
  // 2026-01-01 es jueves (verificado: 2024-01-01 lunes, año bisiesto +366d ->
  // 2025-01-01 miércoles, +365d -> 2026-01-01 jueves). Con el jueves adentro,
  // la semana pertenece al año en curso sin ambigüedad.
  assert.equal(periodoDe("2026-01-01", "semana"), "2026-W01")
})

test("semana ISO: el 1ro de enero puede pertenecer al año anterior", () => {
  // Caso real y conocido: 2023-01-01 fue domingo. El jueves de esa semana
  // (lunes 26/dic a domingo 1/ene) es 29 de diciembre de 2022: la semana es
  // la 52 de 2022, no la 1 de 2023. Es el caso que rompe una implementación
  // ingenua de "semana = domingo a sábado del año en curso".
  assert.equal(periodoDe("2023-01-01", "semana"), "2022-W52")
})

test("semana ISO: algunos años tienen 53 semanas", () => {
  // 2021-01-01 fue viernes; el jueves de esa semana es 31/dic/2020, así que
  // esa semana es la 53 de 2020 (2020 es uno de los años con 53 semanas ISO).
  assert.equal(periodoDe("2021-01-01", "semana"), "2020-W53")
})

test("semana ISO: mitad del año no tiene ambigüedad de años", () => {
  assert.equal(periodoDe("2026-06-15", "semana"), "2026-W25")
})

test("agrega sumando sólo los días con dato, sin contarlos como cero", () => {
  const fechas = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-04-01"]
  const mm = [5, null, 3, 10]
  const serie = agregarSerieHistorica(fechas, mm, "mes")

  assert.equal(serie.length, 2)
  const marzo = serie.find((p) => p.periodo === "2026-03")
  assert.equal(marzo?.mm, 8)
  assert.equal(marzo?.diasConDato, 2)
})

test("la serie agregada sale ordenada por período", () => {
  const fechas = ["2026-03-01", "2020-01-01", "2023-06-01"]
  const mm = [1, 1, 1]
  const serie = agregarSerieHistorica(fechas, mm, "anio")
  assert.deepEqual(serie.map((p) => p.periodo), ["2020", "2023", "2026"])
})

test("las etiquetas de mes son legibles, no el código YYYY-MM crudo", () => {
  const serie = agregarSerieHistorica(["2026-03-15"], [5], "mes")
  assert.equal(serie[0].etiqueta, "mar 2026")
})

test("una serie totalmente vacía de dato no rompe: no hay períodos", () => {
  const serie = agregarSerieHistorica(["2026-01-01", "2026-01-02"], [null, null], "dia")
  assert.deepEqual(serie, [])
})

test("promediar exige que todos los puntos cubran el período, igual que clima-campania", () => {
  const punto1: PuntoHistorico[] = [
    { periodo: "2025", etiqueta: "2025", mm: 100, diasConDato: 300 },
    { periodo: "2026", etiqueta: "2026", mm: 200, diasConDato: 300 },
  ]
  const punto2: PuntoHistorico[] = [
    { periodo: "2026", etiqueta: "2026", mm: 300, diasConDato: 300 },
  ]
  const zona = promediarSerieHistorica([punto1, punto2])

  assert.equal(zona.length, 1)
  assert.equal(zona[0].periodo, "2026")
  assert.equal(zona[0].mm, 250)
})

test("resumir ubica el más lluvioso y el más seco de la serie", () => {
  const serie: PuntoHistorico[] = [10, 90, 40, 5].map((mm, i) => ({
    periodo: String(2020 + i), etiqueta: String(2020 + i), mm, diasConDato: 360,
  }))
  const resumen = resumirSerieHistorica(serie)

  assert.equal(resumen.periodos, 4)
  assert.equal(resumen.promedioMm, 36.3) // (10+90+40+5)/4 = 36.25, redondeado a 1 decimal
  assert.equal(resumen.masLluvioso?.mm, 90)
  assert.equal(resumen.masSeco?.mm, 5)
  assert.equal(resumen.ultimo?.periodo, "2023")
})

test("resumir una serie vacía no rompe", () => {
  const resumen = resumirSerieHistorica([])
  assert.equal(resumen.periodos, 0)
  assert.equal(resumen.masLluvioso, null)
})
