"use client"

import type { ReactNode } from "react"

/**
 * HeroFadeRise — entrada escalonada al montar (no al hacer scroll: eso es
 * Reveal). Mismo recurso que H2HeroV2.js del proyecto MIT (fade-rise con
 * delay por elemento) para el contenido del hero que ya está a la vista al
 * cargar la página — el título, la bajada, los principios, el CTA.
 */
export function HeroFadeRise({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`hero-fade-rise ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}
