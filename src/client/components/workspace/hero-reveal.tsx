"use client"

import type { ReactNode } from "react"
import { useReveal } from "@/client/hooks/use-reveal"

/** Envoltorio de transición de entrada para secciones del hero (fade + slide-up al entrar en viewport). */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
    >
      {children}
    </div>
  )
}
