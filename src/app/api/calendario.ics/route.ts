/**
 * GET /api/calendario.ics — feed iCalendar suscribible del Calendario Financiero.
 *
 * Uso típico:
 *   - Google Calendar → "Agregar por URL" → https://.../api/calendario.ics
 *   - Outlook → "Suscribirse a un calendario de Internet" → misma URL.
 *   - Descarga directa → cliente pide /api/calendario.ics?descarga=1
 *
 * Query params (opcionales):
 *   - categoria=<slug,slug>   filtra el feed a esas categorías.
 *   - solo_alta=1             solo importancia alta.
 *   - descarga=1              fuerza Content-Disposition attachment.
 *
 * Content-Type: text/calendar; charset=utf-8 (RFC 5545).
 */

import { NextRequest } from "next/server"
import { cargarCatalogo } from "@/server/calendario-loader"
import {
  filtrarEventos,
  ordenarPorFecha,
  type CategoriaEvento,
} from "@/lib/calendario-financiero"
import { generarICS } from "@/lib/calendario-ics"

export const revalidate = 86400  // 1 día

const CATEGORIAS_VALIDAS: CategoriaEvento[] = [
  "licitacion", "publicacion_datos", "vencimiento_tesoro", "earnings", "feriado", "otro",
]

function parseCategorias(raw: string | null): CategoriaEvento[] | undefined {
  if (!raw) return undefined
  const partes = raw.split(",").map((s) => s.trim()).filter(Boolean)
  const cats = partes.filter((p): p is CategoriaEvento =>
    (CATEGORIAS_VALIDAS as string[]).includes(p),
  )
  return cats.length > 0 ? cats : undefined
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const categoria = parseCategorias(searchParams.get("categoria"))
  const soloAlta = searchParams.get("solo_alta") === "1"
  const descarga = searchParams.get("descarga") === "1"

  const catalogo = await cargarCatalogo()
  const eventos = ordenarPorFecha(
    filtrarEventos(catalogo.eventos, { categoria, soloAlta }),
  )
  const ics = generarICS(eventos, {
    nombreCalendario: "Calendario financiero AR — EconData",
    descripcionCalendario:
      "Licitaciones, publicaciones INDEC/BCRA/AFIP, vencimientos de deuda y feriados. Actualizado " +
      (catalogo.actualizado || "manualmente") + ". Fuente: catálogo curado de EconData.",
  })

  const headers: Record<string, string> = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  }
  if (descarga) {
    headers["Content-Disposition"] = 'attachment; filename="calendario-financiero-ar.ics"'
  }

  return new Response(ics, { status: 200, headers })
}
