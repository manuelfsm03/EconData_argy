import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const panel = readFileSync("src/client/components/health/veracity-panel.tsx", "utf8")

test("el IPC mensual se multiplica x100 antes de evaluarlo — llega en proporción, no en %", () => {
  // /api/macro?endpoint=ipc entrega ipc_var_mensual como 0.0288 (no 2.88):
  // ver api/macro/route.ts. Sin el x100, un mes con inflación real del
  // 300% todavía "pasaría" como plausible (proporción 3.0 cae dentro de
  // [-5, 60]) — el chequeo sería casi inútil sin esta conversión.
  assert.match(panel, /ipcVarMensualRaw\s*\*\s*100/)
})

test("sólo evalúa IPC, EMAE, riesgo país y dólar — las métricas que llamó assessPlausibility", () => {
  // La exclusión de renta fija/bonos ya la fija data-plausibility.test.ts
  // contra el catálogo de reglas en sí; acá sólo se confirma que el panel
  // no invoca ninguna métrica fuera de esas cuatro.
  const metricas = [...panel.matchAll(/assessPlausibility\("([a-z_]+)"/g)].map((m) => m[1])
  assert.deepEqual(new Set(metricas), new Set(["ipc_var_mensual", "emae", "riesgo_pais_bps", "dolar_ars"]))
})

test("reutiliza endpoints públicos que ya existen, no pega a fuentes externas nuevas", () => {
  for (const path of ["/api/macro?endpoint=ipc", "/api/macro?endpoint=emae", "/api/riesgo-pais", "/api/dolares"]) {
    assert.match(panel, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.doesNotMatch(panel, /https?:\/\//)
})
