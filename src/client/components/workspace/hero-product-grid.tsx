"use client"

/**
 * HeroProductGrid — qué podés hacer adentro de La Pizarra.
 *
 * Mismos nombres y descripciones que los ítems reales de navegación del
 * panel (app-shell.tsx NAV_ITEMS) — no es copy de marketing inventado, es
 * el mapa real del producto. El conteo de tarjetas sale de DATA_CARD_CATALOG
 * (misma fuente que usa el propio panel), así que si el catálogo crece este
 * número se actualiza solo.
 *
 * Diseño: tarjeta con número grande en marca de agua + barra de acento
 * arriba + tag de categoría abajo. No es un patrón nuevo inventado acá —
 * es el mismo que ya usa Juan en jup-fce-web (sección Propuestas: número
 * gigante en baja opacidad, título, descripción, pill de categoría, barra
 * de gradiente arriba, hover con elevación). Se descartaron antes emojis
 * flotantes y un fondo abstracto animado — ninguno convenció.
 */

import { DATA_CARD_CATALOG } from "@/lib/card-catalog"
import { HeroSectionHeader } from "./hero-section-header"

const FUNCIONES = [
  { categoria: "Panel", titulo: "Mi Pizarra", texto: "Un canvas personal: armás tu propio tablero con las tarjetas de datos que te importan, en el orden que quieras." },
  { categoria: "Datos", titulo: "Biblioteca de datos", texto: `${DATA_CARD_CATALOG.length} tarjetas económicas y financieras listas para agregar, organizadas por tema y categoría.` },
  { categoria: "Datos", titulo: "Calendario", texto: "Pagos y vencimientos relevantes para seguir de cerca, en una sola vista cronológica." },
  { categoria: "Mercado", titulo: "Bonos", texto: "Calculadora y herramientas para analizar renta fija argentina." },
  { categoria: "Mercado", titulo: "Agro", texto: "Producción y rendimientos agrícolas, con series históricas de clima por región." },
  { categoria: "Comunidad", titulo: "Foro", texto: "Conversaciones y debate alrededor de los datos, entre quienes los usan." },
  { categoria: "Integraciones", titulo: "Conectar", texto: "Exponemos los datos por MCP (Model Context Protocol) para que tu propio agente de IA los consulte directo." },
]

export function HeroProductGrid() {
  return (
    <div id="producto" className="mt-16 scroll-mt-8">
      <HeroSectionHeader tag="Producto" title="Qué podés hacer en La Pizarra" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {FUNCIONES.map(({ categoria, titulo, texto }, i) => (
          <div
            key={titulo}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--amber)]"
          >
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--amber)] to-[var(--sky)]" />
            <div className="font-mono text-4xl leading-none text-[var(--text)] opacity-[0.08]">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-1.5 text-sm font-semibold text-[var(--text)]">{titulo}</div>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
            <span className="mt-4 inline-block w-fit rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--text-mute)] transition-colors group-hover:border-[var(--amber)]/40 group-hover:text-[var(--amber)]">
              {categoria}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
