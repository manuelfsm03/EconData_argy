// Comando: `lapizarra bonos [ticker]`
// Sin argumento: screener de soberanos hard dollar con TIR, precio,
// duration y variación diaria. Con ticker: detalle de un solo bono.

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
import type { Bono } from "../types.js";

interface BonosResp {
  data: Bono | Bono[];
  count?: number;
  updated_at: string;
}

export async function runBonos(
  ticker: string | undefined,
  format: OutputFormat
): Promise<void> {
  try {
    const params = ticker ? { ticker: ticker.toUpperCase() } : undefined;
    const resp = await apiGet<BonosResp>("/api/bonos", params);
    const rows: Bono[] = Array.isArray(resp.data)
      ? resp.data
      : resp.data
      ? [resp.data]
      : [];

    if (rows.length === 0) {
      handleApiError(
        new Error(
          ticker
            ? `No encontré el bono ${ticker.toUpperCase()}.`
            : "La API no devolvió bonos."
        ),
        format
      );
      return;
    }

    render(format, {
      pretty: () => {
        printHeader(
          ticker
            ? `Bono soberano · ${ticker.toUpperCase()}`
            : "Bonos soberanos hard dollar"
        );
        if (ticker && rows.length === 1) {
          const b = rows[0];
          const table = makeTable({
            head: ["Campo", "Valor"],
            colAligns: ["left", "right"],
          });
          table.push(["Ticker", b.ticker]);
          if (b.nombre) table.push(["Nombre", b.nombre]);
          if (b.ley) table.push(["Ley", b.ley]);
          table.push(["Cupón (%)", fmtNum(b.cupon)]);
          table.push(["Vencimiento", b.vencimiento ?? "—"]);
          table.push(["Precio", fmtNum(b.precio)]);
          table.push(["TIR (%)", fmtNum(b.tir)]);
          table.push(["Duration mod.", fmtNum(b.durationMod)]);
          table.push(["Paridad (%)", fmtNum(b.paridad)]);
          table.push(["Current yield (%)", fmtNum(b.currentYield)]);
          table.push(["Var. día", fmtPct(b.change1D, { arrow: true })]);
          console.log(table.toString());
          printFooter(b.fuente ?? "BYMA Data", b.asOf ?? resp.updated_at);
          return;
        }
        const table = makeTable({
          head: ["Ticker", "Precio", "TIR %", "Dur.", "Var día"],
          colAligns: ["left", "right", "right", "right", "right"],
        });
        for (const b of rows) {
          table.push([
            b.ticker,
            fmtNum(b.precio),
            fmtNum(b.tir),
            fmtNum(b.durationMod),
            fmtPct(b.change1D, { arrow: true }),
          ]);
        }
        console.log(table.toString());
        printFooter("BYMA Data · motor La Pizarra", resp.updated_at);
      },
      json: () => (ticker && rows.length === 1 ? rows[0] : rows),
      csv: () =>
        rows.map((b) => ({
          ticker: b.ticker,
          ley: b.ley ?? "",
          cupon: b.cupon ?? "",
          vencimiento: b.vencimiento ?? "",
          precio: b.precio ?? "",
          tir_pct: b.tir ?? "",
          duration_mod: b.durationMod ?? "",
          paridad_pct: b.paridad ?? "",
          change_1d_pct: b.change1D ?? "",
          as_of: b.asOf ?? "",
        })),
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
