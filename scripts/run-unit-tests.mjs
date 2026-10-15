// Corre todos los tests/**/*.test.ts: un test nuevo entra a CI solo por existir.
// Se listan a mano porque Node 20 (el del CI) no acepta globs en --test.
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"

function listarTests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const ruta = join(dir, entry.name)
    if (entry.isDirectory()) return listarTests(ruta)
    return entry.name.endsWith(".test.ts") ? [ruta.split("\\").join("/")] : []
  })
}

const archivos = listarTests("tests").sort()
if (archivos.length === 0) {
  console.error("run-unit-tests: no se encontró ningún tests/**/*.test.ts")
  process.exit(1)
}

console.log(`run-unit-tests: ${archivos.length} archivos de test`)
const resultado = spawnSync("npx", ["tsx", "--test", ...archivos], {
  stdio: "inherit",
  shell: process.platform === "win32",
})
process.exit(resultado.status ?? 1)
