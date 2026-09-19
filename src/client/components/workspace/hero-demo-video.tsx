"use client"

import { useEffect, useRef, useState } from "react"

/**
 * HeroDemoVideo — demo corta en loop de una sección real del panel.
 *
 * Son grabaciones de la app misma (Playwright contra el dev server, sin la
 * barra lateral), no mockups: MP4 H.264 de ~100-150 KB en /public/demos.
 * MP4 y no GIF porque pesa 10-20 veces menos a igual calidad.
 *
 * Solo se reproduce mientras la tarjeta está a la vista (IntersectionObserver)
 * y con preload="none", así la landing no descarga 6 videos de entrada. Con
 * prefers-reduced-motion queda la imagen fija (poster) y no reproduce.
 */
export function HeroDemoVideo({ nombre, alt }: { nombre: string; alt: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [reducido, setReducido] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducido(mq.matches)
    const onChange = () => setReducido(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    const video = ref.current
    if (!video || reducido) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.35 },
    )
    obs.observe(video)
    return () => obs.disconnect()
  }, [reducido])

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)]">
      <video
        ref={ref}
        className="block aspect-[13/10] w-full object-cover object-top"
        poster={`/demos/${nombre}.jpg`}
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt}
      >
        <source src={`/demos/${nombre}.mp4`} type="video/mp4" />
      </video>
    </div>
  )
}
