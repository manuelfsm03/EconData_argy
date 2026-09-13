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
 * Sin tarjetas de fondo gris plano: cada bloque lleva un emoji grande y
 * translúcido flotando lento detrás del texto (mismo lenguaje de movimiento
 * que HeroGlowBackdrop), en vez de un ícono chico estático — le da vida sin
 * sumar un GIF externo (pesado, difícil de conseguir genuino para cada
 * función, y no combina con el resto de la app, que es 100% vectorial).
 */

import { DATA_CARD_CATALOG } from "@/lib/card-catalog"

const FUNCIONES = [
  { emoji: "📊", titulo: "Mi Pizarra", texto: "Un canvas personal: armás tu propio tablero con las tarjetas de datos que te importan, en el orden que quieras." },
  { emoji: "🗂️", titulo: "Biblioteca de datos", texto: `${DATA_CARD_CATALOG.length} tarjetas económicas y financieras listas para agregar, organizadas por tema y categoría.` },
  { emoji: "📅", titulo: "Calendario", texto: "Pagos y vencimientos relevantes para seguir de cerca, en una sola vista cronológica." },
  { emoji: "🏦", titulo: "Bonos", texto: "Calculadora y herramientas para analizar renta fija argentina." },
  { emoji: "🌾", titulo: "Agro", texto: "Producción y rendimientos agrícolas, con series históricas de clima por región." },
  { emoji: "💬", titulo: "Foro", texto: "Conversaciones y debate alrededor de los datos, entre quienes los usan." },
  { emoji: "🔌", titulo: "Conectar", texto: "Exponemos los datos por MCP (Model Context Protocol) para que tu propio agente de IA los consulte directo." },
]

export function HeroProductGrid() {
  return (
    <div id="producto" className="mt-16 scroll-mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">Qué podés hacer en La Pizarra</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FUNCIONES.map(({ emoji, titulo, texto }, i) => (
          <div
            key={titulo}
            className="relative overflow-hidden rounded-lg border border-[var(--border)] p-4"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-2 select-none text-5xl opacity-25"
              style={{ animation: `hero-drift-soft ${14 + i * 2}s ease-in-out ${-i * 3}s infinite alternate` }}
            >
              {emoji}
            </span>
            <div className="relative max-w-[80%] text-sm font-semibold text-[var(--text)]">{titulo}</div>
            <p className="relative mt-1 max-w-[80%] text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
