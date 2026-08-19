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
 * prospecto (ver ESQUEMAS en bond-schedule.ts — hoy GD30 y AL30). Para el
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
import { diasEntre, esCeroCupon, precioDadaTasaReal, tasaRealCeroCupon } from "@/lib/cer-math"
import { fetchRavaBondPrices } from "@/server/external/rava-prices"
import { PESO_BOND_TICKERS } from "@/server/domain/peso-bonds"

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

  // ── Instrumentos en pesos ajustados por CER ───────────────────────────────
  // Van por otro camino a propósito: a un bono CER no se le puede calcular una
  // TIR nominal, así que devolver el mismo shape que un global sería mentir con
  // el nombre de un campo. Ver src/lib/cer-math.ts.
  if ((PESO_BOND_TICKERS as readonly string[]).includes(ticker)) {
    return responderCER(ticker, valor, modo, searchParams)
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

/** Escalera de movimientos de tasa real que se simula por defecto, en bp. */
const SHOCKS_CER = [-300, -200, -100, -50, 50, 100, 200, 300]

/**
 * Calculadora de los instrumentos ajustados por CER.
 *
 * Contesta la pregunta que corresponde a este papel —"a qué tasa REAL lo estoy
 * comprando", o sea CER + cuánto— en vez de una TIR nominal, que para un bono
 * CER no existe sin proyectar inflación.
 *
 * El valor técnico es el capital ya ajustado por CER. Sale de la fuente de
 * precios, pero se puede pisar con ?valorTecnico= para calcular contra el
 * número que el usuario tenga en pantalla, sin depender de que la fuente esté
 * al día. Es el mismo criterio del M6.3 del ROADMAP.
 */
async function responderCER(
  ticker: string,
  valor: number,
  modo: "precio" | "tir",
  searchParams: URLSearchParams,
) {
  const precios = await fetchRavaBondPrices()
  const fila = precios.get(ticker)

  if (!esCeroCupon(ticker, fila?.nombre ?? null)) {
    // Los duales son un caso aparte y peor: además de tener cupones, pagan el
    // MÁXIMO entre CER y TAMAR. Eso es una opcionalidad, y ninguna tasa única
    // —ni real ni nominal— describe bien lo que se está comprando.
    const esDual = /dual/i.test(fila?.nombre ?? "") || ticker.toUpperCase().startsWith("TXM")
    return NextResponse.json(
      {
        error: esDual
          ? "Los duales CER/TAMAR no se valúan con una sola tasa: pagan el máximo entre dos, y eso es una opción."
          : "Este instrumento CER paga cupones, y para eso hace falta el cronograma verificado contra el prospecto. Todavía no está cargado.",
        ticker,
        nombre: fila?.nombre ?? null,
        porQue: esDual
          ? "Valuarlo como si fuera CER puro ignora la pata TAMAR, y como si fuera tasa fija ignora el ajuste. Cualquiera de los dos números daría de menos."
          : "La fórmula de cero cupón ignoraría los cupones intermedios y devolvería un rendimiento más bajo que el real. Preferimos no contestar antes que contestar de menos.",
      },
      { status: 501 },
    )
  }

  // Valor técnico: el del mercado, o el que pase el usuario.
  const vtParam = searchParams.get("valorTecnico")?.trim()
  let valorTecnico: number | null = fila?.valorTecnico ?? null
  let fuenteVT = "Rava (valor técnico publicado)"
  if (vtParam) {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(vtParam) || Number(vtParam) <= 0) {
      return NextResponse.json({ error: "?valorTecnico debe ser un número positivo" }, { status: 400 })
    }
    valorTecnico = Number(vtParam)
    fuenteVT = "ingresado a mano"
  }
  if (!valorTecnico) {
    return NextResponse.json(
      {
        error: "No tengo el valor técnico de este instrumento y sin eso no hay tasa real.",
        ticker,
        comoResolverlo: "Pasalo con ?valorTecnico=<número>, que es el capital ajustado por CER.",
      },
      { status: 422 },
    )
  }

  const vencimientoISO = searchParams.get("vencimiento")?.trim() || fila?.vencimiento?.slice(0, 10)
  if (!vencimientoISO || !/^\d{4}-\d{2}-\d{2}$/.test(vencimientoISO)) {
    return NextResponse.json(
      { error: "No tengo la fecha de vencimiento. Pasala con ?vencimiento=YYYY-MM-DD." },
      { status: 422 },
    )
  }

  const liquidacionISO = searchParams.get("liquidacion") ?? todayInBuenosAires()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(liquidacionISO)) {
    return NextResponse.json({ error: "?liquidacion debe tener formato YYYY-MM-DD" }, { status: 400 })
  }

  const dias = diasEntre(fechaUTC(liquidacionISO), fechaUTC(vencimientoISO))
  if (dias <= 0) {
    return NextResponse.json(
      { error: `${ticker} vence el ${vencimientoISO}: a esa liquidación ya no tiene rendimiento, tiene un cobro.` },
      { status: 422 },
    )
  }

  // En modo "tir" el número que entra es la tasa REAL objetivo, no una TIR.
  const precio = modo === "precio" ? valor : precioDadaTasaReal(valor, valorTecnico, dias)
  if (precio === null) {
    return NextResponse.json({ error: "No se pudo calcular un precio con esa tasa real" }, { status: 422 })
  }

  const metricas = tasaRealCeroCupon(precio, valorTecnico, dias)
  if (metricas === null) {
    return NextResponse.json({ error: "No se pudo calcular con esos parámetros" }, { status: 422 })
  }

  const escenarios = SHOCKS_CER.flatMap((shockBp) => {
    const tasaNueva = metricas.tasaReal + shockBp / 100
    const precioNuevo = precioDadaTasaReal(tasaNueva, valorTecnico, dias)
    if (precioNuevo === null) return []
    return [{
      shockBp,
      tasaReal: tasaNueva,
      precio: precioNuevo,
      variacion: (precioNuevo / precio - 1) * 100,
    }]
  })

  return NextResponse.json({
    ticker,
    nombre: fila?.nombre ?? null,
    tipo: "cer_cero_cupon",
    modo,
    valorIngresado: valor,
    liquidacion: liquidacionISO,
    vencimiento: vencimientoISO,
    dias,
    valorTecnico,
    fuenteValorTecnico: fuenteVT,
    metricas: {
      tasaReal: metricas.tasaReal,
      paridad: metricas.paridad,
      precio,
    },
    escenarios,
    nota:
      "Rendimiento REAL, sobre CER: se lee como \"CER + X%\". Un bono ajustado por CER no tiene TIR nominal, " +
      "porque el flujo futuro depende de la inflación. La cuenta no necesita el CER base: se cancela entre el " +
      "precio y el valor técnico, que están los dos ajustados al mismo día.",
  })
}
