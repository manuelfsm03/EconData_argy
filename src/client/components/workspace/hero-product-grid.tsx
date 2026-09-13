"use client"

/**
 * HeroProductGrid — qué podés hacer adentro de La Pizarra.
 *
 * Mismos nombres y descripciones que los ítems reales de navegación del
 * panel (app-shell.tsx NAV_ITEMS) — no es copy de marketing inventado, es
 * el mapa real del producto. El conteo de tarjetas sale de DATA_CARD_CATALOG
 * (misma fuente que usa el propio panel), así que si el catálogo crece este
 * número se actualiza solo.
 */

import { CalendarDays, Cable, Database, LayoutDashboard, Landmark, MessageSquareText, Sprout } from "lucide-react"
import { DATA_CARD_CATALOG } from "@/lib/card-catalog"

const FUNCIONES = [
  { icono: LayoutDashboard, titulo: "Mi Pizarra", texto: "Un canvas personal: armás tu propio tablero con las tarjetas de datos que te importan, en el orden que quieras." },
  { icono: Database, titulo: "Biblioteca de datos", texto: `${DATA_CARD_CATALOG.length} tarjetas económicas y financieras listas para agregar, organizadas por tema y categoría.` },
  { icono: CalendarDays, titulo: "Calendario", texto: "Pagos y vencimientos relevantes para seguir de cerca, en una sola vista cronológica." },
  { icono: Landmark, titulo: "Bonos", texto: "Calculadora y herramientas para analizar renta fija argentina." },
  { icono: Sprout, titulo: "Agro", texto: "Producción y rendimientos agrícolas, con series históricas de clima por región." },
  { icono: MessageSquareText, titulo: "Foro", texto: "Conversaciones y debate alrededor de los datos, entre quienes los usan." },
  { icono: Cable, titulo: "Conectar", texto: "Exponemos los datos por MCP (Model Context Protocol) para que tu propio agente de IA los consulte directo." },
]

export function HeroProductGrid() {
  return (
    <div id="producto" className="mt-16 scroll-mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">Qué podés hacer en La Pizarra</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FUNCIONES.map(({ icono: Icono, titulo, texto }) => (
          <div key={titulo} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <Icono size={18} className="text-[var(--amber)]" />
            <div className="mt-2 text-sm font-semibold text-[var(--text)]">{titulo}</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
