import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  PESO_BOND_TICKERS,
  pesoBondsVencidos,
  pesoBondsVigentes,
  vencimientoDe,
} from "../src/server/domain/peso-bonds"

const bondRoute = readFileSync("src/app/api/bonos/route.ts", "utf8")

test("peso bond ticker list has no duplicates and is all uppercase", () => {
  const unique = new Set(PESO_BOND_TICKERS)
  assert.equal(unique.size, PESO_BOND_TICKERS.length)
  for (const ticker of PESO_BOND_TICKERS) {
    assert.equal(ticker, ticker.toUpperCase())
    assert.ok(ticker.length > 0)
  }
})

test("peso bond ticker list includes the CER/DUAL/LECER families and excludes provincial debt", () => {
  assert.ok(PESO_BOND_TICKERS.includes("TXMJ0"))
  assert.ok(PESO_BOND_TICKERS.includes("TX26"))
  assert.ok(PESO_BOND_TICKERS.includes("TZX26"))
  assert.ok(PESO_BOND_TICKERS.includes("X15Y6"))
  assert.ok(PESO_BOND_TICKERS.includes("DICP"))

  const provincial = ["CO3D7", "COD7", "PBA28", "PMA28"]
  for (const ticker of provincial) {
    assert.equal(PESO_BOND_TICKERS.includes(ticker as (typeof PESO_BOND_TICKERS)[number]), false)
  }
})

test("?tipo=pesos reuses the existing Rava bonds endpoint, no new external source", () => {
  assert.match(bondRoute, /tipoParam === "pesos"/)
  assert.match(bondRoute, /vigentes\.map/)
  // El branch de pesos tiene que resolver contra el mismo fetch cacheado que ya usan
  // los bonos hard-dollar, no pegarle a un dominio nuevo.
  const pesosBranch = bondRoute.slice(
    bondRoute.indexOf('tipoParam === "pesos"'),
    bondRoute.indexOf('tipoParam === "lecap"'),
  )
  assert.match(pesosBranch, /fetchRavaBondPrices\(\)/)
  assert.doesNotMatch(pesosBranch, /https?:\/\//)
})


// ── Vigencia ─────────────────────────────────────────────────────────────────

test("todo ticker del universo tiene un vencimiento con formato de fecha", () => {
  for (const ticker of PESO_BOND_TICKERS) {
    const vto = vencimientoDe(ticker)
    assert.ok(vto, `${ticker} sin vencimiento cargado`)
    assert.match(vto, /^\d{4}-\d{2}-\d{2}$/, `${ticker} tiene un vencimiento raro: ${vto}`)
    assert.ok(!Number.isNaN(Date.parse(vto)), `${ticker} tiene una fecha inválida: ${vto}`)
  }
})

test("un instrumento vencido no entra al panel", () => {
  /**
   * Este es el test que existe para que no se repita lo del 20/8/2026: cinco
   * papeles ya vencidos seguían en el screener con duration 0 y rendimientos
   * anualizados sin sentido, porque la lista había que podarla a mano.
   */
  const hoy = new Date("2026-08-20T12:00:00Z")
  const vigentes = pesoBondsVigentes(hoy).map((b) => b.ticker)

  for (const muerto of ["TZX26", "TZXM6", "X15Y6", "X29Y6", "X31L6"]) {
    assert.ok(!vigentes.includes(muerto), `${muerto} ya venció y sigue en la lista de vigentes`)
  }
  for (const vivo of ["TZX27", "TZX28", "X30N6", "TX31", "DICP"]) {
    assert.ok(vigentes.includes(vivo), `${vivo} está vivo y se cayó de la lista`)
  }
})

test("vigentes y vencidos parten el universo sin perder ni duplicar nada", () => {
  const hoy = new Date("2026-08-20T12:00:00Z")
  const vigentes = pesoBondsVigentes(hoy)
  const vencidos = pesoBondsVencidos(hoy)
  assert.equal(vigentes.length + vencidos.length, PESO_BOND_TICKERS.length)

  const juntos = new Set([...vigentes, ...vencidos].map((b) => b.ticker))
  assert.equal(juntos.size, PESO_BOND_TICKERS.length)
})

test("el corte se mueve con la fecha: el mismo bono entra y sale", () => {
  // X30S6 vence el 30/09/2026. Es el instrumento el que caduca, no la lista.
  const antes = pesoBondsVigentes(new Date("2026-09-29T12:00:00Z")).map((b) => b.ticker)
  const despues = pesoBondsVigentes(new Date("2026-10-01T12:00:00Z")).map((b) => b.ticker)
  assert.ok(antes.includes("X30S6"), "el día antes tiene que estar")
  assert.ok(!despues.includes("X30S6"), "el día después no")
})

test("el día del vencimiento el bono ya no cotiza", () => {
  const elDia = pesoBondsVigentes(new Date("2026-09-30T12:00:00Z")).map((b) => b.ticker)
  assert.ok(!elDia.includes("X30S6"), "el día del vencimiento se cobra, no se opera")
})

test("el universo entero sigue teniendo los 33 papeles, vencidos incluidos", () => {
  // Que un papel venza no lo borra de la historia: se saca del screener, pero
  // la calculadora tiene que poder decir "venció el tal día" en vez de un 404.
  assert.equal(PESO_BOND_TICKERS.length, 33)
  assert.ok(PESO_BOND_TICKERS.includes("TZX26"))
})
