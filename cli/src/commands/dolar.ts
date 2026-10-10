// Comando: `lapizarra dolar [variedad]`
// Muestra todas las cotizaciones del dólar (blue, MEP, CCL, oficial,
// mayorista, cripto, tarjeta), sus variaciones vs. día anterior y la
// brecha vs. oficial. Con un argumento (`lapizarra dolar mep`) filtra
// a una sola variedad.

import chalk from "chalk";
import type { OutputFormat } from "../lib/config.js";
import { apiGet } from "../lib/api.js";
import {
  fmtNum,
  fmtPct,
  handleApiError,
  makeTable,
  printFooter,
  printHeader,
  render,
} from "../lib/format.js";
import type { DolaresResponse } from "../types.js";

// El backend usa `casa` como key ("blue", "bolsa" para MEP, "contadoconliqui"
// para CCL, etc). Este mapa acepta lo que un humano escribiría.
const ALIAS: Record<string, string> = {
  blue: "blue",
  oficial: "oficial",
  mayorista: "mayorista",
  cripto: "cripto",
  tarjeta: "tarjeta",
  solidario: "tarjeta",
  mep: "bolsa",
  bolsa: "bolsa",
  ccl: "contadoconliqui",
  contadoconliqui: "contadoconliqui",
};

const ORDEN_DEFAULT = [
  "blue",
  "bolsa", // MEP
  "contadoconliqui", // CCL
  "oficial",
  "mayorista",
  "cripto",
  "tarjeta",
];

export async function runDolar(
  variedad: string | undefined,
  format: OutputFormat
): Promise<void> {
  let data: DolaresResponse;
  try {
    data = await apiGet<DolaresResponse>("/api/dolares");
  } catch (err) {
    handleApiError(err, format);
    return;
  }

  const casa = variedad ? ALIAS[variedad.toLowerCase()] : undefined;
  if (variedad && !casa) {
    console.error(
      chalk.red(`Variedad desconocida: "${variedad}".`) +
        ` Probá una de: ${Object.keys(ALIAS).join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const casas = casa ? [casa] : ORDEN_DEFAULT.filter((k) => data.rates[k]);

  render(format, {
    pretty: () => {
      printHeader("Cotizaciones del dólar (ARS)");
      const table = makeTable({
        head: ["Variedad", "Compra", "Venta", "Var día"],
        colAligns: ["left", "right", "right", "right"],
      });
      for (const key of casas) {
        const r = data.rates[key];
        if (!r) continue;
        table.push([
          r.nombre,
          fmtNum(r.compra),
          fmtNum(r.venta),
          fmtPct(r.variacion, { arrow: true }),
        ]);
      }
      console.log(table.toString());
      if (!casa) {
        const s = data.spreads ?? {};
        const brechas: string[] = [];
        if (s.brechaBlueOficial != null)
          brechas.push(
            `Brecha blue/oficial: ${fmtPct(s.brechaBlueOficial, {
              colored: false,
            })}`
          );
        if (s.brechaCclOficial != null)
          brechas.push(
            `CCL/oficial: ${fmtPct(s.brechaCclOficial, { colored: false })}`
          );
        if (brechas.length > 0) console.log(chalk.gray(brechas.join(" · ")));
      }
      printFooter(data.source, data.as_of ?? data.timestamp);
    },
    json: () => {
      if (casa) return { casa, ...data.rates[casa] };
      return data;
    },
    csv: () =>
      casas.map((key) => {
        const r = data.rates[key];
        return {
          casa: key,
          nombre: r.nombre,
          compra: r.compra,
          venta: r.venta,
          variacion_pct: r.variacion ?? "",
          actualizacion: r.actualizacion ?? "",
        };
      }),
  });
}
