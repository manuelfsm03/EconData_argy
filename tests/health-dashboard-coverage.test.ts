import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/**
 * El tablero de /health existía pero una fuente SIN healthcheck configurado
 * (status "unprobed") no contaba ni como OK ni como caída en los KPIs de
 * arriba: desaparecía del resumen. Este test fija que quede su propia tile,
 * para que "68% de las fuentes sin chequear" no vuelva a pasar inadvertido.
 */
const dashboard = readFileSync("src/client/components/health/health-dashboard.tsx", "utf8")
const statusRoute = readFileSync("src/app/api/status/route.ts", "utf8")

test("hay una tile dedicada a fuentes sin sonda, no sólo OK/caídas", () => {
  assert.match(dashboard, /sourcesUnprobed\s*=\s*sources\.filter/)
  assert.match(dashboard, /row\.status === "unprobed"/)
  assert.match(dashboard, /label:\s*"Fuentes sin sonda"/)
})

test("el gate de parseo JSON del healthcheck mira el content-type real, no el `kind` declarado de la fuente", () => {
  // Antes: sólo parseaba el body si definition.kind === "json", así que un
  // endpoint de healthcheck que SÍ devuelve JSON (ej. magyp_siia, una API
  // CKAN) pero cuya fuente está declarada kind:"csv" (porque la descarga de
  // datos real es un CSV) nunca llegaba a leer su timestamp real.
  const start = statusRoute.indexOf("async function runHealthcheck")
  const end = statusRoute.indexOf("export async function GET")
  assert.ok(start >= 0 && end > start)
  const block = statusRoute.slice(start, end)
  assert.match(block, /content-type/i)
  assert.match(block, /looksJson/)
})
