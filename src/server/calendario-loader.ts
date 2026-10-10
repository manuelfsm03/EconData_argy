/**
 * Loader server-side del catálogo del calendario.
 *
 * Lee public/data/calendario-eventos.json desde disco (una vez por proceso).
 * Cachea en memoria — el JSON es estático y no cambia sin redeploy.
 */

import { promises as fs } from "fs"
import path from "path"
import { parseCatalogo, type CatalogoCalendario } from "@/lib/calendario-financiero"

let cache: CatalogoCalendario | null = null

export async function cargarCatalogo(): Promise<CatalogoCalendario> {
  if (cache) return cache
  const rutaJson = path.join(process.cwd(), "public", "data", "calendario-eventos.json")
  const raw = await fs.readFile(rutaJson, "utf-8")
  const parsed = parseCatalogo(JSON.parse(raw))
  cache = parsed
  return parsed
}
