// Comando: `lapizarra bcra`
// Muestra un resumen del estado del BCRA: reservas brutas y netas, tasa
// de política monetaria (TPM) y base monetaria.

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
import type { SeriePunto } from "../types.js";

interface BcraReservasResp {
  data: {
    ultima: {
      brutas: number | null;
      netas: number | null;
      fecha: string | null;
      fecha_netas: string | null;
      var_semanal_brutas: number | null;
    };
  };
  updated_at: string;
  source: string;
}

interface BcraTasasResp {
  data: Record<string, SeriePunto[]>;
  updated_at: string;
  source: string;
}

interface BcraAgregadosResp {
  data: Record<string, SeriePunto[]>;
  updated_at: string;
  source: string;
}

function ultimoValor(serie: SeriePunto[] | undefined): SeriePunto | null {
  if (!serie || serie.length === 0) return null;
  // La API los devuelve ordenados asc, pero por las dudas.
  return [...serie].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1) ?? null;
}

export async function runBcra(format: OutputFormat): Promise<void> {
  try {
    // Consultamos los tres endpoints en paralelo — el timeout ya está por request.
    const [reservas, tasas, agregados] = await Promise.all([
      apiGet<BcraReservasResp>("/api/bcra", { endpoint: "reservas" }),
      apiGet<BcraTasasResp>("/api/bcra", { endpoint: "tasas" }),
      apiGet<BcraAgregadosResp>("/api/bcra", { endpoint: "agregados" }),
    ]);

    const ultReservas = reservas.data.ultima;
    // La TPM real vive dentro de `plazofijo`, pero `tasas` trae tamar y badlar
    // que son las que más publica el BCRA. Buscamos ambas.
    const tamar = ultimoValor(tasas.data.tamar);
    const badlar = ultimoValor(tasas.data.badlar);
    const base = ultimoValor(agregados.data.base);

    render(format, {
      pretty: () => {
        printHeader("BCRA · Snapshot");
        const table = makeTable({
          head: ["Indicador", "Valor", "Unidad", "Fecha"],
          colAligns: ["left", "right", "left", "left"],
        });
        table.push([
          "Reservas brutas",
          fmtNum(ultReservas.brutas, { decimals: 0 }),
          "M USD",
          ultReservas.fecha ?? "—",
        ]);
        table.push([
          "Reservas netas",
          fmtNum(ultReservas.netas, { decimals: 0 }),
          "M USD",
          ultReservas.fecha_netas ?? "—",
        ]);
        table.push([
          "Var. semanal brutas",
          fmtNum(ultReservas.var_semanal_brutas, { decimals: 0 }),
          "M USD",
          ultReservas.fecha ?? "—",
        ]);
        table.push([
          "TAMAR (bancos privados)",
          fmtNum(tamar?.valor, { decimals: 2 }),
          "% TNA",
          tamar?.fecha ?? "—",
        ]);
        table.push([
          "BADLAR (bancos privados)",
          fmtNum(badlar?.valor, { decimals: 2 }),
          "% TNA",
          badlar?.fecha ?? "—",
        ]);
        table.push([
          "Base monetaria",
          fmtNum(base?.valor, { decimals: 0 }),
          "M ARS",
          base?.fecha ?? "—",
        ]);
        console.log(table.toString());
        printFooter("BCRA API v4.0", reservas.updated_at);
      },
      json: () => ({
        reservas: ultReservas,
        tasas: { tamar, badlar },
        agregados: { base_monetaria: base },
        updated_at: reservas.updated_at,
      }),
      csv: () => [
        {
          indicador: "reservas_brutas",
          valor: ultReservas.brutas ?? "",
          unidad: "M_USD",
          fecha: ultReservas.fecha ?? "",
        },
        {
          indicador: "reservas_netas",
          valor: ultReservas.netas ?? "",
          unidad: "M_USD",
          fecha: ultReservas.fecha_netas ?? "",
        },
        {
          indicador: "tamar_tna",
          valor: tamar?.valor ?? "",
          unidad: "pct",
          fecha: tamar?.fecha ?? "",
        },
        {
          indicador: "badlar_tna",
          valor: badlar?.valor ?? "",
          unidad: "pct",
          fecha: badlar?.fecha ?? "",
        },
        {
          indicador: "base_monetaria",
          valor: base?.valor ?? "",
          unidad: "M_ARS",
          fecha: base?.fecha ?? "",
        },
      ],
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
