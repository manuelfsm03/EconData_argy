// Comando: `lapizarra riesgo`
// Riesgo país Argentina (EMBI+) + comparativo regional + TIR de globales.

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
import type { RiesgoPaisResponse } from "../types.js";

const NOMBRE_PAIS: Record<string, string> = {
  brasil: "Brasil",
  chile: "Chile",
  colombia: "Colombia",
  peru: "Perú",
  mexico: "México",
};

export async function runRiesgo(format: OutputFormat): Promise<void> {
  try {
    const resp = await apiGet<RiesgoPaisResponse>("/api/riesgo-pais");
    const actual = resp.data.actual;
    const regionales = resp.data.regionales;
    const globales = resp.data.globalesTir ?? [];

    render(format, {
      pretty: () => {
        printHeader("Riesgo País · Argentina (EMBI+)");
        const t1 = makeTable({
          head: ["Métrica", "Valor"],
          colAligns: ["left", "right"],
        });
        t1.push([
          "Riesgo país",
          `${fmtNum(actual.riesgoPaisBps, { decimals: 0 })} bps`,
        ]);
        t1.push(["Var. 1 semana", fmtPct(actual.var1w, { arrow: true })]);
        t1.push(["Var. 1 mes", fmtPct(actual.var1m, { arrow: true })]);
        t1.push([
          "Spread AR (TIR - US10Y)",
          `${fmtNum(actual.spreadAr, { decimals: 0 })} bps`,
        ]);
        t1.push([
          "US 10Y",
          `${fmtNum(actual.us10y, { decimals: 2 })}%`,
        ]);
        console.log(t1.toString());

        if (regionales && Object.keys(regionales).length > 0) {
          console.log();
          const t2 = makeTable({
            head: ["País", "Riesgo (bps)", "Nota"],
            colAligns: ["left", "right", "left"],
          });
          t2.push([
            "Argentina",
            fmtNum(actual.riesgoPaisBps, { decimals: 0 }),
            "en vivo",
          ]);
          // La API a veces incluye argentina también en `regionales` con el
          // mismo valor; lo filtramos para no duplicar la fila.
          for (const [k, v] of Object.entries(regionales)) {
            if (k.toLowerCase() === "argentina") continue;
            t2.push([
              NOMBRE_PAIS[k] ?? k,
              fmtNum(v.bps, { decimals: 0 }),
              v.nota,
            ]);
          }
          console.log(t2.toString());
        }

        if (globales.length > 0) {
          console.log();
          const t3 = makeTable({
            head: ["Global", "Precio", "TIR %", "Dur. mod."],
            colAligns: ["left", "right", "right", "right"],
          });
          for (const g of globales) {
            t3.push([
              g.ticker,
              fmtNum(g.precio),
              fmtNum(g.tir),
              fmtNum(g.durationMod),
            ]);
          }
          console.log(t3.toString());
        }

        printFooter(resp.source, resp.updated_at);
      },
      json: () => resp.data,
      csv: () => [
        {
          indicador: "riesgo_pais_bps",
          valor: actual.riesgoPaisBps ?? "",
          var_1w_pct: actual.var1w ?? "",
          var_1m_pct: actual.var1m ?? "",
          spread_ar_bps: actual.spreadAr ?? "",
          us10y_pct: actual.us10y ?? "",
        },
        ...Object.entries(regionales ?? {}).map(([k, v]) => ({
          indicador: `riesgo_${k}_bps`,
          valor: v.bps,
          var_1w_pct: "",
          var_1m_pct: "",
          spread_ar_bps: "",
          us10y_pct: "",
        })),
      ],
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
