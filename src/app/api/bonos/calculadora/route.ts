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
 *
 * Solo soporta tickers con esquema de cashflows verificado contra el
 * prospecto (ver ESQUEMAS en bond-schedule.ts — hoy sólo GD30). Para el
 * resto devuelve 404 explícito en vez de un cálculo legado sin validar,
 * mismo criterio de honestidad que ya usa /api/bonos con "dataQuality".
 */

import { NextRequest, NextResponse } from "next/server"
import { ESQUEMAS, construirCashflows } from "@/lib/bond-schedule"
import { todayInBuenosAires } from "@/lib/calendar-events"
import {
  calcularMetricas,
  interesesCorridos as calcularInteresesCorridos,
  metricasDesdeTIR,
} from "@/lib/bond-math"
import { fechaUTC } from "@/lib/market-calendar"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get("ticker")?.trim().toUpperCase() ?? ""
  const modo = searchParams.get("modo")
  const valorParam = searchParams.get("valor")
  const liquidacionParam = searchParams.get("liquidacion")

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

  return NextResponse.json({
    ticker,
    modo,
    valorIngresado: valor,
    liquidacion: liquidacion.toISOString().slice(0, 10),
    metricas,
    flujosFuturos: cashflows
      .filter((cf) => cf.fechaDevengamiento > liquidacion)
      .map((cf) => ({
        fecha: cf.fechaPago.toISOString().slice(0, 10),
        cupon: cf.cupon,
        amortizacion: cf.amortizacion,
        total: cf.cupon + cf.amortizacion,
      })),
    nota: "Simulación: no usa precio de mercado en vivo. Solo tickers con esquema verificado (ver /api/bonos para el resto).",
  })
}
