"use client"

import Image from "next/image"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { HeroFaqDrawer } from "./hero-faq-drawer"
import { HeroNarrative } from "./hero-narrative"
import { HeroProductStory } from "./hero-product-story"
import { LandingAmbient } from "./landing-ambient"
import { HeroPublico } from "./hero-publico"
import { HeroPrimerosPasos } from "./hero-primeros-pasos"
import { InstituteCarousel } from "./institute-carousel"
import { Reveal } from "./hero-reveal"
import { SiteFooter } from "./site-footer"
import "@/client/styles/hero-landing.css"

export function HeroLanding({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="landing-page">
      <HeroFaqDrawer />
      <LandingAmbient />

      <header className="landing-header">
        <a href="#inicio" className="landing-header-brand" aria-label="La Pizarra, inicio">
          <Image src="/logo.png" alt="" width={42} height={34} priority />
          <span>La Pizarra</span>
        </a>
        <nav aria-label="Navegación de la presentación">
          <a href="#producto">Producto</a>
          <a href="#para-quien">Para quién</a>
          <a href="#fuentes">Fuentes</a>
        </nav>
        <button type="button" onClick={onEnter} className="landing-header-enter">
          <span>Entrar al panel</span>
          <i aria-hidden="true"><ArrowUpRight size={16} /></i>
        </button>
      </header>

      <div id="inicio">
        <HeroNarrative />
      </div>

      <Reveal className="landing-reveal-shell">
        <HeroProductStory />
      </Reveal>

      <Reveal className="landing-reveal-shell">
        <section className="landing-use" id="para-quien" aria-labelledby="landing-use-title">
          <div className="landing-use-heading">
            <span>Una herramienta abierta</span>
            <h2 id="landing-use-title">Una entrada simple.<br /><em>Distintas formas de mirar.</em></h2>
          </div>
          <div className="landing-use-grid">
            <HeroPublico />
            <HeroPrimerosPasos />
          </div>
        </section>
      </Reveal>

      <Reveal className="landing-reveal-shell">
        <section className="landing-sources" id="fuentes" aria-labelledby="landing-sources-title">
          <div className="landing-sources-heading">
            <span>Fuentes</span>
            <h2 id="landing-sources-title">De dónde vienen<br />los datos.</h2>
            <p>La Pizarra reúne información pública sin borrar su procedencia.</p>
          </div>
          <InstituteCarousel />
        </section>
      </Reveal>

      <Reveal className="landing-reveal-shell">
        <section className="landing-final" aria-labelledby="landing-final-title">
          <span>Tu próxima lectura empieza acá</span>
          <h2 id="landing-final-title">Menos portales.<br />Más contexto.</h2>
          <button type="button" onClick={onEnter}>
            <span>Entrar a La Pizarra</span>
            <ArrowRight size={21} />
          </button>
        </section>
      </Reveal>

      <SiteFooter />
    </main>
  )
}
