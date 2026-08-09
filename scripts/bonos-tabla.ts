/**
 * Tabla de bonos soberanos: todo lo calculable a una fecha dada.
 *
 *   npx tsx scripts/bonos-tabla.ts            # a hoy
 *   npx tsx scripts/bonos-tabla.ts 2026-04-28 # a una fecha
 *
 * La tabla está partida en dos a propósito:
 *
 *   1. Métricas devengadas — salen del prospecto y la fecha. No necesitan
 *      precio de mercado, así que están disponibles para cualquier bono apenas
 *      se carga su esquema.
 *   2. Métricas de mercado — necesitan precio. Sólo aparecen para los tickers
 *      con precio cargado, y la tabla dice de dónde salió y qué antigüedad
 *      tiene. Mientras no haya fuente conectada, esta mitad va a estar casi
 *      vacía, y eso es correcto: es preferible a inventar precios.
 */

import { metricasDeMercado, metricasDevengadas } from "../src/lib/bond-math"
import { antiguedadEnDias, estaVigente, precioDe } from "../src/lib/bond-prices"
import { ESQUEMAS, construirCashflows, totalAmortizado, validarEsquema } from "../src/lib/bond-schedule"
import { aISO, fechaUTC, siguienteDiaHabil } from "../src/lib/market-calendar"

function fecha(valor: number, ancho: number): string {
  return valor.toFixed(2).padStart(ancho)
}

function main(): void {
  const arg = process.argv[2]
  const liquidacion = arg ? fechaUTC(arg) : siguienteDiaHabil(fechaUTC(aISO(new Date())))

  console.log(`\nBONOS SOBERANOS — liquidación ${aISO(liquidacion)}`)
  console.log(`${ESQUEMAS.length} bono(s) con esquema cargado\n`)

  console.log("1. MÉTRICAS DEVENGADAS  (no requieren precio de mercado)\n")
  console.log(
    "  ticker  ley    tasa%    VR    amort%   int.corr   V.Técnico   próx.pago    próx.flujo   renta12m   WAL   plazo",
  )
  console.log("  " + "-".repeat(115))

  for (const esquema of ESQUEMAS) {
    const cashflows = construirCashflows(esquema)
    const m = metricasDevengadas(cashflows, liquidacion)
    if (m === null) {
      console.log(`  ${esquema.ticker.padEnd(7)} sin flujos futuros (vencido)`)
      continue
    }
    console.log(
      `  ${esquema.ticker.padEnd(7)} ${esquema.ley.padEnd(6)}` +
        `${(m.tasaVigente * 100).toFixed(3).padStart(6)}` +
        `${fecha(m.valorResidual, 7)}` +
        `${fecha(m.amortizado, 8)}` +
        `${m.interesesCorridos.toFixed(4).padStart(11)}` +
        `${fecha(m.valorTecnico, 12)}` +
        `   ${aISO(m.proximoPago)}` +
        `${fecha(m.proximoFlujo, 13)}` +
        `${fecha(m.rentaProximos12m, 11)}` +
        `${fecha(m.vidaPromedio, 7)}` +
        `${fecha(m.plazoResidual, 7)}`,
    )
  }

  console.log("\n  VR = valor residual (capital sin amortizar, por cada 100 de VN original)")
  console.log("  WAL = vida promedio del capital, en años · plazo = años al último pago")

  console.log("\n\n2. MÉTRICAS DE MERCADO  (requieren precio)\n")

  const conPrecio = ESQUEMAS.filter((e) => precioDe(e.ticker) !== undefined)
  const sinPrecio = ESQUEMAS.filter((e) => precioDe(e.ticker) === undefined)

  if (conPrecio.length === 0) {
    console.log("  Ningún bono tiene precio cargado.")
  } else {
    console.log(
      "  ticker   precio   clean    TIR%   paridad%   dur.mod   convexity   c.yield%   fuente / antigüedad",
    )
    console.log("  " + "-".repeat(110))
    for (const esquema of conPrecio) {
      const precio = precioDe(esquema.ticker)!
      const cashflows = construirCashflows(esquema)
      const m = metricasDeMercado(precio.precioDirty, cashflows, liquidacion)
      if (m === null) {
        console.log(`  ${esquema.ticker.padEnd(8)} no calculable a esta fecha`)
        continue
      }
      const dias = antiguedadEnDias(precio, liquidacion)
      const sello = estaVigente(precio, liquidacion)
        ? `${precio.fuente}`
        : `${precio.fuente} — ${dias}d, FUENTE NO CONECTADA`
      console.log(
        `  ${esquema.ticker.padEnd(8)}${fecha(precio.precioDirty, 7)}${fecha(m.precioClean, 8)}` +
          `${fecha(m.tir, 8)}${fecha(m.paridad, 11)}${fecha(m.durationMod, 10)}` +
          `${fecha(m.convexity, 12)}${fecha(m.currentYield, 11)}   ${sello}`,
      )
    }
  }

  if (sinPrecio.length > 0) {
    console.log(`\n  Sin precio cargado: ${sinPrecio.map((e) => e.ticker).join(", ")}`)
    console.log("  Cargarlos en src/lib/bond-prices.ts, o conectar la fuente cuando se defina.")
  }

  console.log("\n\n3. INTEGRIDAD DE LOS ESQUEMAS\n")
  for (const esquema of ESQUEMAS) {
    const problemas = validarEsquema(esquema)
    const total = totalAmortizado(esquema)
    console.log(
      `  ${problemas.length === 0 ? "ok   " : "FALLA"} ${esquema.ticker.padEnd(7)}` +
        ` amortiza ${total.toFixed(3)}% del VN   fuente: ${esquema.fuente}`,
    )
    for (const problema of problemas) console.log(`         - ${problema}`)
  }

  const pendientes = ["AL29", "AL30", "AL35", "AL41", "GD29", "GD35", "GD41", "AE38"]
  console.log(
    `\n  Pendientes de esquema verificado: ${pendientes.join(", ")}.` +
      `\n  Los que hoy están en src/lib/bonds-data.ts tienen amortizaciones que no cierran` +
      `\n  en 100 y cupones cargados a mano; no se migran hasta tener prospecto o planilla.\n`,
  )
}

main()
