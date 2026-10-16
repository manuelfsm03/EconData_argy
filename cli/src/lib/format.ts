// Helpers de formateo: colores, tablas, %, fechas y salida CSV/JSON.
// Diseñado para que las vistas "pretty" queden coherentes entre comandos.

import chalk from "chalk";
import Table from "cli-table3";
import type { OutputFormat } from "./config.js";
import { ApiError } from "./api.js";

// ── Números y % ──────────────────────────────────────────────────────────────

export function fmtNum(
  n: number | null | undefined,
  { decimals = 2, thousandSep = ".", decimalSep = "," }: { decimals?: number; thousandSep?: string; decimalSep?: string } = {}
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return decPart ? `${withSep}${decimalSep}${decPart}` : withSep;
}

// Formatea un porcentaje con signo y colores (verde positivo, rojo negativo).
export function fmtPct(
  n: number | null | undefined,
  { decimals = 2, colored = true, arrow = false, alreadyPct = true }: { decimals?: number; colored?: boolean; arrow?: boolean; alreadyPct?: boolean } = {}
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const val = alreadyPct ? n : n * 100;
  const sign = val > 0 ? "+" : "";
  const body = `${sign}${val.toFixed(decimals)}%`;
  const suffix = arrow ? (val > 0 ? " ↑" : val < 0 ? " ↓" : "") : "";
  const text = body + suffix;
  if (!colored) return text;
  if (val > 0) return chalk.green(text);
  if (val < 0) return chalk.red(text);
  return chalk.yellow(text);
}

// ── Fechas ────────────────────────────────────────────────────────────────────

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtHace(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const dias = Math.round(hr / 24);
  return `hace ${dias} d`;
}

// ── Header con logo ASCII ─────────────────────────────────────────────────────

export function printHeader(subtitulo?: string): void {
  const logo = chalk.hex("#EAB308").bold("La Pizarra");
  const dot = chalk.gray("·");
  const sub = subtitulo ? ` ${dot} ${chalk.gray(subtitulo)}` : "";
  console.log(`\n${logo}${sub}`);
}

export function printFooter(fuente?: string | null, actualizacion?: string | null): void {
  const partes: string[] = [];
  if (actualizacion) partes.push(`Actualizado ${fmtHace(actualizacion)}`);
  if (fuente) partes.push(fuente);
  partes.push("lapizarra.ar");
  console.log(chalk.gray(partes.join(" · ")));
  console.log();
}

// ── Tablas ────────────────────────────────────────────────────────────────────

export type ColAlign = "left" | "center" | "right";

export interface TablaOpts {
  head: string[];
  colAligns?: ColAlign[];
}

export function makeTable(opts: TablaOpts): Table.Table {
  return new Table({
    head: opts.head.map((h) => chalk.bold.hex("#EAB308")(h)),
    colAligns: opts.colAligns,
    style: {
      head: [],
      border: ["gray"],
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });
}

// ── CSV ────────────────────────────────────────────────────────────────────────

// Serializa una lista de objetos a CSV. Usa las claves del primer objeto
// como header. Escapa comas y comillas cuando hace falta.
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

// ── Emisor genérico según el formato ─────────────────────────────────────────

// Cada comando construye 3 vistas y llama a este helper:
//   render(format, {
//     pretty: () => imprimir tabla,
//     json:   () => cualquier objeto/array serializable,
//     csv:    () => filas para CSV,
//   })
// Así centralizamos el fallback de mensajes de error y el JSON.stringify.
export function render(
  format: OutputFormat,
  vistas: {
    pretty: () => void;
    json: () => unknown;
    csv: () => Array<Record<string, unknown>>;
  }
): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(vistas.json(), null, 2) + "\n");
    return;
  }
  if (format === "csv") {
    process.stdout.write(toCsv(vistas.csv()) + "\n");
    return;
  }
  vistas.pretty();
}

// Mensaje amable cuando la API no responde, respetando el formato pedido.
export function handleApiError(err: unknown, format: OutputFormat): void {
  const msg =
    err instanceof ApiError
      ? err.message
      : err instanceof Error
      ? err.message
      : String(err);

  if (format === "json") {
    process.stdout.write(
      JSON.stringify({ error: msg, hint: "Reintentá en un momento." }, null, 2) + "\n"
    );
    process.exitCode = 1;
    return;
  }
  console.error(
    chalk.yellow(
      `⚠ La Pizarra API no respondió. Reintentá en un momento o chequeá lapizarra.ar`
    )
  );
  console.error(chalk.gray(`  Detalle: ${msg}`));
  process.exitCode = 1;
}
