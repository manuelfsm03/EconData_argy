/**
 * Outstanding de bonos soberanos argentinos (miles de millones USD).
 *
 * Fuente: Ministerio de Economía — Presentaciones al SEC + reportes de deuda.
 * Actualizar cuando haya buybacks, canjes o reaperturas.
 *
 * Se centraliza acá para que tanto el motor del riesgo país
 * (`src/app/api/riesgo-pais/route.ts`) como la UI de bonos
 * (`src/client/components/dashboard/tab-bonos.tsx`) lean el mismo número.
 */
export const BOND_OUTSTANDING: Record<string, number> = {
  GD35: 14.79,
  GD30: 12.65,
  AL30: 12.15,
  GD41: 11.15,
  AL35: 10.27,
  GD46: 8.04,
  AL29: 7.61,
  AE38: 4.57,
  GD38: 6.0,
  AO27: 1.5,
  AO28: 2.0,
  AO29: 2.5,
}
