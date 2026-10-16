#!/usr/bin/env node
// Entrypoint del bin `lapizarra`. Registra todos los sub-comandos y
// delega la lógica a los módulos en `src/commands/`.

import { Command } from "commander";
import { parseFormat, VERSION } from "./lib/config.js";
import { runDolar } from "./commands/dolar.js";
import { runBcra } from "./commands/bcra.js";
import { runIpc } from "./commands/ipc.js";
import { runBonos } from "./commands/bonos.js";
import { runRiesgo } from "./commands/riesgo.js";
import { runAgro } from "./commands/agro.js";
import { runCoyuntura } from "./commands/coyuntura.js";
import { runWatch } from "./commands/watch.js";

const program = new Command();

program
  .name("lapizarra")
  .description(
    "CLI de La Pizarra — datos macro y financieros argentinos en tu terminal.\n" +
      "Fuente: https://lapizarra.ar"
  )
  .version(VERSION, "-v, --version", "Mostrar versión")
  .option(
    "--format <fmt>",
    "Formato de salida: pretty | json | csv (default pretty)",
    "pretty"
  );

// ── dolar ────────────────────────────────────────────────────────────────────
program
  .command("dolar [variedad]")
  .description(
    "Cotizaciones del dólar (blue, MEP, CCL, oficial, mayorista). " +
      "Opcional: pasá una variedad (ej. `mep`, `blue`)."
  )
  .action(async (variedad: string | undefined) => {
    const format = parseFormat(program.opts().format);
    await runDolar(variedad, format);
  });

// ── bcra ──────────────────────────────────────────────────────────────────────
program
  .command("bcra")
  .description("Snapshot del BCRA: reservas brutas y netas, tasas, base monetaria.")
  .action(async () => {
    const format = parseFormat(program.opts().format);
    await runBcra(format);
  });

// ── ipc ───────────────────────────────────────────────────────────────────────
program
  .command("ipc")
  .description("Inflación mensual (INDEC) + últimos 12 meses (gráfico ASCII).")
  .action(async () => {
    const format = parseFormat(program.opts().format);
    await runIpc(format);
  });

// ── bonos ─────────────────────────────────────────────────────────────────────
program
  .command("bonos [ticker]")
  .description(
    "Screener de soberanos hard dollar con TIR / duration / precio. " +
      "Con ticker (ej. `bonos GD30`) muestra el detalle."
  )
  .action(async (ticker: string | undefined) => {
    const format = parseFormat(program.opts().format);
    await runBonos(ticker, format);
  });

// ── riesgo ────────────────────────────────────────────────────────────────────
program
  .command("riesgo")
  .description("Riesgo país AR (EMBI+) + comparativo regional + TIR de globales.")
  .action(async () => {
    const format = parseFormat(program.opts().format);
    await runRiesgo(format);
  });

// ── agro ──────────────────────────────────────────────────────────────────────
program
  .command("agro")
  .description("Pizarra Rosario: soja / maíz / trigo / girasol (USD/tn).")
  .action(async () => {
    const format = parseFormat(program.opts().format);
    await runAgro(format);
  });

// ── coyuntura ─────────────────────────────────────────────────────────────────
program
  .command("coyuntura")
  .description("Últimas noticias económicas del feed de La Pizarra.")
  .option("--limit <n>", "Cantidad de noticias (default 5)", (v) => parseInt(v, 10))
  .action(async (opts: { limit?: number }) => {
    const format = parseFormat(program.opts().format);
    await runCoyuntura(format, { limit: opts.limit });
  });

// ── watch ─────────────────────────────────────────────────────────────────────
program
  .command("watch <recurso>")
  .description(
    "Refresca en loop un recurso (dolar | bonos | riesgo). Ctrl+C para salir."
  )
  .option("--interval <segundos>", "Intervalo entre refrescos (default 30)", (v) =>
    parseInt(v, 10)
  )
  .action(async (recurso: string, opts: { interval?: number }) => {
    const format = parseFormat(program.opts().format);
    await runWatch(recurso, format, { interval: opts.interval });
  });

program.addHelpText(
  "after",
  `
Ejemplos:
  $ lapizarra dolar
  $ lapizarra dolar mep --format=json | jq
  $ lapizarra ipc
  $ lapizarra bonos GD30
  $ lapizarra riesgo --format=csv > riesgo.csv
  $ lapizarra watch dolar --interval=60

Config por env vars:
  LAPIZARRA_API_URL   Cambia el backend (default https://lapizarra.ar).
                      Ej.: LAPIZARRA_API_URL=http://localhost:3001

Docs & fuentes:      https://lapizarra.ar
`
);

// Ejecuta el CLI. Cualquier error inesperado sale con exit 1.
program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
