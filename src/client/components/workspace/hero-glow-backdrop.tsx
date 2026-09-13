"use client"

/**
 * HeroGlowBackdrop — puntos de luz difusos que derivan lentamente detrás del
 * hero. CSS puro (sin librería de partículas): mismo lenguaje visual que los
 * glow layers del mapa de lluvias regional (feGaussianBlur), aplicado acá
 * como ambientación estática de fondo. Decorativo: aria-hidden, no
 * interactivo, no compite con el contenido (z-index por debajo, opacidad baja).
 *
 * El keyframe "hero-drift" que usa vive en globals.css (regla compartida):
 * HeroProductGrid lo reutiliza para los emojis flotantes de cada tarjeta.
 */
const PUNTOS = [
  { top: "8%", left: "12%", size: 260, color: "var(--amber)", delay: "0s", duration: "22s" },
  { top: "55%", left: "78%", size: 320, color: "var(--sky)", delay: "-6s", duration: "26s" },
  { top: "75%", left: "20%", size: 220, color: "var(--amber)", delay: "-12s", duration: "19s" },
  { top: "15%", left: "70%", size: 180, color: "var(--sky)", delay: "-3s", duration: "24s" },
]

export function HeroGlowBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {PUNTOS.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-[0.08] blur-3xl"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `hero-drift ${p.duration} ease-in-out ${p.delay} infinite alternate`,
          }}
        />
      ))}
    </div>
  )
}
