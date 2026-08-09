/**
 * Verifica el módulo de matemática de bonos contra la calculadora de
 * referencia del equipo (Copia de Calculadoras de bonos.xlsx, hoja GD30).
 *
 * Los valores esperados están copiados de las celdas de esa planilla, con el
 * precio y la fecha de liquidación que tenía cargados. Si alguien rompe el
 * cálculo, esto falla y dice exactamente qué métrica se movió.
 *
 *   npx tsx scripts/verify-bond-math.ts
 *
 * Es un script y no un test de vitest porque el repo todavía no tiene runner
 * de tests, y agregar uno toca tooling compartido. Migrarlo a vitest cuando
 * esté aprobado es mecánico.
 */

import { calcularMetricas, flujosFuturos } from "../src/lib/bond-math"
import { GD30, construirCashflows, totalAmortizado } from "../src/lib/bond-schedule"
import { aISO, fechaUTC } from "../src/lib/market-calendar"

const LIQUIDACION = fechaUTC("2026-04-28")
const PRECIO_DIRTY = 64.44

/** Celdas de la hoja GD30 de la planilla de referencia. */
const ESPERADO = {
  tir: { valor: 6.802534078, celda: "E3", tolerancia: 0.0005 },
  duration: { valor: 2.086562916, celda: "E12", tolerancia: 0.0005 },
  durationMod: { valor: 1.95366424, celda: "E13", tolerancia: 0.0005 },
  convexity: { valor: 7.089906701, celda: "E14", tolerancia: 0.0005 },
  valorResidual: { valor: 72, celda: "E7", tolerancia: 0.0001 },
  interesesCorridos: { valor: 0.1635, celda: "E8", tolerancia: 0.0001 },
  valorTecnico: { valor: 72.1635, celda: "E9", tolerancia: 0.0001 },
  paridad: { valor: 89.29722089, celda: "E10", tolerancia: 0.0005 },
  precioClean: { valor: 64.2765, celda: "B17", tolerancia: 0.0001 },
} as const

let fallas = 0

function comparar(nombre: keyof typeof ESPERADO, obtenido: number): void {
  const { valor, celda, tolerancia } = ESPERADO[nombre]
  const delta = Math.abs(obtenido - valor)
  const ok = delta <= tolerancia
  if (!ok) fallas += 1
  const marca = ok ? "ok  " : "FALLA"
  console.log(
    `  ${marca} ${nombre.padEnd(18)} obtenido=${obtenido.toFixed(8).padStart(14)}` +
      `  excel[${celda}]=${valor.toFixed(8).padStart(14)}  delta=${delta.toExponential(2)}`,
  )
}

function main(): void {
  console.log(`\nGD30 — verificación contra la planilla de referencia`)
  console.log(`liquidación ${aISO(LIQUIDACION)}, precio dirty ${PRECIO_DIRTY}\n`)

  const cashflows = construirCashflows(GD30)

  // Invariante 1: un bono devuelve exactamente el 100% del capital.
  const total = totalAmortizado(GD30)
  const amortOk = Math.abs(total - 100) < 1e-9
  if (!amortOk) fallas += 1
  console.log(`  ${amortOk ? "ok  " : "FALLA"} amortización total   ${total} (debe ser 100)\n`)

  // Invariante 2: el último flujo cae en el vencimiento y deja el residual en 0.
  const ultimo = cashflows[cashflows.length - 1]
  const vencOk = aISO(ultimo.fechaDevengamiento) === GD30.vencimiento
  const residualFinal = ultimo.vr - ultimo.amortizacion
  if (!vencOk || Math.abs(residualFinal) > 1e-9) fallas += 1
  console.log(
    `  ${vencOk && Math.abs(residualFinal) < 1e-9 ? "ok  " : "FALLA"} último flujo         ` +
      `${aISO(ultimo.fechaDevengamiento)} (vto ${GD30.vencimiento}), residual final ${residualFinal}\n`,
  )

  const metricas = calcularMetricas(PRECIO_DIRTY, cashflows, LIQUIDACION)
  if (metricas === null) {
    console.error("  FALLA: no se pudieron calcular las métricas")
    process.exit(1)
  }

  comparar("valorResidual", metricas.valorResidual)
  comparar("interesesCorridos", metricas.interesesCorridos)
  comparar("valorTecnico", metricas.valorTecnico)
  comparar("precioClean", metricas.precioClean)
  comparar("paridad", metricas.paridad)
  comparar("tir", metricas.tir)
  comparar("duration", metricas.duration)
  comparar("durationMod", metricas.durationMod)
  comparar("convexity", metricas.convexity)

  // El current yield se aparta del excel a propósito: la planilla lo calcula
  // con un rango de celdas fijo que quedó viejo y suma cupones ya cobrados.
  const futuros = flujosFuturos(cashflows, LIQUIDACION)
  const proximos = futuros
    .slice(0, 2)
    .map((cf) => `${aISO(cf.fechaDevengamiento)}=${cf.cupon.toFixed(3)}`)
    .join(" + ")
  console.log(
    `\n  nota  currentYield       ${metricas.currentYield.toFixed(6)}%  ` +
      `(próximos 12m: ${proximos})`,
  )
  console.log(
    `        el excel[E5] da 0.980140% porque suma F29:F30, cupones de 2025 ya cobrados.`,
  )

  console.log(
    fallas === 0
      ? "\nTodo coincide con la planilla.\n"
      : `\n${fallas} verificación(es) fallaron.\n`,
  )
  process.exit(fallas === 0 ? 0 : 1)
}

main()
