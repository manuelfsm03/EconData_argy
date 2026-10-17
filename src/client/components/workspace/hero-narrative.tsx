"use client"

import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react"
import { ArrowDown } from "lucide-react"

const PRINCIPLES = [
  { title: "Centralizar", copy: "Fuentes dispersas, en un mismo lugar." },
  { title: "Abrir", copy: "Acceso público, simple y trazable." },
  { title: "Traducir con IA", copy: "Datos complejos, explicados en contexto." },
]

export function HeroNarrative() {
  const scrollToProduct = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById("producto")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const movePrinciple = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    event.currentTarget.style.setProperty("--card-rx", `${(-y * 5).toFixed(2)}deg`)
    event.currentTarget.style.setProperty("--card-ry", `${(x * 7).toFixed(2)}deg`)
    event.currentTarget.style.setProperty("--card-light-x", `${((x + 0.5) * 100).toFixed(1)}%`)
    event.currentTarget.style.setProperty("--card-light-y", `${((y + 0.5) * 100).toFixed(1)}%`)
  }

  const resetPrinciple = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--card-rx", "0deg")
    event.currentTarget.style.setProperty("--card-ry", "0deg")
    event.currentTarget.style.setProperty("--card-light-x", "50%")
    event.currentTarget.style.setProperty("--card-light-y", "50%")
  }

  return (
    <section className="landing-narrative" aria-labelledby="landing-title">
      <div className="landing-narrative-sticky">
        <div className="landing-hero-copy">
          <span className="landing-hero-kicker">Datos para entender Argentina</span>
          <h1 id="landing-title" className="landing-wordmark">
            <span>La Pizarra</span><b aria-hidden="true">.</b><i aria-hidden="true" />
          </h1>
          <p className="landing-hero-promise">
            <span>Datos económicos complejos,</span>
            <em> ordenados y explicados con IA.</em>
          </p>
        </div>

        <svg className="landing-principle-branches" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M500 8V46C500 76 160 82 160 128" />
          <path d="M500 8V128" />
          <path d="M500 8V46C500 76 840 82 840 128" />
          <circle className="landing-branch-end" cx="160" cy="128" r="3.5" />
          <circle className="landing-branch-end" cx="500" cy="128" r="3.5" />
          <circle className="landing-branch-end" cx="840" cy="128" r="3.5" />
          <circle className="landing-branch-signal" r="2.8"><animateMotion dur="7.4s" repeatCount="indefinite" path="M500 8V46C500 76 160 82 160 128" /></circle>
          <circle className="landing-branch-signal" r="2.8"><animateMotion dur="6.7s" begin="-2.8s" repeatCount="indefinite" path="M500 8V128" /></circle>
          <circle className="landing-branch-signal" r="2.8"><animateMotion dur="7.8s" begin="-4.6s" repeatCount="indefinite" path="M500 8V46C500 76 840 82 840 128" /></circle>
        </svg>

        <div className="landing-principles" aria-label="Principios de La Pizarra">
          {PRINCIPLES.map((principle, index) => (
            <article
              key={principle.title}
              className={`landing-principle landing-principle--${index + 1}`}
              onPointerMove={movePrinciple}
              onPointerLeave={resetPrinciple}
            >
              <div className="landing-principle-surface">
                <strong>{principle.title}</strong>
                <small>{principle.copy}</small>
              </div>
              <PrincipleMotion index={index} />
            </article>
          ))}
        </div>

        <a href="#producto" className="landing-scroll-cue" onClick={scrollToProduct}>
          <span className="sr-only">Descubrí qué podés hacer en La Pizarra</span>
          <ArrowDown size={24} />
        </a>
      </div>
    </section>
  )
}

function PrincipleMotion({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg className="landing-principle-motion" viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M232 24H154C110 24 108 75 18 75" />
        <path d="M232 75H18" />
        <path d="M232 126H154C110 126 108 75 18 75" />
        <circle className="landing-principle-port" cx="18" cy="75" r="5" />
        <circle r="2.4"><animateMotion dur="4.8s" repeatCount="indefinite" path="M232 24H154C110 24 108 75 18 75" /></circle>
        <circle r="2.4"><animateMotion dur="5.7s" begin="-2.4s" repeatCount="indefinite" path="M232 75H18" /></circle>
        <circle r="2.4"><animateMotion dur="5.2s" begin="-3.1s" repeatCount="indefinite" path="M232 126H154C110 126 108 75 18 75" /></circle>
      </svg>
    )
  }

  if (index === 1) {
    return (
      <svg className="landing-principle-motion" viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d="M18 75C83 75 106 28 232 24" />
        <path d="M18 75H232" />
        <path d="M18 75C83 75 106 122 232 126" />
        <circle className="landing-principle-port" cx="18" cy="75" r="5" />
        <circle r="2.4"><animateMotion dur="5.3s" repeatCount="indefinite" path="M18 75C83 75 106 28 232 24" /></circle>
        <circle r="2.4"><animateMotion dur="4.6s" begin="-1.8s" repeatCount="indefinite" path="M18 75H232" /></circle>
        <circle r="2.4"><animateMotion dur="6s" begin="-3.5s" repeatCount="indefinite" path="M18 75C83 75 106 122 232 126" /></circle>
      </svg>
    )
  }

  return (
    <svg className="landing-principle-motion" viewBox="0 0 240 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="M18 75C66 75 82 28 120 28C158 28 164 126 232 126" />
      <path d="M18 75H232" />
      <path d="M18 75C66 75 82 122 120 122C158 122 164 24 232 24" />
      <circle className="landing-principle-port" cx="18" cy="75" r="5" />
      <circle r="2.4"><animateMotion dur="5.6s" repeatCount="indefinite" path="M18 75C66 75 82 28 120 28C158 28 164 126 232 126" /></circle>
      <circle r="2.4"><animateMotion dur="4.9s" begin="-2.2s" repeatCount="indefinite" path="M18 75H232" /></circle>
      <circle r="2.4"><animateMotion dur="6.2s" begin="-4s" repeatCount="indefinite" path="M18 75C66 75 82 122 120 122C158 122 164 24 232 24" /></circle>
    </svg>
  )
}
