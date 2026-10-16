// Comando: `lapizarra watch <recurso> [--interval=30]`
// Refresca en loop un recurso "vivo" (dolar, bonos, riesgo) limpiando la
// terminal en cada tick. Ctrl+C sale limpio.

import chalk from "chalk";
import type { OutputFormat } from "../lib/config.js";
import { runDolar } from "./dolar.js";
import { runBonos } from "./bonos.js";
import { runRiesgo } from "./riesgo.js";

const RECURSOS_VALIDOS = new Set(["dolar", "bonos", "riesgo"]);

async function ejecutar(recurso: string, format: OutputFormat): Promise<void> {
  if (recurso === "dolar") return runDolar(undefined, format);
  if (recurso === "bonos") return runBonos(undefined, format);
  if (recurso === "riesgo") return runRiesgo(format);
}

export async function runWatch(
  recurso: string,
  format: OutputFormat,
  opciones: { interval?: number } = {}
): Promise<void> {
  if (!RECURSOS_VALIDOS.has(recurso)) {
    console.error(
      chalk.red(
        `watch solo funciona con datos vivos: ${[...RECURSOS_VALIDOS].join(", ")}`
      )
    );
    process.exitCode = 1;
    return;
  }

  const interval = Math.max(5, Math.floor(opciones.interval ?? 30));
  let running = true;

  // Salida limpia con Ctrl+C.
  process.on("SIGINT", () => {
    running = false;
    console.log(chalk.gray("\n\nDetenido por el usuario. ¡Hasta la próxima!"));
    process.exit(0);
  });

  while (running) {
    // Limpia la pantalla y mueve el cursor arriba a la izquierda.
    process.stdout.write("\x1B[2J\x1B[H");
    console.log(
      chalk.gray(
        `[watch ${recurso} · refresco cada ${interval}s · Ctrl+C para salir]`
      )
    );
    try {
      await ejecutar(recurso, format);
    } catch (err) {
      console.error(
        chalk.yellow(
          `⚠ Tick falló: ${(err as Error).message}. Sigo intentando…`
        )
      );
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}
