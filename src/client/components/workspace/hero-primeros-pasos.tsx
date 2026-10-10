"use client"

/**
 * HeroPrimerosPasos — el mini tutorial que el equipo pidió meter en el hero
 * (reunión 2026-09-19): que antes de entrar se entienda cómo se usa, y que
 * quede claro que se puede entrar sin crear cuenta.
 *
 * Los tres pasos describen el flujo real de hoy: el panel es libre, las
 * tarjetas se agregan desde la Biblioteca y el MCP ya está publicado. La
 * cuenta todavía no existe (USERS_ENABLED está apagado), así que se nombra
 * como lo que da más adelante, no como algo disponible.
 */

import { HeroSectionHeader } from "./hero-section-header"

const PASOS = [
  {
    titulo: "Entrá sin cuenta",
    texto: "El panel es de acceso libre: no te pedimos registro ni datos personales para empezar a mirar.",
  },
  {
    titulo: "Armá tu pizarra",
    texto: "Agregá desde la Biblioteca las tarjetas que te interesen y ordenalas como quieras. Queda guardada en tu navegador.",
  },
  {
    titulo: "Llevátela a tu agente",
    texto: "Si usás Claude, Codex u otro cliente con MCP, podés consultar los mismos datos desde ahí sin API key.",
  },
]

export function HeroPrimerosPasos() {
  return (
    <div className="mt-16">
      <HeroSectionHeader tag="Cómo se usa" title="Empezar lleva un minuto" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PASOS.map(({ titulo, texto }, i) => (
          <div key={titulo} className="relative rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4 pl-12">
            <span className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--amber)] font-mono text-[11px] text-[var(--amber)]">
              {i + 1}
            </span>
            <div className="text-sm font-semibold text-[var(--text)]">{titulo}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
