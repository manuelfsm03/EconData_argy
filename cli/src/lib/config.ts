// Configuración global del CLI de La Pizarra.
// Todos los valores se pueden overridear por variable de entorno.

export const VERSION = "0.1.0";

export const config = {
  // Base URL del backend de La Pizarra. Para dev local exportá:
  //   LAPIZARRA_API_URL=http://localhost:3001
  baseUrl: (process.env.LAPIZARRA_API_URL ?? "https://lapizarra.ar").replace(
    /\/+$/,
    ""
  ),
  // Timeout de cada request HTTP en milisegundos.
  timeoutMs: 10_000,
  // User-Agent que identifica al CLI cuando pega a la API.
  userAgent: `lapizarra-cli/${VERSION}`,
};

export type OutputFormat = "pretty" | "json" | "csv";

// Valida y normaliza el flag --format. Cae a "pretty" si viene raro.
export function parseFormat(raw: string | undefined): OutputFormat {
  const value = (raw ?? "pretty").toLowerCase();
  if (value === "json" || value === "csv" || value === "pretty") {
    return value;
  }
  return "pretty";
}
