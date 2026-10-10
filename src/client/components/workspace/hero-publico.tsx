"use client"

/**
 * HeroPublico — a quién está dirigida La Pizarra.
 *
 * Pedido en la reunión del equipo (2026-09-19): el hero tiene que decir a
 * quién va dirigido, sin acotar el público — que cada uno se auto-seleccione.
 * Los tres perfiles son los que nombró el equipo: alguien sin formación
 * técnica, estudiantes, y gente que ya trabaja en el rubro.
 */

import { HeroSectionHeader } from "./hero-section-header"

const PERFILES = [
  {
    titulo: "Si no sos del palo",
    texto: "Los datos vienen explicados en castellano, con el contexto necesario para entender qué significan. No hace falta saber leer un balance.",
  },
  {
    titulo: "Si estudiás economía",
    texto: "Series oficiales listas para mirar y comparar, con la fuente y la fecha de cada dato a la vista para citarlas en un trabajo.",
  },
  {
    titulo: "Si ya trabajás con esto",
    texto: "Todo en un solo lugar en vez de diez portales, y la posibilidad de consultarlo desde tu propio agente de IA por MCP.",
  },
]

export function HeroPublico() {
  return (
    <div className="mt-16">
      <HeroSectionHeader tag="Para quién" title="A quién le sirve" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PERFILES.map(({ titulo, texto }) => (
          <div key={titulo} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">{titulo}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
