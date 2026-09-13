"use client"

/**
 * HeroLanding — landing completa antes de entrar al panel funcional.
 *
 * No es un solo bloque: se recorre en secciones, como brajafinanzas.com o
 * la página del proyecto MIT (varias secciones apiladas, cada una con su
 * propio propósito) — acá: hero, principios, producto (funciones reales del
 * panel), fuentes de datos, CTA final y footer. Cada sección entra con una
 * transición de fade+slide al hacer scroll (Reveal) y el hero tiene un fondo
 * de glow difuso en movimiento (HeroGlowBackdrop), mismo lenguaje visual que
 * el mapa de lluvias regional. Las Preguntas Frecuentes viven en un panel
 * lateral aparte (HeroFaqDrawer), no en el scroll principal — se abre con el
 * botón hamburguesa o con el link "Preguntas frecuentes" del footer.
 *
 * Contenido basado en el speech real del equipo para el 4to Encuentro
 * Interdisciplinar de Gestión de Datos (FCE UBA, ago-2026): el problema que
 * resuelve La Pizarra y los principios de diseño. La sección de producto usa
 * los mismos nombres/descripciones que NAV_ITEMS en app-shell.tsx — no hay
 * copy de marketing inventado, es el mapa real de lo que existe hoy.
 *
 * No es una ruta aparte: es un estado local en page.tsx. Entrar no navega a
 * otra URL, solo monta el AppShell — así no se rompe ningún deep-link
 * existente a "/" ni a "/?section=...".
 */

import Image from "next/image"
import { ArrowRight, Database, Landmark, Sparkles } from "lucide-react"
import { InstituteCarousel } from "./institute-carousel"
import { HeroProductGrid } from "./hero-product-grid"
import { HeroFaqDrawer } from "./hero-faq-drawer"
import { HeroGlowBackdrop } from "./hero-glow-backdrop"
import { HeroChalkboardTexture } from "./hero-chalkboard-texture"
import { Reveal } from "./hero-reveal"
import { SiteFooter } from "./site-footer"

const PRINCIPIOS = [
  { icono: Landmark, titulo: "Centralizar", texto: "Un único punto de acceso a datos que hoy están dispersos en portales distintos, con formatos y lenguajes heterogéneos." },
  { icono: Database, titulo: "Abrir", texto: "Redistribuir con la mínima fricción posible, en vez de concentrar el acceso." },
  { icono: Sparkles, titulo: "Traducir con IA", texto: "No solo mostrar los datos: explicarlos en lenguaje accesible, con trazabilidad hasta la fuente oficial." },
]

export function HeroLanding({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg)]">
      <HeroGlowBackdrop />
      <HeroChalkboardTexture />
      <HeroFaqDrawer />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={44} height={37} className="h-10 w-11 object-contain" />
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Canvas de datos</span>
        </div>

        <h1
          className="chalk-typewriter mt-6 text-5xl font-bold leading-tight text-[var(--text)] md:text-6xl"
          style={{ fontFamily: "var(--font-chalk)" }}
        >
          La Pizarra
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--text-dim)]">
          Una solución a la complejidad de datos económicos con IA.
        </p>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-mute)]">
          La información económica argentina es pública, pero está dispersa en múltiples fuentes con
          formatos y lenguaje heterogéneos. Esa dispersión tiene un costo real: el analista puede cruzar
          fuentes, la mayoría no tiene tiempo ni entrenamiento para hacerlo. La Pizarra nace de ese
          problema — proyecto de un grupo de estudiantes y profesionales de Ciencias Económicas (UBA),
          presentado en el 4to Encuentro Interdisciplinar de Gestión de Datos en Organizaciones.
        </p>

        <Reveal className="mt-10 grid gap-4 sm:grid-cols-3">
          {PRINCIPIOS.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
              <Icono size={18} className="text-[var(--amber)]" />
              <div className="mt-2 text-sm font-semibold text-[var(--text)]">{titulo}</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{texto}</p>
            </div>
          ))}
        </Reveal>

        <button
          onClick={onEnter}
          className="mt-10 flex w-fit items-center gap-2 rounded-lg bg-[var(--amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90"
        >
          Entrar al panel
          <ArrowRight size={16} />
        </button>

        <Reveal>
          <HeroProductGrid />
        </Reveal>

        <Reveal className="mt-16">
          <div className="text-xs uppercase tracking-wide text-[var(--text-dim)]">De dónde vienen los datos</div>
          <div className="mt-3">
            <InstituteCarousel />
          </div>
        </Reveal>

        <Reveal className="mt-16 flex flex-col items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">¿Listo para ver tus datos ordenados?</div>
            <p className="mt-1 text-xs text-[var(--text-dim)]">Es gratis y no necesitás crear una cuenta para empezar.</p>
          </div>
          <button
            onClick={onEnter}
            className="flex w-fit shrink-0 items-center gap-2 rounded-lg bg-[var(--amber)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90"
          >
            Entrar al panel
            <ArrowRight size={16} />
          </button>
        </Reveal>
      </div>

      <SiteFooter />
    </div>
  )
}
