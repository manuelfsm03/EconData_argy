import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  GASTOS,
  INGRESOS,
  agregarPeriodos,
  construirSankey,
  parseImig,
} from "../src/server/domain/fiscal-imig"

const macroRoute = readFileSync("src/app/api/macro/route.ts", "utf8")

/**
 * Fila sintética que respeta la estructura real del IMIG:
 * 16 ingresos, 31 gastos, y los resultados publicados por la fuente.
 * Cuadra a propósito: 1000 - 700 = 300 primario; 300 - 100 = 200 financiero.
 */
function filaCuadrada(fecha: string, escala = 1): Record<string, string> {
  const row: Record<string, string> = { indice_tiempo: fecha }
  // 16 ingresos de 62.5 → 1000
  for (const l of INGRESOS) row[l.clave] = String(62.5 * escala)
  // 31 gastos que suman 700
  for (const l of GASTOS) row[l.clave] = String(0)
  row.jubilaciones_pensiones_contributivas = String(400 * escala)
  row.salarios = String(200 * escala)
  row.energia = String(100 * escala)
  row.resultado_primario = String(300 * escala)
  row.intereses_netos = String(100 * escala)
  row.resultado_financiero = String(200 * escala)
  return row
}

test("el catálogo cubre las 53 columnas del IMIG: 16 ingresos + 31 gastos", () => {
  assert.equal(INGRESOS.length, 16)
  assert.equal(GASTOS.length, 31)
  const claves = new Set([...INGRESOS, ...GASTOS].map(l => l.clave))
  assert.equal(claves.size, 47, "no puede haber claves duplicadas entre ingresos y gastos")
})

test("parseImig calcula totales y verifica el cierre contable", () => {
  const [p] = parseImig([filaCuadrada("2026-07-01")])
  assert.equal(p.periodo, "2026-07")
  assert.equal(p.totalIngresos, 1000)
  assert.equal(p.totalGastoPrimario, 700)
  assert.equal(p.resultadoPrimario, 300)
  assert.equal(p.resultadoFinanciero, 200)
  assert.equal(p.desvioCierre, 0)
})

test("desvioCierre denuncia una fuente que dejó de cuadrar en vez de ocultarlo", () => {
  const rota = filaCuadrada("2026-07-01")
  rota.resultado_primario = "999" // la fuente dice 999, las columnas dicen 300
  const [p] = parseImig([rota])
  assert.equal(p.desvioCierre, -699)
})

test("parseImig descarta filas sin fecha o sin datos publicados", () => {
  const vacia: Record<string, string> = { indice_tiempo: "2026-08-01" }
  for (const l of [...INGRESOS, ...GASTOS]) vacia[l.clave] = ""
  const periodos = parseImig([
    { indice_tiempo: "no-es-fecha" },
    vacia,
    filaCuadrada("2026-07-01"),
  ])
  assert.equal(periodos.length, 1)
  assert.equal(periodos[0].periodo, "2026-07")
})

test("parseImig ordena los períodos cronológicamente", () => {
  const periodos = parseImig([
    filaCuadrada("2026-07-01"),
    filaCuadrada("2026-05-01"),
    filaCuadrada("2026-06-01"),
  ])
  assert.deepEqual(periodos.map(p => p.periodo), ["2026-05", "2026-06", "2026-07"])
})

test("agregarPeriodos suma flujos mensuales y mantiene el cierre", () => {
  const meses = parseImig([filaCuadrada("2026-01-01"), filaCuadrada("2026-02-01")])
  const ytd = agregarPeriodos(meses, "2026 (ene-feb)")
  assert.ok(ytd)
  assert.equal(ytd.meses, 2)
  assert.equal(ytd.totalIngresos, 2000)
  assert.equal(ytd.totalGastoPrimario, 1400)
  assert.equal(ytd.resultadoPrimario, 600)
  assert.equal(ytd.desvioCierre, 0)
  const jubilaciones = ytd.gastos.find(g => g.clave === "jubilaciones_pensiones_contributivas")
  assert.equal(jubilaciones?.monto, 800)
})

test("agregarPeriodos devuelve null sin períodos", () => {
  assert.equal(agregarPeriodos([], "2026"), null)
})

test("construirSankey balancea: lo que entra al nodo central es lo que sale", () => {
  const [p] = parseImig([filaCuadrada("2026-07-01")])
  const links = construirSankey(p)
  const entra = links.filter(l => l.target === "Ingresos totales").reduce((a, l) => a + l.value, 0)
  const sale = links.filter(l => l.source === "Ingresos totales").reduce((a, l) => a + l.value, 0)
  assert.equal(entra, 1000)
  assert.equal(sale, 1000, "gasto por bloque + intereses + superávit debe igualar los ingresos")
})

test("construirSankey omite montos no positivos en vez de dibujarlos invertidos", () => {
  const conNegativo = filaCuadrada("2026-07-01")
  conNegativo.otros_programas = "-50"
  const [p] = parseImig([conNegativo])
  const links = construirSankey(p)
  assert.ok(links.every(l => l.value > 0))
  assert.ok(!links.some(l => l.target === "Otros programas sociales"))
})

test("el endpoint fiscal usa las series del IMIG y no las mal etiquetadas", () => {
  // 378.9 es de EEPP+PAMI+Fondos Fiduciarios, no del SPN.
  // 379.9_RESULTADO_017__31_73 es el primario "sin rentas", no el titular.
  assert.doesNotMatch(macroRoute, /378\.9_RESULTADO_017_0_M_18_90/)
  assert.doesNotMatch(macroRoute, /379\.9_RESULTADO_017__31_73/)
  assert.match(macroRoute, /452\.3_RESULTADO_RIO_0_M_18_54/)
  assert.match(macroRoute, /452\.3_INTERESES_TOS_0_M_15_62/)
  assert.match(macroRoute, /452\.3_RESULTADO_ERO_0_M_20_25/)
})

test("el endpoint fiscal_imig existe y declara la fuente real", () => {
  assert.match(macroRoute, /endpoint === "fiscal_imig"/)
  assert.match(macroRoute, /imig-mensual\.csv/)
  assert.match(macroRoute, /Secretar[ií]a de Hacienda/)
})
