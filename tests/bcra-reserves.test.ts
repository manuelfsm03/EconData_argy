import assert from "node:assert/strict"
import test from "node:test"

import {
  buildReserveSeries,
  latestMeasuredNetReserves,
  normalizeBCRAPoints,
} from "../src/server/sources/bcra-reserves"

const p = (fecha: string, valor: number) => ({ fecha, valor })

test("descarta null y no finitos sin aplicar !isNaN sobre null", () => {
  assert.deepEqual(
    normalizeBCRAPoints([
      { fecha: "2024-01-01", valor: null },
      { fecha: "2024-01-02", valor: Number.NaN },
      { fecha: "2024-01-03", valor: 0 },
    ]),
    [p("2024-01-03", 0)],
  )
})

test("calcula netas Machado sólo con los tres componentes medidos", () => {
  const [row] = buildReserveSeries({
    brutas: [p("2024-01-02", 50_000)],
    var75: [p("2024-01-02", 48_000)],
    efectivoME: [p("2024-01-02", 4_000)],
    cuentasME: [p("2024-01-02", 12_000)],
  })
  assert.deepEqual(row, {
    fecha: "2024-01-02",
    brutas: 50_000,
    netas: 32_000,
    encajes: 16_000,
    swap_china: null,
  })
})

test("devuelve netas null si falta un componente en esa fecha", () => {
  const [row] = buildReserveSeries({
    brutas: [p("2024-01-02", 50_000)],
    var75: [p("2024-01-02", 48_000)],
    efectivoME: [],
    cuentasME: [p("2024-01-02", 12_000)],
  })
  assert.equal(row.netas, null)
  assert.equal(row.encajes, null)
})

test("acepta cero medido como componente válido", () => {
  const [row] = buildReserveSeries({
    brutas: [p("2024-01-02", 50_000)],
    var75: [p("2024-01-02", 48_000)],
    efectivoME: [p("2024-01-02", 0)],
    cuentasME: [p("2024-01-02", 12_000)],
  })
  assert.equal(row.netas, 36_000)
})

test("elige la última neta realmente medida y no la rellena", () => {
  const rows = buildReserveSeries({
    brutas: [p("2024-01-02", 50_000), p("2024-01-03", 51_000)],
    var75: [p("2024-01-02", 48_000)],
    efectivoME: [p("2024-01-02", 4_000)],
    cuentasME: [p("2024-01-02", 12_000)],
  })
  assert.equal(rows[1].netas, null)
  assert.deepEqual(latestMeasuredNetReserves(rows), rows[0])
})
