/**
 * Verifica el simulador de escenarios de tasa (M6.2 del ROADMAP) sobre los
 * bonos GLOBALES: GD29, GD30, GD35 y GD41.
 *
 *   npx tsx scripts/verify-escenarios.ts
 *
 * No hay una planilla de referencia para escenarios como la hay para las
 * métricas de un bono, así que acá no se comparan números contra celdas. Se
 * verifican las propiedades que TIENEN que valer si el reprecio está bien
 * hecho, que es una prueba más fuerte que copiar ocho valores a mano:
 *
 *   1. shock 0 devuelve exactamente el precio base;
 *   2. el reprecio es consistente con la TIR: si al precio nuevo le pedís la
 *      TIR, vuelve la tasa shockeada (ida y vuelta contra el solver);
 *   3. suben las tasas, baja el precio, sin excepción;
 *   4. la aproximación duration + convexity le pega bien en shocks chicos;
 *   5. y le erra más en los bonos largos que en los cortos, que es la razón
 *      económica por la que la tabla existe.
 *
 * Sigue el estilo de verify-bond-math.ts: es un script y no un test de runner,
 * porque el repo todavía no tiene uno unificado.
 */

import { escenariosDeTasa, flujosFuturos, precioDadoTIR, tir } from "../src/lib/bond-math"
import { ESQUEMAS, construirCashflows } from "../src/lib/bond-schedule"
import { fechaUTC } from "../src/lib/market-calendar"

const LIQUIDACION = fechaUTC("2026-08-17")

/** Los globales, que son la prioridad. Ley NY, canje 2020. */
const GLOBALES = ["GD29", "GD30", "GD35", "GD41"] as const

/** TIR de partida para la simulación. No es un precio de mercado: es un punto
 *  de referencia fijo, para que la verificación no dependa de la rueda. */
const TIR_BASE = 12

let fallas = 0

function chequear(nombre: string, ok: boolean, detalle: string): void {
  if (!ok) fallas += 1
  console.log(`  ${ok ? "ok   " : "FALLA"} ${nombre.padEnd(46)} ${detalle}`)
}

function esquemaDe(ticker: string) {
  const esquema = ESQUEMAS.find((e) => e.ticker === ticker)
  if (!esquema) throw new Error(`${ticker} no tiene esquema verificado en bond-schedule.ts`)
  return esquema
}

function main(): void {
  console.log(`\nEscenarios de tasa — globales, liquidación ${LIQUIDACION.toISOString().slice(0, 10)}`)
  console.log(`TIR base de referencia: ${TIR_BASE}%\n`)

  const erroresPorBono = new Map<string, number>()

  for (const ticker of GLOBALES) {
    console.log(`${ticker}`)
    const cashflows = construirCashflows(esquemaDe(ticker))
    const futuros = flujosFuturos(cashflows, LIQUIDACION)

    const conCero = escenariosDeTasa(cashflows, LIQUIDACION, TIR_BASE, [0])
    const escenarios = escenariosDeTasa(cashflows, LIQUIDACION, TIR_BASE)
    if (conCero === null || escenarios === null) {
      chequear("devuelve escenarios", false, "devolvió null")
      continue
    }

    // 1. El escenario neutro no mueve el precio.
    const base = conCero[0]
    chequear(
      "shock 0 no mueve el precio",
      Math.abs(base.variacionDirty) < 1e-9 && Math.abs(base.variacionClean) < 1e-9,
      `variación=${base.variacionDirty.toExponential(2)}%`,
    )

    // 2. Ida y vuelta contra el solver de TIR: el precio repreciado tiene que
    //    devolver exactamente la tasa con la que se lo calculó.
    let peorVuelta = 0
    for (const escenario of escenarios) {
      const devuelta = tir(escenario.precioDirty, futuros, LIQUIDACION)
      if (devuelta === null) {
        peorVuelta = Infinity
        break
      }
      peorVuelta = Math.max(peorVuelta, Math.abs(devuelta - escenario.tir))
    }
    chequear("el reprecio y la TIR cierran", peorVuelta < 1e-6, `peor delta=${peorVuelta.toExponential(2)} pp`)

    // 3. Monotonía: no existe un bono donde subir la tasa suba el precio.
    const ordenados = [...escenarios].sort((a, b) => a.shockBp - b.shockBp)
    const monotono = ordenados.every(
      (escenario, i) => i === 0 || escenario.precioDirty < ordenados[i - 1].precioDirty,
    )
    chequear("más tasa, menos precio", monotono, `${ordenados.length} escenarios`)

    // 4. En shocks chicos la regla de bolsillo tiene que servir.
    const chico = escenarios.find((e) => e.shockBp === 50)
    chequear(
      "duration + convexity sirve en 50 bp",
      chico !== undefined && Math.abs(chico.errorAproximacion) < 0.02,
      chico ? `error=${chico.errorAproximacion.toFixed(4)} pp` : "sin escenario de 50 bp",
    )

    // 5. Y en shocks grandes tiene que empezar a errarle.
    const grande = escenarios.find((e) => e.shockBp === 300)
    if (grande) {
      erroresPorBono.set(ticker, Math.abs(grande.errorAproximacion))
      console.log(
        `       300 bp: TIR ${grande.tir.toFixed(2)}%  clean ${grande.precioClean.toFixed(4)}` +
          `  exacto ${grande.variacionDirty.toFixed(3)}%  aprox ${grande.variacionAproximada.toFixed(3)}%` +
          `  error ${grande.errorAproximacion.toFixed(4)} pp`,
      )
    }

    // Coherencia con el resto del módulo: el precio del escenario tiene que ser
    // el mismo que da precioDadoTIR() llamado por afuera.
    const directo = precioDadoTIR(escenarios[0].tir, futuros, LIQUIDACION)
    chequear(
      "coincide con precioDadoTIR()",
      directo !== null && Math.abs(directo - escenarios[0].precioDirty) < 1e-9,
      `delta=${directo === null ? "null" : Math.abs(directo - escenarios[0].precioDirty).toExponential(2)}`,
    )
    console.log("")
  }

  // 6. El error de la aproximación crece con el plazo. Es la razón por la que
  //    mostrar exacto y aproximado al lado sirve para algo: en GD30 dan casi lo
  //    mismo, en GD41 no.
  const corto = erroresPorBono.get("GD30")
  const largo = erroresPorBono.get("GD41")
  chequear(
    "la aproximación erra más en el largo",
    corto !== undefined && largo !== undefined && largo > corto,
    `GD30=${corto?.toFixed(4)} pp  <  GD41=${largo?.toFixed(4)} pp`,
  )

  console.log(fallas === 0 ? "\nTodo OK\n" : `\n${fallas} verificaciones fallaron\n`)
  process.exit(fallas === 0 ? 0 : 1)
}

main()
