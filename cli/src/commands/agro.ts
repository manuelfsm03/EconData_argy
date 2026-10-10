// Comando: `lapizarra agro`
// Precios locales de granos (pizarra Rosario) — soja, maíz, trigo, girasol.

import type { OutputFormat } from "../lib/config.js";
import { apiGet } from "../lib/api.js";
import {
  fmtNum,
  handleApiError,
  makeTable,
  printFooter,
  printHeader,
  render,
} from "../lib/format.js";
import type { AgroGrano, AgroLocalResponse } from "../types.js";

const GRANOS: Array<keyof Omit<AgroLocalResponse, "updated_at" | "source">> = [
  "soja",
  "maiz",
  "trigo",
  "girasol",
];

const NOMBRE: Record<string, string> = {
  soja: "Soja",
  maiz: "Maíz",
  trigo: "Trigo",
  girasol: "Girasol",
};

export async function runAgro(format: OutputFormat): Promise<void> {
  try {
    const resp = await apiGet<AgroLocalResponse>("/api/agro-local");

    render(format, {
      pretty: () => {
        printHeader("Agro · Pizarra Rosario (USD/tn)");
        const table = makeTable({
          head: ["Grano", "Disponible", "FOB estimado", "Retención"],
          colAligns: ["left", "right", "right", "right"],
        });
        for (const g of GRANOS) {
          const d = resp[g] as AgroGrano;
          if (!d) continue;
          table.push([
            NOMBRE[g],
            fmtNum(d.disponible, { decimals: 2 }),
            fmtNum(d.fobOficial, { decimals: 2 }),
            `${fmtNum(d.retencion, { decimals: 1 })}%`,
          ]);
        }
        console.log(table.toString());
        printFooter(resp.source, resp.updated_at);
      },
      json: () => resp,
      csv: () =>
        GRANOS.map((g) => {
          const d = resp[g] as AgroGrano;
          return {
            grano: g,
            disponible_usd_tn: d?.disponible ?? "",
            fob_estimado_usd_tn: d?.fobOficial ?? "",
            retencion_pct: d?.retencion ?? "",
          };
        }),
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
