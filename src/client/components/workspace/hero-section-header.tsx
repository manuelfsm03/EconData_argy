"use client"

/**
 * HeroSectionHeader — tag + título + línea divisora + subtítulo opcional.
 * Mismo patrón que .section-tag/.section-title/.divider-line/.section-subtitle
 * en jup-fce-web (se repite en Hero, QuienesSomos, Propuestas, Recursos...):
 * un tag chico en mayúscula con borde inferior, el título, una línea de
 * gradiente corta, y opcionalmente una bajada. Acá con los tokens de La
 * Pizarra en vez de los colores de JUP.
 */
export function HeroSectionHeader({ tag, title, subtitle }: { tag: string; title: string; subtitle?: string }) {
  return (
    <div>
      <span className="inline-block border-b border-[var(--amber)] pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--amber)]">
        {tag}
      </span>
      <h2 className="mt-3 text-xl font-bold text-[var(--text)] md:text-2xl">{title}</h2>
      <div className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-[var(--amber)] to-[var(--sky)]" />
      {subtitle && <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-dim)]">{subtitle}</p>}
    </div>
  )
}
