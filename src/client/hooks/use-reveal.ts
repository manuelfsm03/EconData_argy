"use client"

import { useEffect, useRef, useState } from "react"

/**
 * useReveal — true la primera vez que el elemento referenciado entra en
 * viewport. Una sola vez (no se re-oculta al scrollear para arriba): es una
 * transición de entrada, no un efecto de scroll-jacking.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, visible }
}
