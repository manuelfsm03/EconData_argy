// Comando: `lapizarra coyuntura`
// Últimas noticias del feed de La Pizarra. Intenta primero /api/news
// (feed principal en DB) y cae a /api/rss-news si aquel devuelve vacío.

import chalk from "chalk";
import type { OutputFormat } from "../lib/config.js";
import { apiGet, ApiError } from "../lib/api.js";
import {
  fmtHace,
  handleApiError,
  printFooter,
  printHeader,
  render,
} from "../lib/format.js";
import type { NewsItem } from "../types.js";

const LIMITE_DEFAULT = 5;

async function fetchNoticias(limit: number): Promise<NewsItem[]> {
  try {
    const primary = await apiGet<NewsItem[]>("/api/news", { limit });
    if (Array.isArray(primary) && primary.length > 0) return primary;
  } catch (err) {
    // Si es 404/500 probamos el RSS. Otros errores (timeout) también.
    if (!(err instanceof ApiError)) throw err;
  }
  const rss = await apiGet<NewsItem[]>("/api/rss-news");
  return Array.isArray(rss) ? rss.slice(0, limit) : [];
}

export async function runCoyuntura(
  format: OutputFormat,
  opciones: { limit?: number } = {}
): Promise<void> {
  const limit = opciones.limit ?? LIMITE_DEFAULT;
  try {
    const noticias = await fetchNoticias(limit);
    if (noticias.length === 0) {
      handleApiError(new Error("No hay noticias disponibles."), format);
      return;
    }

    render(format, {
      pretty: () => {
        printHeader(`Coyuntura · últimas ${noticias.length} noticias`);
        for (const [i, n] of noticias.entries()) {
          const num = chalk.hex("#EAB308").bold(`${i + 1}.`);
          console.log(`${num} ${chalk.bold(n.title)}`);
          const meta: string[] = [];
          if (n.source) meta.push(n.source);
          if (n.pubDate) meta.push(fmtHace(n.pubDate));
          if (n.category) meta.push(n.category);
          if (meta.length > 0) console.log(chalk.gray(`   ${meta.join(" · ")}`));
          if (n.link) console.log(chalk.cyan(`   ${n.link}`));
          console.log();
        }
        printFooter("Feeds La Pizarra", noticias[0]?.pubDate);
      },
      json: () => noticias,
      csv: () =>
        noticias.map((n) => ({
          title: n.title,
          source: n.source ?? "",
          pub_date: n.pubDate ?? "",
          category: n.category ?? "",
          link: n.link,
        })),
    });
  } catch (err) {
    handleApiError(err, format);
  }
}
