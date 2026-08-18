/**
 * /api/bonos/calculadora — Simulador de bonos soberanos
 *
 * A diferencia de /api/bonos (que siempre usa el precio de mercado en vivo),
 * este endpoint acepta un precio o una TIR HIPOTÉTICOS y devuelve las
 * métricas que corresponderían — sin tocar ni consultar el precio real.
 *
 * GET /api/bonos/calculadora?ticker=GD30&modo=precio&valor=65.30
 * GET /api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5
 * GET /api/bonos/calculadora?ticker=GD30&modo=tir&valor=12.5&liquidacion=2026-09-01
 * GET /api/bonos/calculadora?ticker=GD41&modo=precio&valor=64.10&shocks=-100,100
 *
 * Siempre devuelve además una tabla de ESCENARIOS: qué precio tendría el bono
 * si la TIR se moviera N puntos básicos, repreciando el flujo entero con la
 * tasa nueva. Con ?shocks= se pide una lista propia, separada por comas; sin
 * ese parámetro se usa la escalera por defecto de bond-math.
 *
 * Solo soporta tickers con esquema de cashflows verificado contra el
 * prospecto (ver ESQUEMAS en bond-schedule.ts). Para el resto devuelve 404
 * explícito en vez de un cálculo legado sin validar, mismo criterio de
 * honestidad que ya usa /api/bonos con "dataQuality".
 */

import { NextRequest, NextResponse } from "next/server"
import { ESQUEMAS, construirCashflows } from "@/lib/bond-schedule"
import { todayInBuenosAires } from "@/lib/calendar-events"
import {
  SHOCKS_POR_DEFECTO,
  calcularMetricas,
  escenariosDeTasa,
  interesesCorridos as calcularInteresesCorridos,
  metricasDesdeTIR,
} from "@/lib/bond-math"
import { fechaUTC } from "@/lib/market-calendar"

/** Cuántos escenarios se aceptan de una: suficiente para una escalera fina,
 *  poco como para que nadie use la ruta para hacer trabajar al server de gusto. */
const MAX_ESCENARIOS = 24

/** Tope por escenario: ±10000 bp son ±100 puntos de TIR, de sobra para
 *  cualquier simulación honesta. */
const MAX_SHOCK_BP = 10000

/**
 * Interpreta ?shocks=-100,50,200. Devuelve el error listo para responder si la
 * lista no sirve, en vez de tragarse en silencio un valor mal escrito y
 * devolver una tabla que no es la que pidieron.
 */
function parsearShocks(crudo: string | null): { shocks: number[] } | { error: string } {
  if (crudo === null) return { shocks: SHOCKS_POR_DEFECTO }

  const partes = crudo
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0)

  if (partes.length === 0) return { error: "?shocks no puede venir vacío" }
  if (partes.length > MAX_ESCENARIOS) {
    return { error: `?shocks admite hasta ${MAX_ESCENARIOS} escenarios` }
  }

  const shocks: number[] = []
  for (const parte of partes) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(parte)) {
      return { error: `"${parte}" no es un movimiento en puntos básicos válido` }
    }
    const bp = Number(parte)
    if (!Number.isFinite(bp) || Math.abs(bp) > MAX_SHOCK_BP) {
      return { error: `Cada shock debe estar entre -${MAX_SHOCK_BP} y ${MAX_SHOCK_BP} puntos básicos` }
    }
    shocks.push(bp)
  }

  return { shocks }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")?.trim().toUpperCase() ?? ""
  const modo = searchParams.get("modo")
  const valorParam = searchParams.get("valor")
  const liquidacionParam = searchParams.get("liquidacion")

  const shocksParseados = parsearShocks(searchParams.get("shocks"))
  if ("error" in shocksParseados) {
    return NextResponse.json({ error: shocksParseados.error }, { status: 400 })
  }

  if (!ticker) {
    return NextResponse.json({ error: "Falta ?ticker" }, { status: 400 })
  }
  if (modo !== "precio" && modo !== "tir") {
    return NextResponse.json({ error: "?modo debe ser 'precio' o 'tir'" }, { status: 400 })
  }
  const valorTexto = valorParam?.trim() ?? ""
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valorTexto)) {
    return NextResponse.json({ error: "?valor debe ser un número decimal" }, { status: 400 })
  }
  const valor = Number(valorTexto)
  if (!Number.isFinite(valor)) {
    return NextResponse.json({ error: "?valor debe ser un número finito" }, { status: 400 })
  }
  if (modo === "precio" && valor <= 0) {
    return NextResponse.json({ error: "El precio debe ser positivo" }, { status: 400 })
  }
  if (modo === "tir" && (valor <= -100 || valor > 1000)) {
    return NextResponse.json({ error: "La TIR debe ser mayor a -100% y menor o igual a 1000%" }, { status: 400 })
  }

  const esquema = ESQUEMAS.find((e) => e.ticker === ticker)
  if (!esquema) {
    return NextResponse.json(
      {
        error: "Este bono todavía no tiene esquema de cashflows verificado contra el prospecto",
        ticker,
        disponibles: ESQUEMAS.map((e) => e.ticker),
      },
      { status: 404 },
    )
  }

  const liquidacionISO = liquidacionParam ?? todayInBuenosAires()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(liquidacionISO)) {
    return NextResponse.json({ error: "?liquidacion debe tener formato YYYY-MM-DD" }, { status: 400 })
  }
  const liquidacionBase = fechaUTC(liquidacionISO)
  if (!Number.isFinite(liquidacionBase.getTime()) || liquidacionBase.toISOString().slice(0, 10) !== liquidacionISO) {
    return NextResponse.json({ error: "?liquidacion no es una fecha válida" }, { status: 400 })
  }
  // La liquidación es una fecha de valuación explícita. No se corrige con el
  // calendario de pagos, que a partir de 2026 sólo cubre fechas de cupones.
  const liquidacion = liquidacionBase
  const emision = fechaUTC(esquema.emision)
  const vencimiento = fechaUTC(esquema.vencimiento)
  if (liquidacion < emision || liquidacion >= vencimiento) {
    return NextResponse.json(
      { error: `?liquidacion debe estar entre ${esquema.emision} y antes de ${esquema.vencimiento}` },
      { status: 422 },
    )
  }

  const cashflows = construirCashflows(esquema)

  const metricas =
    modo === "tir"
      ? metricasDesdeTIR(valor, cashflows, liquidacion)
      : calcularMetricas(valor + calcularInteresesCorridos(cashflows, liquidacion), cashflows, liquidacion)
  // En modo "precio" tratamos el valor de entrada como precio CLEAN (igual
  // convención que /api/bonos con las cotizaciones de mercado) y sumamos los
  // intereses corridos para llegar al precio dirty que espera calcularMetricas.

  if (!metricas) {
    return NextResponse.json(
      { error: "No se pudo calcular con esos parámetros (fecha de liquidación fuera de rango del bono, etc.)" },
      { status: 422 },
    )
  }

  // Los escenarios parten SIEMPRE de la TIR resultante, venga de donde venga el
  // dato de entrada. Así la tabla significa lo mismo en los dos modos: cuánto se
  // mueve el precio desde el punto en el que quedó parado el usuario.
  const escenarios = escenariosDeTasa(cashflows, liquidacion, metricas.tir, shocksParseados.shocks)

  return NextResponse.json({
    ticker,
    modo,
    valorIngresado: valor,
    liquidacion: liquidacion.toISOString().slice(0, 10),
    metricas,
    escenarios: escenarios ?? [],
    flujosFuturos: cashflows
      .filter((cf) => cf.fechaDevengamiento > liquidacion)
      .map((cf) => ({
        fecha: cf.fechaPago.toISOString().slice(0, 10),
        cupon: cf.cupon,
        amortizacion: cf.amortizacion,
        total: cf.cupon + cf.amortizacion,
      })),
    shocksBp: shocksParseados.shocks,
    nota: "Simulación: no usa precio de mercado en vivo. Solo tickers con esquema verificado (ver /api/bonos para el resto). Los escenarios reprecian el flujo completo con la tasa nueva; variacionAproximada es la regla de duration + convexity, que se muestra al lado para ver dónde deja de servir.",
  })
}
