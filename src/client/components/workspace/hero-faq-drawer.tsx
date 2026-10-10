"use client"

/**
 * HeroFaqDrawer — panel lateral con las Preguntas Frecuentes, fuera del
 * scroll principal del hero. Se abre con el botón hamburguesa (fijo,
 * esquina superior derecha) o llegando con el hash #faq en la URL (así el
 * link "Preguntas frecuentes" del footer sigue funcionando).
 */

import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import { HeroFAQ } from "./hero-faq"

export function HeroFaqDrawer() {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    const chequearHash = () => {
      if (window.location.hash === "#faq") setAbierto(true)
    }
    chequearHash()
    window.addEventListener("hashchange", chequearHash)
    return () => window.removeEventListener("hashchange", chequearHash)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [abierto])

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label="Abrir preguntas frecuentes"
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-dim)] shadow-sm transition hover:text-[var(--amber)]"
      >
        <Menu size={18} />
      </button>

      <div
        aria-hidden={!abierto}
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${abierto ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setAbierto(false)}
        />
        <div
          id="faq"
          className={`absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-[var(--bg)] p-6 shadow-2xl transition-transform duration-300 ${abierto ? "translate-x-0" : "translate-x-full"}`}
        >
          <button
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--amber)]"
          >
            <X size={18} />
          </button>
          <div className="mt-2">
            <HeroFAQ />
          </div>
        </div>
      </div>
    </>
  )
}
