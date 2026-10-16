// Comando: `lapizarra ipc`
// Muestra la última inflación mensual + un mini-gráfico ASCII con los
// últimos 12 meses. Usa /api/inflation, que devuelve un array simple.

import chalk from "chalk";
import type { OutputFormat } from "../lib/config.js";
import { apiGet } from "../lib/api.js";
import {
  fmtFecha,
  fmtPct,
  handleApiError,
  makeTable,
  printFooter,
  printHeader,
  render,
} from "../lib/format.js";
import type { InflationPoint } from "../types.js";

// Normaliza una fila (algunos formatos usan `date/value`, otros `fecha/valor`).
function normalizar(p: InflationPoint): { fecha: string; valor: number } | null {
  const fecha = p.date ?? p.fecha ?? "";
  const valorRaw =
    p.monthlyChange ?? p.value ?? p.valor ?? p.yearlyChange ?? null;
  if (!fecha || valorRaw === null || valorRaw === undefined) return null;
  return { fecha, valor: Number(valorRaw) };
}

// Gráfico horizontal ASCII muy simple. Cada barra escala al máximo del set.
function graficoAscii(datos: Array<{ fecha: string; valor: number }>): string[] {
  if (datos.length === 0) return [];
  const anchoMax = 30;
  const max = Math.max(...datos.map((d) => Math.abs(d.valor)), 0.1);
  return datos.map((d) => {
    const len = Math.round((Math.abs(d.valor) / max) * anchoMax);
    const barra = "█".repeat(Math.max(1, len));
    const etiqueta = `${d.fecha.slice(0, 7)}  ${d.valor.toFixed(1)}%`.padEnd(18);
    return `  ${etiqueta} ${chalk.hex("#EAB308")(barra)}`;
  });
}

export async function runIpc(format: OutputFormat): Promise<void> {
  try {
    // Pedimos 24 para tener margen; graficamos 12.
    const raw = await apiGet<InflationPoint[]>("/api/inflation", { limit: 24 });
    const puntos = (Array.isArray(raw) ? raw : [])
      .map(normalizar)
      .filter((p): p is { fecha: string; valor: number } => p !== null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (puntos.length === 0) {
      handleApiError(
        new Error("La API devolvió inflación vacía."),
        format
      );
      return;
    }

    const ultimos12 = puntos.slice(-12);
    const ultimo = puntos.at(-1)!;
    // Acumulado 12 meses = (∏(1 + v/100) - 1) * 100.
    const acum12 =
      (ultimos12.reduce((acc, p) => acc * (1 + p.valor / 100), 1) - 1) * 100;

    render(format, {
      pretty: () => {
        printHeader("IPC · Inflación nacional (INDEC)");
        const table = makeTable({
          head: ["Métrica", "Valor", "Fecha"],
          colAligns: ["left", "right", "left"],
        });
        table.push(["Último mes", fmtPct(ultimo.valor), fmtFecha(ultimo.fecha)]);
        table.push([
          "Acumulado 12m",
          fmtPct(acum12),
          `hasta ${fmtFecha(ultimo.fecha)}`,
        ]);
        console.log(table.toString());
        console.log(chalk.gray("\nÚltimos 12 meses (variación mensual %):"));
        for (const linea of graficoAscii(ultimos12)) console.log(linea);
        printFooter("INDEC · argentinadatos.com", ultimo.fecha);
      },
      json: () => ({
        ultimo,
        acumulado_12m_pct: acum12,
        serie: ultimos12,
      }),
      csv: () =>
        ultimos12.map((p) => ({
          fecha: p.fecha,
          variacion_mensual_pct: p.valor,
        })),
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
